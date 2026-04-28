import os
import sqlite3


DB_PATH = os.getenv("DB_PATH", os.path.join(os.path.dirname(__file__), "findoc.db"))

DEMO_DOSSIER = {
    "id": 1,
    "raison_sociale": "ATLAS INDUSTRIES SA",
    "ice": "001234567890123",
    "forme_juridique": "SA",
    "ville": "Casablanca",
    "secteur": "Industrie",
    "regime_tva": "debits",
    "if_number": "15243890",
    "rc_number": "98765",
    "cnss_number": "4567891",
    "capital_social": 2500000,
    "adresse": "Zone industrielle Ain Sebaa, Casablanca",
    "telephone": "+212 522 00 00 00",
    "email_societe": "contact@atlas-industries.ma",
    "site_web": "https://atlas-industries.ma",
    "logo_hue": 178,
    "exercice_courant": 2026,
}


def ensure_columns(conn):
    columns = {row[1] for row in conn.execute("PRAGMA table_info(dossiers)").fetchall()}
    wanted = {
        "if_number": "TEXT",
        "rc_number": "TEXT",
        "cnss_number": "TEXT",
        "capital_social": "REAL",
        "adresse": "TEXT",
        "telephone": "TEXT",
        "email_societe": "TEXT",
        "site_web": "TEXT",
        "logo_hue": "INTEGER",
        "exercice_courant": "INTEGER",
    }
    for name, typ in wanted.items():
        if name not in columns:
            conn.execute(f"ALTER TABLE dossiers ADD COLUMN {name} {typ}")


def table_exists(conn, table):
    return conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
        (table,),
    ).fetchone() is not None


with sqlite3.connect(DB_PATH) as conn:
    conn.execute("PRAGMA foreign_keys = OFF")
    ensure_columns(conn)

    if table_exists(conn, "relances"):
        conn.execute("DELETE FROM relances")
    if table_exists(conn, "ecritures"):
        conn.execute("DELETE FROM ecritures")
    if table_exists(conn, "corrections"):
        conn.execute("DELETE FROM corrections")
    if table_exists(conn, "team_messages"):
        conn.execute("DELETE FROM team_messages")
    if table_exists(conn, "private_messages"):
        conn.execute("DELETE FROM private_messages")
    if table_exists(conn, "audit_logs"):
        conn.execute("DELETE FROM audit_logs")
    if table_exists(conn, "factures"):
        conn.execute("DELETE FROM factures")
    if table_exists(conn, "pcm_comptes"):
        conn.execute("DELETE FROM pcm_comptes")
    conn.execute("DELETE FROM dossiers")

    conn.execute(
        """
        INSERT INTO dossiers (
          id, raison_sociale, ice, forme_juridique, ville, secteur, regime_tva,
          if_number, rc_number, cnss_number, capital_social, adresse, telephone,
          email_societe, site_web, logo_hue, exercice_courant, created_at
        )
        VALUES (
          :id, :raison_sociale, :ice, :forme_juridique, :ville, :secteur, :regime_tva,
          :if_number, :rc_number, :cnss_number, :capital_social, :adresse, :telephone,
          :email_societe, :site_web, :logo_hue, :exercice_courant, datetime('now')
        )
        """,
        DEMO_DOSSIER,
    )

    for table in ("dossiers", "factures", "ecritures"):
        if table_exists(conn, "sqlite_sequence"):
            conn.execute("DELETE FROM sqlite_sequence WHERE name=?", (table,))

    conn.commit()

print(f"OK - reset demo empty: {DB_PATH}")
print("Dossier: ATLAS INDUSTRIES SA")
print("Factures: 0")
