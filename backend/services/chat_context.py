from datetime import datetime

from services.export import calculer_penalite, calculer_retard


def build_chat_context(db, dossier_id: int) -> dict:
    from models.schemas import Dossier, Ecriture, Facture

    dossier = db.query(Dossier).filter(Dossier.id == dossier_id).first()
    factures = db.query(Facture).filter(Facture.dossier_id == dossier_id).order_by(Facture.date_facture.desc()).all()
    facture_ids = [facture.id for facture in factures]
    ecritures = db.query(Ecriture).filter(Ecriture.facture_id.in_(facture_ids)).all() if facture_ids else []

    achats = [facture for facture in factures if (facture.type or "achat") == "achat"]
    ventes = [facture for facture in factures if facture.type == "vente"]
    retards = [facture for facture in factures if facture.paiement == "en_retard"]

    penalties = 0.0
    for facture in retards:
        info = calculer_retard(facture.date_facture, 60, facture.date_echeance)
        penalties += calculer_penalite(facture.montant_ttc or 0, info["retard_jours"], 2.25)

    dossier_payload = dossier.__dict__.copy() if dossier else {}
    dossier_payload.pop("_sa_instance_state", None)

    factures_payload = []
    for facture in factures:
        row = facture.__dict__.copy()
        row.pop("_sa_instance_state", None)
        factures_payload.append(row)

    ecritures_payload = []
    for ecriture in ecritures:
        row = ecriture.__dict__.copy()
        row.pop("_sa_instance_state", None)
        ecritures_payload.append(row)

    stats = {
        "generated_at": datetime.utcnow().isoformat(),
        "achats_ttc": round(sum(float(f.montant_ttc or 0) for f in achats), 2),
        "ventes_ttc": round(sum(float(f.montant_ttc or 0) for f in ventes), 2),
        "tva_deductible": round(sum(float(f.tva or 0) for f in achats), 2),
        "tva_collectee": round(sum(float(f.tva or 0) for f in ventes), 2),
        "factures_en_retard": len(retards),
        "penalites_totales": round(penalties, 2),
    }

    return {
        "dossier": dossier_payload,
        "factures": factures_payload,
        "ecritures": ecritures_payload,
        "stats": stats,
    }
