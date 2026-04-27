import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from models.database import get_db
from models.schemas import PrivateMessage, TeamMessage, User
from routers.auth import get_current_user
from services.chat_context import build_chat_context
from services.claude import stream_chat_response

router = APIRouter(tags=["Chat IA"])


class ChatHistoryItem(BaseModel):
    role: str = Field(default="user", description="Role du message: user ou assistant")
    content: str = Field(description="Contenu textuel du message")


class ChatRequest(BaseModel):
    dossier_id: int = Field(description="Identifiant du dossier concerne")
    message: str = Field(description="Question actuelle de l'utilisateur")
    historique: list[ChatHistoryItem] = Field(default_factory=list, description="Historique conversationnel recent")


class TeamMessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=4000, description="Message interne d'equipe")


class TeamMessageResponse(BaseModel):
    id: int
    dossier_id: int
    user_id: int
    user_name: str
    user_email: str
    content: str
    created_at: str


class PrivateContactResponse(BaseModel):
    id: int
    email: str
    nom: str
    role: str


class PrivateMessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=4000, description="Message prive")


class PrivateMessageResponse(BaseModel):
    id: int
    dossier_id: int
    sender_id: int
    sender_name: str
    sender_email: str
    recipient_id: int
    content: str
    created_at: str


@router.post(
    "/chat",
    summary="Dialoguer avec l'assistant IA du dossier",
    description="Retourne une reponse en streaming SSE basee sur le contexte du dossier, des factures et des ecritures.",
)
def chat(payload: ChatRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    context = build_chat_context(db, payload.dossier_id)

    def event_stream():
        yield "event: ready\ndata: " + json.dumps({"ok": True}, ensure_ascii=True) + "\n\n"
        for chunk in stream_chat_response(
            payload.message,
            [item.model_dump() for item in payload.historique],
            context,
        ):
            yield "event: chunk\ndata: " + json.dumps({"text": chunk}, ensure_ascii=True) + "\n\n"
        yield "event: done\ndata: " + json.dumps({"ok": True}, ensure_ascii=True) + "\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get(
    "/chat/team/{dossier_id}",
    response_model=list[TeamMessageResponse],
    summary="Lister les messages du chat interne d'equipe",
    description="Retourne les messages internes associes a un dossier, avec auteur et date.",
)
def list_team_messages(dossier_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    rows = (
        db.query(TeamMessage, User)
        .join(User, User.id == TeamMessage.user_id)
        .filter(TeamMessage.dossier_id == dossier_id)
        .order_by(TeamMessage.created_at.asc(), TeamMessage.id.asc())
        .all()
    )
    return [
        {
            "id": message.id,
            "dossier_id": message.dossier_id,
            "user_id": message.user_id,
            "user_name": user.nom or user.email,
            "user_email": user.email,
            "content": message.content,
            "created_at": message.created_at.isoformat(),
        }
        for message, user in rows
    ]


@router.post(
    "/chat/team/{dossier_id}",
    response_model=TeamMessageResponse,
    summary="Envoyer un message dans le chat interne d'equipe",
    description="Ajoute un message interne pour l'equipe sur un dossier donne.",
)
def create_team_message(
    dossier_id: int,
    payload: TeamMessageCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message vide")

    message = TeamMessage(
        dossier_id=dossier_id,
        user_id=current_user.id,
        content=content,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return {
        "id": message.id,
        "dossier_id": message.dossier_id,
        "user_id": message.user_id,
        "user_name": current_user.nom or current_user.email,
        "user_email": current_user.email,
        "content": message.content,
        "created_at": message.created_at.isoformat(),
    }


@router.get(
    "/chat/private/{dossier_id}/contacts",
    response_model=list[PrivateContactResponse],
    summary="Lister les contacts disponibles pour le chat prive",
)
def list_private_contacts(dossier_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    users = (
        db.query(User)
        .filter(User.id != current_user.id)
        .order_by(User.nom.asc(), User.email.asc())
        .all()
    )
    return [
        {
            "id": user.id,
            "email": user.email,
            "nom": user.nom or user.email,
            "role": user.role,
        }
        for user in users
    ]


@router.get(
    "/chat/private/{dossier_id}/{other_user_id}",
    response_model=list[PrivateMessageResponse],
    summary="Lister une conversation privee",
)
def list_private_messages(
    dossier_id: int,
    other_user_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    rows = (
        db.query(PrivateMessage, User)
        .join(User, User.id == PrivateMessage.sender_id)
        .filter(PrivateMessage.dossier_id == dossier_id)
        .filter(
            (
                (PrivateMessage.sender_id == current_user.id)
                & (PrivateMessage.recipient_id == other_user_id)
            )
            | (
                (PrivateMessage.sender_id == other_user_id)
                & (PrivateMessage.recipient_id == current_user.id)
            )
        )
        .order_by(PrivateMessage.created_at.asc(), PrivateMessage.id.asc())
        .all()
    )
    return [
        {
            "id": message.id,
            "dossier_id": message.dossier_id,
            "sender_id": message.sender_id,
            "sender_name": sender.nom or sender.email,
            "sender_email": sender.email,
            "recipient_id": message.recipient_id,
            "content": message.content,
            "created_at": message.created_at.isoformat(),
        }
        for message, sender in rows
    ]


@router.post(
    "/chat/private/{dossier_id}/{other_user_id}",
    response_model=PrivateMessageResponse,
    summary="Envoyer un message prive",
)
def create_private_message(
    dossier_id: int,
    other_user_id: int,
    payload: PrivateMessageCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message vide")

    recipient = db.query(User).filter(User.id == other_user_id).first()
    if recipient is None:
        raise HTTPException(status_code=404, detail="Contact introuvable")

    message = PrivateMessage(
        dossier_id=dossier_id,
        sender_id=current_user.id,
        recipient_id=recipient.id,
        content=content,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return {
        "id": message.id,
        "dossier_id": message.dossier_id,
        "sender_id": message.sender_id,
        "sender_name": current_user.nom or current_user.email,
        "sender_email": current_user.email,
        "recipient_id": message.recipient_id,
        "content": message.content,
        "created_at": message.created_at.isoformat(),
    }
