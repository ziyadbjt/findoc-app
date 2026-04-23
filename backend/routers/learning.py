"""
Learning router — records user corrections and stores them in ChromaDB for RAG.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import uuid

from models.database import get_db
from models.schemas import Correction
from services.rag import store_correction, get_similar_corrections, rag_available
from routers.auth import get_current_user

router = APIRouter(prefix="/learning", tags=["learning"])


class CorrectionIn(BaseModel):
    dossier_id: int
    facture_id: Optional[int] = None
    fournisseur: str
    description: Optional[str] = ""
    montant: Optional[float] = 0.0
    champ: str
    valeur_originale: str
    valeur_corrigee: str


class SimilarQuery(BaseModel):
    fournisseur: str
    description: Optional[str] = ""
    montant: Optional[float] = 0.0
    dossier_id: Optional[int] = None


@router.post("/correction", summary="Enregistrer une correction utilisateur")
def record_correction(
    payload: CorrectionIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    correction_id = str(uuid.uuid4())

    # Persist in SQLite
    db_correction = Correction(
        dossier_id=payload.dossier_id,
        facture_id=payload.facture_id,
        fournisseur=payload.fournisseur,
        description=payload.description or "",
        montant=payload.montant or 0.0,
        champ=payload.champ,
        valeur_originale=payload.valeur_originale,
        valeur_corrigee=payload.valeur_corrigee,
    )
    db.add(db_correction)
    db.commit()
    db.refresh(db_correction)

    # Store embedding in ChromaDB
    rag_stored = store_correction(
        correction_id=f"{db_correction.id}-{correction_id}",
        dossier_id=payload.dossier_id,
        fournisseur=payload.fournisseur,
        description=payload.description or "",
        montant=payload.montant or 0.0,
        champ=payload.champ,
        valeur_originale=payload.valeur_originale,
        valeur_corrigee=payload.valeur_corrigee,
    )

    return {
        "id": db_correction.id,
        "rag_indexed": rag_stored,
        "rag_available": rag_available(),
    }


@router.get("/corrections/{dossier_id}", summary="Lister les corrections d'un dossier")
def list_corrections(
    dossier_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    corrections = (
        db.query(Correction)
        .filter(Correction.dossier_id == dossier_id)
        .order_by(Correction.created_at.desc())
        .limit(100)
        .all()
    )
    return [
        {
            "id": c.id,
            "fournisseur": c.fournisseur,
            "champ": c.champ,
            "valeur_originale": c.valeur_originale,
            "valeur_corrigee": c.valeur_corrigee,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in corrections
    ]


@router.post("/similar", summary="Trouver des corrections similaires (RAG)")
def find_similar(
    payload: SimilarQuery,
    current_user=Depends(get_current_user),
):
    results = get_similar_corrections(
        fournisseur=payload.fournisseur,
        description=payload.description or "",
        montant=payload.montant or 0.0,
        dossier_id=payload.dossier_id,
    )
    return {"corrections": results, "rag_available": rag_available()}


@router.get("/status", summary="Statut du système RAG")
def rag_status(current_user=Depends(get_current_user)):
    available = rag_available()
    return {
        "rag_available": available,
        "message": "ChromaDB + sentence-transformers opérationnels" if available
                   else "RAG non disponible — pip install chromadb sentence-transformers",
    }
