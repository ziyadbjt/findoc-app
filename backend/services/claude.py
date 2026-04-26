import json
import os
import re
from collections.abc import Iterable
from datetime import datetime
from typing import Any

from anthropic import Anthropic


_client: Anthropic | None = None


def _get_client() -> Anthropic:
    global _client
    if _client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY manquante")
        _client = Anthropic(api_key=api_key)
    return _client


def _classify_tiers(fournisseur: str, texte_source: str = "") -> str:
    haystack = f"{fournisseur} {texte_source}".upper()
    if any(token in haystack for token in ["CLIENT", "VENTE", "SALES", "CUSTOMER"]):
        return "CL"
    if any(token in haystack for token in ["SARL", "SA", "SAS", "LLC", "INC", "LTD", "FRANCE", "ESPANA", "EUROPE"]):
        return "FE"
    return "FL"


def _slug(label: str) -> str:
    letters = re.sub(r"[^A-Z0-9]+", "", label.upper())
    return letters[:8] or "GENERIC"


def _default_pcm(line_items: list[dict[str, Any]], fournisseur: str, code_tiers: str) -> str:
    haystack = f"{fournisseur} {' '.join(str(item.get('description', '')) for item in line_items)}".lower()
    if "carbur" in haystack:
        return "6161000"
    if "locat" in haystack or "loyer" in haystack:
        return "6132000"
    if "maint" in haystack or "informat" in haystack or "digital" in haystack:
        return "6135000"
    if "cnss" in haystack:
        return "6551000"
    if code_tiers.startswith("CL"):
        return "7111000"
    return "6111000"


def enrich_facture_metier(invoice_data: dict[str, Any], dossier_id: int | None = None) -> dict[str, Any]:
    fournisseur = invoice_data.get("fournisseur") or "Fournisseur inconnu"
    line_items = invoice_data.get("line_items") or []
    texte_source = invoice_data.get("texte_source", "")
    montant_ht = float(invoice_data.get("montant_ht") or 0.0)

    code_prefix = _classify_tiers(fournisseur, texte_source)
    code_tiers = f"{code_prefix}{_slug(fournisseur)}"
    compte_pcm = _default_pcm(line_items, fournisseur, code_tiers)
    ras = round(montant_ht * 0.10, 2) if code_tiers.startswith("FE") else 0.0

    base_response = {
        "code_tiers": code_tiers,
        "compte_pcm": compte_pcm,
        "ras": ras,
        "confiance_metier": 0.82,
        "classification": code_prefix,
    }

    if not os.getenv("ANTHROPIC_API_KEY"):
        return base_response

    # RAG: inject similar past corrections into the prompt
    rag_context = ""
    try:
        from services.rag import build_rag_context
        description = " ".join(str(item.get("description", "")) for item in line_items[:5])
        rag_context = build_rag_context(fournisseur, description, montant_ht, dossier_id)
    except Exception:
        pass

    prompt = f"""
Tu es un assistant comptable marocain.
Tu dois enrichir des donnees OCR de facture et retourner uniquement un JSON valide:
{{
  "code_tiers": "FLXXX|FEXXX|CLXXX",
  "compte_pcm": "6111000",
  "ras": 0,
  "confiance_metier": 0.93
}}

Regles:
- FL = fournisseur local
- FE = fournisseur etranger
- CL = client
- Si FE, appliquer RAS de 10% du montant HT
- Choisir un compte PCM plausible
{f"{chr(10)}{rag_context}" if rag_context else ""}
Donnees OCR:
{json.dumps({
    "fournisseur": fournisseur,
    "montant_ht": montant_ht,
    "montant_ttc": invoice_data.get("montant_ttc"),
    "line_items": line_items[:20],
    "texte_source": texte_source[:2000],
}, ensure_ascii=True)}
""".strip()

    try:
        message = _get_client().messages.create(
            model="claude-sonnet-4-6",
            max_tokens=256,
            messages=[{"role": "user", "content": prompt}],
        )
        parsed = json.loads(message.content[0].text.strip())
        return {
            "code_tiers": parsed.get("code_tiers") or base_response["code_tiers"],
            "compte_pcm": parsed.get("compte_pcm") or base_response["compte_pcm"],
            "ras": round(float(parsed.get("ras") or base_response["ras"]), 2),
            "confiance_metier": round(float(parsed.get("confiance_metier") or base_response["confiance_metier"]), 3),
            "classification": (parsed.get("code_tiers") or base_response["code_tiers"])[:2],
        }
    except Exception:
        return base_response


