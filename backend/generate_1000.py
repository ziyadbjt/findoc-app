import sqlite3, datetime, random

db = 'C:/Users/hp/Desktop/findoc-app/backend/findoc.db'
conn = sqlite3.connect(db)

DOSSIER_ID = 2

# ── Référentiels ──────────────────────────────────────────────────────────────

FOURNISSEURS = [
    # (nom, code_tiers, compte_charge, categorie, tva_pct)
    ("SONATRACH MAROC",        "FESONATRACH", "6161000", "Carburant",              20),
    ("AFRIQUIA SMDC",          "FLAFRIQUIA",  "6161000", "Carburant",              20),
    ("MAROC PRINT SAS",        "FLMARPRINT",  "6135000", "Impression",             20),
    ("IMPRIMERIE ATLAS",       "FLATLAS",     "6135000", "Impression",             20),
    ("ATECH DIGITAL SARL",     "FEATECH",     "6135000", "Services informatiques", 20),
    ("INFOTECH MAROC",         "FLINFOTECH",  "6135000", "Services informatiques", 20),
    ("ATLAS LOCATION SARL",    "FLATLOC",     "6132000", "Location matériel",      20),
    ("LOCATION PRO MAROC",     "FLLOCPRO",    "6132000", "Location matériel",      20),
    ("CASATEX IMPEX",          "FECASATEX",   "6111000", "Matières premières",     20),
    ("SAFRAN MAROC SA",        "FLSAFRAN",    "6111000", "Pièces détachées",       20),
    ("REDAL SA",               "FLREDAL",     "6164000", "Électricité",            14),
    ("AMENDIS TANGER",         "FLAMENDIS",   "6164000", "Eau & électricité",      14),
    ("CNSS",                   "FLCNSS",      "6551000", "Charges sociales",        0),
    ("DGI IMPOTS",             "FLDGI",       "6552000", "Impôts & taxes",          0),
    ("TRANSPORT MAGHREB",      "FLTRANSM",    "6142000", "Transport",              20),
    ("ATLAS TRANSIT SARL",     "FLATRANS",    "6142000", "Transport",              20),
    ("MENUISERIE AL FATH",     "FLALFATH",    "6122000", "Sous-traitance",         20),
    ("METAL INDUSTRIE MAROC",  "FLMETALIND",  "6111000", "Matières premières",     20),
    ("ASSURANCE WAFA",         "FLWAFA",      "6163000", "Assurances",             14),
    ("BMCE BANK LEASING",      "FLBMCE",      "6311000", "Charges financières",     0),
    ("TÉLÉCOM MAROC",          "FLTELECOM",   "6135000", "Télécommunications",     20),
    ("ORANGE MAROC",           "FLORANGE",    "6135000", "Télécommunications",     20),
    ("ENTRETIEN RAPID",        "FLENTRAP",    "6135000", "Entretien & réparation", 20),
    ("NETTOYAGE ATLAS",        "FLNETT",      "6135000", "Nettoyage",              20),
    ("FOURNITURES BUREAU MA",  "FLFOURN",     "6123000", "Fournitures bureau",     20),
]

CLIENTS = [
    # (nom, code_tiers, compte_produit, categorie)
    ("OCP GROUP SA",           "CLOCPGRP",  "7111000", "Vente produits finis"),
    ("LAFARGE HOLCIM MAROC",   "CLLAFARGE", "7111000", "Prestation assemblage"),
    ("VICAT CIMENTS MAROC",    "CLVICAT",   "7111000", "Vente pièces"),
    ("CIMENTS DU MAROC",       "CLCDM",     "7061000", "Maintenance usine"),
    ("COSUMAR SA",             "CLCOSUMAR", "7111000", "Vente produits finis"),
    ("MANAGEM GROUP",          "CLMANAGEM", "7111000", "Vente équipements"),
    ("SONASID",                "CLSONASID", "7111000", "Fourniture acier"),
    ("BMCE BANK",              "CLBMCE",    "7061000", "Prestations services"),
    ("ATTIJARIWAFA BANK",      "CLATTIJAR", "7061000", "Maintenance équip."),
    ("MARSA MAROC",            "CLMARSA",   "7111000", "Vente outillage"),
    ("ONCF",                   "CLONCF",    "7111000", "Fourniture pièces"),
    ("ROYAL AIR MAROC",        "CLRAM",     "7061000", "Prestation technique"),
]

STATUTS_PAIEMENT = ["payee", "payee", "payee", "en_attente", "en_attente", "en_retard"]

def rand_date(start_days_ago=365, end_days_ago=0):
    d = datetime.date.today() - datetime.timedelta(days=random.randint(end_days_ago, start_days_ago))
    return d.isoformat()

def echeance(date_str, delai=30):
    d = datetime.date.fromisoformat(date_str) + datetime.timedelta(days=delai)
    return d.isoformat()

def num_facture(prefix, n):
    return f"{prefix}-{datetime.date.today().year}-{n:04d}"

# ── Nettoyage ─────────────────────────────────────────────────────────────────
fids = [r[0] for r in conn.execute("SELECT id FROM factures WHERE dossier_id=?", (DOSSIER_ID,)).fetchall()]
if fids:
    conn.execute(f"DELETE FROM ecritures WHERE facture_id IN ({','.join(str(x) for x in fids)})")
    conn.execute("DELETE FROM factures WHERE dossier_id=?", (DOSSIER_ID,))
    conn.commit()
    print(f"Nettoyage: {len(fids)} anciennes factures supprimées")

# ── Génération ────────────────────────────────────────────────────────────────
n_ecr = 0

