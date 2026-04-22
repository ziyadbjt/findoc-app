import io
import os
import shutil

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from models.database import get_db
from models.schemas import Ecriture, Facture
from routers.auth import get_current_user
from services.claude import generer_ecritures
from services.document_ai import extract_facture
from services.export import build_export_workbook


router = APIRouter(prefix="/factures", tags=["factures"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/{dossier_id}/upload")
async def upload_factures(
    dossier_id: int,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    results = []
    for file in files:
        if not file.filename.lower().endswith((".pdf", ".png", ".jpg", ".jpeg")):
            results.append({"fichier": file.filename, "statut": "erreur"})
            continue

        path = f"{UPLOAD_DIR}/{dossier_id}_{file.filename}"
        with open(path, "wb") as handle:
            shutil.copyfileobj(file.file, handle)

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
            date_echeance=extracted.get("date_echeance"),
            num_facture=extracted.get("num_facture"),
            confidence=extracted.get("confidence"),
            compte_pcm=extracted.get("compte_pcm"),
            statut="traite",
            paiement="en_attente",
        )
        db.add(facture)
        db.commit()
        db.refresh(facture)

        ecritures = generer_ecritures({**extracted, "type": facture.type})
        for row in ecritures:
            db.add(
                Ecriture(
                    facture_id=facture.id,
                    compte_pcm=row["compte_pcm"],
                    libelle=row["libelle"],
                    debit=row["debit"],
                    credit=row["credit"],
                )
            )
        db.commit()

        results.append(
            {
                "id": facture.id,
                "fichier": file.filename,
                "fournisseur": extracted["fournisseur"],
                "num_facture": extracted.get("num_facture"),
                "montant_ttc": extracted["montant_ttc"],
                "statut": "traite",
                "source_ai": extracted.get("source_ai"),
                "confiance": extracted.get("confidence"),
            }
        )

    return {"total": len(files), "resultats": results}


@router.get("/{dossier_id}")
def list_factures(dossier_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(Facture).filter(Facture.dossier_id == dossier_id).all()


@router.get("/{dossier_id}/ecritures")
def list_ecritures(dossier_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    factures = db.query(Facture).filter(Facture.dossier_id == dossier_id).all()
    facture_ids = [facture.id for facture in factures]
    if not facture_ids:
        return []
    return db.query(Ecriture).filter(Ecriture.facture_id.in_(facture_ids)).all()


@router.get("/{dossier_id}/export")
def export_journal(dossier_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    factures = db.query(Facture).filter(Facture.dossier_id == dossier_id).all()
    facture_ids = [facture.id for facture in factures]
    ecritures = db.query(Ecriture).filter(Ecriture.facture_id.in_(facture_ids)).all() if facture_ids else []

    workbook = build_export_workbook(factures, ecritures)
    stream = io.BytesIO()
    workbook.save(stream)
    stream.seek(0)

    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=journal_dossier_{dossier_id}.xlsx"},
    )
