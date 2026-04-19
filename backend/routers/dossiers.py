from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from models.database import get_db
from models.schemas import Dossier
from routers.auth import get_current_user
from services.extract_societe import extract_societe

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
    if_number: str = "",
    rc_number: str = "",
    cnss_number: str = "",
    capital_social: float = None,
    adresse: str = "",
    telephone: str = "",
    email_societe: str = "",
    site_web: str = "",
    logo_hue: int = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    dossier = Dossier(
        raison_sociale=raison_sociale,
        ice=ice,
        forme_juridique=forme_juridique,
        ville=ville,
        secteur=secteur,
        regime_tva=regime_tva,
        if_number=if_number or None,
        rc_number=rc_number or None,
        cnss_number=cnss_number or None,
        capital_social=capital_social,
        adresse=adresse or None,
        telephone=telephone or None,
        email_societe=email_societe or None,
        site_web=site_web or None,
        logo_hue=logo_hue,
    )
    db.add(dossier)
    db.commit()
    db.refresh(dossier)
    return dossier

@router.post("/extract-societe")
async def extract_societe_from_doc(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user)
):
    allowed = {"pdf", "jpg", "jpeg", "png", "xml"}
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"Format non supporté : .{ext}. Utilisez PDF, JPG, PNG ou XML.")
    data = await file.read()
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Fichier trop lourd (max 20 Mo)")
    try:
        result = extract_societe(data, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur d'extraction : {str(e)}")
    return result

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