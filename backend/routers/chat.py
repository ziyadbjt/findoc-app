import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from models.database import get_db
from routers.auth import get_current_user
from services.chat_context import build_chat_context
from services.claude import stream_chat_response


router = APIRouter(tags=["chat"])


class ChatHistoryItem(BaseModel):
    role: str = Field(default="user")
    content: str


class ChatRequest(BaseModel):
    dossier_id: int
    message: str
    historique: list[ChatHistoryItem] = Field(default_factory=list)


@router.post("/chat")
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
