import axios from "axios";
import { MOCK_USER, MOCK_DOSSIERS, MOCK_FACTURES, MOCK_ECRITURES } from "./mockData";

const API_HOST =
  typeof window !== "undefined" && window.location.hostname
    ? window.location.hostname
    : "127.0.0.1";

const IS_LOCAL = API_HOST === "localhost" || API_HOST === "127.0.0.1";

const BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ||
  (IS_LOCAL ? `http://127.0.0.1:8000` : null);

// When no backend URL is available (e.g. Vercel without VITE_API_URL), use mock data
const USE_MOCK = !BASE;

const mock = (data, delay = 80) =>
  new Promise((resolve) => setTimeout(() => resolve({ data }), delay));

const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

const isTouchAppleDevice = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isModernIPad = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return isIOS || isModernIPad;
};

export const loginUser = (identifier, password) => {
  if (USE_MOCK) return mock({ access_token: "demo-token" });
  const form = new URLSearchParams({ username: identifier, password });
  return axios.post(`${BASE}/auth/login`, form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
};

export const getMe = (token) => {
  if (USE_MOCK) return mock(MOCK_USER);
  return axios.get(`${BASE}/auth/me`, auth(token));
};

export const getDossiers = (token) => {
  if (USE_MOCK) return mock(MOCK_DOSSIERS);
  return axios.get(`${BASE}/dossiers/`, auth(token));
};
export const getDossier = (token, id) => {
  if (USE_MOCK) return mock(MOCK_DOSSIERS.find((d) => d.id === Number(id)) || MOCK_DOSSIERS[0]);
  return axios.get(`${BASE}/dossiers/${id}`, auth(token));
};
export const updateDossier = (token, id, payload) => {
  if (USE_MOCK) return mock({ ...MOCK_DOSSIERS[0], ...payload });
  return axios.patch(`${BASE}/dossiers/${id}`, payload, auth(token));
};
export const getPCM = (token, dossierId) => {
  if (USE_MOCK) return mock([]);
  return axios.get(`${BASE}/dossiers/${dossierId}/pcm`, auth(token));
};
export const replacePCM = (token, dossierId, comptes) => {
  if (USE_MOCK) return mock({ ok: true });
  return axios.put(`${BASE}/dossiers/${dossierId}/pcm`, comptes, auth(token));
};
export const extractSocieteFromDoc = (token, file) => {
  if (USE_MOCK) return mock(MOCK_DOSSIERS[0]);
  const form = new FormData();
  form.append("file", file);
  return axios.post(`${BASE}/dossiers/extract-societe`, form, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const createDossier = (token, data) => {
  if (USE_MOCK) return mock({ ...MOCK_DOSSIERS[0], ...data, id: Date.now() });
  const params = { ...data };
  if (params.capital_social === "" || params.capital_social == null) delete params.capital_social;
  if (params.logo_hue == null) delete params.logo_hue;
  return axios.post(`${BASE}/dossiers/`, null, { ...auth(token), params });
};
export const deleteDossier = (token, id) => {
  if (USE_MOCK) return mock({ ok: true });
  return axios.delete(`${BASE}/dossiers/${id}`, auth(token));
};

export const getFactures = (token, dossierId) => {
  if (USE_MOCK) return mock(MOCK_FACTURES.filter((f) => f.dossier_id === Number(dossierId)));
  return axios.get(`${BASE}/factures/${dossierId}`, auth(token));
};

export const updateFacture = (token, factureId, payload) => {
  if (USE_MOCK) return mock({ ok: true });
  return axios.patch(`${BASE}/factures/item/${factureId}`, payload, auth(token));
};

export const getFactureFile = (token, factureId) => {
  if (USE_MOCK) return Promise.reject(new Error("Fichier non disponible en mode démo"));
  return axios.get(`${BASE}/factures/item/${factureId}/file`, {
    ...auth(token),
    responseType: "blob",
  });
};

export const uploadFactures = (token, dossierId, files, options = {}) => {
  if (USE_MOCK) return mock({ uploaded: files.length, factures: [] });
  const form = new FormData();
  files.forEach((file) => form.append("files", file));
  return axios.post(`${BASE}/factures/${dossierId}/upload`, form, {
    headers: { Authorization: `Bearer ${token}` },
    onUploadProgress: options.onUploadProgress,
  });
};

export const getEcritures = (token, dossierId) => {
  if (USE_MOCK) {
    const fids = new Set(MOCK_FACTURES.filter((f) => f.dossier_id === Number(dossierId)).map((f) => f.id))
    return mock(MOCK_ECRITURES.filter((e) => fids.has(e.facture_id)))
  }
  return axios.get(`${BASE}/factures/${dossierId}/ecritures`, auth(token));
};

export const exportJournal = (token, dossierId) => {
  if (USE_MOCK) return Promise.reject(new Error("Export non disponible en mode démo"));
  return axios.get(`${BASE}/factures/${dossierId}/export`, {
    ...auth(token),
    responseType: "blob",
  });
};

export const getReconciliation = (token, dossierId) => {
  if (USE_MOCK) return mock({ lignes: [], factures: [] });
  return axios.get(`${BASE}/reconciliation/${dossierId}`, auth(token));
};

export const uploadBankStatement = (token, dossierId, file) => {
  if (USE_MOCK) return mock({ ok: true });
  const form = new FormData();
  form.append("file", file);
  return axios.post(`${BASE}/reconciliation/${dossierId}/upload`, form, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export async function sendChatMessage(token, payload, handlers = {}) {
  if (USE_MOCK) {
    setTimeout(() => handlers.onChunk?.("Fonctionnalité disponible avec le backend connecté."), 100)
    setTimeout(() => handlers.onDone?.({}), 200)
    return {}
  }
  const sendPlain = async () => {
    const response = await fetch(`${BASE}/chat/answer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error("Chat indisponible");
    const data = await response.json();
    if (data.answer) handlers.onChunk?.(data.answer);
    handlers.onDone?.(data);
    return data;
  };

  if (isTouchAppleDevice()) {
    return sendPlain();
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 25000);

  const response = await fetch(`${BASE}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
    signal: controller.signal,
  });

  if (!response.ok || !response.body) {
    window.clearTimeout(timeoutId);
    throw new Error("Chat indisponible");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const emitEvent = (rawBlock) => {
    const lines = rawBlock.split("\n").filter(Boolean);
    const event = lines.find((line) => line.startsWith("event:"))?.slice(6).trim() || "message";
    const dataLine = lines.find((line) => line.startsWith("data:"))?.slice(5).trim() || "{}";
    let data = {};
    try {
      data = JSON.parse(dataLine);
    } catch {
      data = {};
    }
    if (event === "chunk" && data.text) handlers.onChunk?.(data.text);
    if (event === "done") handlers.onDone?.(data);
    if (event === "ready") handlers.onReady?.(data);
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() || "";
    blocks.forEach(emitEvent);
  }

  if (buffer.trim()) emitEvent(buffer);
  window.clearTimeout(timeoutId);
}

export async function generateMonthlyReport(token, dossierId, mois, annee, handlers = {}) {
  if (USE_MOCK) {
    setTimeout(() => handlers.onChunk?.("Rapport non disponible en mode démo."), 100)
    setTimeout(() => handlers.onDone?.({}), 200)
    return {}
  }
  const response = await fetch(
    `${BASE}/factures/${dossierId}/rapport-mensuel?mois=${mois}&annee=${annee}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!response.ok || !response.body) throw new Error("Rapport indisponible");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const emitEvent = (rawBlock) => {
    const lines = rawBlock.split("\n").filter(Boolean);
    const event = lines.find((l) => l.startsWith("event:"))?.slice(6).trim() || "message";
    const dataLine = lines.find((l) => l.startsWith("data:"))?.slice(5).trim() || "{}";
    let data = {};
    try { data = JSON.parse(dataLine); } catch { data = {}; }
    if (event === "chunk" && data.text) handlers.onChunk?.(data.text);
    if (event === "done") handlers.onDone?.(data);
    if (event === "ready") handlers.onReady?.(data);
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() || "";
    blocks.forEach(emitEvent);
  }
  if (buffer.trim()) emitEvent(buffer);
}

export const getTeamMessages = (token, dossierId) =>
  axios.get(`${BASE}/chat/team/${dossierId}`, auth(token));

export const postTeamMessage = (token, dossierId, content) =>
  axios.post(`${BASE}/chat/team/${dossierId}`, { content }, auth(token));

export const getPrivateChatContacts = (token, dossierId) =>
  axios.get(`${BASE}/chat/private/${dossierId}/contacts`, auth(token));

export const getPrivateMessages = (token, dossierId, otherUserId) =>
  axios.get(`${BASE}/chat/private/${dossierId}/${otherUserId}`, auth(token));

export const postPrivateMessage = (token, dossierId, otherUserId, content) =>
  axios.post(`${BASE}/chat/private/${dossierId}/${otherUserId}`, { content }, auth(token));

export const getAdminUsers = (token) => {
  if (USE_MOCK) return mock([MOCK_USER]);
  return axios.get(`${BASE}/admin/users`, auth(token));
};

export const createAdminUser = (token, payload) => {
  if (USE_MOCK) return mock({ ...payload, id: Date.now() });
  return axios.post(`${BASE}/admin/users`, payload, auth(token));
};

export const updateAdminUser = (token, id, payload) => {
  if (USE_MOCK) return mock({ ok: true });
  return axios.patch(`${BASE}/admin/users/${id}`, payload, auth(token));
};

export const sendRelance = (token, payload) => {
  if (USE_MOCK) return mock({ ok: true });
  return axios.post(`${BASE}/relances/send`, payload, auth(token));
};

export const getRelances = (token, dossierId) => {
  if (USE_MOCK) return mock([]);
  return axios.get(`${BASE}/relances/${dossierId}`, auth(token));
};

export const exportDgiTva = (token, dossierId, mois = 0, annee = 0) => {
  if (USE_MOCK) return Promise.reject(new Error("Export non disponible en mode démo"));
  return axios.get(`${BASE}/factures/${dossierId}/export-dgi`, {
    ...auth(token),
    params: { mois, annee },
    responseType: "blob",
  });
};

export const recordCorrection = (token, payload) => {
  if (USE_MOCK) return mock({ ok: true });
  return axios.post(`${BASE}/learning/correction`, payload, auth(token));
};

export const getCorrections = (token, dossierId) => {
  if (USE_MOCK) return mock([]);
  return axios.get(`${BASE}/learning/corrections/${dossierId}`, auth(token));
};

export const getRagStatus = (token) => {
  if (USE_MOCK) return mock({ status: "ok" });
  return axios.get(`${BASE}/learning/status`, auth(token));
};

export const MOCK_BANK_LINES = [
  { id: "b1", date: "2026-03-15", libelle: "VIR FOURNISSEUR ATECH DIGITAL",    montant: -5760.00, ref: "VIR-26031501" },
  { id: "b2", date: "2026-03-18", libelle: "VIR FOURNISSEUR MAROC PRINT",       montant: -2880.00, ref: "VIR-26031802" },
  { id: "b3", date: "2026-03-22", libelle: "PRLV SAFRAN MAROC",                 montant: -18600.00, ref: "PRV-26032201" },
  { id: "b4", date: "2026-03-28", libelle: "VIR SONATRACH",                     montant: -34200.00, ref: "VIR-26032803" },
  { id: "b5", date: "2026-04-02", libelle: "ENCAISSEMENT OCP",                  montant: 48000.00,  ref: "ENC-26040201" },
  { id: "b6", date: "2026-04-05", libelle: "VIR FOURNISSEUR CIMENTS DU MAROC",  montant: -9120.00,  ref: "VIR-26040502" },
];

export const MOCK_NOTIFICATIONS = [
  { id: 1, kind: "ai", ts: "il y a 2min", title: "Factures extraites automatiquement", body: "98% de confiance moyenne" },
  { id: 2, kind: "warn", ts: "il y a 14min", title: "Retard detecte", body: "Retard detecte · penalite calculee" },
  { id: 3, kind: "reconcile", ts: "il y a 1h", title: "Releve bancaire importe", body: "Correspondances a valider" },
  { id: 4, kind: "export", ts: "il y a 3h", title: "Export SAGE 100 pret", body: "Journal · ecritures generees" },
];
