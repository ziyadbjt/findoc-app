from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    username = Column(String, unique=True, index=True, nullable=True)
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
    exercice_courant = Column(Integer, nullable=True)
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
    stored_filename = Column(String, nullable=True)
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
    exercice_rattachement = Column(Integer, nullable=True)
    traitement_comptable = Column(String, default="exercice_courant", nullable=True)
    analyse_ai = Column(Text, nullable=True)
    validation_status = Column(String, default="a_valider", nullable=True)
    texte_source = Column(Text, nullable=True)
    ocr_payload = Column(Text, nullable=True)
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


class PCMCompte(Base):
    __tablename__ = "pcm_comptes"
    id = Column(Integer, primary_key=True, index=True)
    dossier_id = Column(Integer, ForeignKey("dossiers.id"), index=True)
    compte = Column(String, index=True)
    libelle = Column(String)
    classe = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Correction(Base):
    __tablename__ = "corrections"
    id = Column(Integer, primary_key=True, index=True)
    dossier_id = Column(Integer, ForeignKey("dossiers.id"))
    facture_id = Column(Integer, ForeignKey("factures.id"), nullable=True)
    fournisseur = Column(String)
    description = Column(String, nullable=True)
    montant = Column(Float, nullable=True)
    champ = Column(String)           # e.g. "compte_pcm", "code_tiers", "fournisseur"
    valeur_originale = Column(String)
    valeur_corrigee = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


class TeamMessage(Base):
    __tablename__ = "team_messages"
    id = Column(Integer, primary_key=True, index=True)
    dossier_id = Column(Integer, ForeignKey("dossiers.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    content = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class PrivateMessage(Base):
    __tablename__ = "private_messages"
    id = Column(Integer, primary_key=True, index=True)
    dossier_id = Column(Integer, ForeignKey("dossiers.id"), index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), index=True)
    recipient_id = Column(Integer, ForeignKey("users.id"), index=True)
    content = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class Relance(Base):
    __tablename__ = "relances"
    id = Column(Integer, primary_key=True, index=True)
    facture_id = Column(Integer, ForeignKey("factures.id"), index=True)
    niveau = Column(Integer, default=1)
    destinataire_email = Column(String)
    destinataire_nom = Column(String, nullable=True)
    sujet = Column(String)
    corps = Column(Text)
    envoye = Column(Integer, default=0)
    envoye_at = Column(DateTime, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user_email = Column(String, nullable=True)
    action = Column(String)
    ressource = Column(String, nullable=True)
    ressource_id = Column(Integer, nullable=True)
    details = Column(Text, nullable=True)
    ip = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