def generer_ecritures(facture_data: dict[str, Any]) -> list[dict[str, Any]]:
    code_tiers = facture_data.get("code_tiers", "")
    montant_ht = round(float(facture_data.get("montant_ht") or 0), 2)
    tva = round(float(facture_data.get("tva") or 0), 2)
    montant_ttc = round(float(facture_data.get("montant_ttc") or 0), 2)
    fournisseur = facture_data.get("fournisseur", "")
    compte_pcm = facture_data.get("compte_pcm") or _default_pcm(facture_data.get("line_items") or [], fournisseur, code_tiers)
    type_document = facture_data.get("type", "achat")
    ras = round(float(facture_data.get("ras") or 0), 2)

    ecritures: list[dict[str, Any]] = []

    if type_document == "vente" or code_tiers.startswith("CL"):
        ecritures.append({"compte_pcm": "342100", "libelle": fournisseur, "debit": montant_ttc, "credit": 0})
        if tva:
            ecritures.append({"compte_pcm": "445700", "libelle": "TVA collectee", "debit": 0, "credit": tva})
        ecritures.append({"compte_pcm": compte_pcm, "libelle": f"Vente {fournisseur}".strip(), "debit": 0, "credit": montant_ht})
        return ecritures

    ecritures.append({"compte_pcm": compte_pcm, "libelle": fournisseur, "debit": montant_ht, "credit": 0})
    if tva:
        ecritures.append({"compte_pcm": "344100", "libelle": "TVA deductible", "debit": tva, "credit": 0})

    fournisseur_credit = montant_ttc
    if code_tiers.startswith("FE") and ras:
        ecritures.append({"compte_pcm": "445500", "libelle": "RAS a reverser DGI 10%", "debit": 0, "credit": ras})
        fournisseur_credit = round(montant_ttc - ras, 2)

    ecritures.append({"compte_pcm": "401100", "libelle": fournisseur, "debit": 0, "credit": fournisseur_credit})
    return ecritures


def build_chat_context_summary(context: dict[str, Any]) -> str:
    dossier = context.get("dossier") or {}
    factures = context.get("factures") or []
    stats = context.get("stats") or {}
    lignes = [
        f"Dossier: {dossier.get('raison_sociale', 'N/A')} ({dossier.get('forme_juridique', 'N/A')})",
        f"Ville: {dossier.get('ville', 'N/A')}",
        f"Nombre de factures: {len(factures)}",
        f"Retards: {stats.get('factures_en_retard', 0)}",
        f"TVA collectee: {stats.get('tva_collectee', 0)}",
        f"TVA deductible: {stats.get('tva_deductible', 0)}",
        "Extraits de factures:",
    ]
    for facture in factures[:12]:
        lignes.append(
            f"- {facture.get('num_facture') or facture.get('nom_fichier')}: {facture.get('fournisseur')} "
            f"TTC={facture.get('montant_ttc')} statut={facture.get('paiement')} echeance={facture.get('date_echeance')}"
        )
    return "\n".join(lignes)


def _fallback_chat_answer(message: str, context: dict[str, Any]) -> str:
    stats = context.get("stats") or {}
    factures = context.get("factures") or []
    lowered = message.lower()

    if "retard" in lowered:
        retards = [f for f in factures if f.get("paiement") == "en_retard"]
        if not retards:
            return "Aucune facture en retard n'a ete detectee dans ce dossier."
        lines = ["Factures en retard :"]
        for facture in retards[:10]:
            lines.append(
                f"- {facture.get('num_facture') or facture.get('nom_fichier')} / {facture.get('fournisseur')} / "
                f"{facture.get('montant_ttc', 0):.2f} MAD / echeance {facture.get('date_echeance')}"
            )
        return "\n".join(lines)

    if "tva" in lowered:
        solde = round(float(stats.get("tva_collectee", 0)) - float(stats.get("tva_deductible", 0)), 2)
        return (
            f"TVA collectee: {stats.get('tva_collectee', 0):.2f} MAD\n"
            f"TVA deductible: {stats.get('tva_deductible', 0):.2f} MAD\n"
            f"Solde TVA estime: {solde:.2f} MAD"
        )

    if "69-21" in lowered or "penalit" in lowered:
        return f"Penalites estimees Loi 69-21: {float(stats.get('penalites_totales', 0)):.2f} MAD."

    return (
        "Resume dossier:\n"
        f"- Factures: {len(factures)}\n"
        f"- Montant achats TTC: {float(stats.get('achats_ttc', 0)):.2f} MAD\n"
        f"- Montant ventes TTC: {float(stats.get('ventes_ttc', 0)):.2f} MAD\n"
        f"- Penalites estimees: {float(stats.get('penalites_totales', 0)):.2f} MAD"
    )


