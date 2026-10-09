import sqlite3, datetime

import os as _os
db = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..', 'findoc.db')
conn = sqlite3.connect(db)

# ── Migrate factures ──────────────────────────────────────────────────────────
existing = {r[1] for r in conn.execute("PRAGMA table_info(factures)").fetchall()}
new_cols = [
    ("type",          "TEXT DEFAULT 'achat'"),
    ("paiement",      "TEXT DEFAULT 'en_attente'"),
    ("num_facture",   "TEXT"),
    ("date_echeance", "TEXT"),
    ("confidence",    "REAL DEFAULT 0.95"),
    ("categorie",     "TEXT"),
    ("compte_pcm",    "TEXT"),
]
for col, typ in new_cols:
    if col not in existing:
        conn.execute(f"ALTER TABLE factures ADD COLUMN {col} {typ}")
        print(f"  + factures.{col}")
conn.commit()

DOSSIER_ID = 2

# Wipe existing demo data for this dossier (clean restart)
fids = [r[0] for r in conn.execute("SELECT id FROM factures WHERE dossier_id=?", (DOSSIER_ID,)).fetchall()]
if fids:
    conn.execute(f"DELETE FROM ecritures WHERE facture_id IN ({','.join(str(x) for x in fids)})")
    conn.execute("DELETE FROM factures WHERE dossier_id=?", (DOSSIER_ID,))
    conn.commit()
    print(f"  Cleared {len(fids)} old factures")

# ── Factures achats ───────────────────────────────────────────────────────────
# (nom_fichier, fournisseur, code_tiers, ht, tva_pct, date_facture, date_echeance, paiement, conf, cat, num_f, cpte)
achats = [
    ("FAC-2026-0089.pdf", "MAROC PRINT SAS",      "FLMARPRINT",  12400.00, 20, "2026-01-15", "2026-02-14", "payee",      0.99, "Impression",             "FAC-2026-0089", "6135000"),
    ("FAC-2026-0093.pdf", "SONATRACH MAROC",       "FESONATRACH", 32100.00, 20, "2026-01-28", "2026-02-27", "payee",      0.97, "Carburant",              "FAC-2026-0093", "6161000"),
    ("FAC-2026-0101.pdf", "ATLAS LOCATION SARL",   "FLATLOC",     18000.00, 20, "2026-02-05", "2026-03-06", "payee",      0.98, "Location materiel",      "FAC-2026-0101", "6132000"),
    ("FAC-2026-0108.pdf", "CASATEX IMPEX",          "FECASATEX",  15000.00, 20, "2026-02-18", "2026-03-19", "en_retard",  0.96, "Matieres premieres",     "FAC-2026-0108", "6111000"),
    ("FAC-2026-0114.pdf", "MAROC PRINT SAS",        "FLMARPRINT", 12400.00, 20, "2026-03-05", "2026-04-04", "en_retard",  0.99, "Impression",             "FAC-2026-0114", "6135000"),
    ("ATC-260318.pdf",    "ATECH DIGITAL SARL",     "FEATECH",     4800.00, 20, "2026-03-18", "2026-04-17", "payee",      0.97, "Services informatiques", "ATC-260318",    "6135000"),
    ("LOC-2026-031.pdf",  "ATLAS LOCATION SARL",   "FLATLOC",     18000.00, 20, "2026-03-30", "2026-04-29", "en_retard",  0.98, "Location materiel",      "LOC-2026-031",  "6132000"),
    ("SON-2026-042.pdf",  "SONATRACH MAROC",        "FESONATRACH", 32100.00, 20, "2026-03-03", "2026-04-02", "en_retard",  0.96, "Carburant",              "SON-2026-042",  "6161000"),
    ("CNSS-03-2026.pdf",  "CNSS MARS 2026",         "FLCNSS",     10375.00,  0, "2026-03-08", "2026-04-07", "payee",      1.00, "Charges sociales",       "CNSS-03-2026",  "6551000"),
    ("ATC-260411.pdf",    "ATECH DIGITAL SARL",     "FEATECH",     7200.00, 20, "2026-04-11", "2026-05-11", "en_attente", 0.98, "Maintenance IT",         "ATC-260411",    "6135000"),
    ("SAF-2026-019.pdf",  "SAFRAN MAROC SA",        "FLSAFRAN",   48000.00, 20, "2026-04-02", "2026-05-02", "en_attente", 0.95, "Pieces detachees",       "SAF-2026-019",  "6111000"),
    ("ELEC-2026-044.pdf", "REDAL SA",               "FLREDAL",     3200.00, 14, "2026-04-08", "2026-04-23", "payee",      0.99, "Electricite",            "ELEC-2026-044", "6164000"),
]

# ── Factures ventes ───────────────────────────────────────────────────────────
ventes = [
    ("FAV-2026-025.pdf", "OCP GROUP SA",          "CLOCPGRP",  100000.00, 20, "2026-02-28", "2026-03-29", "payee",      0.99, "Vente produits finis", "FAV-2026-025", "7111000"),
    ("FAV-2026-028.pdf", "LAFARGE HOLCIM MAROC",  "CLLAFARGE",  52000.00, 20, "2026-03-25", "2026-04-24", "en_attente", 0.98, "Prestation assemblage","FAV-2026-028", "7111000"),
    ("FAV-2026-031.pdf", "VICAT CIMENTS MAROC",   "CLVICAT",    70166.67, 20, "2026-04-09", "2026-05-09", "payee",      0.97, "Vente pieces",         "FAV-2026-031", "7111000"),
    ("FAV-2026-034.pdf", "CIMENTS DU MAROC",      "CLCDM",      45000.00, 20, "2026-04-15", "2026-05-15", "en_attente", 0.96, "Maintenance usine",    "FAV-2026-034", "7061000"),
]

