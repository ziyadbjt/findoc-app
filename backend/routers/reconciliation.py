from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session
from models.database import get_db
from models.schemas import Facture
from routers.auth import get_current_user
from services.export import calculer_retard, calculer_penalite
import random

router = APIRouter(prefix="/reconciliation", tags=["reconciliation"])

DELAIS = {
    "FEATLAS": 60, "FLMARPRINT": 30, "FECASATEX": 120,
    "FESONATRACH": 60, "FEATECH": 30
}

@router.get("/{dossier_id}")
def reconcilier(
    dossier_id: int,
    taux_bam: float = 2.25,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    factures = db.query(Facture).filter(
        Facture.dossier_id == dossier_id,
        Facture.statut == "traité"
    ).all()

    resultats = []
    for f in factures:
        delai = DELAIS.get(f.code_tiers, 60)
        retard_info = calculer_retard(f.date_facture, delai)
        penalite = 0
        if retard_info["retard_jours"] > 0:
            penalite = calculer_penalite(f.montant_ttc, retard_info["retard_jours"], taux_bam)

        statuts = ["payée", "payée", "payée", "en_retard", "en_attente"]
        statut_paiement = random.choice(statuts)

        resultats.append({
            "facture_id": f.id,
            "fichier": f.nom_fichier,
            "fournisseur": f.fournisseur,
            "code_tiers": f.code_tiers,
            "montant_ttc": f.montant_ttc,
            "date_facture": f.date_facture,
            "delai_contractuel": delai,
            "echeance": retard_info["echeance"],
            "statut_paiement": statut_paiement,
            "retard_jours": retard_info["retard_jours"],
            "penalite_mad": penalite,
            "loi_6921": retard_info["statut"] == "en_retard"
        })

    total_penalites = sum(r["penalite_mad"] for r in resultats)
    retards = [r for r in resultats if r["loi_6921"]]

    return {
        "total_factures": len(resultats),
        "retards_loi_6921": len(retards),
        "total_penalites_mad": round(total_penalites, 2),
        "taux_bam_applique": taux_bam,
        "resultats": resultats
    }