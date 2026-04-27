import base64
import io
import json
import mimetypes
import os
import re
from datetime import datetime, timedelta
from typing import Any

import anthropic
import pdfplumber

from services.claude import enrich_facture_metier


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


def _extract_with_claude(text: str, filename: str) -> dict[str, Any] | None:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    try:
        client = anthropic.Anthropic(api_key=api_key)
        prompt = f"""Tu es un expert-comptable marocain. Extrais les informations de cette facture et retourne UNIQUEMENT un objet JSON valide, sans texte avant ou après.

Champs attendus :
- fournisseur : nom du fournisseur/émetteur (string ou null)
- num_facture : numéro de facture (string ou null)
- date_facture : date au format YYYY-MM-DD (string ou null)
- date_echeance : date d'échéance au format YYYY-MM-DD (string ou null)
- montant_ht : montant hors taxes en nombre décimal (number ou null)
- tva : montant de la TVA en nombre décimal (number ou null)
- montant_ttc : montant toutes taxes comprises en nombre décimal (number ou null)
- line_items : liste des lignes [{{"description": "", "quantity": null, "unit_price": null, "amount": null}}]

Texte de la facture :
{text}

JSON:"""

        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = re.sub(r"^```[a-z]*\n?", "", raw)
            raw = re.sub(r"\n?```$", "", raw)
        data = json.loads(raw)
        return {
            "fournisseur": data.get("fournisseur") or "",
            "num_facture": data.get("num_facture") or "",
            "date_facture": _normalise_date(data.get("date_facture")),
            "date_echeance": _normalise_date(data.get("date_echeance")),
            "montant_ht": _to_float(data.get("montant_ht")),
            "tva": _to_float(data.get("tva")),
            "montant_ttc": _to_float(data.get("montant_ttc")),
            "line_items": data.get("line_items") or [],
            "confiance_ocr": 0.88,
            "texte_source": text[:6000],
        }
    except Exception:
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
        "date_echeance": (today + timedelta(days=30)).isoformat(),
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


def extract_facture(filepath: str, filename: str) -> dict[str, Any]:
    with open(filepath, "rb") as handle:
        file_bytes = handle.read()

    mime_type = _guess_mime_type(filename)

    if mime_type == "application/pdf":
        text = _extract_text_from_pdf(file_bytes)
        if text.strip():
            invoice_data = _extract_with_claude(text, filename)
            if invoice_data:
                provider = "claude_haiku"
            else:
                invoice_data = _fallback_extract_facture(filename, file_bytes)
                provider = "fallback"
        else:
            invoice_data = _fallback_extract_facture(filename, file_bytes)
            provider = "fallback"
    else:
        invoice_data = _fallback_extract_facture(filename, file_bytes)
        provider = "fallback"

    invoice_data = _ensure_totals(invoice_data)
    enriched = enrich_facture_metier(invoice_data)

    response = {
        **invoice_data,
        **enriched,
        "source_ai": provider,
        "document_base64_preview": base64.b64encode(file_bytes[:256]).decode("ascii"),
    }
    response["date_facture"] = _normalise_date(response.get("date_facture")) or datetime.utcnow().date().isoformat()
    if not response.get("date_echeance"):
        response["date_echeance"] = (
            datetime.strptime(response["date_facture"], "%Y-%m-%d").date() + timedelta(days=30)
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
            "montant_ht": response.get("montant_ht"),
            "tva": response.get("tva"),
            "montant_ttc": response.get("montant_ttc"),
            "line_items": response.get("line_items", []),
        },
        ensure_ascii=True,
    )
    return response
