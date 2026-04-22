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
export const extractSocieteFromDoc = (token, file) => {
  const form = new FormData();
  form.append("file", file);
  return axios.post(`${BASE}/dossiers/extract-societe`, form, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const createDossier = (token, data) => {
  const params = { ...data };
  if (params.capital_social === "" || params.capital_social == null) delete params.capital_social;
  if (params.logo_hue == null) delete params.logo_hue;
  return axios.post(`${BASE}/dossiers/`, null, { ...auth(token), params });
};
export const deleteDossier = (token, id) => axios.delete(`${BASE}/dossiers/${id}`, auth(token));

export const getFactures = (token, dossierId) =>
  axios.get(`${BASE}/factures/${dossierId}`, auth(token));

export const uploadFactures = (token, dossierId, files) => {
  const form = new FormData();
  files.forEach((file) => form.append("files", file));
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

export const uploadBankStatement = (token, dossierId, file) => {
  const form = new FormData();
  form.append("file", file);
  return axios.post(`${BASE}/reconciliation/${dossierId}/upload`, form, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export async function sendChatMessage(token, payload, handlers = {}) {
  const response = await fetch(`${BASE}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok || !response.body) {
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
}

export const MOCK_NOTIFICATIONS = [
  { id: 1, kind: "ai", ts: "il y a 2min", title: "Factures extraites automatiquement", body: "98% de confiance moyenne" },
  { id: 2, kind: "warn", ts: "il y a 14min", title: "Retard detecte", body: "Retard detecte · penalite calculee" },
  { id: 3, kind: "reconcile", ts: "il y a 1h", title: "Releve bancaire importe", body: "Correspondances a valider" },
  { id: 4, kind: "export", ts: "il y a 3h", title: "Export SAGE 100 pret", body: "Journal · ecritures generees" },
];
