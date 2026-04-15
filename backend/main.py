from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from models.database import engine
from models import schemas
from routers import auth

schemas.Base.metadata.create_all(bind=engine)

app = FastAPI(title="FinDoc API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)

@app.get("/")
def root():
    return {"message": "FinDoc API is running"}