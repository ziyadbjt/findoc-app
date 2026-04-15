from fastapi import APIRouter, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from models.database import get_db
from models.schemas import Facture, Ecriture
from routers.auth import get_current_user
from services.document_ai import extract_facture
from services.claude import generer_ecritures
import os, shutil, io
import openpyxl

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
            results.append({"fichier": file.filename, "statut": "erreur"})
            continue

        path = f"{UPLOAD_DIR}/{dossier_id}_{file.filename}"
        with open(path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        extracted = extract_facture(path, file.filename)

        facture = Facture(
            dossier_id=dossier_id,
            nom_fichier=file.filename,
            fournisseur=extracted["fournisseur"],
            code_tiers=extracted["code_tiers"],
            montant_ht=extracted["montant_ht"],
            tva=extracted["tva"],
            montant_ttc=extracted["montant_ttc"],
            date_facture=extracted["date_facture"],
            statut="traité"
        )
        db.add(facture)
        db.commit()
        db.refresh(facture)

        ecritures = generer_ecritures(extracted)
        for e in ecritures:
            ecriture = Ecriture(
                facture_id=facture.id,
                compte_pcm=e["compte_pcm"],
                libelle=e["libelle"],
                debit=e["debit"],
                credit=e["credit"]
            )
            db.add(ecriture)
        db.commit()

        results.append({
            "id": facture.id,
            "fichier": file.filename,
            "fournisseur": extracted["fournisseur"],
            "montant_ttc": extracted["montant_ttc"],
            "statut": "traité"
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

@router.get("/{dossier_id}/export")
def export_journal(dossier_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    factures = db.query(Facture).filter(Facture.dossier_id == dossier_id).all()
    facture_ids = [f.id for f in factures]
    ecritures = db.query(Ecriture).filter(Ecriture.facture_id.in_(facture_ids)).all()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Journal SAGE 100"
    ws.append(["N° Facture", "Date", "Compte PCM", "Code Tiers", "Libellé", "Débit (MAD)", "Crédit (MAD)"])

    facture_map = {f.id: f for f in factures}
    for e in ecritures:
        f = facture_map.get(e.facture_id)
        ws.append([
            f.nom_fichier if f else "",
            f.date_facture if f else "",
            e.compte_pcm,
            f.code_tiers if f else "",
            e.libelle,
            e.debit or "",
            e.credit or ""
        ])

    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)

    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=journal_dossier_{dossier_id}.xlsx"}
    )