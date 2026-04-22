import base64
import json
import mimetypes
import os
import re
from datetime import datetime, timedelta
from typing import Any

from google.api_core.client_options import ClientOptions
from google.cloud import documentai

from services.claude import enrich_facture_metier


DEFAULT_LOCATION = os.getenv("GOOGLE_PROCESSOR_LOCATION", "eu")


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
    cleaned = cleaned.replace("\u00a0", "").replace("MAD", "").replace("DHS", "")
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


def _text_anchor_to_string(document: documentai.Document, text_anchor: Any) -> str:
    if not text_anchor or not getattr(text_anchor, "text_segments", None):
        return ""
    response = []
    for segment in text_anchor.text_segments:
        start = int(segment.start_index or 0)
        end = int(segment.end_index or 0)
        response.append(document.text[start:end])
    return "".join(response).strip()


def _entity_value(document: documentai.Document, entity: Any) -> str:
    return (getattr(entity, "mention_text", None) or _text_anchor_to_string(document, entity.text_anchor)).strip()


def _safe_confidence(value: Any, default: float = 0.75) -> float:
    try:
        return round(float(value), 3)
    except (TypeError, ValueError):
        return default


def _build_client(location: str) -> documentai.DocumentProcessorServiceClient:
    endpoint = f"{location}-documentai.googleapis.com"
    return documentai.DocumentProcessorServiceClient(client_options=ClientOptions(api_endpoint=endpoint))


def _run_processor(file_bytes: bytes, mime_type: str, processor_id: str, location: str) -> documentai.Document:
    project_id = os.getenv("GOOGLE_PROJECT_ID")
    if not project_id or not processor_id:
        raise ValueError("Google Document AI n'est pas configure")

    client = _build_client(location)
    name = client.processor_path(project_id, location, processor_id)
    request = documentai.ProcessRequest(
        name=name,
        raw_document=documentai.RawDocument(content=file_bytes, mime_type=mime_type),
    )
    result = client.process_document(request=request)
    return result.document


def _extract_invoice_entities(document: documentai.Document) -> dict[str, Any]:
    entity_map: dict[str, list[Any]] = {}
    for entity in document.entities:
        entity_map.setdefault(entity.type_.lower(), []).append(entity)

    def pick(*keys: str) -> Any:
        for key in keys:
            matches = entity_map.get(key.lower()) or []
            if matches:
                return matches[0]
        return None

    line_items: list[dict[str, Any]] = []
    for item in entity_map.get("line_item", []):
        row = {"description": _entity_value(document, item), "quantity": None, "unit_price": None, "amount": None}
        for child in getattr(item, "properties", []):
            child_type = child.type_.lower()
            if child_type in {"description", "line_item/description"}:
                row["description"] = _entity_value(document, child)
            elif child_type in {"quantity", "line_item/quantity"}:
                row["quantity"] = _to_float(_entity_value(document, child))
            elif child_type in {"unit_price", "line_item/unit_price", "amount"}:
                value = _to_float(_entity_value(document, child))
                if child_type.endswith("unit_price"):
                    row["unit_price"] = value
                else:
                    row["amount"] = value
        line_items.append(row)

    fournisseur = _entity_value(document, pick("supplier_name", "vendor_name", "invoice_supplier_name"))
    numero = _entity_value(document, pick("invoice_id", "invoice_number"))
    date_facture = _normalise_date(_entity_value(document, pick("invoice_date", "date")))
    date_echeance = _normalise_date(_entity_value(document, pick("due_date", "payment_due_date")))
    montant_ht = _to_float(_entity_value(document, pick("net_amount", "subtotal_amount")))
    tva = _to_float(_entity_value(document, pick("tax_amount", "total_tax_amount")))
    montant_ttc = _to_float(_entity_value(document, pick("total_amount", "amount_due")))
    confidence = max((_safe_confidence(entity.confidence) for entity in document.entities), default=0.75)

    return {
        "fournisseur": fournisseur,
        "num_facture": numero,
        "date_facture": date_facture,
        "date_echeance": date_echeance,
        "montant_ht": montant_ht,
        "tva": tva,
        "montant_ttc": montant_ttc,
        "line_items": [item for item in line_items if item.get("description") or item.get("amount")],
        "confiance_ocr": round(confidence, 3),
        "texte_source": document.text[:12000],
    }


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
    processor_id = os.getenv("GOOGLE_PROCESSOR_ID_INVOICE")
    location = os.getenv("GOOGLE_PROCESSOR_LOCATION_INVOICE", DEFAULT_LOCATION)

    try:
        document = _run_processor(file_bytes, mime_type, processor_id, location)
        invoice_data = _extract_invoice_entities(document)
        provider = "google_document_ai"
    except Exception as exc:
        invoice_data = _fallback_extract_facture(filename, file_bytes)
        invoice_data["warning"] = str(exc)
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
