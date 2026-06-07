const today = new Date()
const d = (offsetDays) => {
  const dt = new Date(today)
  dt.setDate(dt.getDate() + offsetDays)
  return dt.toISOString().slice(0, 10)
}

export const MOCK_USER = {
  id: 1,
  email: "ziyad@cabinetchami.ma",
  username: "ziyad",
  nom: "Ziyad B.",
  role: "admin",
  status: "active",
}

export const MOCK_DOSSIERS = [
  {
    id: 2,
    raison_sociale: "ATLAS INDUSTRIES SA",
    ice: "001234567890123",
    if_number: "12345678",
    rc_number: "123456",
    cnss_number: "9876543",
    capital_social: 5000000,
    forme_juridique: "SA",
    ville: "Casablanca",
    adresse: "123 Bd Zerktouni, Casablanca",
    telephone: "+212522123456",
    email_societe: "contact@atlas-industries.ma",
    site_web: "www.atlas-industries.ma",
    secteur: "Industrie",
    regime_tva: "Normal",
    logo_hue: 210,
    created_at: "2025-01-15",
  },
]

export const MOCK_FACTURES = [
  // ── ACHATS ──────────────────────────────────────────────────────────────────
  { id: 1,  dossier_id: 2, fournisseur: "MAROC PRINT SAS",      code_tiers: "FLMARPRINT",  montant_ht: 12400,  tva: 2480,  montant_ttc: 14880,  date_facture: "2026-01-15", date_echeance: "2026-02-14", num_facture: "FAC-2026-0089", type: "achat",  paiement: "payee",      statut: "validee", confidence: 0.99, categorie: "Impression",             compte_pcm: "6135000" },
  { id: 2,  dossier_id: 2, fournisseur: "SONATRACH MAROC",       code_tiers: "FESONATRACH", montant_ht: 32100,  tva: 6420,  montant_ttc: 38520,  date_facture: "2026-01-28", date_echeance: "2026-02-27", num_facture: "FAC-2026-0093", type: "achat",  paiement: "payee",      statut: "validee", confidence: 0.97, categorie: "Carburant",              compte_pcm: "6161000" },
  { id: 3,  dossier_id: 2, fournisseur: "ATLAS LOCATION SARL",   code_tiers: "FLATLOC",     montant_ht: 18000,  tva: 3600,  montant_ttc: 21600,  date_facture: "2026-02-05", date_echeance: "2026-03-06", num_facture: "FAC-2026-0101", type: "achat",  paiement: "payee",      statut: "validee", confidence: 0.98, categorie: "Location materiel",      compte_pcm: "6132000" },
  { id: 4,  dossier_id: 2, fournisseur: "CASATEX IMPEX",          code_tiers: "FECASATEX",   montant_ht: 15000,  tva: 3000,  montant_ttc: 18000,  date_facture: "2026-02-18", date_echeance: "2026-03-19", num_facture: "FAC-2026-0108", type: "achat",  paiement: "en_retard",  statut: "validee", confidence: 0.96, categorie: "Matieres premieres",     compte_pcm: "6111000" },
  { id: 5,  dossier_id: 2, fournisseur: "MAROC PRINT SAS",        code_tiers: "FLMARPRINT",  montant_ht: 12400,  tva: 2480,  montant_ttc: 14880,  date_facture: "2026-03-05", date_echeance: "2026-04-04", num_facture: "FAC-2026-0114", type: "achat",  paiement: "en_retard",  statut: "validee", confidence: 0.99, categorie: "Impression",             compte_pcm: "6135000" },
  { id: 6,  dossier_id: 2, fournisseur: "ATECH DIGITAL SARL",     code_tiers: "FEATECH",     montant_ht: 4800,   tva: 960,   montant_ttc: 5760,   date_facture: "2026-03-18", date_echeance: "2026-04-17", num_facture: "ATC-260318",    type: "achat",  paiement: "payee",      statut: "validee", confidence: 0.97, categorie: "Services informatiques", compte_pcm: "6135000" },
  { id: 7,  dossier_id: 2, fournisseur: "ATLAS LOCATION SARL",    code_tiers: "FLATLOC",     montant_ht: 18000,  tva: 3600,  montant_ttc: 21600,  date_facture: "2026-03-30", date_echeance: "2026-04-29", num_facture: "LOC-2026-031",  type: "achat",  paiement: "en_retard",  statut: "validee", confidence: 0.98, categorie: "Location materiel",      compte_pcm: "6132000" },
  { id: 8,  dossier_id: 2, fournisseur: "SONATRACH MAROC",        code_tiers: "FESONATRACH", montant_ht: 32100,  tva: 6420,  montant_ttc: 38520,  date_facture: "2026-03-03", date_echeance: "2026-04-02", num_facture: "SON-2026-042",  type: "achat",  paiement: "en_retard",  statut: "validee", confidence: 0.96, categorie: "Carburant",              compte_pcm: "6161000" },
  { id: 9,  dossier_id: 2, fournisseur: "CNSS MARS 2026",         code_tiers: "FLCNSS",      montant_ht: 10375,  tva: 0,     montant_ttc: 10375,  date_facture: "2026-03-08", date_echeance: "2026-04-07", num_facture: "CNSS-03-2026",  type: "achat",  paiement: "payee",      statut: "validee", confidence: 1.00, categorie: "Charges sociales",       compte_pcm: "6551000" },
  { id: 10, dossier_id: 2, fournisseur: "ATECH DIGITAL SARL",     code_tiers: "FEATECH",     montant_ht: 7200,   tva: 1440,  montant_ttc: 8640,   date_facture: "2026-04-11", date_echeance: "2026-05-11", num_facture: "ATC-260411",    type: "achat",  paiement: "en_attente", statut: "validee", confidence: 0.98, categorie: "Maintenance IT",         compte_pcm: "6135000" },
  { id: 11, dossier_id: 2, fournisseur: "SAFRAN MAROC SA",        code_tiers: "FLSAFRAN",    montant_ht: 48000,  tva: 9600,  montant_ttc: 57600,  date_facture: "2026-04-02", date_echeance: "2026-05-02", num_facture: "SAF-2026-019",  type: "achat",  paiement: "en_attente", statut: "validee", confidence: 0.95, categorie: "Pieces detachees",       compte_pcm: "6111000" },
  { id: 12, dossier_id: 2, fournisseur: "REDAL SA",               code_tiers: "FLREDAL",     montant_ht: 3200,   tva: 448,   montant_ttc: 3648,   date_facture: "2026-04-08", date_echeance: "2026-04-23", num_facture: "ELEC-2026-044", type: "achat",  paiement: "payee",      statut: "validee", confidence: 0.99, categorie: "Electricite",            compte_pcm: "6164000" },
  // ── VENTES ──────────────────────────────────────────────────────────────────
  { id: 13, dossier_id: 2, fournisseur: "OCP SA",                 code_tiers: "CLOCP",       montant_ht: 85000,  tva: 17000, montant_ttc: 102000, date_facture: "2026-01-20", date_echeance: "2026-03-20", num_facture: "VTE-2026-001",  type: "vente",  paiement: "payee",      statut: "validee", confidence: 0.99, categorie: "Ventes produits",        compte_pcm: "7111000" },
  { id: 14, dossier_id: 2, fournisseur: "LAFARGE MAROC",          code_tiers: "CLLAFARGE",   montant_ht: 62000,  tva: 12400, montant_ttc: 74400,  date_facture: "2026-02-10", date_echeance: "2026-04-10", num_facture: "VTE-2026-002",  type: "vente",  paiement: "payee",      statut: "validee", confidence: 0.98, categorie: "Ventes produits",        compte_pcm: "7111000" },
  { id: 15, dossier_id: 2, fournisseur: "VICAT MAROC",            code_tiers: "CLVICAT",     montant_ht: 48000,  tva: 9600,  montant_ttc: 57600,  date_facture: "2026-03-15", date_echeance: "2026-05-14", num_facture: "VTE-2026-003",  type: "vente",  paiement: "en_attente", statut: "validee", confidence: 0.97, categorie: "Ventes produits",        compte_pcm: "7111000" },
  { id: 16, dossier_id: 2, fournisseur: "CIMENTS DU MAROC",       code_tiers: "CLCIMAR",     montant_ht: 71500,  tva: 14300, montant_ttc: 85800,  date_facture: "2026-04-05", date_echeance: "2026-06-04", num_facture: "VTE-2026-004",  type: "vente",  paiement: "en_attente", statut: "validee", confidence: 0.99, categorie: "Ventes produits",        compte_pcm: "7111000" },
]

