"""
RAG (Retrieval-Augmented Generation) service for FinDoc.

Stores past extraction corrections as vector embeddings using ChromaDB + sentence-transformers.
When a new invoice is processed, similar past corrections are retrieved and injected into
the Claude prompt so it learns from past mistakes.
"""

import json
import os
from typing import Any

_chroma_client = None
_collection = None
_embedder = None
_COLLECTION_NAME = "findoc_corrections"
_CHROMA_PATH = os.getenv("CHROMA_PATH", os.path.join(os.path.dirname(__file__), "..", "chroma_db"))


def _get_embedder():
    global _embedder
    if _embedder is None:
        try:
            from sentence_transformers import SentenceTransformer
            _embedder = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
        except ImportError:
            _embedder = None
    return _embedder


def _get_collection():
    global _chroma_client, _collection
    if _collection is not None:
        return _collection
    try:
        import chromadb
        _chroma_client = chromadb.PersistentClient(path=_CHROMA_PATH)
        _collection = _chroma_client.get_or_create_collection(
            name=_COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
        return _collection
    except Exception:
        return None


def _embed(text: str) -> list[float] | None:
    embedder = _get_embedder()
    if embedder is None:
        return None
    try:
        return embedder.encode(text, normalize_embeddings=True).tolist()
    except Exception:
        return None


def _doc_text(fournisseur: str, description: str, montant: float) -> str:
    return f"fournisseur:{fournisseur} description:{description} montant:{montant:.0f}"


def store_correction(
    correction_id: str,
    dossier_id: int,
    fournisseur: str,
    description: str,
    montant: float,
    champ: str,
    valeur_originale: str,
    valeur_corrigee: str,
) -> bool:
    """Persist a user correction as an embedding in ChromaDB."""
    collection = _get_collection()
    if collection is None:
        return False

    text = _doc_text(fournisseur, description, montant)
    embedding = _embed(text)
    if embedding is None:
        return False

    metadata = {
        "dossier_id": str(dossier_id),
        "fournisseur": fournisseur,
        "champ": champ,
        "valeur_originale": valeur_originale,
        "valeur_corrigee": valeur_corrigee,
        "montant": montant,
    }

    try:
        collection.upsert(
            ids=[correction_id],
            embeddings=[embedding],
            documents=[text],
            metadatas=[metadata],
        )
        return True
    except Exception:
        return False


def get_similar_corrections(
    fournisseur: str,
    description: str,
    montant: float,
    dossier_id: int | None = None,
    n_results: int = 5,
) -> list[dict[str, Any]]:
    """Retrieve the n most similar past corrections for RAG injection."""
    collection = _get_collection()
    if collection is None or collection.count() == 0:
        return []

    text = _doc_text(fournisseur, description, montant)
    embedding = _embed(text)
    if embedding is None:
        return []

    try:
        where = {"dossier_id": str(dossier_id)} if dossier_id else None
        results = collection.query(
            query_embeddings=[embedding],
            n_results=min(n_results, collection.count()),
            where=where,
            include=["metadatas", "distances"],
        )
        corrections = []
        for meta, dist in zip(results["metadatas"][0], results["distances"][0]):
            if dist < 0.45:  # cosine similarity threshold
                corrections.append({**meta, "score": round(1 - dist, 3)})
        return corrections
    except Exception:
        return []


def build_rag_context(
    fournisseur: str,
    description: str,
    montant: float,
    dossier_id: int | None = None,
) -> str:
    """Return a formatted string to inject into the Claude prompt."""
    corrections = get_similar_corrections(fournisseur, description, montant, dossier_id)
    if not corrections:
        return ""

    lines = ["Corrections passées similaires (apprises des erreurs précédentes) :"]
    for c in corrections:
        lines.append(
            f"- Fournisseur '{c.get('fournisseur')}' | {c.get('champ')} : "
            f"'{c.get('valeur_originale')}' → '{c.get('valeur_corrigee')}' "
            f"(confiance {c.get('score', 0):.0%})"
        )
    lines.append("Applique ces corrections si la situation est similaire.")
    return "\n".join(lines)


def rag_available() -> bool:
    try:
        import chromadb  # noqa: F401
        from sentence_transformers import SentenceTransformer  # noqa: F401
        return True
    except ImportError:
        return False