def insert_facture(four, code, ht, tva_pct, date_f, date_e, paiement, conf, cat, num_f, cpte, ftype):
    tva = round(ht * tva_pct / 100, 2)
    ttc = round(ht + tva, 2)
    conn.execute("""
        INSERT INTO factures
          (dossier_id, nom_fichier, fournisseur, code_tiers, montant_ht, tva, montant_ttc,
           date_facture, statut, created_at, type, paiement, num_facture, date_echeance,
           confidence, categorie, compte_pcm)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, (DOSSIER_ID, f"{num_f}.pdf", four, code, ht, tva, ttc,
          date_f, "traite", datetime.datetime.utcnow().isoformat(),
          ftype, paiement, num_f, date_e, conf, cat, cpte))
    return conn.execute("SELECT last_insert_rowid()").fetchone()[0]

def add_ecr(fid, compte, lib, debit, credit):
    global n_ecr
    conn.execute("""
        INSERT INTO ecritures (facture_id, compte_pcm, libelle, debit, credit, created_at)
        VALUES (?,?,?,?,?,?)
    """, (fid, compte, lib, round(debit, 2), round(credit, 2), datetime.datetime.utcnow().isoformat()))
    n_ecr += 1

print("Génération de 1000 factures...")

# 750 achats
for i in range(1, 751):
    four, code, cpte, cat, tva_pct = random.choice(FOURNISSEURS)
    ht = round(random.uniform(2000, 80000), 2)
    date_f = rand_date(365, 1)
    date_e = echeance(date_f, random.choice([30, 60, 90]))
    paiement = random.choice(STATUTS_PAIEMENT)
    # Cohérence : facture récente → pas encore en retard
    if date_e >= datetime.date.today().isoformat() and paiement == "en_retard":
        paiement = "en_attente"
    conf = round(random.uniform(0.88, 0.99), 2)
    num_f = num_facture("FAC", i)

    fid = insert_facture(four, code, ht, tva_pct, date_f, date_e, paiement, conf, cat, num_f, cpte, "achat")

    tva = round(ht * tva_pct / 100, 2)
    ttc = round(ht + tva, 2)
    add_ecr(fid, cpte, four, ht, 0)
    if tva > 0:
        add_ecr(fid, "344100", f"TVA déd. — {four}", tva, 0)
    if code.startswith("FE"):
        ras = round(ht * 0.10, 2)
        add_ecr(fid, "4455",   f"RAS DGI 10% — {four}", 0, ras)
        add_ecr(fid, "401100", four, 0, ttc - ras)
    else:
        add_ecr(fid, "401100", four, 0, ttc)

    if i % 100 == 0:
        conn.commit()
        print(f"  {i}/750 achats...")

conn.commit()

# 250 ventes
for i in range(1, 251):
    client, code, cpte, cat = random.choice(CLIENTS)
    ht = round(random.uniform(10000, 200000), 2)
    tva_pct = 20
    date_f = rand_date(365, 1)
    date_e = echeance(date_f, 30)
    paiement = random.choice(["payee", "payee", "en_attente", "en_retard"])
    if date_e >= datetime.date.today().isoformat() and paiement == "en_retard":
        paiement = "en_attente"
    conf = round(random.uniform(0.90, 0.99), 2)
    num_f = num_facture("FAV", i)

    fid = insert_facture(client, code, ht, tva_pct, date_f, date_e, paiement, conf, cat, num_f, cpte, "vente")

    tva = round(ht * tva_pct / 100, 2)
    ttc = round(ht + tva, 2)
    add_ecr(fid, "342100", client, ttc, 0)
    add_ecr(fid, "342200", f"TVA coll. — {client}", 0, tva)
    add_ecr(fid, cpte,     f"Vente — {client}", 0, ht)

    if i % 50 == 0:
        conn.commit()
        print(f"  {i}/250 ventes...")

conn.commit()

# ── Résumé ────────────────────────────────────────────────────────────────────
nf   = conn.execute("SELECT COUNT(*) FROM factures WHERE dossier_id=?", (DOSSIER_ID,)).fetchone()[0]
ne   = conn.execute("SELECT COUNT(*) FROM ecritures WHERE facture_id IN (SELECT id FROM factures WHERE dossier_id=?)", (DOSSIER_ID,)).fetchone()[0]
acht = conn.execute("SELECT SUM(montant_ttc) FROM factures WHERE dossier_id=? AND type='achat'", (DOSSIER_ID,)).fetchone()[0]
vent = conn.execute("SELECT SUM(montant_ttc) FROM factures WHERE dossier_id=? AND type='vente'", (DOSSIER_ID,)).fetchone()[0]
ret  = conn.execute("SELECT COUNT(*) FROM factures WHERE dossier_id=? AND paiement='en_retard'", (DOSSIER_ID,)).fetchone()[0]
four = conn.execute("SELECT COUNT(DISTINCT fournisseur) FROM factures WHERE dossier_id=? AND type='achat'", (DOSSIER_ID,)).fetchone()[0]
cli  = conn.execute("SELECT COUNT(DISTINCT fournisseur) FROM factures WHERE dossier_id=? AND type='vente'", (DOSSIER_ID,)).fetchone()[0]

print()
print("=" * 50)
print(f"  Factures      : {nf}  (750 achats + 250 ventes)")
print(f"  Écritures     : {ne}")
print(f"  Achats TTC    : {acht:>15,.0f} MAD")
print(f"  Ventes TTC    : {vent:>15,.0f} MAD")
print(f"  En retard     : {ret} factures")
print(f"  Fournisseurs  : {four} distincts")
print(f"  Clients       : {cli} distincts")
print("=" * 50)

conn.close()
print("Terminé.")
