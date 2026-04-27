import os
from datetime import datetime

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from models.database import SessionLocal, get_db
from models.schemas import AuditLog, Dossier, Ecriture, Facture, User
from routers.auth import get_current_user, hash_password

router = APIRouter(tags=["Admin"])
load_dotenv()


def _mask_secret(value: str | None) -> str:
    if not value:
        return "non configure"
    if len(value) <= 8:
        return "configure"
    return f"{value[:4]}...{value[-4:]}"


def _collect_status() -> dict:
    db = SessionLocal()
    try:
        dossier_count = db.query(Dossier).count()
        facture_count = db.query(Facture).count()
        ecriture_count = db.query(Ecriture).count()
        user_count = db.query(User).count()
        db_ok = db.execute(text("SELECT 1")).scalar() == 1
    finally:
        db.close()

    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    project_id = os.getenv("GOOGLE_PROJECT_ID")
    processor_invoice = os.getenv("GOOGLE_PROCESSOR_ID_INVOICE")
    processor_bank = os.getenv("GOOGLE_PROCESSOR_ID_BANK")

    doc_ai_ready = all(
        value and not str(value).startswith("your_")
        for value in [project_id, processor_invoice, processor_bank]
    )

    return {
        "generated_at": datetime.utcnow().isoformat(),
        "database": {
            "ok": db_ok,
            "dossiers": dossier_count,
            "factures": facture_count,
            "ecritures": ecriture_count,
            "users": user_count,
        },
        "integrations": {
            "claude": {
                "configured": bool(anthropic_key and anthropic_key != "your_key_here"),
                "key_preview": _mask_secret(anthropic_key),
            },
            "document_ai": {
                "project_id": project_id or "non configure",
                "invoice_processor": processor_invoice or "non configure",
                "bank_processor": processor_bank or "non configure",
                "ready": doc_ai_ready,
            },
        },
        "links": {
            "swagger": "/docs",
            "openapi": "/openapi.json",
            "root": "/",
            "chat": "/chat",
        },
    }


@router.get(
    "/admin/status",
    summary="Etat technique du backend",
    description="Retourne les compteurs de base de donnees et l'etat des integrations Claude et Document AI.",
)
def admin_status():
    return _collect_status()


