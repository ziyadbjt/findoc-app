import os
import sqlite3

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from models import schemas
from models.database import engine
from routers import admin, auth, chat, dossiers, factures, learning, reconciliation, relances


schemas.Base.metadata.create_all(bind=engine)

_DB_PATH = os.getenv("DB_PATH", os.path.join(os.path.dirname(__file__), "findoc.db"))
_NEW_COLS = [
    ("if_number", "TEXT"),
    ("rc_number", "TEXT"),
    ("cnss_number", "TEXT"),
    ("capital_social", "REAL"),
    ("adresse", "TEXT"),
    ("telephone", "TEXT"),
    ("email_societe", "TEXT"),
    ("site_web", "TEXT"),
    ("logo_hue", "INTEGER"),
]
with sqlite3.connect(_DB_PATH) as connection:
    existing = {row[1] for row in connection.execute("PRAGMA table_info(dossiers)")}
    for col, typ in _NEW_COLS:
        if col not in existing:
            connection.execute(f"ALTER TABLE dossiers ADD COLUMN {col} {typ}")

app = FastAPI(
    title="FinDoc Backend API",
    summary="API de gestion documentaire et comptable pour FinDoc.",
    description=(
        "Cette API centralise les flux principaux de FinDoc : authentification, dossiers, "
        "upload et extraction de factures, reconciliation bancaire, chat IA et export Excel.\n\n"
        "Ordre de lecture recommande dans /docs :\n"
        "1. Authentification\n"
        "2. Dossiers\n"
        "3. Factures\n"
        "4. Reconciliation bancaire\n"
        "5. Chat IA"
    ),
    version="2.4.0",
    contact={"name": "FinDoc", "email": "support@findoc.local"},
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(dossiers.router)
app.include_router(factures.router)
app.include_router(reconciliation.router)
app.include_router(chat.router)
app.include_router(learning.router)
app.include_router(admin.router)
app.include_router(relances.router)


@app.get(
    "/",
    tags=["system"],
    summary="Verifier que l'API est en ligne",
    description="Retourne un message simple confirmant que le backend FinDoc fonctionne.",
)
def root():
    return {
        "message": "FinDoc API is running",
        "docs": "/docs",
        "admin": "/admin",
        "status": "/admin/status",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
