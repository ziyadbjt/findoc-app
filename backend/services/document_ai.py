import base64
import io
import json
import logging
import mimetypes
import os
import re
from datetime import datetime, timedelta
from typing import Any

import anthropic
import pdfplumber

from services.claude import enrich_facture_metier

logger = logging.getLogger(__name__)


def _guess_mime_type(filename: str) -> str:
    mime_type, _ = mimetypes.guess_type(filename)
    return mime_type or "application/pdf"


def _normalise_date(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = value.strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y"):
        try:
            return datetime.strptime(cleaned, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return cleaned


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return round(float(value), 2)
    cleaned = str(value).strip()
    if not cleaned:
        return None
    cleaned = cleaned.replace(" ", "").replace("MAD", "").replace("DHS", "")
    cleaned = cleaned.replace(" ", "")
    if "," in cleaned and "." in cleaned:
        cleaned = cleaned.replace(".", "").replace(",", ".")
    else:
        cleaned = cleaned.replace(",", ".")
    cleaned = re.sub(r"[^0-9.\-]", "", cleaned)
    try:
        return round(float(cleaned), 2)
    except ValueError:
        return None


def _extract_text_from_pdf(file_bytes: bytes) -> str:
    try:
        pages = []
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    pages.append(text)
        return "\n".join(pages)[:8000]
    except Exception:
        return ""


def _parse_claude_json(raw: str) -> dict[str, Any]:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[a-z]*\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned)
    return json.loads(cleaned)


def _invoice_prompt(filename: str, text: str = "") -> str:
    text_hint = f"\nTexte OCR/PDF disponible:\n{text[:6000]}\n" if text else ""
    return f"""Tu es un expert-comptable marocain et tu lis directement une facture.
Analyse le document visuellement, y compris tableaux, cachets, notes, libelles et petites lignes.

Retourne UNIQUEMENT un objet JSON valide, sans texte avant ou apres.

Champs attendus:
- fournisseur: nom du fournisseur/emetteur (string ou null)
- num_facture: numero de facture (string ou null)
- date_facture: date au format YYYY-MM-DD (string ou null)
- date_echeance: date d'echeance au format YYYY-MM-DD (string ou null)
- paiement: "a_rapprocher" par defaut, sauf si un rapprochement bancaire confirme deja le paiement
- date_paiement: date du paiement au format YYYY-MM-DD si visible (string ou null)
- montant_ht: montant hors taxes en nombre decimal (number ou null)
- tva: montant TVA en nombre decimal (number ou null)
- montant_ttc: montant TTC en nombre decimal (number ou null)
- type: "achat" ou "vente" selon le sens comptable pour le dossier
- line_items: liste des lignes [{{"description": "", "quantity": null, "unit_price": null, "amount": null}}]
- exercice_rattachement: annee comptable la plus probable (number ou null)
- traitement_comptable: "exercice_courant", "charge_constatee_avance", "produit_constate_avance", "rattachement_exercice_precedent" ou "a_verifier"
- niveau_risque: "faible", "moyen" ou "eleve"
- commentaire_analyse: explication courte, surtout si le libelle mentionne un autre exercice
- texte_source: court resume des indices lus dans la facture

Important:
- Si la facture est datee N mais concerne une prestation N+1, propose charge/produit constate d'avance.
- Si elle concerne N-1, propose rattachement exercice precedent.
- Les mentions "paye", "total paye", "montant paye", "regle", "acquitte", "Mastercard" ou "Visa" sont des indices seulement.
- Ne conclus jamais que la facture est payee depuis le document seul: le paiement doit rester "a_rapprocher" tant qu'il n'est pas confirme par rapprochement bancaire.
- N'utilise pas une mention de paiement pour remplacer la date d'echeance.
- Ne devine pas un montant si tu ne le lis pas clairement: mets null.

Nom du fichier: {filename}
{text_hint}
JSON:"""


def _extract_with_claude_vision(file_bytes: bytes, filename: str, mime_type: str, text_hint: str = "") -> dict[str, Any] | None:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    if len(file_bytes) > 30 * 1024 * 1024:
        return None

    try:
        client = anthropic.Anthropic(api_key=api_key)
        document_base64 = base64.standard_b64encode(file_bytes).decode("utf-8")
        if mime_type == "application/pdf":
            media_block = {
                "type": "document",
                "source": {
                    "type": "base64",
                    "media_type": "application/pdf",
                    "data": document_base64,
                },
            }
        elif mime_type.startswith("image/"):
            media_block = {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": mime_type,
                    "data": document_base64,
                },
            }
        else:
            return None

        message = client.messages.create(
            model=os.getenv("ANTHROPIC_VISION_MODEL") or os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514"),
            max_tokens=1600,
            messages=[
                {
                    "role": "user",
                    "content": [
                        media_block,
                        {"type": "text", "text": _invoice_prompt(filename, text_hint)},
                    ],
                }
            ],
        )
        data = _parse_claude_json(message.content[0].text)
        return {
            "fournisseur": data.get("fournisseur") or "",
            "num_facture": data.get("num_facture") or "",
            "date_facture": _normalise_date(data.get("date_facture")),
            "date_echeance": _normalise_date(data.get("date_echeance")),
            "paiement": data.get("paiement") or None,
            "date_paiement": _normalise_date(data.get("date_paiement")),
            "montant_ht": _to_float(data.get("montant_ht")),
            "tva": _to_float(data.get("tva")),
            "montant_ttc": _to_float(data.get("montant_ttc")),
            "type": data.get("type") or "achat",
            "line_items": data.get("line_items") or [],
            "exercice_rattachement": data.get("exercice_rattachement"),
            "traitement_comptable": data.get("traitement_comptable"),
            "niveau_risque": data.get("niveau_risque"),
            "commentaire_analyse": data.get("commentaire_analyse"),
            "confiance_ocr": 0.92,
            "texte_source": data.get("texte_source") or text_hint[:6000],
        }
    except Exception:
        logger.exception("Claude Vision extraction failed")
        return None


