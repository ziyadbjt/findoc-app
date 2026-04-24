import mimetypes
import os
import re
from datetime import datetime
from typing import Any

from services.document_ai import (
    DEFAULT_LOCATION,
    _entity_value,
    _normalise_date,
    _run_processor,
    _safe_confidence,
    _text_anchor_to_string,
    _to_float,
)


def _guess_mime_type(filename: str) -> str:
    mime_type, _ = mimetypes.guess_type(filename)
    return mime_type or "application/pdf"


def _extract_transactions(document) -> list[dict[str, Any]]:
    transactions: list[dict[str, Any]] = []
    for entity in getattr(document, "entities", []):
        entity_type = entity.type_.lower()
        if "transaction" not in entity_type and entity_type not in {"line_item"}:
            continue
        row = {
            "date": None,
            "libelle": _entity_value(document, entity),
            "montant": None,
            "solde": None,
            "type": None,
            "confidence": _safe_confidence(entity.confidence),
        }
        for child in getattr(entity, "properties", []):
            child_type = child.type_.lower()
            value = _entity_value(document, child)
            if "date" in child_type:
                row["date"] = _normalise_date(value)
            elif any(token in child_type for token in ["description", "libelle", "narration"]):
                row["libelle"] = value
            elif any(token in child_type for token in ["amount", "montant"]):
                row["montant"] = _to_float(value)
            elif "balance" in child_type or "solde" in child_type:
                row["solde"] = _to_float(value)
            elif "debit_credit" in child_type or child_type.endswith("type"):
                row["type"] = value.lower()
        if row["montant"] is None:
            continue
        if row["type"] is None:
            row["type"] = "credit" if row["montant"] >= 0 else "debit"
        transactions.append(row)
    return transactions


def _fallback_transactions(file_bytes: bytes) -> list[dict[str, Any]]:
    text = file_bytes.decode("utf-8", errors="ignore")
    transactions: list[dict[str, Any]] = []
    pattern = re.compile(
        r"(?P<date>\d{2}[/-]\d{2}[/-]\d{4}).{0,20}?(?P<label>[A-Za-z0-9 \-_/]{5,80}).{0,20}?"
        r"(?P<amount>-?\d[\d\s.,]+)(?:.{0,10}(?P<balance>-?\d[\d\s.,]+))?",
        re.MULTILINE,
    )
    for match in pattern.finditer(text):
        amount = _to_float(match.group("amount"))
        if amount is None:
            continue
        transactions.append(
            {
                "date": _normalise_date(match.group("date")),
                "libelle": " ".join(match.group("label").split()),
                "montant": amount,
                "solde": _to_float(match.group("balance")) if match.group("balance") else None,
                "type": "credit" if amount >= 0 else "debit",
                "confidence": 0.4,
            }
        )
    return transactions


def extract_bank_statement(filepath: str, filename: str) -> dict[str, Any]:
    with open(filepath, "rb") as handle:
        file_bytes = handle.read()

    mime_type = _guess_mime_type(filename)
    processor_id = os.getenv("GOOGLE_PROCESSOR_ID_BANK")
    location = os.getenv("GOOGLE_PROCESSOR_LOCATION_BANK", DEFAULT_LOCATION)

    try:
        document = _run_processor(file_bytes, mime_type, processor_id, location)
        transactions = _extract_transactions(document)
        source = "google_document_ai"
        raw_text = getattr(document, "text", "")[:12000]
    except Exception as exc:
        transactions = _fallback_transactions(file_bytes)
        source = "fallback"
        raw_text = str(exc)

    for index, row in enumerate(transactions, start=1):
        row["id"] = f"txn-{index}"
        if not row.get("date"):
            row["date"] = datetime.utcnow().date().isoformat()
        row["reference"] = re.sub(r"[^A-Z0-9]", "", (row.get("libelle") or "").upper())[:12] or f"TXN{index:03d}"

    return {"source_ai": source, "transactions": transactions, "raw_text": raw_text}
