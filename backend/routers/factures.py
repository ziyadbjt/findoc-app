from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from models.database import get_db
from models.schemas import Facture, Ecriture
from routers.auth import get_current_user
import os, shutil

router = APIRouter(prefix="/factures", tags=["factures"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/{dossier_id}/upload")
async def upload_factures(
    dossier_id: int,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    results = []
    for file in files:
        if not file.filename.endswith(".pdf"):
            results.append({"fichier": file.filename, "statut": "erreur", "message": "PDF uniquement"})
            continue

        path = f"{UPLOAD_DIR}/{dossier_id}_{file.filename}"
        with open(path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        facture = Facture(
            dossier_id=dossier_id,
            nom_fichier=file.filename,
            statut="en_attente"
        )
        db.add(facture)
        db.commit()
        db.refresh(facture)

        results.append({
            "id": facture.id,
            "fichier": file.filename,
            "statut": "uploadé"
        })

    return {"total": len(files), "resultats": results}

@router.get("/{dossier_id}")
def list_factures(dossier_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(Facture).filter(Facture.dossier_id == dossier_id).all()

@router.get("/{dossier_id}/ecritures")
def list_ecritures(dossier_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    factures = db.query(Facture).filter(Facture.dossier_id == dossier_id).all()
    facture_ids = [f.id for f in factures]
    return db.query(Ecriture).filter(Ecriture.facture_id.in_(facture_ids)).all()