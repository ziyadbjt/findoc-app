from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from models.database import engine
from models import schemas
from routers import auth, dossiers, factures, reconciliation
import sqlite3, os

schemas.Base.metadata.create_all(bind=engine)

# SQLite migration: add new columns if they don't exist
_DB_PATH = os.path.join(os.path.dirname(__file__), "findoc.db")
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
with sqlite3.connect(_DB_PATH) as _conn:
    _existing = {row[1] for row in _conn.execute("PRAGMA table_info(dossiers)")}
    for col, typ in _NEW_COLS:
        if col not in _existing:
            _conn.execute(f"ALTER TABLE dossiers ADD COLUMN {col} {typ}")

app = FastAPI(title="FinDoc API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(dossiers.router)
app.include_router(factures.router)
app.include_router(reconciliation.router)

@app.get("/")
def root():
    return {"message": "FinDoc API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)