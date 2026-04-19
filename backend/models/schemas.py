from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    nom = Column(String)
    role = Column(String, default="junior")
    created_at = Column(DateTime, default=datetime.utcnow)

class Dossier(Base):
    __tablename__ = "dossiers"
    id = Column(Integer, primary_key=True, index=True)
    raison_sociale = Column(String)
    ice = Column(String)
    forme_juridique = Column(String)
    ville = Column(String)
    secteur = Column(String)
    regime_tva = Column(String, default="debits")
    # Identifiants fiscaux
    if_number = Column(String, nullable=True)
    rc_number = Column(String, nullable=True)
    cnss_number = Column(String, nullable=True)
    capital_social = Column(Float, nullable=True)
    # Coordonnées
    adresse = Column(String, nullable=True)
    telephone = Column(String, nullable=True)
    email_societe = Column(String, nullable=True)
    site_web = Column(String, nullable=True)
    # Logo
    logo_hue = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    factures = relationship("Facture", back_populates="dossier")

class Facture(Base):
    __tablename__ = "factures"
    id = Column(Integer, primary_key=True, index=True)
    dossier_id = Column(Integer, ForeignKey("dossiers.id"))
    nom_fichier = Column(String)
    fournisseur = Column(String)
    code_tiers = Column(String)
    montant_ht = Column(Float)
    tva = Column(Float)
    montant_ttc = Column(Float)
    date_facture = Column(String)
    statut = Column(String, default="en_attente")
    created_at = Column(DateTime, default=datetime.utcnow)
    type = Column(String, default="achat", nullable=True)
    paiement = Column(String, default="en_attente", nullable=True)
    num_facture = Column(String, nullable=True)
    date_echeance = Column(String, nullable=True)
    confidence = Column(Float, default=0.95, nullable=True)
    categorie = Column(String, nullable=True)
    compte_pcm = Column(String, nullable=True)
    dossier = relationship("Dossier", back_populates="factures")

class Ecriture(Base):
    __tablename__ = "ecritures"
    id = Column(Integer, primary_key=True, index=True)
    facture_id = Column(Integer, ForeignKey("factures.id"))
    compte_pcm = Column(String)
    libelle = Column(String)
    debit = Column(Float, default=0)
    credit = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)