// Generate ecritures from factures
export const MOCK_ECRITURES = MOCK_FACTURES.flatMap((f) => {
  if (f.type === "achat") {
    const lines = [
      { id: f.id * 10 + 1, facture_id: f.id, compte_pcm: f.compte_pcm,  libelle: `Achat ${f.fournisseur}`, debit: f.montant_ht, credit: 0 },
      { id: f.id * 10 + 2, facture_id: f.id, compte_pcm: "344100",       libelle: `TVA déductible ${f.num_facture}`, debit: f.tva, credit: 0 },
      { id: f.id * 10 + 3, facture_id: f.id, compte_pcm: "401100",       libelle: `Fournisseur ${f.fournisseur}`, debit: 0, credit: f.montant_ttc },
    ]
    if (f.code_tiers.startsWith("FE") && f.tva > 0) {
      const ras = +(f.montant_ht * 0.1).toFixed(2)
      lines.push({ id: f.id * 10 + 4, facture_id: f.id, compte_pcm: "4455", libelle: `RAS DGI ${f.fournisseur}`, debit: 0, credit: ras })
    }
    return lines
  } else {
    return [
      { id: f.id * 10 + 1, facture_id: f.id, compte_pcm: "342100",       libelle: `Client ${f.fournisseur}`, debit: f.montant_ttc, credit: 0 },
      { id: f.id * 10 + 2, facture_id: f.id, compte_pcm: "342200",       libelle: `TVA collectée ${f.num_facture}`, debit: 0, credit: f.tva },
      { id: f.id * 10 + 3, facture_id: f.id, compte_pcm: f.compte_pcm,   libelle: `Vente ${f.fournisseur}`, debit: 0, credit: f.montant_ht },
    ]
  }
})
