import json
import logging
import os
import re
from collections.abc import Iterable
from datetime import datetime
from pathlib import Path
from typing import Any

from anthropic import Anthropic
from dotenv import load_dotenv


_BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(_BACKEND_DIR / ".env")
load_dotenv(_BACKEND_DIR.parent / ".env")
logger = logging.getLogger(__name__)
_client: Anthropic | None = None
CLAUDE_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")


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


def _load_pcm_options(dossier_id: int | None) -> list[dict[str, str]]:
    if not dossier_id:
        return []
    try:
        from models.database import SessionLocal
        from models.schemas import PCMCompte

        db = SessionLocal()
        try:
            rows = (
                db.query(PCMCompte)
                .filter(PCMCompte.dossier_id == dossier_id)
                .order_by(PCMCompte.compte.asc())
                .all()
            )
            return [
                {"compte": row.compte, "libelle": row.libelle, "classe": row.classe or (row.compte or "")[:1]}
                for row in rows
            ]
        finally:
            db.close()
    except Exception:
        logger.exception("PCM load failed")
        return []


def _score_pcm_option(option: dict[str, str], haystack: str, code_tiers: str) -> int:
    compte = option.get("compte", "")
    libelle = option.get("libelle", "").lower()
    score = 0
    if code_tiers.startswith("CL") and compte.startswith("7"):
        score += 8
    if not code_tiers.startswith("CL") and compte.startswith("6"):
        score += 6
    for token in re.findall(r"[a-z0-9]{4,}", libelle):
        if token in haystack:
            score += 3
    keyword_map = (
        (("carbur", "gasoil", "essence"), ("carbur", "transport", "deplacement")),
        (("loyer", "location", "locat"), ("loyer", "location")),
        (("assurance", "prime"), ("assurance",)),
        (("honoraire", "consult", "service", "prestation"), ("honoraire", "service", "prestation")),
        (("informat", "logiciel", "digital", "internet", "telecom"), ("informat", "logiciel", "telecom", "internet")),
        (("marchandise", "achat", "matiere", "stock"), ("marchandise", "achat", "matiere", "stock")),
        (("vente", "produit", "service"), ("vente", "produit", "service")),
    )
    for source_tokens, label_tokens in keyword_map:
        if any(token in haystack for token in source_tokens) and any(token in libelle for token in label_tokens):
            score += 5
    return score


def _choose_pcm_from_options(
    options: list[dict[str, str]],
    line_items: list[dict[str, Any]],
    fournisseur: str,
    code_tiers: str,
) -> str | None:
    if not options:
        return None
    haystack = f"{fournisseur} {' '.join(str(item.get('description', '')) for item in line_items)}".lower()
    ranked = sorted(options, key=lambda option: _score_pcm_option(option, haystack, code_tiers), reverse=True)
    best = ranked[0] if ranked else None
    return best.get("compte") if best else None


def enrich_facture_metier(invoice_data: dict[str, Any], dossier_id: int | None = None) -> dict[str, Any]:
    fournisseur = invoice_data.get("fournisseur") or "Fournisseur inconnu"
    line_items = invoice_data.get("line_items") or []
    texte_source = invoice_data.get("texte_source", "")
    montant_ht = float(invoice_data.get("montant_ht") or 0.0)

    code_prefix = _classify_tiers(fournisseur, texte_source)
    code_tiers = f"{code_prefix}{_slug(fournisseur)}"
    pcm_options = _load_pcm_options(dossier_id)
    compte_pcm = _choose_pcm_from_options(pcm_options, line_items, fournisseur, code_tiers) or _default_pcm(line_items, fournisseur, code_tiers)
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

    pcm_context = "\n".join(
        f"- {row['compte']} | {row['libelle']} | classe {row.get('classe') or ''}"
        for row in pcm_options[:120]
    )

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
- Choisir le compte PCM uniquement dans la liste fournie si elle existe.
- Si aucun compte de la liste ne correspond, utiliser le compte le plus proche et baisser confiance_metier.
{f"{chr(10)}Plan comptable autorise:{chr(10)}{pcm_context}" if pcm_context else ""}
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
            model=CLAUDE_MODEL,
            max_tokens=256,
            messages=[{"role": "user", "content": prompt}],
        )
        parsed = json.loads(message.content[0].text.strip())
        parsed_compte = str(parsed.get("compte_pcm") or "")
        if pcm_options and parsed_compte not in {row["compte"] for row in pcm_options}:
            parsed_compte = base_response["compte_pcm"]
        return {
            "code_tiers": parsed.get("code_tiers") or base_response["code_tiers"],
            "compte_pcm": parsed_compte or base_response["compte_pcm"],
            "ras": round(float(parsed.get("ras") or base_response["ras"]), 2),
            "confiance_metier": round(float(parsed.get("confiance_metier") or base_response["confiance_metier"]), 3),
            "classification": (parsed.get("code_tiers") or base_response["code_tiers"])[:2],
        }
    except Exception:
        logger.exception("Claude enrichment failed; using local fallback")
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


