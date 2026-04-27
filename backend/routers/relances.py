import os
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from models.database import get_db
from models.schemas import Facture, Relance
from routers.auth import get_current_user

router = APIRouter(prefix="/relances", tags=["Relances"])


class RelanceCreate(BaseModel):
    facture_ids: list[int] = Field(min_length=1)
    destinataire_email: EmailStr
    destinataire_nom: str
    sujet: str
    corps: str
    niveau: int = Field(ge=1, le=3, default=1)


class RelanceResponse(BaseModel):
    id: int
    facture_id: int
    niveau: int
    destinataire_email: str
    envoye: bool
    envoye_at: str | None
    created_at: str


def _send_email(to_email: str, subject: str, body: str) -> bool:
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")
    from_email = os.getenv("SMTP_FROM", smtp_user or "noreply@findoc.ma")

    if not smtp_host or not smtp_user:
        # Log sans lever d'exception — l'email est marqué "non envoyé" mais la relance est créée
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = from_email
        msg["To"] = to_email
        msg.attach(MIMEText(body, "plain", "utf-8"))

        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(from_email, [to_email], msg.as_string())
        return True
    except Exception:
        return False


@router.post(
    "/send",
    summary="Envoyer une relance email",
    description="Envoie un email de relance pour une ou plusieurs factures et enregistre l'historique.",
)
def send_relance(
    payload: RelanceCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    factures = db.query(Facture).filter(Facture.id.in_(payload.facture_ids)).all()
    if not factures:
        raise HTTPException(status_code=404, detail="Factures introuvables")

    sent = _send_email(payload.destinataire_email, payload.sujet, payload.corps)
    now = datetime.utcnow()

    created = []
    for facture in factures:
        relance = Relance(
            facture_id=facture.id,
            niveau=payload.niveau,
            destinataire_email=payload.destinataire_email,
            destinataire_nom=payload.destinataire_nom,
            sujet=payload.sujet,
            corps=payload.corps,
            envoye=sent,
            envoye_at=now if sent else None,
            created_by=current_user.id,
        )
        db.add(relance)
        created.append(relance)

    db.commit()
    for r in created:
        db.refresh(r)

    return {
        "envoye": sent,
        "count": len(created),
        "message": "Email envoyé avec succès" if sent else "Relance enregistrée (email non configuré — ajoutez SMTP_HOST dans .env)",
    }


@router.get(
    "/{dossier_id}",
    summary="Historique des relances d'un dossier",
    description="Retourne toutes les relances envoyées ou créées pour les factures du dossier.",
)
def get_relances(dossier_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    factures = db.query(Facture).filter(Facture.dossier_id == dossier_id).all()
    facture_ids = [f.id for f in factures]
    if not facture_ids:
        return []
    relances = db.query(Relance).filter(Relance.facture_id.in_(facture_ids)).order_by(Relance.created_at.desc()).all()
    return [
        {
            "id": r.id,
            "facture_id": r.facture_id,
            "niveau": r.niveau,
            "destinataire_email": r.destinataire_email,
            "envoye": r.envoye,
            "envoye_at": r.envoye_at.isoformat() if r.envoye_at else None,
            "created_at": r.created_at.isoformat(),
        }
        for r in relances
    ]
