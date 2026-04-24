import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from models.database import get_db
from models.schemas import TeamMessage, User
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