def _handle_slash_command(message: str, context: dict[str, Any]) -> str | None:
    """Handle /relance, /tva, /export slash commands directly without calling Claude."""
    stripped = message.strip()
    factures = context.get("factures") or []
    stats = context.get("stats") or {}

    if stripped.startswith("/relance"):
        parts = stripped.split(maxsplit=1)
        query = parts[1].strip().upper() if len(parts) > 1 else ""
        matches = [f for f in factures if f.get("paiement") == "en_retard" and (not query or query in (f.get("fournisseur") or "").upper())]
        if not matches:
            target = query or "tous les fournisseurs"
            return f"Aucune facture en retard trouvée pour {target}."
        lines = [f"Relance — {len(matches)} facture(s) en retard :\n"]
        total = sum(float(f.get("montant_ttc") or 0) for f in matches)
        for f in matches[:10]:
            lines.append(f"• {f.get('fournisseur')} — {f.get('num_facture')} — {float(f.get('montant_ttc') or 0):.0f} MAD (échéance {f.get('date_echeance')})")
        lines.append(f"\nTotal : {total:.0f} MAD")
        lines.append("\nModèle d'email généré automatiquement par RelancesPage.")
        return "\n".join(lines)

    if stripped.startswith("/tva"):
        tva_collectee = float(stats.get("tva_collectee") or 0)
        tva_deductible = float(stats.get("tva_deductible") or 0)
        solde = round(tva_collectee - tva_deductible, 2)
        signe = "à reverser à la DGI" if solde > 0 else "crédit de TVA"
        return (
            f"**Situation TVA du dossier**\n\n"
            f"• TVA collectée (ventes) : {tva_collectee:.2f} MAD\n"
            f"• TVA déductible (achats) : {tva_deductible:.2f} MAD\n"
            f"• Solde net : **{abs(solde):.2f} MAD {signe}**"
        )

    if stripped.startswith("/anomalies"):
        retards = [f for f in factures if f.get("paiement") == "en_retard"]
        penalites = float(stats.get("penalites_totales") or 0)
        total = len(factures)
        return (
            f"**Anomalies détectées**\n\n"
            f"• Factures en retard : {len(retards)} / {total}\n"
            f"• Pénalités Loi 69-21 estimées : {penalites:.2f} MAD\n"
            f"• Ouvrez l'onglet Anomalies pour le détail."
        )

    if stripped.startswith("/aide") or stripped.startswith("/help"):
        return (
            "**Commandes disponibles**\n\n"
            "• `/relance [fournisseur]` — Liste les factures en retard et génère un résumé de relance\n"
            "• `/tva` — Affiche le solde TVA du dossier\n"
            "• `/anomalies` — Résumé des anomalies et retards détectés\n"
            "• `/aide` — Affiche cette aide\n\n"
            "Ou posez directement vos questions sur le dossier !"
        )

    return None


def stream_chat_response(message: str, history: list[dict[str, str]], context: dict[str, Any]) -> Iterable[str]:
    # Handle slash commands directly
    slash_response = _handle_slash_command(message, context)
    if slash_response:
        for token in slash_response.split():
            yield token + " "
        return

    summary = build_chat_context_summary(context)
    stats = context.get("stats") or {}
    factures = context.get("factures") or []

    # Build proactive alerts for system prompt
    alerts = []
    retard_count = int(stats.get("factures_en_retard") or 0)
    if retard_count > 0:
        alerts.append(f"ALERTE : {retard_count} facture(s) en retard, pénalités estimées à {float(stats.get('penalites_totales') or 0):.0f} MAD.")
    tva_solde = float(stats.get("tva_collectee") or 0) - float(stats.get("tva_deductible") or 0)
    if tva_solde > 10000:
        alerts.append(f"TVA à reverser DGI : {tva_solde:.0f} MAD.")
    low_confidence = [f for f in factures if f.get("confidence") is not None and float(f.get("confidence") or 1) < 0.8]
    if low_confidence:
        alerts.append(f"{len(low_confidence)} facture(s) avec confiance d'extraction < 80% — à valider.")

    alerts_str = "\n".join(alerts) if alerts else "Aucune alerte active."

    system_prompt = (
        "Tu es FinDoc, copilote comptable marocain expert en Plan Comptable Marocain (PCM), "
        "Loi 69-21 sur les délais de paiement, et fiscalité marocaine (TVA, IS, IR, RAS). "
        "Réponds en français, de manière concise et opérationnelle. "
        "Utilise des listes à puces et du Markdown pour la clarté. "
        "Propose toujours une action concrète. "
        "Quand une information manque, dis-le clairement.\n\n"
        f"=== CONTEXTE DU DOSSIER ===\n{summary}\n\n"
        f"=== ALERTES ACTIVES ===\n{alerts_str}\n\n"
        "=== COMMANDES DISPONIBLES ===\n"
        "L'utilisateur peut taper /relance, /tva, /anomalies, /aide pour des réponses rapides."
    )

    if not os.getenv("ANTHROPIC_API_KEY"):
        answer = _fallback_chat_answer(message, context)
        for token in answer.split():
            yield token + " "
        return

    messages = [{"role": item.get("role", "user"), "content": item.get("content", "")} for item in history[-8:]]
    messages.append({"role": "user", "content": message})

    try:
        with _get_client().messages.stream(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=system_prompt,
            messages=messages,
        ) as stream:
            for text in stream.text_stream:
                yield text
    except Exception:
        answer = _fallback_chat_answer(message, context)
        for token in answer.split():
            yield token + " "