def _fallback_extract_facture(filename: str, file_bytes: bytes) -> dict[str, Any]:
    text = ""
    try:
        text = file_bytes.decode("utf-8", errors="ignore")
    except Exception:
        text = ""

    amount_candidates = re.findall(r"(\d[\d\s.,]{2,})", text)
    numeric_values = []
    for candidate in amount_candidates:
        digits_only = re.sub(r"\D", "", candidate)
        if len(digits_only) < 2 or len(digits_only) > 10:
            continue
        value = _to_float(candidate)
        if value is None or value <= 0 or value > 100_000_000:
            continue
        numeric_values.append(value)
    montant_ttc = max(numeric_values) if numeric_values else 0.0
    montant_ht = round(montant_ttc / 1.2, 2) if montant_ttc else 0.0
    tva = round(montant_ttc - montant_ht, 2) if montant_ttc else 0.0
    today = datetime.utcnow().date()
    return {
        "fournisseur": os.path.splitext(filename)[0].replace("_", " ").upper(),
        "num_facture": os.path.splitext(filename)[0],
        "date_facture": today.isoformat(),
        "date_echeance": (today + timedelta(days=60)).isoformat(),
        "montant_ht": montant_ht,
        "tva": tva,
        "montant_ttc": montant_ttc,
        "line_items": [],
        "confiance_ocr": 0.35,
        "texte_source": text[:6000],
    }


def _ensure_totals(data: dict[str, Any]) -> dict[str, Any]:
    montant_ht = _to_float(data.get("montant_ht")) or 0.0
    tva = _to_float(data.get("tva"))
    montant_ttc = _to_float(data.get("montant_ttc"))

    if tva is None and montant_ttc is not None:
        tva = round(montant_ttc - montant_ht, 2)
    if montant_ttc is None:
        montant_ttc = round(montant_ht + (tva or 0.0), 2)
    if tva is None:
        tva = round(montant_ttc - montant_ht, 2)

    data["montant_ht"] = round(montant_ht, 2)
    data["tva"] = round(tva, 2)
    data["montant_ttc"] = round(montant_ttc, 2)
    return data


def extract_facture(filepath: str, filename: str, dossier_id: int | None = None) -> dict[str, Any]:
    with open(filepath, "rb") as handle:
        file_bytes = handle.read()

    mime_type = _guess_mime_type(filename)
    text = _extract_text_from_pdf(file_bytes) if mime_type == "application/pdf" else ""
    invoice_data = _extract_with_claude_vision(file_bytes, filename, mime_type, text)

    if invoice_data:
        provider = "claude_vision"
    else:
        invoice_data = _fallback_extract_facture(filename, file_bytes)
        provider = "fallback"

    invoice_data = _ensure_totals(invoice_data)
    enriched = enrich_facture_metier(invoice_data, dossier_id)

    response = {
        **invoice_data,
        **enriched,
        "source_ai": provider,
        "document_base64_preview": base64.b64encode(file_bytes[:256]).decode("ascii"),
    }
    response["date_facture"] = _normalise_date(response.get("date_facture")) or datetime.utcnow().date().isoformat()
    if str(response.get("paiement") or "").lower() in {"payee", "payée", "paye", "paid"}:
        response["commentaire_analyse"] = (
            f"{response.get('commentaire_analyse') or ''} Paiement indique par le document, a confirmer par rapprochement bancaire."
        ).strip()
    response["paiement"] = "a_rapprocher"
    if not response.get("date_echeance"):
        response["date_echeance"] = (
            datetime.strptime(response["date_facture"], "%Y-%m-%d").date() + timedelta(days=60)
        ).isoformat()
    response["confidence"] = round(
        max(float(response.get("confiance_ocr", 0.0)), float(response.get("confiance_metier", 0.0))), 3
    )
    response["ocr_payload"] = json.dumps(
        {
            "fournisseur": response.get("fournisseur"),
            "num_facture": response.get("num_facture"),
            "date_facture": response.get("date_facture"),
            "date_echeance": response.get("date_echeance"),
            "paiement": response.get("paiement"),
            "date_paiement": response.get("date_paiement"),
            "montant_ht": response.get("montant_ht"),
            "tva": response.get("tva"),
            "montant_ttc": response.get("montant_ttc"),
            "type": response.get("type"),
            "exercice_rattachement": response.get("exercice_rattachement"),
            "traitement_comptable": response.get("traitement_comptable"),
            "niveau_risque": response.get("niveau_risque"),
            "commentaire_analyse": response.get("commentaire_analyse"),
            "line_items": response.get("line_items", []),
        },
        ensure_ascii=True,
    )
    return response
