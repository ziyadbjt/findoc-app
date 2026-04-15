from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models.database import get_db
from models.schemas import Dossier
from routers.auth import get_current_user

router = APIRouter(prefix="/dossiers", tags=["dossiers"])

@router.get("/")
def list_dossiers(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(Dossier).all()

@router.post("/")
def create_dossier(
    raison_sociale: str,
    ice: str = "",
    forme_juridique: str = "SARL",
    ville: str = "",
    secteur: str = "",
    regime_tva: str = "debits",
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    dossier = Dossier(
        raison_sociale=raison_sociale,
        ice=ice,
        forme_juridique=forme_juridique,
        ville=ville,
        secteur=secteur,
        regime_tva=regime_tva
    )
    db.add(dossier)
    db.commit()
    db.refresh(dossier)
    return dossier

@router.get("/{dossier_id}")
def get_dossier(dossier_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    dossier = db.query(Dossier).filter(Dossier.id == dossier_id).first()
    if not dossier:
        raise HTTPException(status_code=404, detail="Dossier introuvable")
    return dossier

@router.delete("/{dossier_id}")
def delete_dossier(dossier_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    dossier = db.query(Dossier).filter(Dossier.id == dossier_id).first()
    if not dossier:
        raise HTTPException(status_code=404, detail="Dossier introuvable")
    db.delete(dossier)
    db.commit()
    return {"message": "Dossier supprimé"}