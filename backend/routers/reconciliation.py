import os
import shutil

from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from models.database import get_db
from models.schemas import Facture
from routers.auth import get_current_user
from services.bank_ai import extract_bank_statement
from services.export import calculer_penalite, calculer_retard

router = APIRouter(prefix="/reconciliation", tags=["Reconciliation bancaire"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

DELAIS = {
    "FEATLAS": 60,
    "FLMARPRINT": 30,
    "FECASATEX": 120,
    "FESONATRACH": 60,
    "FEATECH": 30,
}


class ReconciliationSummary(BaseModel):
    total_factures: int
    retards_loi_6921: int
    total_penalites_mad: float
    taux_bam_applique: float
    resultats: list[dict]


@router.get(
    "/{dossier_id}",
    response_model=ReconciliationSummary,
    summary="Calculer l'etat de reconciliation et de retard",
    description="Retourne les echeances, retards et penalites Loi 69-21 pour un dossier.",
)
def reconcilier(
    dossier_id: int,
    taux_bam: float = 2.25,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    factures = db.query(Facture).filter(Facture.dossier_id == dossier_id).all()

    resultats = []
    for facture in factures:
        delai = DELAIS.get(facture.code_tiers, 60)
        retard_info = calculer_retard(facture.date_facture, delai, facture.date_echeance)
        penalite = 0.0
        if retard_info["retard_jours"] > 0:
            penalite = calculer_penalite(float(facture.montant_ttc or 0), retard_info["retard_jours"], taux_bam)

        resultats.append(
            {
                "facture_id": facture.id,
                "fichier": facture.nom_fichier,
                "fournisseur": facture.fournisseur,
                "code_tiers": facture.code_tiers,
                "montant_ttc": facture.montant_ttc,
                "date_facture": facture.date_facture,
                "delai_contractuel": delai,
                "echeance": retard_info["echeance"],
                "statut_paiement": facture.paiement or ("en_retard" if retard_info["retard_jours"] > 0 else "en_attente"),
                "retard_jours": retard_info["retard_jours"],
                "penalite_mad": penalite,
                "loi_6921": retard_info["statut"] == "en_retard",
            }
        )

    total_penalites = sum(resultat["penalite_mad"] for resultat in resultats)
    retards = [resultat for resultat in resultats if resultat["loi_6921"]]

    return {
        "total_factures": len(resultats),
        "retards_loi_6921": len(retards),
        "total_penalites_mad": round(total_penalites, 2),
        "taux_bam_applique": taux_bam,
        "resultats": resultats,
    }


@router.post(
    "/{dossier_id}/upload",
    summary="Uploader un releve bancaire et proposer des correspondances",
    description="Analyse un releve bancaire puis suggere des rapprochements avec les factures existantes.",
)
async def upload_releve_bancaire(
    dossier_id: int,
    file: UploadFile = File(..., description="Releve bancaire PDF, image ou fichier texte"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    path = f"{UPLOAD_DIR}/{dossier_id}_bank_{file.filename}"
    with open(path, "wb") as handle:
        shutil.copyfileobj(file.file, handle)

    extracted = extract_bank_statement(path, file.filename)
    factures = db.query(Facture).filter(Facture.dossier_id == dossier_id).all()
    bank_lines = []

    for line in extracted["transactions"]:
        best_match = None
        best_gap = None
        for facture in factures:
            gap = abs(abs(float(line.get("montant") or 0)) - float(facture.montant_ttc or 0))
            if best_gap is None or gap < best_gap:
                best_gap = gap
                best_match = facture
        bank_lines.append(
            {
                **line,
                "matched_to": best_match.id if best_match and (best_gap or 0) < 5 else None,
                "matched_label": best_match.fournisseur if best_match and (best_gap or 0) < 5 else None,
            }
        )

    return {
        "source_ai": extracted["source_ai"],
        "bank_lines": bank_lines,
        "reconciliation": reconcilier(dossier_id, 2.25, db, current_user),
    }
