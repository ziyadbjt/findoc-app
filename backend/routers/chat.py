import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from models.database import get_db
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