def _extract_years(text: str) -> list[int]:
    current_year = datetime.utcnow().year
    years = []
    for match in re.findall(r"\b(20\d{2})\b", text or ""):
        year = int(match)
        if 2000 <= year <= current_year + 5:
            years.append(year)
    return sorted(set(years))


def analyser_rattachement_exercice(invoice_data: dict[str, Any]) -> dict[str, Any]:
    date_facture = str(invoice_data.get("date_facture") or "")
    facture_year = int(date_facture[:4]) if re.match(r"^\d{4}", date_facture) else datetime.utcnow().year
    type_document = invoice_data.get("type") or "achat"
    text_parts = [
        str(invoice_data.get("nom_fichier") or ""),
        str(invoice_data.get("texte_source") or ""),
        str(invoice_data.get("ocr_payload") or ""),
        " ".join(str(item.get("description", "")) for item in invoice_data.get("line_items") or []),
    ]
    haystack = "\n".join(text_parts)
    candidate_years = [year for year in _extract_years(haystack) if year != facture_year]
    suggested_year = candidate_years[0] if candidate_years else facture_year

    if suggested_year > facture_year:
        traitement = "produit_constate_avance" if type_document == "vente" else "charge_constatee_avance"
        risk = "eleve"
        reason = f"Facture datee {facture_year}, mais le libelle/source mentionne {suggested_year}."
    elif suggested_year < facture_year:
        traitement = "rattachement_exercice_precedent"
        risk = "moyen"
        reason = f"Facture datee {facture_year}, mais le libelle/source mentionne {suggested_year}."
    else:
        traitement = "exercice_courant"
        risk = "faible"
        reason = "Aucun indice de rattachement a un autre exercice detecte."

    fallback = {
        "exercice_rattachement": suggested_year,
        "traitement_comptable": traitement,
        "niveau_risque": risk,
        "commentaire": reason,
    }

    if not os.getenv("ANTHROPIC_API_KEY"):
        return fallback

    prompt = f"""
Tu es un expert-comptable marocain. Analyse le rattachement d'exercice de cette facture.
Retourne uniquement un JSON valide:
{{
  "exercice_rattachement": 2026,
  "traitement_comptable": "exercice_courant|charge_constatee_avance|produit_constate_avance|rattachement_exercice_precedent|a_verifier",
  "niveau_risque": "faible|moyen|eleve",
  "commentaire": "raison courte"
}}

Regles:
- Si la facture est datee N mais le libelle mentionne une prestation N+1, proposer charge/produit constate d'avance.
- Si la facture est datee N mais concerne N-1, proposer rattachement exercice precedent.
- Si les indices sont insuffisants, garder exercice courant ou a_verifier.

Donnees:
{json.dumps({
    "date_facture": invoice_data.get("date_facture"),
    "type": type_document,
    "fournisseur": invoice_data.get("fournisseur"),
    "num_facture": invoice_data.get("num_facture"),
    "line_items": invoice_data.get("line_items", [])[:20],
    "texte_source": str(invoice_data.get("texte_source") or "")[:3000],
    "fallback_python": fallback,
}, ensure_ascii=True)}
""".strip()

    try:
        message = _get_client().messages.create(
            model=CLAUDE_MODEL,
            max_tokens=320,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip()
        if raw.startswith("```"):
            raw = re.sub(r"^```[a-z]*\n?", "", raw)
            raw = re.sub(r"\n?```$", "", raw)
        parsed = json.loads(raw)
        exercice = int(parsed.get("exercice_rattachement") or fallback["exercice_rattachement"])
        if exercice < 2000 or exercice > datetime.utcnow().year + 5:
            exercice = fallback["exercice_rattachement"]
        return {
            "exercice_rattachement": exercice,
            "traitement_comptable": parsed.get("traitement_comptable") or fallback["traitement_comptable"],
            "niveau_risque": parsed.get("niveau_risque") or fallback["niveau_risque"],
            "commentaire": parsed.get("commentaire") or fallback["commentaire"],
        }
    except Exception:
        logger.exception("Claude exercice analysis failed; using Python fallback")
        return fallback


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


def generate_monthly_report(
    dossier: Any,
    factures: list[Any],
    mois: int,
    annee: int,
) -> Iterable[str]:
    BAM_RATE = 0.0225
    PENALTY_RATE = BAM_RATE + 0.03
    LEGAL_DELAY = 60
    today = datetime.utcnow().date()

    achats = [f for f in factures if (getattr(f, "type", None) or "achat") != "vente"]
    ventes = [f for f in factures if (getattr(f, "type", None) or "") == "vente"]
    retards = [f for f in factures if (getattr(f, "paiement", None) or "") == "en_retard"]

    ca_ttc = sum(float(getattr(f, "montant_ttc", 0) or 0) for f in ventes)
    achats_ttc = sum(float(getattr(f, "montant_ttc", 0) or 0) for f in achats)
    tva_collectee = sum(float(getattr(f, "tva", 0) or 0) for f in ventes)
    tva_deductible = sum(float(getattr(f, "tva", 0) or 0) for f in achats)
    solde_tva = round(tva_collectee - tva_deductible, 2)

    penalites = 0.0
    for f in retards:
        try:
            echeance = datetime.strptime(str(getattr(f, "date_echeance", "") or ""), "%Y-%m-%d").date()
            overdue_days = max(0, (today - echeance).days)
            montant = float(getattr(f, "montant_ttc", 0) or 0)
            penalites += montant * PENALTY_RATE * max(0, overdue_days - LEGAL_DELAY) / 365
        except Exception:
            pass

    low_conf = [f for f in factures if float(getattr(f, "confidence", 1) or 1) < 0.8]

    top_fournisseurs: dict[str, float] = {}
    for f in achats:
        nom = getattr(f, "fournisseur", None) or "Inconnu"
        top_fournisseurs[nom] = top_fournisseurs.get(nom, 0) + float(getattr(f, "montant_ttc", 0) or 0)
    top3 = sorted(top_fournisseurs.items(), key=lambda x: x[1], reverse=True)[:3]

    raison = getattr(dossier, "raison_sociale", None) or "Société"
    periode = f"{mois:02d}/{annee}"

    prompt = f"""Tu es expert-comptable marocain (PCM, Loi 69-21, DGI). Génère un rapport mensuel clair et actionnable pour le cabinet.

Dossier : {raison}
Période : {periode}
Nombre de factures : {len(factures)} ({len(achats)} achats, {len(ventes)} ventes)

CHIFFRES CLÉS :
- Chiffre d'affaires TTC : {ca_ttc:,.0f} MAD
- Achats TTC : {achats_ttc:,.0f} MAD
- TVA collectée : {tva_collectee:,.0f} MAD
- TVA déductible : {tva_deductible:,.0f} MAD
- Solde TVA net : {solde_tva:+,.0f} MAD {"(à reverser DGI)" if solde_tva > 0 else "(crédit de TVA)"}
- Factures en retard : {len(retards)} ({sum(float(getattr(f, "montant_ttc", 0) or 0) for f in retards):,.0f} MAD)
- Pénalités Loi 69-21 estimées : {penalites:,.0f} MAD
- Factures à confiance faible (<80%) : {len(low_conf)}

TOP FOURNISSEURS (achats) :
{chr(10).join(f"- {nom} : {montant:,.0f} MAD" for nom, montant in top3) or "- Aucun"}

FACTURES EN RETARD :
{chr(10).join(f"- {getattr(f, 'fournisseur', '?')} / {getattr(f, 'num_facture', '?')} / {float(getattr(f, 'montant_ttc', 0) or 0):,.0f} MAD / éch. {getattr(f, 'date_echeance', '?')}" for f in retards[:8]) or "- Aucune"}

Structure ta réponse en Markdown avec ces sections :
## Résumé exécutif
## Ventes & Chiffre d'affaires
## Achats & Dépenses
## TVA & Obligations fiscales
## Retards de paiement & Pénalités
## Anomalies détectées
## Actions prioritaires

Sois concis, opérationnel, et mets en gras les chiffres importants. N'utilise aucun emoji."""

    if not os.getenv("ANTHROPIC_API_KEY"):
        fallback = (
            f"## Rapport mensuel {periode} — {raison}\n\n"
            f"**CA TTC :** {ca_ttc:,.0f} MAD · **Achats :** {achats_ttc:,.0f} MAD\n\n"
            f"**Solde TVA :** {solde_tva:+,.0f} MAD · **Retards :** {len(retards)} facture(s)\n\n"
            f"*(Clé API manquante — rapport complet indisponible)*"
        )
        for token in fallback.split():
            yield token + " "
        return

    try:
        with _get_client().messages.stream(
            model=CLAUDE_MODEL,
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            for text in stream.text_stream:
                yield text
    except Exception:
        logger.exception("Claude monthly report failed")
        yield f"Erreur lors de la génération du rapport. Veuillez réessayer."


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
            model=CLAUDE_MODEL,
            max_tokens=1024,
            system=system_prompt,
            messages=messages,
        ) as stream:
            for text in stream.text_stream:
                yield text
    except Exception:
        logger.exception("Claude chat failed; using local fallback")
        answer = _fallback_chat_answer(message, context)
        for token in answer.split():
            yield token + " "
