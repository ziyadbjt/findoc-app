import axios from "axios";

const BASE = "http://127.0.0.1:8000";

const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

export const loginUser = (email, password) => {
  const form = new URLSearchParams({ username: email, password });
  return axios.post(`${BASE}/auth/login`, form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
};

export const getMe = (token) => axios.get(`${BASE}/auth/me`, auth(token));

export const getDossiers = (token) => axios.get(`${BASE}/dossiers/`, auth(token));
export const getDossier = (token, id) => axios.get(`${BASE}/dossiers/${id}`, auth(token));
export const createDossier = (token, data) =>
  axios.post(`${BASE}/dossiers/`, null, { ...auth(token), params: data });
export const deleteDossier = (token, id) => axios.delete(`${BASE}/dossiers/${id}`, auth(token));

export const getFactures = (token, dossierId) =>
  axios.get(`${BASE}/factures/${dossierId}`, auth(token));

export const uploadFactures = (token, dossierId, files) => {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  return axios.post(`${BASE}/factures/${dossierId}/upload`, form, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const getEcritures = (token, dossierId) =>
  axios.get(`${BASE}/factures/${dossierId}/ecritures`, auth(token));

export const exportJournal = (token, dossierId) =>
  axios.get(`${BASE}/factures/${dossierId}/export`, {
    ...auth(token),
    responseType: "blob",
  });

export const getReconciliation = (token, dossierId) =>
  axios.get(`${BASE}/reconciliation/${dossierId}`, auth(token));

// Mock bank lines — replace when backend adds /bank-lines endpoint
export const MOCK_BANK_LINES = [
  { id: "tx1", date: "2026-03-05", libelle: "VIR MARPRINT SARL REF-0114", montant: -14880.0, matched_to: null },
  { id: "tx2", date: "2026-03-20", libelle: "VIR ATECH DIG — ATC260318", montant: -5760.0, matched_to: null },
  { id: "tx3", date: "2026-03-30", libelle: "VIR ATLAS LOCATION LOYER MARS", montant: -21600.0, matched_to: null },
  { id: "tx4", date: "2026-04-11", libelle: "VIR ATECH DIGITAL MAINT", montant: -8640.0, matched_to: null },
  { id: "tx5", date: "2026-04-03", libelle: "VIR SONATRACH — carb. mars", montant: -38520.0, matched_to: null },
  { id: "tx6", date: "2026-04-08", libelle: "PRLV CNSS MARS 2026", montant: -12450.0, matched_to: null },
  { id: "tx7", date: "2026-04-09", libelle: "REC CLIENT VICAT CIMENTS MA", montant: 84200.0, matched_to: null },
  { id: "tx8", date: "2026-04-12", libelle: "FRAIS BANCAIRES TRIM.", montant: -450.0, matched_to: null },
];

export const MOCK_NOTIFICATIONS = [
  { id: 1, kind: "ai", ts: "il y a 2min", title: "Factures extraites automatiquement", body: "98% de confiance moyenne" },
  { id: 2, kind: "warn", ts: "il y a 14min", title: "Loi 69-21 déclenchée", body: "Retard détecté · pénalité calculée" },
  { id: 3, kind: "reconcile", ts: "il y a 1h", title: "Relevé bancaire importé", body: "Correspondances à valider" },
  { id: 4, kind: "export", ts: "il y a 3h", title: "Export SAGE 100 prêt", body: "Journal · écritures générées" },
];
