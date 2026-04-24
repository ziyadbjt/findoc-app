from models.database import SessionLocal
from models.schemas import User
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

db = SessionLocal()
user = User(
    email="ziyad@cabinetchami.ma",
    hashed_password=pwd_context.hash("password123"),
    nom="Ziyad",
    role="admin"
)
db.add(user)
db.commit()
db.close()
print("User created")