@router.get(
    "/admin",
    response_class=HTMLResponse,
    summary="Interface d'administration backend",
    description="Affiche un panneau backend lisible avec etat de sante, integrations et raccourcis.",
)
def admin_dashboard():
    status = _collect_status()
    db_status = status["database"]
    integrations = status["integrations"]

    html = f"""
    <!doctype html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>FinDoc Backend Admin</title>
        <style>
          :root {{
            --bg: #f6f1ea;
            --panel: rgba(255,255,255,.82);
            --line: #ddcfbf;
            --ink: #2f241a;
            --muted: #6c6258;
            --accent: #9f633b;
            --accent-soft: #f3dfcf;
            --ok: #2d7a5b;
            --warn: #b26a2b;
          }}
          * {{ box-sizing: border-box; }}
          body {{
            margin: 0;
            font-family: Inter, Segoe UI, sans-serif;
            color: var(--ink);
            background:
              radial-gradient(circle at top left, rgba(159,99,59,.18), transparent 32%),
              radial-gradient(circle at bottom right, rgba(47,111,106,.12), transparent 28%),
              var(--bg);
          }}
          .wrap {{
            max-width: 1180px;
            margin: 0 auto;
            padding: 28px;
          }}
          .hero {{
            display: flex;
            align-items: end;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 22px;
          }}
          h1 {{
            margin: 0 0 8px;
            font-size: 40px;
            line-height: 1;
            letter-spacing: -0.04em;
          }}
          .sub {{
            color: var(--muted);
            max-width: 760px;
            line-height: 1.55;
          }}
          .pill {{
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 10px 14px;
            border-radius: 999px;
            background: var(--panel);
            border: 1px solid var(--line);
            color: var(--muted);
            font-size: 13px;
          }}
          .grid {{
            display: grid;
            grid-template-columns: repeat(12, 1fr);
            gap: 16px;
          }}
          .card {{
            grid-column: span 12;
            background: var(--panel);
            border: 1px solid var(--line);
            border-radius: 24px;
            padding: 22px;
            box-shadow: 0 18px 40px rgba(47, 36, 26, 0.08);
            backdrop-filter: blur(10px);
          }}
          .card.half {{ grid-column: span 6; }}
          .card.third {{ grid-column: span 4; }}
          .card h2 {{
            margin: 0 0 14px;
            font-size: 20px;
            letter-spacing: -0.03em;
          }}
          .metrics {{
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
          }}
          .metric {{
            padding: 16px;
            border-radius: 18px;
            background: rgba(255,255,255,.7);
            border: 1px solid var(--line);
          }}
          .metric .label {{
            color: var(--muted);
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: .12em;
            margin-bottom: 10px;
          }}
          .metric .value {{
            font-size: 32px;
            font-weight: 700;
            letter-spacing: -0.04em;
          }}
          .stack {{
            display: flex;
            flex-direction: column;
            gap: 12px;
          }}
          .row {{
            display: flex;
            justify-content: space-between;
            gap: 16px;
            padding: 14px 16px;
            border-radius: 16px;
            background: rgba(255,255,255,.62);
            border: 1px solid var(--line);
          }}
          .row strong {{ display: block; margin-bottom: 4px; }}
          .status {{
            font-size: 12px;
            font-weight: 700;
            padding: 6px 10px;
            border-radius: 999px;
            align-self: center;
            white-space: nowrap;
          }}
          .status.ok {{ background: rgba(45,122,91,.12); color: var(--ok); }}
          .status.warn {{ background: rgba(178,106,43,.12); color: var(--warn); }}
          .links {{
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
          }}
          a.quick {{
            text-decoration: none;
            color: var(--ink);
            padding: 12px 14px;
            border-radius: 14px;
            background: rgba(255,255,255,.74);
            border: 1px solid var(--line);
            font-size: 13px;
            font-weight: 600;
          }}
          code {{
            font-family: ui-monospace, SFMono-Regular, monospace;
            font-size: 12px;
            background: var(--accent-soft);
            padding: 3px 6px;
            border-radius: 8px;
          }}
          .footer {{
            margin-top: 16px;
            color: var(--muted);
            font-size: 12px;
          }}
          @media (max-width: 960px) {{
            .card.half, .card.third {{ grid-column: span 12; }}
            .metrics {{ grid-template-columns: repeat(2, 1fr); }}
          }}
          @media (max-width: 640px) {{
            .wrap {{ padding: 18px; }}
            h1 {{ font-size: 30px; }}
            .metrics {{ grid-template-columns: 1fr; }}
          }}
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="hero">
            <div>
              <h1>FinDoc Backend</h1>
              <div class="sub">
                Console de supervision locale pour comprendre rapidement l'etat du backend,
                de la base, des integrations IA et des endpoints principaux.
              </div>
            </div>
            <div class="pill">Maj: <code>{status["generated_at"]}</code></div>
          </div>

          <div class="grid">
            <section class="card">
              <h2>Sante generale</h2>
              <div class="metrics">
                <div class="metric">
                  <div class="label">Base SQLite</div>
                  <div class="value">{"OK" if db_status["ok"] else "KO"}</div>
                </div>
                <div class="metric">
                  <div class="label">Dossiers</div>
                  <div class="value">{db_status["dossiers"]}</div>
                </div>
                <div class="metric">
                  <div class="label">Factures</div>
                  <div class="value">{db_status["factures"]}</div>
                </div>
                <div class="metric">
                  <div class="label">Ecritures</div>
                  <div class="value">{db_status["ecritures"]}</div>
                </div>
              </div>
            </section>

            <section class="card half">
              <h2>Integrations IA</h2>
              <div class="stack">
                <div class="row">
                  <div>
                    <strong>Claude / Anthropic</strong>
                    <div>Cle detectee: <code>{integrations["claude"]["key_preview"]}</code></div>
                  </div>
                  <span class="status {"ok" if integrations["claude"]["configured"] else "warn"}">
                    {"pret" if integrations["claude"]["configured"] else "a configurer"}
                  </span>
                </div>
                <div class="row">
                  <div>
                    <strong>Google Document AI</strong>
                    <div>Projet: <code>{integrations["document_ai"]["project_id"]}</code></div>
                    <div>Invoice: <code>{integrations["document_ai"]["invoice_processor"]}</code></div>
                    <div>Bank: <code>{integrations["document_ai"]["bank_processor"]}</code></div>
                  </div>
                  <span class="status {"ok" if integrations["document_ai"]["ready"] else "warn"}">
                    {"pret" if integrations["document_ai"]["ready"] else "partiel"}
                  </span>
                </div>
              </div>
            </section>

            <section class="card half">
              <h2>Raccourcis utiles</h2>
              <div class="links">
                <a class="quick" href="/">Accueil API</a>
                <a class="quick" href="/docs">Swagger /docs</a>
                <a class="quick" href="/openapi.json">OpenAPI JSON</a>
                <a class="quick" href="/admin/status">JSON status</a>
              </div>
              <div class="footer">
                Pour les tests rapides, commence par <code>/docs</code> puis suis l'ordre:
                Authentification → Dossiers → Factures → Reconciliation → Chat IA.
              </div>
            </section>

            <section class="card third">
              <h2>Endpoints metier</h2>
              <div class="stack">
                <div class="row"><div><strong>Connexion</strong><div><code>POST /auth/login</code></div></div></div>
                <div class="row"><div><strong>Upload facture</strong><div><code>POST /factures/{{dossier_id}}/upload</code></div></div></div>
                <div class="row"><div><strong>Export Excel</strong><div><code>GET /factures/{{dossier_id}}/export</code></div></div></div>
              </div>
            </section>

            <section class="card third">
              <h2>Reconciliation</h2>
              <div class="stack">
                <div class="row"><div><strong>Analyse releve</strong><div><code>POST /reconciliation/{{dossier_id}}/upload</code></div></div></div>
                <div class="row"><div><strong>Etat retards</strong><div><code>GET /reconciliation/{{dossier_id}}</code></div></div></div>
                <div class="row"><div><strong>Utilisateurs</strong><div><code>{db_status["users"]} compte(s)</code></div></div></div>
              </div>
            </section>

            <section class="card third">
              <h2>Assistant IA</h2>
              <div class="stack">
                <div class="row"><div><strong>Chat dossier</strong><div><code>POST /chat</code></div></div></div>
                <div class="row"><div><strong>Streaming</strong><div>SSE avec events <code>ready</code>, <code>chunk</code>, <code>done</code></div></div></div>
                <div class="row"><div><strong>Mode fallback</strong><div>{"actif si cle manquante" if not integrations["claude"]["configured"] else "disponible en secours"}</div></div></div>
              </div>
            </section>
          </div>
        </div>
      </body>
    </html>
    """
    return HTMLResponse(html)


