from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from datetime import datetime

from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from models.database import get_db
from models.schemas import Dossier, PCMCompte
from routers.auth import get_current_user
from services.extract_societe import extract_societe

router = APIRouter(prefix="/dossiers", tags=["Dossiers"])


class DossierDeleteResponse(BaseModel):
    message: str


class DossierUpdate(BaseModel):
    exercice_courant: int | None = Field(default=None, ge=2000, le=2100)
    regime_tva: str | None = None


class PCMCompteIn(BaseModel):
    compte: str
    libelle: str
    classe: str | None = None


def _normalise_pcm(payload: PCMCompteIn) -> dict:
    compte = payload.compte.strip()
    libelle = payload.libelle.strip()
    classe = (payload.classe or compte[:1]).strip()
    if not compte or not libelle:
        raise HTTPException(status_code=400, detail="Compte et libelle requis")
    return {"compte": compte, "libelle": libelle, "classe": classe}


@router.get(
    "/",
    summary="Lister les dossiers",
    description="Retourne tous les dossiers accessibles a l'utilisateur connecte.",
)
def list_dossiers(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(Dossier).all()


@router.post(
    "/",
    summary="Creer un dossier",
    description="Cree un nouveau dossier client avec ses informations legales et fiscales.",
)
def create_dossier(
    raison_sociale: str,
    ice: str = "",
    forme_juridique: str = "SARL",
    ville: str = "",
    secteur: str = "",
    regime_tva: str = "debits",
    exercice_courant: int = None,
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
    current_user=Depends(get_current_user),
):
    dossier = Dossier(
        raison_sociale=raison_sociale,
        ice=ice,
        forme_juridique=forme_juridique,
        ville=ville,
        secteur=secteur,
        regime_tva=regime_tva,
        exercice_courant=exercice_courant or datetime.utcnow().year,
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


@router.post(
    "/extract-societe",
    summary="Extraire les informations d'une societe depuis un document",
    description="Analyse un PDF, JPG, PNG ou XML pour pre-remplir un dossier societe.",
)
async def extract_societe_from_doc(file: UploadFile = File(...), current_user=Depends(get_current_user)):
    allowed = {"pdf", "jpg", "jpeg", "png", "xml"}
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"Format non supporte : .{ext}. Utilisez PDF, JPG, PNG ou XML.")

    data = await file.read()
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Fichier trop lourd (max 20 Mo)")

    try:
        result = extract_societe(data, file.filename)
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erreur d'extraction : {str(exc)}")
    return result


@router.get(
    "/{dossier_id}",
    summary="Recuperer un dossier",
    description="Retourne les informations detaillees d'un dossier par son identifiant.",
)
def get_dossier(dossier_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    dossier = db.query(Dossier).filter(Dossier.id == dossier_id).first()
    if not dossier:
        raise HTTPException(status_code=404, detail="Dossier introuvable")
    return dossier


@router.get(
    "/{dossier_id}/pcm",
    summary="Lister le plan comptable du dossier",
    description="Retourne les comptes PCM persistes et utilises par l'analyse IA.",
)
def list_pcm(dossier_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if not db.query(Dossier.id).filter(Dossier.id == dossier_id).first():
        raise HTTPException(status_code=404, detail="Dossier introuvable")
    rows = (
        db.query(PCMCompte)
        .filter(PCMCompte.dossier_id == dossier_id)
        .order_by(PCMCompte.compte.asc())
        .all()
    )
    return [{"id": row.id, "compte": row.compte, "libelle": row.libelle, "classe": row.classe} for row in rows]


@router.put(
    "/{dossier_id}/pcm",
    summary="Remplacer le plan comptable du dossier",
    description="Importe ou remplace en bloc les comptes PCM du dossier.",
)
def replace_pcm(
    dossier_id: int,
    payload: list[PCMCompteIn],
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not db.query(Dossier.id).filter(Dossier.id == dossier_id).first():
        raise HTTPException(status_code=404, detail="Dossier introuvable")

    seen: dict[str, dict] = {}
    for item in payload:
        row = _normalise_pcm(item)
        seen[row["compte"]] = row

    db.query(PCMCompte).filter(PCMCompte.dossier_id == dossier_id).delete()
    for row in seen.values():
        db.add(PCMCompte(dossier_id=dossier_id, **row))
    db.commit()
    return list_pcm(dossier_id, db, current_user)


@router.patch(
    "/{dossier_id}",
    summary="Mettre a jour un dossier",
    description="Met a jour les parametres de travail du dossier, dont l'exercice courant.",
)
def update_dossier(dossier_id: int, payload: DossierUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    dossier = db.query(Dossier).filter(Dossier.id == dossier_id).first()
    if not dossier:
        raise HTTPException(status_code=404, detail="Dossier introuvable")

    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(dossier, key, value)
    db.commit()
    db.refresh(dossier)
    return dossier


@router.delete(
    "/{dossier_id}",
    response_model=DossierDeleteResponse,
    summary="Supprimer un dossier",
    description="Supprime le dossier cible si celui-ci existe.",
)
def delete_dossier(dossier_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    dossier = db.query(Dossier).filter(Dossier.id == dossier_id).first()
    if not dossier:
        raise HTTPException(status_code=404, detail="Dossier introuvable")
    db.delete(dossier)
    db.commit()
    return {"message": "Dossier supprime"}
