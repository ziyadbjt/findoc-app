import base64
import json
import os
import xml.etree.ElementTree as ET
from anthropic import Anthropic

_client = None

def _get_client():
    global _client
    if _client is None:
        key = os.getenv("ANTHROPIC_API_KEY")
        if not key:
            raise ValueError("ANTHROPIC_API_KEY manquante dans .env")
        _client = Anthropic(api_key=key)
    return _client

_PROMPT = """Tu es un expert en lecture de documents administratifs et commerciaux marocains.
Analyse ce document et extrais les informations de la société émettrice ou destinataire principale.

Retourne UNIQUEMENT un objet JSON valide avec ces champs (utilise null si non trouvé) :
{
  "raison_sociale": "Nom légal complet",
  "forme_juridique": "SARL|SA|SARL-AU|SNC|SCS|GIE|Auto-entrepreneur",
  "ice": "ICE 15 chiffres exactement",
  "if_number": "Identifiant Fiscal (IF)",
  "rc_number": "Registre de Commerce avec ville ex: 12345 Casa",
  "cnss_number": "Numéro CNSS",
  "capital_social": 100000,
  "adresse": "Adresse complète avec code postal",
  "ville": "Ville uniquement",
  "telephone": "Numéro tel format marocain",
  "email_societe": "Email professionnel",
  "site_web": "URL site web sans http",
  "secteur": "Secteur d'activité principal",
  "regime_tva": "debits ou encaissements",
  "confiance": 0.95
}
Aucun texte hors JSON."""


def _call_claude_image(data: bytes, media_type: str) -> dict:
    client = _get_client()
    b64 = base64.standard_b64encode(data).decode()
    msg = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
                {"type": "text", "text": _PROMPT},
            ]
        }]
    )
    return json.loads(msg.content[0].text.strip())


def _call_claude_pdf(data: bytes) -> dict:
    client = _get_client()
    b64 = base64.standard_b64encode(data).decode()
    msg = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": [
                {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": b64}},
                {"type": "text", "text": _PROMPT},
            ]
        }]
    )
    return json.loads(msg.content[0].text.strip())


def _call_claude_text(text: str) -> dict:
    client = _get_client()
    msg = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": f"Voici le contenu d'un document XML d'entreprise marocaine :\n\n{text}\n\n{_PROMPT}"
        }]
    )
    return json.loads(msg.content[0].text.strip())


def _parse_xml_text(data: bytes) -> str:
    try:
        root = ET.fromstring(data)
        lines = []
        def walk(el, depth=0):
            val = (el.text or "").strip()
            if val:
                lines.append(f"{'  ' * depth}{el.tag}: {val}")
            for child in el:
                walk(child, depth + 1)
        walk(root)
        return "\n".join(lines[:200])
    except ET.ParseError:
        return data.decode("utf-8", errors="replace")[:4000]


def extract_societe(data: bytes, filename: str) -> dict:
    """Extract company info from a PDF, image, or XML file using Claude."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "pdf":
        raw = _call_claude_pdf(data)
    elif ext in ("jpg", "jpeg"):
        raw = _call_claude_image(data, "image/jpeg")
    elif ext == "png":
        raw = _call_claude_image(data, "image/png")
    elif ext in ("xml", "txt"):
        text = _parse_xml_text(data)
        raw = _call_claude_text(text)
    else:
        raw = _call_claude_image(data, "image/jpeg")

    # Sanitise
    result = {
        "raison_sociale": raw.get("raison_sociale") or "",
        "forme_juridique": raw.get("forme_juridique") or "SARL",
        "ice": raw.get("ice") or "",
        "if_number": raw.get("if_number") or "",
        "rc_number": raw.get("rc_number") or "",
        "cnss_number": raw.get("cnss_number") or "",
        "capital_social": raw.get("capital_social"),
        "adresse": raw.get("adresse") or "",
        "ville": raw.get("ville") or "",
        "telephone": raw.get("telephone") or "",
        "email_societe": raw.get("email_societe") or "",
        "site_web": raw.get("site_web") or "",
        "secteur": raw.get("secteur") or "",
        "regime_tva": raw.get("regime_tva") or "debits",
        "confiance": float(raw.get("confiance") or 0.85),
    }
    return result