# ── Audit log endpoints ────────────────────────────────────────────────────────

def log_action(db: Session, user_id: int | None, user_email: str | None, action: str,
               ressource: str | None = None, ressource_id: int | None = None,
               details: str | None = None, ip: str | None = None):
    entry = AuditLog(
        user_id=user_id,
        user_email=user_email,
        action=action,
        ressource=ressource,
        ressource_id=ressource_id,
        details=details,
        ip=ip,
    )
    db.add(entry)
    db.commit()


@router.get(
    "/admin/audit",
    summary="Journal d'audit",
    description="Retourne les dernières actions enregistrées dans le journal d'audit.",
)
def get_audit_log(
    limit: int = 100,
    ressource: str | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role not in ("admin", "super"):
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")
    query = db.query(AuditLog).order_by(AuditLog.created_at.desc())
    if ressource:
        query = query.filter(AuditLog.ressource == ressource)
    logs = query.limit(limit).all()
    return [
        {
            "id": l.id,
            "user_email": l.user_email,
            "action": l.action,
            "ressource": l.ressource,
            "ressource_id": l.ressource_id,
            "details": l.details,
            "ip": l.ip,
            "created_at": l.created_at.isoformat(),
        }
        for l in logs
    ]


# ── User management endpoints ──────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: str
    password: str
    nom: str
    role: str = "collab"


class UserUpdate(BaseModel):
    nom: str | None = None
    role: str | None = None
    password: str | None = None


@router.get(
    "/admin/users",
    summary="Lister tous les utilisateurs",
)
def list_users(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role not in ("admin", "super"):
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        {"id": u.id, "email": u.email, "nom": u.nom, "role": u.role, "created_at": u.created_at.isoformat()}
        for u in users
    ]


@router.post(
    "/admin/users",
    summary="Créer un utilisateur",
)
def create_user(
    payload: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role not in ("admin", "super"):
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email déjà utilisé")
    user = User(email=payload.email, hashed_password=hash_password(payload.password), nom=payload.nom, role=payload.role)
    db.add(user)
    db.commit()
    db.refresh(user)
    log_action(db, current_user.id, current_user.email, "create_user", "user", user.id,
               f"email={user.email} role={user.role}", request.client.host if request.client else None)
    return {"id": user.id, "email": user.email, "nom": user.nom, "role": user.role}


@router.patch(
    "/admin/users/{user_id}",
    summary="Modifier un utilisateur",
)
def update_user(
    user_id: int,
    payload: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role not in ("admin", "super"):
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    if payload.nom is not None:
        user.nom = payload.nom
    if payload.role is not None:
        user.role = payload.role
    if payload.password:
        user.hashed_password = hash_password(payload.password)
    db.commit()
    log_action(db, current_user.id, current_user.email, "update_user", "user", user_id,
               f"role={user.role}", request.client.host if request.client else None)
    return {"id": user.id, "email": user.email, "nom": user.nom, "role": user.role}


@router.delete(
    "/admin/users/{user_id}",
    summary="Désactiver un utilisateur",
)
def delete_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role not in ("admin", "super"):
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas supprimer votre propre compte")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    db.delete(user)
    db.commit()
    log_action(db, current_user.id, current_user.email, "delete_user", "user", user_id,
               f"email={user.email}", request.client.host if request.client else None)
