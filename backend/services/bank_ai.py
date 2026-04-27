import mimetypes
import os
import re
from datetime import datetime
from typing import Any

from services.document_ai import _normalise_date, _to_float


def _guess_mime_type(filename: str) -> str:
    mime_type, _ = mimetypes.guess_type(filename)
    return mime_type or "application/pdf"



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

    transactions = _fallback_transactions(file_bytes)
    source = "fallback"
    raw_text = ""

    for index, row in enumerate(transactions, start=1):
        row["id"] = f"txn-{index}"
        if not row.get("date"):
            row["date"] = datetime.utcnow().date().isoformat()
        row["reference"] = re.sub(r"[^A-Z0-9]", "", (row.get("libelle") or "").upper())[:12] or f"TXN{index:03d}"

    return {"source_ai": source, "transactions": transactions, "raw_text": raw_text}
