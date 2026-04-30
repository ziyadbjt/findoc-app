import io
import os
import re
import shutil
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from models.database import get_db
from models.schemas import Dossier, Ecriture, Facture
from routers.auth import get_current_user
from services.claude import analyser_rattachement_exercice, generer_ecritures, generate_monthly_report
from services.document_ai import extract_facture
from services.export import build_export_workbook

router = APIRouter(prefix="/factures", tags=["Factures"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _facture_exercice(facture: Facture) -> int | None:
    if facture.exercice_rattachement:
        return int(facture.exercice_rattachement)
    if facture.date_facture and re.match(r"^\d{4}", str(facture.date_facture)):
        return int(str(facture.date_facture)[:4])
    return None


class UploadFactureItem(BaseModel):
    id: int | None = None
    fichier: str
    fournisseur: str | None = None
    num_facture: str | None = None
    montant_ttc: float | None = None
    statut: str
    source_ai: str | None = None
    confiance: float | None = None
    validation_status: str | None = None


class UploadFacturesResponse(BaseModel):
    total: int
    resultats: list[UploadFactureItem]


class FactureUpdate(BaseModel):
    fournisseur: str | None = None
    code_tiers: str | None = None
    num_facture: str | None = None
    date_facture: str | None = None
    date_echeance: str | None = None
    montant_ht: float | None = None
    tva: float | None = None
    montant_ttc: float | None = None
    type: str | None = None
    paiement: str | None = None
    statut: str | None = None
    categorie: str | None = None
    compte_pcm: str | None = None
    exercice_rattachement: int | None = Field(default=None, ge=2000, le=2100)
    traitement_comptable: str | None = None
    validation_status: str | None = None
    analyse_ai: str | None = None


@router.post(
    "/{dossier_id}/upload",
    response_model=UploadFacturesResponse,
    summary="Uploader et analyser des factures",
    description="Importe un ou plusieurs PDF/images, lance l'extraction IA, puis genere les ecritures.",
)
async def upload_factures(
    dossier_id: int,
    request: Request,
    files: list[UploadFile] = File(..., description="Liste de fichiers PDF, PNG, JPG ou JPEG"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    results = []
    for file in files:
        if not file.filename.lower().endswith((".pdf", ".png", ".jpg", ".jpeg")):
            results.append({"fichier": file.filename, "statut": "erreur"})
            continue

        safe_ext = os.path.splitext(file.filename or "")[-1].lower()
        safe_name = f"{dossier_id}_{uuid.uuid4().hex}{safe_ext}"
        path = os.path.join(UPLOAD_DIR, safe_name)
        with open(path, "wb") as handle:
            shutil.copyfileobj(file.file, handle)

        extracted = extract_facture(path, file.filename, dossier_id)
        exercice_analysis = analyser_rattachement_exercice({**extracted, "nom_fichier": file.filename})
        dossier = db.query(Dossier).filter(Dossier.id == dossier_id).first()
        exercice_rattachement = extracted.get("exercice_rattachement") or exercice_analysis.get("exercice_rattachement") or (dossier.exercice_courant if dossier else None)
        traitement_comptable = extracted.get("traitement_comptable") or exercice_analysis.get("traitement_comptable")
        niveau_risque = extracted.get("niveau_risque") or exercice_analysis.get("niveau_risque")
        commentaire_analyse = extracted.get("commentaire_analyse") or exercice_analysis.get("commentaire")

        facture = Facture(
            dossier_id=dossier_id,
            nom_fichier=file.filename,
            stored_filename=safe_name,
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
            type=extracted.get("type") or "achat",
            exercice_rattachement=exercice_rattachement,
            traitement_comptable=traitement_comptable,
            analyse_ai=commentaire_analyse,
            validation_status="a_verifier" if niveau_risque in ("moyen", "eleve") else "a_valider",
            texte_source=extracted.get("texte_source"),
            ocr_payload=extracted.get("ocr_payload"),
            statut="traite",
            paiement=extracted.get("paiement") or "en_attente",
        )
        db.add(facture)
        db.commit()
        db.refresh(facture)

        ecritures = generer_ecritures({**extracted, "type": facture.type, "compte_pcm": facture.compte_pcm})
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
                "validation_status": facture.validation_status,
            }
        )

    try:
        from routers.admin import log_action
        log_action(db, current_user.id, current_user.email, "upload_facture",
                   "dossier", dossier_id, f"{len(files)} fichier(s) importé(s)",
                   request.client.host if request.client else None)
    except Exception:
        pass

    return {"total": len(files), "resultats": results}


@router.get(
    "/{dossier_id}",
    summary="Lister les factures d'un dossier",
    description="Retourne toutes les factures enregistrees pour le dossier cible.",
)
def list_factures(dossier_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(Facture).filter(Facture.dossier_id == dossier_id).all()


@router.patch(
    "/item/{facture_id}",
    summary="Mettre a jour une facture",
    description="Corrige les champs valides d'une facture, notamment le rattachement d'exercice.",
)
def update_facture(facture_id: int, payload: FactureUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    facture = db.query(Facture).filter(Facture.id == facture_id).first()
    if facture is None:
        raise HTTPException(status_code=404, detail="Facture introuvable")

    data = payload.model_dump(exclude_unset=True)
    allowed = set(FactureUpdate.model_fields)
    for key, value in data.items():
        if key in allowed:
            setattr(facture, key, value)

    db.commit()
    db.refresh(facture)
    return facture


@router.get(
    "/item/{facture_id}/file",
    summary="Afficher le fichier original d'une facture",
    description="Retourne le PDF/image original importe pour le visualisateur.",
)
def get_facture_file(facture_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    facture = db.query(Facture).filter(Facture.id == facture_id).first()
    if facture is None:
        raise HTTPException(status_code=404, detail="Facture introuvable")
    if not facture.stored_filename:
        raise HTTPException(status_code=404, detail="Fichier original non rattache")

    safe_name = os.path.basename(facture.stored_filename)
    path = os.path.join(UPLOAD_DIR, safe_name)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Fichier original introuvable")

    return FileResponse(path, filename=facture.nom_fichier or safe_name)


@router.get(
    "/{dossier_id}/ecritures",
    summary="Lister les ecritures generees",
    description="Retourne les ecritures comptables rattachees aux factures du dossier.",
)
def list_ecritures(dossier_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    factures = db.query(Facture).filter(Facture.dossier_id == dossier_id).all()
    facture_ids = [facture.id for facture in factures]
    if not facture_ids:
        return []
    return db.query(Ecriture).filter(Ecriture.facture_id.in_(facture_ids)).all()


@router.get(
    "/{dossier_id}/rapport-mensuel",
    summary="Générer un rapport mensuel IA",
    description="Stream SSE — Claude génère un résumé comptable mensuel (CA, achats, TVA, retards, anomalies).",
)
def stream_rapport_mensuel(
    dossier_id: int,
    mois: int = 0,
    annee: int = 0,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    from datetime import datetime as _dt
    import json as _json

    dossier = db.query(Dossier).filter(Dossier.id == dossier_id).one_or_none()
    factures_all = db.query(Facture).filter(Facture.dossier_id == dossier_id).all()

    if mois and annee:
        factures_all = [
            f for f in factures_all
            if f.date_facture and str(f.date_facture)[:7] == f"{annee}-{mois:02d}"
        ]

    def event_generator():
        yield "event: ready\ndata: {}\n\n"
        for token in generate_monthly_report(dossier, factures_all, mois or _dt.utcnow().month, annee or _dt.utcnow().year):
            yield f"event: chunk\ndata: {_json.dumps({'text': token})}\n\n"
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get(
    "/{dossier_id}/export",
    summary="Exporter le dossier en Excel",
    description="Genere un fichier Excel avec journal, balance, TVA, penalites et grand livre.",
)
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


@router.get(
    "/{dossier_id}/export-dgi",
    summary="Exporter la declaration TVA au format DGI",
    description="Genere un fichier CSV compatible DGI pour la declaration TVA mensuelle.",
)
def export_dgi_tva(
    dossier_id: int,
    mois: int = 0,
    annee: int = 0,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    from datetime import datetime as _dt
    import csv

    factures_all = db.query(Facture).filter(Facture.dossier_id == dossier_id).all()

    if mois and annee:
        factures_all = [
            f for f in factures_all
            if f.date_facture and _dt.strptime(str(f.date_facture)[:7], "%Y-%m").month == mois
            and _facture_exercice(f) == annee
        ]
    elif annee:
        factures_all = [
            f for f in factures_all
            if f.date_facture and _facture_exercice(f) == annee
        ]

    achats = [f for f in factures_all if (f.type or "achat") == "achat"]
    ventes = [f for f in factures_all if f.type == "vente"]

    tva_collectee = sum(float(f.tva or 0) for f in ventes)
    tva_deductible = sum(float(f.tva or 0) for f in achats)
    solde_tva = round(tva_collectee - tva_deductible, 2)

    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")

    writer.writerow(["=== DECLARATION TVA — Format DGI Maroc ==="])
    writer.writerow(["Dossier ID", dossier_id])
    writer.writerow(["Periode", f"{mois:02d}/{annee}" if mois and annee else str(annee or "Tous")])
    writer.writerow(["Genere le", _dt.utcnow().strftime("%Y-%m-%d %H:%M")])
    writer.writerow([])
    writer.writerow(["RUBRIQUE", "BASE HT (MAD)", "TAUX TVA (%)", "TVA (MAD)"])

    for f in ventes:
        writer.writerow([
            f"Vente - {f.fournisseur or 'Client'}",
            round(float(f.montant_ht or 0), 2),
            round((float(f.tva or 0) / float(f.montant_ht or 1)) * 100, 1) if f.montant_ht else 20,
            round(float(f.tva or 0), 2),
        ])

    writer.writerow([])
    writer.writerow(["TOTAL TVA COLLECTEE", "", "", round(tva_collectee, 2)])
    writer.writerow([])

    for f in achats:
        writer.writerow([
            f"Achat - {f.fournisseur or 'Fournisseur'}",
            round(float(f.montant_ht or 0), 2),
            round((float(f.tva or 0) / float(f.montant_ht or 1)) * 100, 1) if f.montant_ht else 20,
            round(float(f.tva or 0), 2),
        ])

    writer.writerow([])
    writer.writerow(["TOTAL TVA DEDUCTIBLE", "", "", round(tva_deductible, 2)])
    writer.writerow([])
    writer.writerow(["SOLDE TVA NET", "", "", solde_tva])
    writer.writerow(["(+ = a reverser DGI  /  - = credit TVA)", "", "", ""])

    content = output.getvalue().encode("utf-8-sig")
    return StreamingResponse(
        io.BytesIO(content),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=declaration_tva_{dossier_id}.csv"},
    )