def insert_facture(row, ftype):
    nom, four, code, ht, tva_pct, date_f, date_e, paiement, conf, cat, num_f, cpte = row
    tva = round(ht * tva_pct / 100, 2)
    ttc = round(ht + tva, 2)
    conn.execute("""
        INSERT INTO factures
          (dossier_id, nom_fichier, fournisseur, code_tiers, montant_ht, tva, montant_ttc,
           date_facture, statut, created_at, type, paiement, num_facture, date_echeance,
           confidence, categorie, compte_pcm)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, (DOSSIER_ID, nom, four, code, ht, tva, ttc,
          date_f, "traite", datetime.datetime.utcnow().isoformat(),
          ftype, paiement, num_f, date_e, conf, cat, cpte))
    return conn.execute("SELECT last_insert_rowid()").fetchone()[0]

print("Inserting achats...")
achat_ids = [insert_facture(r, "achat") for r in achats]
print("Inserting ventes...")
vente_ids = [insert_facture(r, "vente") for r in ventes]
conn.commit()

# ── Ecritures ─────────────────────────────────────────────────────────────────
print("Inserting ecritures...")
n_ecr = 0

def ecr(fid, compte, lib, debit, credit):
    global n_ecr
    conn.execute("""
        INSERT INTO ecritures (facture_id, compte_pcm, libelle, debit, credit, created_at)
        VALUES (?,?,?,?,?,?)
    """, (fid, compte, lib, round(debit, 2), round(credit, 2), datetime.datetime.utcnow().isoformat()))
    n_ecr += 1

rows = conn.execute("""
    SELECT id, fournisseur, code_tiers, montant_ht, tva, montant_ttc, type, compte_pcm
    FROM factures WHERE dossier_id=?
""", (DOSSIER_ID,)).fetchall()

for fid, fournisseur, code_tiers, ht, tva, ttc, ftype, cpte in rows:
    if ftype == "achat":
        ecr(fid, cpte or "6111000", fournisseur, ht, 0)
        if tva > 0:
            ecr(fid, "344100", f"TVA ded. — {fournisseur}", tva, 0)
        if code_tiers.startswith("FE"):
            ras = round(ht * 0.10, 2)
            ecr(fid, "4455",  f"RAS DGI 10% — {fournisseur}", 0, ras)
            ecr(fid, "401100", fournisseur, 0, ttc - ras)
        else:
            ecr(fid, "401100", fournisseur, 0, ttc)
    else:
        ecr(fid, "342100", fournisseur, ttc, 0)
        if tva > 0:
            ecr(fid, "342200", f"TVA coll. — {fournisseur}", 0, tva)
        ecr(fid, cpte or "7111000", f"Vente — {fournisseur}", 0, ht)

conn.commit()

# ── Summary ───────────────────────────────────────────────────────────────────
print()
print("=" * 48)
print("DEMO COMPLET — ATLAS INDUSTRIES SA")
print("=" * 48)
nf   = conn.execute("SELECT COUNT(*) FROM factures WHERE dossier_id=?", (DOSSIER_ID,)).fetchone()[0]
ne   = conn.execute("SELECT COUNT(*) FROM ecritures WHERE facture_id IN (SELECT id FROM factures WHERE dossier_id=?)", (DOSSIER_ID,)).fetchone()[0]
acht = conn.execute("SELECT SUM(montant_ttc) FROM factures WHERE dossier_id=? AND type='achat'", (DOSSIER_ID,)).fetchone()[0]
vent = conn.execute("SELECT SUM(montant_ttc) FROM factures WHERE dossier_id=? AND type='vente'", (DOSSIER_ID,)).fetchone()[0]
ret  = conn.execute("SELECT COUNT(*) FROM factures WHERE dossier_id=? AND paiement='en_retard'", (DOSSIER_ID,)).fetchone()[0]
tva  = conn.execute("SELECT SUM(tva) FROM factures WHERE dossier_id=? AND type='achat'", (DOSSIER_ID,)).fetchone()[0]
print(f"  Factures      : {nf}  ({len(achat_ids)} achats + {len(vente_ids)} ventes)")
print(f"  Ecritures     : {ne}")
print(f"  Achats TTC    : {acht:,.0f} MAD")
print(f"  Ventes TTC    : {vent:,.0f} MAD")
print(f"  TVA recup.    : {tva:,.0f} MAD")
print(f"  En retard     : {ret} factures")
print()

fournisseurs = conn.execute("""
    SELECT fournisseur, COUNT(*), SUM(montant_ttc)
    FROM factures WHERE dossier_id=? AND type='achat'
    GROUP BY fournisseur ORDER BY SUM(montant_ttc) DESC
""", (DOSSIER_ID,)).fetchall()
print("  Top fournisseurs :")
for f, n, t in fournisseurs:
    print(f"    {f:<30} {n} fac.  {t:>12,.0f} MAD")

conn.close()
print()
print("OK — Redemarrez le serveur pour voir les donnees.")
