# FINDOC — Guide Claude Code

## Stack

| Couche | Tech |
|--------|------|
| Frontend | React + Vite · `frontend/` · port 5173 |
| Backend principal | Python FastAPI · `backend/` · port 8000 |
| Backend fallback | Node.js Express · `backend-node/` · port 8000 |
| Base de données | SQLite · `backend/findoc.db` |
| IA extraction | Anthropic Claude API (`claude-sonnet-4-6`) |

## Démarrer l'app

```bash
# Backend Node.js (fallback, toujours dispo)
node backend-node/server.js

# Backend Python (pour extraction PDF/IA)
cd backend && uvicorn main:app --reload

# Frontend
cd frontend && npm run dev
```

## Identifiants de démo

- Email : `ziyad@cabinetchami.ma`
- Mot de passe : `password123`

## Architecture backend

```
backend/
  main.py                  # FastAPI app + migration SQLite au démarrage
  models/
    database.py            # SQLAlchemy engine SQLite
    schemas.py             # Modèles : User, Dossier, Facture, Ecriture
  routers/
    auth.py                # POST /auth/login, GET /auth/me  (JWT HS256)
    dossiers.py            # CRUD dossiers + POST /dossiers/extract-societe
    factures.py            # Upload PDF, écritures, export XLSX
    reconciliation.py      # Rapprochement bancaire
  services/
    extract_societe.py     # Claude Vision → champs société (PDF/JPG/PNG/XML)
    document_ai.py         # Extraction factures (mock actuel)
    claude.py              # Génération écritures comptables
    export.py              # Calcul retards + pénalités Loi 69-21
  seed_demo.py             # Insère 16 factures + 52 écritures démo
  .env                     # SECRET_KEY, ANTHROPIC_API_KEY (non versionné)
```

## Architecture frontend

```
frontend/src/
  api/index.js             # Toutes les fonctions axios (BASE = http://127.0.0.1:8000)
  context/
    AuthContext.jsx        # login() → URLSearchParams, token localStorage
    ToastContext.jsx       # Notifications toast
  pages/
    Login.jsx              # Page connexion
    Dossiers.jsx           # Liste + modal création (onglet Import / Formulaire)
    Dashboard.jsx          # Shell principal avec routing par onglet
  components/
    Shell.jsx              # DossierAvatar (SVG gradient), Sidebar, Topbar, CmdK
    FactureDetail.jsx      # Drawer détail facture
  utils/
    format.js              # formatMAD, formatDate, enrichDossier, enrichFacture
```

## Modèles de données clés

### Dossier
`raison_sociale, ice, if_number, rc_number, cnss_number, capital_social, forme_juridique, ville, adresse, telephone, email_societe, site_web, secteur, regime_tva, logo_hue`

### Facture
`dossier_id, fournisseur, code_tiers, montant_ht, tva, montant_ttc, date_facture, date_echeance, num_facture, type (achat|vente), paiement (payee|en_attente|en_retard), statut, confidence, categorie, compte_pcm`

### Ecriture
`facture_id, compte_pcm, libelle, debit, credit`

## Conventions code_tiers

| Préfixe | Signification |
|---------|--------------|
| `FL` | Fournisseur Local → achat, pas de RAS |
| `FE` | Fournisseur Étranger → achat + RAS 10% DGI |
| `CL` | Client Local → vente |

## Comptes PCM fréquents

| Compte | Usage |
|--------|-------|
| 401100 | Fournisseurs |
| 342100 | Clients |
| 344100 | TVA déductible |
| 342200 | TVA collectée |
| 4455   | RAS à reverser DGI |
| 512100 | Banque |
| 6111000 | Achats matières |
| 6135000 | Services extérieurs |
| 7111000 | Ventes produits finis |

## Variables d'environnement (backend/.env)

```env
SECRET_KEY=findoc_secret_key_change_in_production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
ANTHROPIC_API_KEY=sk-ant-api03-...
```

## Node.js backend (fallback)

- Lit la même `findoc.db` via Python subprocess (`sqlQuery` / `sqlRun`)
- Gère : auth, dossiers CRUD, factures GET, écritures GET, extract-societe
- Multer installé pour upload fichiers
- **Pas** de bcrypt → accepte tout mot de passe si user existe en DB

## Migration SQLite

Les nouvelles colonnes sont ajoutées automatiquement via :
- `backend/main.py` au démarrage Python
- `backend/seed_demo.py` pour les colonnes factures

## Loi 69-21 (pénalités retard)

```
pénalité = montant_ttc × (taux_BAM + 3%) × max(0, jours_retard − 60) / 365
taux_BAM par défaut = 2.25%
délai légal = 60 jours
```

## Données démo

Dossier **ATLAS INDUSTRIES SA** (ID 2, Casablanca) :
- 12 factures achats (Sonatrach, Safran, Maroc Print, Atech Digital…)
- 4 factures ventes (OCP, Lafarge, Vicat, Ciments du Maroc)
- 52 écritures comptables générées
- 4 factures en retard → pénalités actives

Pour régénérer : `python backend/seed_demo.py`
