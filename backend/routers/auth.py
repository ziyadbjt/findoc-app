import os
import time
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from models.database import get_db
from models.schemas import User

_BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(_BACKEND_DIR / ".env")
load_dotenv(_BACKEND_DIR.parent / ".env")

# Simple in-memory rate limiter: max 10 login attempts per IP per 60s
_login_attempts: dict[str, list[float]] = defaultdict(list)
_RATE_WINDOW = 60
_RATE_MAX = 10


def _check_rate_limit(ip: str):
    now = time.time()
    attempts = [t for t in _login_attempts[ip] if now - t < _RATE_WINDOW]
    attempts.append(now)
    _login_attempts[ip] = attempts
    if len(attempts) > _RATE_MAX:
        raise HTTPException(status_code=429, detail="Trop de tentatives, réessayez dans 60 secondes")

router = APIRouter(prefix="/auth", tags=["Authentification"])

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY manquante — definissez-la dans backend/.env")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 1440))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


class RegisterResponse(BaseModel):
    message: str
    email: str
    role: str


class LoginResponse(BaseModel):
    access_token: str = Field(description="JWT a envoyer dans le header Authorization: Bearer <token>")
    token_type: str = Field(default="bearer")


class CurrentUserResponse(BaseModel):
    email: str
    nom: str
    role: str


def verify_password(plain, hashed):
    return pwd_context.verify(plain, hashed)


def hash_password(password):
    return pwd_context.hash(password)


def create_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Token invalide")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalide")

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable")
    return user


@router.post(
    "/register",
    response_model=RegisterResponse,
    summary="Creer un compte utilisateur",
    description="Cree un utilisateur local dans SQLite avec mot de passe chiffre en bcrypt.",
)
def register(email: str, password: str, nom: str, role: str = "junior", db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email deja utilise")

    user = User(email=email, hashed_password=hash_password(password), nom=nom, role=role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"message": "Compte cree", "email": user.email, "role": user.role}


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Se connecter et recuperer un token JWT",
    description="Endpoint OAuth2 password flow utilise par le frontend.",
)
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    _check_rate_limit(request.client.host if request.client else "unknown")
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")

    token = create_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}


@router.get(
    "/me",
    response_model=CurrentUserResponse,
    summary="Recuperer l'utilisateur courant",
    description="Retourne le profil associe au token JWT fourni dans Authorization.",
)
def me(current_user: User = Depends(get_current_user)):
    return {"email": current_user.email, "nom": current_user.nom, "role": current_user.role}
