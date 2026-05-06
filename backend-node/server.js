const express = require("express");
const bcrypt = require("bcrypt");
const cors = require("cors");
const multer = require("multer");
const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());

const DB_PATH = path.join(__dirname, "..", "backend", "findoc.db");
const BACKEND_ENV_PATH = path.join(__dirname, "..", "backend", ".env");
const CHAT_MODEL = process.env.ANTHROPIC_CHAT_MODEL || process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-20241022";
const PYTHON = (() => {
  for (const candidate of ["C:/Python314/python.exe", "python3", "python"]) {
    try {
      execFileSync(candidate, ["--version"], { timeout: 2000 });
      return candidate;
    } catch {}
  }
  return null;
})();

function readEnvValue(key) {
  if (process.env[key]) return process.env[key];
  if (!fs.existsSync(BACKEND_ENV_PATH)) return "";
  const match = fs.readFileSync(BACKEND_ENV_PATH, "utf8").match(new RegExp(`^${key}=(.*)$`, "m"));
  return match?.[1]?.trim()?.replace(/^['"]|['"]$/g, "") || "";
}

function sqlQuery(sql, params = []) {
  if (!PYTHON || !fs.existsSync(DB_PATH)) return null;
  const script = `
import sqlite3, json
conn = sqlite3.connect(${JSON.stringify(DB_PATH)})
conn.row_factory = sqlite3.Row
params = json.loads(${JSON.stringify(JSON.stringify(params))})
cur = conn.execute(${JSON.stringify(sql)}, params)
rows = [dict(r) for r in cur.fetchall()]
conn.commit()
conn.close()
print(json.dumps(rows))
`;
  try {
    const out = execFileSync(PYTHON, ["-c", script], { timeout: 5000, encoding: "utf8" });
    return JSON.parse(out.trim());
  } catch {
    return null;
  }
}

function sqlRun(sql, params = []) {
  if (!PYTHON || !fs.existsSync(DB_PATH)) return null;
  const script = `
import sqlite3, json
conn = sqlite3.connect(${JSON.stringify(DB_PATH)})
params = json.loads(${JSON.stringify(JSON.stringify(params))})
cur = conn.execute(${JSON.stringify(sql)}, params)
conn.commit()
rowid = cur.lastrowid
conn.close()
print(json.dumps({"lastrowid": rowid}))
`;
  try {
    const out = execFileSync(PYTHON, ["-c", script], { timeout: 5000, encoding: "utf8" });
    return JSON.parse(out.trim());
  } catch {
    return null;
  }
}

function ensureSchema() {
  if (!PYTHON || !fs.existsSync(DB_PATH)) return;
  const script = `
import sqlite3
conn = sqlite3.connect(${JSON.stringify(DB_PATH)})
conn.execute("""
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  username TEXT UNIQUE,
  hashed_password TEXT,
  nom TEXT,
  role TEXT DEFAULT 'collab',
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
""")
columns = {row[1] for row in conn.execute("PRAGMA table_info(users)").fetchall()}
if "username" not in columns:
    conn.execute("ALTER TABLE users ADD COLUMN username TEXT")
if "status" not in columns:
    conn.execute("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'")
if "created_at" not in columns:
    conn.execute("ALTER TABLE users ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP")
conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users(username) WHERE username IS NOT NULL AND username != ''")
conn.execute("""
UPDATE users
SET username = 'ziyad'
WHERE (username IS NULL OR username = '')
  AND lower(email) IN ('ziyad@cabinetchami.ma', 'ziyad@findoc.local')
""")
conn.execute("""
CREATE TABLE IF NOT EXISTS team_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dossier_id INTEGER NOT NULL,
  user_id INTEGER,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
""")
conn.execute("""
CREATE TABLE IF NOT EXISTS private_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dossier_id INTEGER NOT NULL,
  sender_id INTEGER,
  recipient_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
""")
conn.execute("""
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  user_email TEXT,
  action TEXT NOT NULL,
  ressource TEXT,
  ressource_id INTEGER,
  details TEXT,
  ip TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
""")
conn.execute("""
CREATE TABLE IF NOT EXISTS relances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  facture_id INTEGER,
  niveau INTEGER DEFAULT 1,
  destinataire_email TEXT,
  destinataire_nom TEXT,
  sujet TEXT,
  corps TEXT,
  envoye INTEGER DEFAULT 0,
  envoye_at TEXT,
  created_by INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
""")
facture_columns = {row[1] for row in conn.execute("PRAGMA table_info(factures)").fetchall()}
for name, ddl in {
    "validation_status": "TEXT DEFAULT 'a_valider'",
    "traitement_comptable": "TEXT DEFAULT 'a_verifier'",
    "exercice_rattachement": "INTEGER",
    "compte_pcm": "TEXT",
    "categorie": "TEXT",
    "date_echeance": "TEXT",
    "paiement": "TEXT DEFAULT 'en_attente'",
    "type": "TEXT DEFAULT 'achat'",
}.items():
    if facture_columns and name not in facture_columns:
        conn.execute(f"ALTER TABLE factures ADD COLUMN {name} {ddl}")
conn.commit()
conn.close()
print("ok")
`;
  try {
    execFileSync(PYTHON, ["-c", script], { timeout: 5000, encoding: "utf8" });
  } catch {}
}

function calculerRetard(dateFacture, delaiJours = 60, dateEcheance = null) {
  const source = dateEcheance || dateFacture;
  if (!source) return { retard_jours: 0 };
  const baseDate = new Date(source);
  if (Number.isNaN(baseDate.getTime())) return { retard_jours: 0 };
  if (!dateEcheance && dateFacture) baseDate.setDate(baseDate.getDate() + delaiJours);
  const today = new Date();
  const diff = today.getTime() - baseDate.getTime();
  return { retard_jours: Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24))) };
}

function calculerPenalite(montantTtc, retardJours, tauxAnnuel = 2.25) {
  const montant = Number(montantTtc || 0);
  const retard = Number(retardJours || 0);
  if (!montant || !retard) return 0;
  return (montant * (tauxAnnuel / 100) * retard) / 365;
}

function normalizeDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/);
  if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return raw;
}

function toMoney(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value * 100) / 100;
  if (value == null) return null;
  const cleaned = String(value)
    .replace(/\u00a0/g, "")
    .replace(/MAD|DHS|DH|درهم/gi, "")
    .replace(/\s/g, "")
    .replace(/,/g, ".");
  const normalized = cleaned.replace(/[^0-9.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

function ensureInvoiceTotals(data) {
  const ttc = toMoney(data.montant_ttc);
  let ht = toMoney(data.montant_ht);
  let tva = toMoney(data.tva);
  if (ht == null && ttc != null && tva != null) ht = Math.max(0, Math.round((ttc - tva) * 100) / 100);
  if (ttc == null && ht != null && tva != null) data.montant_ttc = Math.round((ht + tva) * 100) / 100;
  if (ht == null && ttc != null) ht = Math.round((ttc / 1.2) * 100) / 100;
  if (tva == null && ttc != null && ht != null) tva = Math.round((ttc - ht) * 100) / 100;
  data.montant_ht = ht ?? 0;
  data.tva = tva ?? 0;
  data.montant_ttc = toMoney(data.montant_ttc) ?? Math.round((data.montant_ht + data.tva) * 100) / 100;
  return data;
}

function parseClaudeJson(text) {
  const cleaned = String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  return JSON.parse(cleaned);
}

function fallbackExtractInvoice(file) {
  const stem = path.basename(file.originalname || "facture", path.extname(file.originalname || ""));
  const text = file.buffer.toString("utf8").slice(0, 6000);
  const amountCandidates = [...text.matchAll(/(\d[\d\s.,]{2,})/g)]
    .map((match) => toMoney(match[1]))
    .filter((value) => value && value > 0 && value < 100000000);
  const montantTtc = amountCandidates.length ? Math.max(...amountCandidates) : 0;
  const today = new Date();
  const due = new Date(today);
  due.setDate(due.getDate() + 60);
  return ensureInvoiceTotals({
    fournisseur: stem.replace(/[_-]+/g, " ").toUpperCase(),
    code_tiers: `FL${stem.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase() || "FACTURE"}`,
    num_facture: stem,
    date_facture: today.toISOString().slice(0, 10),
    date_echeance: due.toISOString().slice(0, 10),
    montant_ttc: montantTtc,
    type: "achat",
    paiement: "en_attente",
    statut: "traite",
    confidence: 0.35,
    compte_pcm: "6111000",
    categorie: "A verifier",
    source_ai: "fallback",
    texte_source: text,
  });
}

async function extractInvoiceWithClaude(file) {
  const apiKey = readEnvValue("ANTHROPIC_API_KEY");
  if (!apiKey || !file?.buffer?.length) return null;
  if (file.buffer.length > 30 * 1024 * 1024) return null;

  const ext = path.extname(file.originalname || "").toLowerCase();
  const mediaType = file.mimetype || (ext === ".pdf" ? "application/pdf" : "image/jpeg");
  if (mediaType !== "application/pdf" && !mediaType.startsWith("image/")) return null;

  const source = {
    type: "base64",
    media_type: mediaType,
    data: file.buffer.toString("base64"),
  };
  const mediaBlock = mediaType === "application/pdf"
    ? { type: "document", source }
    : { type: "image", source };

  const prompt = [
    "Tu es un expert-comptable marocain. Lis cette facture et retourne uniquement un JSON valide.",
    "Champs: fournisseur, code_tiers, num_facture, date_facture, date_echeance, montant_ht, tva, montant_ttc, type, paiement, categorie, compte_pcm.",
    "Formats: dates YYYY-MM-DD, type achat ou vente, paiement en_attente par defaut.",
    "Si une information manque, mets null. Ne rajoute aucun texte hors JSON.",
    `Nom du fichier: ${file.originalname || "facture"}`,
  ].join("\n");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_VISION_MODEL || process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
      max_tokens: 1400,
      messages: [{ role: "user", content: [mediaBlock, { type: "text", text: prompt }] }],
    }),
  });

  if (!response.ok) throw new Error(`Anthropic invoice error ${response.status}`);
  const payload = await response.json();
  const text = payload?.content?.find((part) => part.type === "text")?.text || "";
  const data = parseClaudeJson(text);
  return ensureInvoiceTotals({
    fournisseur: data.fournisseur || path.basename(file.originalname || "Facture"),
    code_tiers: data.code_tiers || `FL${String(data.fournisseur || "FACT").replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase()}`,
    num_facture: data.num_facture || path.basename(file.originalname || "Facture", ext),
    date_facture: normalizeDate(data.date_facture) || new Date().toISOString().slice(0, 10),
    date_echeance: normalizeDate(data.date_echeance),
    montant_ht: data.montant_ht,
    tva: data.tva,
    montant_ttc: data.montant_ttc,
    type: data.type === "vente" ? "vente" : "achat",
    paiement: data.paiement || "en_attente",
    categorie: data.categorie || "A verifier",
    compte_pcm: data.compte_pcm || (data.type === "vente" ? "7111000" : "6111000"),
    statut: "traite",
    confidence: 0.92,
    source_ai: "claude_vision",
    texte_source: JSON.stringify(data).slice(0, 6000),
  });
}

function buildEcrituresForInvoice(facture) {
  const ht = Number(facture.montant_ht || 0);
  const tva = Number(facture.tva || 0);
  const ttc = Number(facture.montant_ttc || 0);
  if (facture.type === "vente") {
    return [
      { compte_pcm: "342100", libelle: facture.fournisseur, debit: ttc, credit: 0 },
      ...(tva ? [{ compte_pcm: "342200", libelle: `TVA coll. - ${facture.fournisseur}`, debit: 0, credit: tva }] : []),
      { compte_pcm: facture.compte_pcm || "7111000", libelle: `Vente - ${facture.fournisseur}`, debit: 0, credit: ht },
    ];
  }
  return [
    { compte_pcm: facture.compte_pcm || "6111000", libelle: facture.fournisseur, debit: ht, credit: 0 },
    ...(tva ? [{ compte_pcm: "344100", libelle: `TVA ded. - ${facture.fournisseur}`, debit: tva, credit: 0 }] : []),
    { compte_pcm: "401100", libelle: facture.fournisseur, debit: 0, credit: ttc },
  ];
}

function buildChatContext(dossierId) {
  const dossier = (sqlQuery("SELECT * FROM dossiers WHERE id = ?", [dossierId]) || [])[0] || {};
  const factures = sqlQuery("SELECT * FROM factures WHERE dossier_id = ? ORDER BY date_facture DESC, id DESC", [dossierId]) || [];
  const factureIds = factures.map((facture) => facture.id).filter(Boolean);
  const placeholders = factureIds.map(() => "?").join(",");
  const ecritures = factureIds.length
    ? (sqlQuery(`SELECT * FROM ecritures WHERE facture_id IN (${placeholders}) ORDER BY id ASC`, factureIds) || [])
    : [];

  const achats = factures.filter((facture) => (facture.type || "achat") === "achat");
  const ventes = factures.filter((facture) => facture.type === "vente");
  const retards = factures.filter((facture) => facture.paiement === "en_retard");
  const penalites = retards.reduce((total, facture) => {
    const retard = calculerRetard(facture.date_facture, 60, facture.date_echeance);
    return total + calculerPenalite(facture.montant_ttc, retard.retard_jours, 2.25);
  }, 0);

  return {
    dossier,
    factures,
    ecritures,
    stats: {
      generated_at: new Date().toISOString(),
      achats_ttc: Number(achats.reduce((total, facture) => total + Number(facture.montant_ttc || 0), 0).toFixed(2)),
      ventes_ttc: Number(ventes.reduce((total, facture) => total + Number(facture.montant_ttc || 0), 0).toFixed(2)),
      tva_deductible: Number(achats.reduce((total, facture) => total + Number(facture.tva || 0), 0).toFixed(2)),
      tva_collectee: Number(ventes.reduce((total, facture) => total + Number(facture.tva || 0), 0).toFixed(2)),
      factures_en_retard: retards.length,
      penalites_totales: Number(penalites.toFixed(2)),
    },
  };
}

function buildChatContextSummary(context) {
  const dossier = context.dossier || {};
  const factures = context.factures || [];
  const stats = context.stats || {};
  const lines = [
    `Dossier: ${dossier.raison_sociale || "N/A"} (${dossier.forme_juridique || "N/A"})`,
    `Ville: ${dossier.ville || "N/A"}`,
    `Nombre de factures: ${factures.length}`,
    `Retards: ${stats.factures_en_retard || 0}`,
    `TVA collectee: ${stats.tva_collectee || 0}`,
    `TVA deductible: ${stats.tva_deductible || 0}`,
    "Extraits de factures:",
  ];
  factures.slice(0, 12).forEach((facture) => {
    lines.push(
      `- ${facture.num_facture || facture.nom_fichier || "Facture"}: ${facture.fournisseur || "N/A"} TTC=${facture.montant_ttc || 0} statut=${facture.paiement || "N/A"} echeance=${facture.date_echeance || "N/A"}`
    );
  });
  return lines.join("\n");
}

function fallbackChatAnswer(message, context) {
  const lowered = String(message || "").toLowerCase();
  const stats = context.stats || {};
  const factures = context.factures || [];

  if (lowered.includes("retard")) {
    const retards = factures.filter((facture) => facture.paiement === "en_retard");
    if (!retards.length) return "Aucune facture en retard n'a ete detectee dans ce dossier.";
    return [
      "Factures en retard :",
      ...retards.slice(0, 10).map((facture) =>
        `- ${facture.num_facture || facture.nom_fichier || "Facture"} / ${facture.fournisseur || "N/A"} / ${Number(facture.montant_ttc || 0).toFixed(2)} MAD / echeance ${facture.date_echeance || "N/A"}`
      ),
    ].join("\n");
  }

  if (lowered.includes("tva")) {
    const solde = Number((Number(stats.tva_collectee || 0) - Number(stats.tva_deductible || 0)).toFixed(2));
    return [
      `TVA collectee: ${Number(stats.tva_collectee || 0).toFixed(2)} MAD`,
      `TVA deductible: ${Number(stats.tva_deductible || 0).toFixed(2)} MAD`,
      `Solde TVA estime: ${solde.toFixed(2)} MAD`,
    ].join("\n");
  }

  if (lowered.includes("69-21") || lowered.includes("penalit")) {
    return `Penalites estimees Loi 69-21: ${Number(stats.penalites_totales || 0).toFixed(2)} MAD.`;
  }

  return [
    "Resume dossier:",
    `- Factures: ${factures.length}`,
    `- Montant achats TTC: ${Number(stats.achats_ttc || 0).toFixed(2)} MAD`,
    `- Montant ventes TTC: ${Number(stats.ventes_ttc || 0).toFixed(2)} MAD`,
    `- Penalites estimees: ${Number(stats.penalites_totales || 0).toFixed(2)} MAD`,
  ].join("\n");
}

function writeSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

async function streamClaudeChat({ message, history, context, res }) {
  const apiKey = readEnvValue("ANTHROPIC_API_KEY");
  if (!apiKey) {
    const answer = fallbackChatAnswer(message, context);
    answer.split(" ").forEach((token) => writeSse(res, "chunk", { text: `${token} ` }));
    writeSse(res, "done", { ok: true, fallback: true });
    return;
  }

  const stats = context.stats || {};
  const alerts = [];
  if ((stats.factures_en_retard || 0) > 0) {
    alerts.push(`⚠️ ${stats.factures_en_retard} facture(s) en retard — pénalités estimées Loi 69-21 : ${Number(stats.penalites_totales || 0).toFixed(2)} MAD`);
  }
  const soldeTva = Number((stats.tva_collectee || 0) - (stats.tva_deductible || 0));
  if (soldeTva > 10000) {
    alerts.push(`⚠️ TVA nette à reverser au DGI : ${soldeTva.toFixed(2)} MAD`);
  }

  const systemPrompt = [
    "Tu es FinDoc, copilote comptable expert dédié aux cabinets comptables marocains.",
    "Réponds TOUJOURS en français, de manière concise, claire et opérationnelle.",
    "Utilise le Plan Comptable Marocain (PCM), la Loi 69-21 sur les délais de paiement, la TVA à 20% par défaut, et la RAS (retenue à la source).",
    "Quand une information manque dans les données du dossier, dis-le clairement sans inventer.",
    "Pour les réponses structurées, utilise du Markdown (listes, gras, tableaux).",
    "",
    ...(alerts.length ? ["## Alertes actives", ...alerts, ""] : []),
    "## Contexte du dossier",
    buildChatContextSummary(context),
  ].join("\n");

  const messages = [
    ...(Array.isArray(history) ? history.slice(-8) : []).map((item) => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: String(item.content || ""),
    })),
    { role: "user", content: String(message || "") },
  ];

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Anthropic error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = "";
  let finished = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const rawData = line.slice(6).trim();
      if (!rawData || rawData === "[DONE]") continue;
      let payload;
      try { payload = JSON.parse(rawData); } catch { continue; }

      if (payload.type === "content_block_delta" && payload.delta?.type === "text_delta" && payload.delta.text) {
        writeSse(res, "chunk", { text: payload.delta.text });
      } else if (payload.type === "message_stop" || payload.type === "message_delta") {
        if (!finished) { finished = true; writeSse(res, "done", { ok: true }); }
      }
    }
  }

  if (!finished) writeSse(res, "done", { ok: true });
}

async function completeClaudeChat({ message, history, context }) {
  const apiKey = readEnvValue("ANTHROPIC_API_KEY");
  if (!apiKey) return { answer: fallbackChatAnswer(message, context), fallback: true };

  const messages = [
    ...(Array.isArray(history) ? history.slice(-8) : []).map((item) => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: String(item.content || ""),
    })),
    { role: "user", content: String(message || "") },
  ];

  const prompt = [
    "Tu es FinDoc, copilote comptable expert pour cabinets comptables marocains.",
    "Reponds toujours en francais, de maniere concise, claire et operationnelle.",
    "Utilise le Plan Comptable Marocain, la Loi 69-21, la TVA et les donnees du dossier.",
    "Si une information manque, dis-le sans inventer.",
    "",
    "Contexte du dossier:",
    buildChatContextSummary(context),
  ].join("\n");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      max_tokens: 1024,
      system: prompt,
      messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Anthropic error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const answer = Array.isArray(data.content)
    ? data.content.map((part) => part?.text || "").join("").trim()
    : "";
  return { answer: answer || fallbackChatAnswer(message, context), fallback: !answer };
}

const tokens = {};
let nextId = 100;
const DEMO_DOSSIER = {
  id: 1,
  raison_sociale: "ATLAS INDUSTRIES SA",
  ice: "001234567890123",
  forme_juridique: "SA",
  ville: "Casablanca",
  secteur: "Industrie",
  regime_tva: "debits",
  if_number: "15243890",
  rc_number: "98765",
  cnss_number: "4567891",
  capital_social: 2500000,
  adresse: "Zone industrielle Ain Sebaa, Casablanca",
  telephone: "+212 522 00 00 00",
  email_societe: "contact@atlas-industries.ma",
  site_web: "https://atlas-industries.ma",
  logo_hue: 178,
  exercice_courant: new Date().getFullYear(),
  created_at: new Date().toISOString(),
};
const memDossiers = [{ ...DEMO_DOSSIER }];
const memFactures = [];
const memEcritures = [];
const memFiles = new Map();
let nextFactureId = 1;
let nextEcritureId = 1;
let nextFileId = 1;

const ROLES = ["admin", "collab", "invite"];
const USERS = {
  "ziyad@findoc.local": { id: 1, email: "ziyad@findoc.local", username: "ziyad", nom: "Ziyad", role: "admin", status: "active" },
  "sarah@findoc.local": { id: 2, email: "sarah@findoc.local", username: "sarah", nom: "Sarah", role: "collab", status: "active" },
  "youssef@findoc.local": { id: 3, email: "youssef@findoc.local", username: "youssef", nom: "Youssef", role: "invite", status: "active" },
};

ensureSchema();

function normalizeRole(role) {
  const value = String(role || "").trim().toLowerCase();
  if (value === "collaborateur" || value === "collab") return "collab";
  if (value === "invité" || value === "invite") return "invite";
  return ROLES.includes(value) ? value : "collab";
}

function seedDefaultUsers() {
  if (!PYTHON || !fs.existsSync(DB_PATH)) return;
  const existing = sqlQuery("SELECT COUNT(*) AS count FROM users");
  if ((existing?.[0]?.count || 0) > 0) return;
  Object.values(USERS).forEach((user) => {
    sqlRun(
      "INSERT INTO users (email, username, hashed_password, nom, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))",
      [user.email, user.username || null, bcrypt.hashSync(user.username === "ziyad" ? "ziyad123" : "password123", 10), user.nom, normalizeRole(user.role), user.status || "active"]
    );
  });
}

seedDefaultUsers();

function getUserByEmail(email) {
  const rows = sqlQuery("SELECT id, email, username, nom, role, status, created_at FROM users WHERE lower(email) = lower(?)", [email]);
  if (rows && rows.length > 0) return { ...rows[0], role: normalizeRole(rows[0].role) };
  return USERS[email] || null;
}

function getFallbackUser(identifier) {
  const value = String(identifier || "").trim().toLowerCase();
  return Object.values(USERS).find(
    (user) => user.email.toLowerCase() === value || String(user.username || "").toLowerCase() === value
  ) || null;
}

function getUserByIdentifier(identifier) {
  const value = String(identifier || "").trim();
  const rows = sqlQuery(
    "SELECT id, email, username, nom, role, status, created_at, hashed_password FROM users WHERE lower(email) = lower(?) OR lower(username) = lower(?)",
    [value, value]
  );
  if (rows && rows.length > 0) return { ...rows[0], role: normalizeRole(rows[0].role) };
  return getFallbackUser(value);
}

function ensureDemoUser() {
  const fallback = USERS["ziyad@findoc.local"];
  if (!PYTHON || !fs.existsSync(DB_PATH)) return fallback;

  const rows = sqlQuery(
    "SELECT id, email, username, nom, role, status, created_at, hashed_password FROM users WHERE lower(username) = 'ziyad' OR lower(email) IN ('ziyad@findoc.local', 'ziyad@cabinetchami.ma') LIMIT 1"
  );
  if (rows && rows.length > 0) {
    const user = rows[0];
    sqlRun(
      "UPDATE users SET username = COALESCE(NULLIF(username, ''), 'ziyad'), hashed_password = COALESCE(NULLIF(hashed_password, ''), ?), role = COALESCE(NULLIF(role, ''), 'admin') WHERE id = ?",
      [bcrypt.hashSync("ziyad123", 10), user.id]
    );
    return getUserByIdentifier("ziyad") || { ...user, username: "ziyad", role: normalizeRole(user.role) };
  }

  const insert = sqlRun(
    "INSERT INTO users (email, username, hashed_password, nom, role, status, created_at) VALUES (?, ?, ?, ?, ?, 'active', datetime('now'))",
    ["ziyad@findoc.local", "ziyad", bcrypt.hashSync("ziyad123", 10), "Ziyad", "admin"]
  );
  return insert?.lastrowid ? getUserById(insert.lastrowid) : fallback;
}

function getUserById(id) {
  const rows = sqlQuery("SELECT id, email, username, nom, role, status, created_at FROM users WHERE id = ?", [id]);
  if (rows && rows.length > 0) return { ...rows[0], role: normalizeRole(rows[0].role) };
  return Object.values(USERS).find((user) => Number(user.id) === Number(id)) || null;
}

function listKnownUsers() {
  const rows = sqlQuery("SELECT id, email, username, nom, role, status, created_at FROM users ORDER BY nom ASC, email ASC");
  if (rows && rows.length > 0) return rows.map((row) => ({ ...row, role: normalizeRole(row.role) }));
  return Object.values(USERS);
}

function getTokenSecret() {
  return process.env.SECRET_KEY || readEnvValue("SECRET_KEY") || "findoc_demo_secret";
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function createAccessToken(email) {
  const payload = JSON.stringify({ email, iat: Date.now() });
  const body = base64UrlEncode(payload);
  const signature = crypto.createHmac("sha256", getTokenSecret()).update(body).digest("base64url");
  return `fd1.${body}.${signature}`;
}

function verifyAccessToken(token) {
  if (!token) return null;
  if (tokens[token]) return tokens[token];
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "fd1") return null;
  const [, body, signature] = parts;
  const expected = crypto.createHmac("sha256", getTokenSecret()).update(body).digest("base64url");
  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return payload?.email ? String(payload.email) : null;
  } catch {
    return null;
  }
}

function requireAdmin(req, res) {
  const email = requireAuth(req, res);
  if (!email) return null;
  const user = getUserByEmail(email);
  if (!user || normalizeRole(user.role) !== "admin") {
    res.status(403).json({ detail: "Acces reserve a l'admin" });
    return null;
  }
  return user;
}

function requireAuth(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ detail: "Token invalide" });
    return null;
  }
  const email = verifyAccessToken(authHeader.substring(7));
  if (!email) {
    res.status(401).json({ detail: "Token invalide" });
    return null;
  }
  return email;
}

app.post("/auth/login", express.urlencoded({ extended: true }), (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(401).json({ detail: "Identifiant ou mot de passe incorrect" });

  const demoLogin = String(username).trim().toLowerCase() === "ziyad" && password === "ziyad123";
  const user = getUserByIdentifier(username) || (demoLogin ? ensureDemoUser() : null);
  if (user) {
    if (user.status === "disabled") {
      return res.status(403).json({ detail: "Compte desactive" });
    }
    const hash = user.hashed_password || "";
    const isBcryptHash = typeof hash === "string" && hash.startsWith("$2");
    const fallbackPasswordOk = !hash && password === (user.username === "ziyad" ? "ziyad123" : "password123");
    const passwordOk = demoLogin || fallbackPasswordOk || (isBcryptHash ? bcrypt.compareSync(password, hash) : hash === password);
    if (!passwordOk) return res.status(401).json({ detail: "Identifiant ou mot de passe incorrect" });
    const tok = createAccessToken(user.email);
    tokens[tok] = user.email;
    return res.json({ access_token: tok, token_type: "bearer" });
  }

  return res.status(401).json({ detail: "Identifiant ou mot de passe incorrect" });
});

app.get("/auth/me", (req, res) => {
  const email = requireAuth(req, res);
  if (!email) return;
  return res.json(getUserByEmail(email) || { email, nom: email, role: "collab", status: "active" });
});

app.get("/admin/users", (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  res.json(listKnownUsers());
});

app.post("/admin/users", (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const email = String(req.body?.email || "").trim().toLowerCase();
  const nom = String(req.body?.nom || "").trim();
  const role = normalizeRole(req.body?.role);
  const password = String(req.body?.password || "").trim() || "password123";

  if (!email || !nom) return res.status(400).json({ detail: "Nom et email requis" });
  if (getUserByEmail(email)) return res.status(409).json({ detail: "Utilisateur deja existant" });

  const insert = sqlRun(
    "INSERT INTO users (email, hashed_password, nom, role, status, created_at) VALUES (?, ?, ?, ?, 'active', datetime('now'))",
    [email, bcrypt.hashSync(password, 10), nom, role]
  );

  if (!insert?.lastrowid) return res.status(500).json({ detail: "Creation impossible" });
  logAction(admin.email, "create_user", "user", insert.lastrowid, `Utilisateur créé: ${email}`, null);
  res.status(201).json(getUserById(insert.lastrowid));
});

app.patch("/admin/users/:id", (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const user = getUserById(req.params.id);
  if (!user) return res.status(404).json({ detail: "Utilisateur introuvable" });

  const nextNom = req.body?.nom != null ? String(req.body.nom).trim() : user.nom;
  const nextRole = req.body?.role != null ? normalizeRole(req.body.role) : normalizeRole(user.role);
  const nextStatus = req.body?.status === "disabled" ? "disabled" : "active";

  sqlRun(
    "UPDATE users SET nom = ?, role = ?, status = ? WHERE id = ?",
    [nextNom, nextRole, nextStatus, req.params.id]
  );

  if (req.body?.password) {
    sqlRun("UPDATE users SET hashed_password = ? WHERE id = ?", [bcrypt.hashSync(String(req.body.password), 10), req.params.id]);
  }

  res.json(getUserById(req.params.id));
});

app.get("/dossiers/", (req, res) => {
  const email = requireAuth(req, res);
  if (!email) return;
  const rows = sqlQuery("SELECT * FROM dossiers ORDER BY id DESC");
  res.json(rows || memDossiers);
});

app.post("/dossiers/", (req, res) => {
  const email = requireAuth(req, res);
  if (!email) return;
  const q = req.query;
  if (!q.raison_sociale) return res.status(400).json({ detail: "raison_sociale requis" });

  const result = sqlRun(
    `
    INSERT INTO dossiers (raison_sociale, ice, forme_juridique, ville, secteur, regime_tva,
      if_number, rc_number, cnss_number, capital_social, adresse, telephone, email_societe, site_web, logo_hue, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `,
    [
      q.raison_sociale,
      q.ice || "",
      q.forme_juridique || "SARL",
      q.ville || "",
      q.secteur || "",
      q.regime_tva || "debits",
      q.if_number || null,
      q.rc_number || null,
      q.cnss_number || null,
      q.capital_social ? parseFloat(q.capital_social) : null,
      q.adresse || null,
      q.telephone || null,
      q.email_societe || null,
      q.site_web || null,
      q.logo_hue ? parseInt(q.logo_hue, 10) : null,
    ]
  );

  if (result) {
    const rows = sqlQuery("SELECT * FROM dossiers WHERE id = ?", [result.lastrowid]);
    return res.json(rows?.[0] || { id: result.lastrowid, ...q });
  }

  const dossier = {
    id: nextId++,
    created_at: new Date().toISOString(),
    raison_sociale: q.raison_sociale,
    ice: q.ice || "",
    forme_juridique: q.forme_juridique || "SARL",
    ville: q.ville || "",
    secteur: q.secteur || "",
    regime_tva: q.regime_tva || "debits",
    if_number: q.if_number || null,
    rc_number: q.rc_number || null,
    cnss_number: q.cnss_number || null,
    capital_social: q.capital_social ? parseFloat(q.capital_social) : null,
    adresse: q.adresse || null,
    telephone: q.telephone || null,
    email_societe: q.email_societe || null,
    site_web: q.site_web || null,
    logo_hue: q.logo_hue ? parseInt(q.logo_hue, 10) : null,
  };
  memDossiers.unshift(dossier);
  res.json(dossier);
});

app.get("/dossiers/:id", (req, res) => {
  const email = requireAuth(req, res);
  if (!email) return;
  const rows = sqlQuery("SELECT * FROM dossiers WHERE id = ?", [req.params.id]);
  if (rows && rows.length > 0) return res.json(rows[0]);
  const dossier = memDossiers.find((row) => row.id == req.params.id);
  if (dossier) return res.json(dossier);
  return res.status(404).json({ detail: "Dossier introuvable" });
});

app.delete("/dossiers/:id", (req, res) => {
  const email = requireAuth(req, res);
  if (!email) return;
  sqlRun("DELETE FROM dossiers WHERE id = ?", [req.params.id]);
  const index = memDossiers.findIndex((row) => row.id == req.params.id);
  if (index !== -1) memDossiers.splice(index, 1);
  res.json({ message: "Dossier supprime" });
});

app.delete("/admin/users/:id", (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  const user = getUserById(req.params.id);
  if (!user) return res.status(404).json({ detail: "Utilisateur introuvable" });
  if (Number(user.id) === Number(admin.id)) return res.status(400).json({ detail: "Impossible de se supprimer soi-meme" });
  sqlRun("DELETE FROM users WHERE id = ?", [req.params.id]);
  res.json({ message: "Utilisateur supprime" });
});

app.get("/factures/:dossier_id", (req, res) => {
  const email = requireAuth(req, res);
  if (!email) return;
  const rows = sqlQuery("SELECT * FROM factures WHERE dossier_id=? ORDER BY date_facture DESC", [req.params.dossier_id]);
  const memoryRows = memFactures.filter((facture) => Number(facture.dossier_id) === Number(req.params.dossier_id));
  res.json([...(rows || []), ...memoryRows].sort((a, b) => String(b.date_facture || "").localeCompare(String(a.date_facture || ""))));
});

app.get("/factures/:dossier_id/ecritures", (req, res) => {
  const email = requireAuth(req, res);
  if (!email) return;
  const dbFactureIds = sqlQuery("SELECT id FROM factures WHERE dossier_id=?", [req.params.dossier_id]);
  const memoryFactureIds = memFactures
    .filter((facture) => Number(facture.dossier_id) === Number(req.params.dossier_id))
    .map((facture) => Number(facture.id));
  const memoryRows = memEcritures
    .filter((row) => memoryFactureIds.includes(Number(row.facture_id)))
    .map((row) => {
      const facture = memFactures.find((item) => Number(item.id) === Number(row.facture_id)) || {};
      return {
        ...row,
        compte: row.compte || row.compte_pcm,
        date: row.date || facture.date_facture || row.created_at,
        journal: row.journal || "AC",
        tiers: row.tiers || facture.fournisseur || "",
      };
    });
  if (!dbFactureIds) return res.json(memoryRows);
  const factureIds = dbFactureIds.map((row) => row.id);
  if (!factureIds.length) return res.json(memoryRows);
  const placeholders = factureIds.map(() => "?").join(",");
  const rows = sqlQuery(
    `SELECT
       e.*,
       e.compte_pcm AS compte,
       COALESCE(f.date_facture, e.created_at) AS date,
       'AC' AS journal,
       COALESCE(f.fournisseur, '') AS tiers
     FROM ecritures e
     LEFT JOIN factures f ON f.id = e.facture_id
     WHERE e.facture_id IN (${placeholders})
     ORDER BY e.id`,
    factureIds
  );
  res.json([...(rows || []), ...memoryRows]);
});

app.post("/factures/:dossier_id/upload", upload.array("files"), async (req, res) => {
  const email = requireAuth(req, res);
  if (!email) return;
  const files = Array.isArray(req.files) ? req.files : [];
  if (!files.length) return res.status(400).json({ detail: "Aucun fichier recu" });

  const resultats = [];

  for (const file of files) {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (![".pdf", ".png", ".jpg", ".jpeg"].includes(ext)) {
      resultats.push({ fichier: file.originalname || "fichier", statut: "erreur" });
      continue;
    }

    let extracted;
    try {
      extracted = await extractInvoiceWithClaude(file);
    } catch (error) {
      console.error("[invoice extraction error]", error?.message);
      extracted = null;
    }
    extracted = extracted || fallbackExtractInvoice(file);
    const storedKey = `mem_${Date.now()}_${nextFileId++}_${path.basename(file.originalname || "facture")}`;
    memFiles.set(storedKey, {
      buffer: file.buffer,
      mimetype: file.mimetype || (ext === ".pdf" ? "application/pdf" : "application/octet-stream"),
      filename: file.originalname || `facture-${Date.now()}${ext}`,
    });

    const baseFacture = {
      dossier_id: Number(req.params.dossier_id),
      nom_fichier: file.originalname || `facture-${Date.now()}${ext}`,
      stored_filename: storedKey,
      fournisseur: extracted.fournisseur || "Fournisseur a verifier",
      code_tiers: extracted.code_tiers || "FLAVERI",
      montant_ht: Number(extracted.montant_ht || 0),
      tva: Number(extracted.tva || 0),
      montant_ttc: Number(extracted.montant_ttc || 0),
      date_facture: extracted.date_facture || new Date().toISOString().slice(0, 10),
      statut: "traite",
      created_at: new Date().toISOString(),
      type: extracted.type || "achat",
      paiement: extracted.paiement || "en_attente",
      num_facture: extracted.num_facture || path.basename(file.originalname || "facture", ext),
      date_echeance: extracted.date_echeance || null,
      confidence: extracted.confidence || 0.35,
      categorie: extracted.categorie || "A verifier",
      compte_pcm: extracted.compte_pcm || ((extracted.type === "vente") ? "7111000" : "6111000"),
      exercice_rattachement: extracted.exercice_rattachement || null,
      traitement_comptable: extracted.traitement_comptable || "a_verifier",
      analyse_ai: extracted.source_ai === "claude_vision" ? "Extraction Claude Vision" : "Extraction fallback a verifier",
      validation_status: extracted.source_ai === "claude_vision" ? "a_valider" : "a_verifier",
      texte_source: extracted.texte_source || null,
      ocr_payload: null,
    };

    const insert = sqlRun(
      `
      INSERT INTO factures (
        dossier_id, nom_fichier, stored_filename, fournisseur, code_tiers, montant_ht, tva, montant_ttc,
        date_facture, statut, created_at, type, paiement, num_facture, date_echeance, confidence,
        categorie, compte_pcm, exercice_rattachement, traitement_comptable, analyse_ai,
        validation_status, texte_source, ocr_payload
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        baseFacture.dossier_id, baseFacture.nom_fichier, baseFacture.stored_filename, baseFacture.fournisseur,
        baseFacture.code_tiers, baseFacture.montant_ht, baseFacture.tva, baseFacture.montant_ttc,
        baseFacture.date_facture, baseFacture.statut, baseFacture.created_at, baseFacture.type,
        baseFacture.paiement, baseFacture.num_facture, baseFacture.date_echeance, baseFacture.confidence,
        baseFacture.categorie, baseFacture.compte_pcm, baseFacture.exercice_rattachement,
        baseFacture.traitement_comptable, baseFacture.analyse_ai, baseFacture.validation_status,
        baseFacture.texte_source, baseFacture.ocr_payload,
      ]
    );

    const facture = { ...baseFacture, id: insert?.lastrowid || nextFactureId++ };
    const ecritures = buildEcrituresForInvoice(facture);

    if (insert?.lastrowid) {
      ecritures.forEach((row) => {
        sqlRun(
          "INSERT INTO ecritures (facture_id, compte_pcm, libelle, debit, credit, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
          [facture.id, row.compte_pcm, row.libelle, row.debit, row.credit]
        );
      });
    } else {
      memFactures.push(facture);
      ecritures.forEach((row) => {
        memEcritures.push({
          id: nextEcritureId++,
          facture_id: facture.id,
          ...row,
          created_at: new Date().toISOString(),
        });
      });
    }

    resultats.push({
      id: facture.id,
      fichier: facture.nom_fichier,
      fournisseur: facture.fournisseur,
      num_facture: facture.num_facture,
      montant_ttc: facture.montant_ttc,
      statut: "traite",
      source_ai: extracted.source_ai,
      confiance: facture.confidence,
    });
  }

  logAction(email, "upload_facture", "dossier", req.params.dossier_id, `${resultats.length} fichier(s) importe(s)`, req.headers["x-forwarded-for"] || req.socket?.remoteAddress);
  res.json({ total: files.length, resultats });
});

app.patch("/factures/item/:facture_id", (req, res) => {
  const email = requireAuth(req, res);
  if (!email) return;

  const factureId = Number(req.params.facture_id);
  const payload = req.body || {};
  const allowed = [
    "type",
    "fournisseur",
    "code_tiers",
    "num_facture",
    "date_facture",
    "date_echeance",
    "montant_ht",
    "tva",
    "montant_ttc",
    "categorie",
    "compte_pcm",
    "exercice_rattachement",
    "traitement_comptable",
    "validation_status",
    "paiement",
    "statut",
  ];

  const updates = Object.entries(payload).filter(([key]) => allowed.includes(key));
  if (!factureId) return res.status(400).json({ detail: "facture_id invalide" });
  if (!updates.length) return res.status(400).json({ detail: "Aucun champ valide a mettre a jour" });

  const existingRows = sqlQuery("SELECT * FROM factures WHERE id = ?", [factureId]);
  const existing = existingRows?.[0];

  if (existing) {
    const assignments = updates.map(([key]) => `${key} = ?`).join(", ");
    const values = updates.map(([, value]) => value);
    const updateResult = sqlRun(`UPDATE factures SET ${assignments} WHERE id = ?`, [...values, factureId]);
    if (!updateResult) {
      return res.status(500).json({ detail: "Mise a jour facture impossible" });
    }
    const rows = sqlQuery("SELECT * FROM factures WHERE id = ?", [factureId]);
    return res.json({ ...(rows?.[0] || existing), ...Object.fromEntries(updates) });
  }

  const index = memFactures.findIndex((row) => Number(row.id) === factureId);
  if (index === -1) return res.status(404).json({ detail: "Facture introuvable" });

  memFactures[index] = {
    ...memFactures[index],
    ...Object.fromEntries(updates),
  };
  return res.json(memFactures[index]);
});

app.get("/factures/item/:facture_id/file", (req, res) => {
  const email = requireAuth(req, res);
  if (!email) return;

  const rows = sqlQuery("SELECT id, nom_fichier, stored_filename FROM factures WHERE id = ?", [req.params.facture_id]);
  const facture = (rows && rows[0]) || memFactures.find((row) => Number(row.id) === Number(req.params.facture_id));
  if (!facture) return res.status(404).json({ detail: "Facture introuvable" });

  if (facture.stored_filename && memFiles.has(facture.stored_filename)) {
    const file = memFiles.get(facture.stored_filename);
    res.setHeader("Content-Type", file.mimetype);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.filename)}"`);
    return res.send(file.buffer);
  }

  if (facture.stored_filename) {
    const safeName = path.basename(facture.stored_filename);
    const candidates = [
      path.join(__dirname, "..", "backend", "uploads", safeName),
      path.join(__dirname, "uploads", safeName),
    ];
    const found = candidates.find((candidate) => fs.existsSync(candidate));
    if (found) return res.sendFile(found);
  }

  return res.status(404).json({ detail: "Fichier original introuvable" });
});

app.post("/dossiers/extract-societe", upload.single("file"), (req, res) => {
  const email = requireAuth(req, res);
  if (!email) return;
  if (!req.file) return res.status(400).json({ detail: "Fichier manquant" });
  if (!PYTHON) return res.status(503).json({ detail: "Python non disponible pour l'extraction" });

  const ext = (req.file.originalname || "").split(".").pop().toLowerCase();
  const allowed = ["pdf", "jpg", "jpeg", "png", "xml"];
  if (!allowed.includes(ext)) return res.status(400).json({ detail: `Format non supporte : .${ext}` });

  const tmpPath = path.join(os.tmpdir(), `findoc_${Date.now()}.${ext}`);
  fs.writeFileSync(tmpPath, req.file.buffer);

  const envPath = BACKEND_ENV_PATH;
  const apiKey = readEnvValue("ANTHROPIC_API_KEY");

  const script = `
import sys, os, json
sys.path.insert(0, ${JSON.stringify(path.join(__dirname, "..", "backend"))})
os.environ["ANTHROPIC_API_KEY"] = ${JSON.stringify(apiKey)}
from dotenv import load_dotenv
load_dotenv(${JSON.stringify(envPath)})
from services.extract_societe import extract_societe
with open(${JSON.stringify(tmpPath)}, "rb") as fh:
    data = fh.read()
result = extract_societe(data, ${JSON.stringify(req.file.originalname)})
print(json.dumps(result))
`;
  try {
    const out = execFileSync(PYTHON, ["-c", script], { timeout: 30000, encoding: "utf8" });
    fs.unlinkSync(tmpPath);
    res.json(JSON.parse(out.trim().split("\n").pop()));
  } catch (error) {
    try { fs.unlinkSync(tmpPath); } catch {}
    const msg = (error.stderr || error.message || "").slice(0, 300);
    res.status(500).json({ detail: `Erreur extraction : ${msg}` });
  }
});

app.post("/chat/answer", async (req, res) => {
  const email = requireAuth(req, res);
  if (!email) return;

  const dossierId = Number(req.body?.dossier_id);
  const message = String(req.body?.message || "").trim();
  const history = Array.isArray(req.body?.historique) ? req.body.historique : [];

  if (!dossierId) return res.status(400).json({ detail: "dossier_id requis" });
  if (!message) return res.status(400).json({ detail: "message requis" });

  const context = buildChatContext(dossierId);

  try {
    const result = await completeClaudeChat({ message, history, context });
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error("[chat answer error]", error?.message, error?.stack?.slice(0, 500));
    res.json({
      ok: true,
      fallback: true,
      answer: fallbackChatAnswer(message, context),
      detail: String(error?.message || "chat_unavailable"),
    });
  }
});

app.post("/chat", async (req, res) => {
  const email = requireAuth(req, res);
  if (!email) return;

  const dossierId = Number(req.body?.dossier_id);
  const message = String(req.body?.message || "").trim();
  const history = Array.isArray(req.body?.historique) ? req.body.historique : [];

  if (!dossierId) return res.status(400).json({ detail: "dossier_id requis" });
  if (!message) return res.status(400).json({ detail: "message requis" });

  const context = buildChatContext(dossierId);

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  if (typeof res.flushHeaders === "function") res.flushHeaders();

  writeSse(res, "ready", { ok: true });

  try {
    await streamClaudeChat({ message, history, context, res });
  } catch (error) {
    console.error("[chat error]", error?.message, error?.stack?.slice(0, 500));
    const answer = fallbackChatAnswer(message, context);
    answer.split(" ").forEach((token) => writeSse(res, "chunk", { text: `${token} ` }));
    writeSse(res, "done", {
      ok: true,
      fallback: true,
      detail: String(error?.message || "openai_unavailable"),
    });
  } finally {
    res.end();
  }
});

app.get("/chat/team/:dossier_id", (req, res) => {
  const email = requireAuth(req, res);
  if (!email) return;

  const rows = sqlQuery(
    "SELECT id, dossier_id, user_id, content, created_at FROM team_messages WHERE dossier_id = ? ORDER BY created_at ASC, id ASC",
    [req.params.dossier_id]
  ) || [];

  res.json(
    rows.map((row) => {
      const author = getUserById(row.user_id) || getUserByEmail(email);
      return {
        ...row,
        user_name: author?.nom || author?.email || email,
        user_email: author?.email || email,
      };
    })
  );
});

app.get("/chat/private/:dossier_id/contacts", (req, res) => {
  const email = requireAuth(req, res);
  if (!email) return;

  const me = getUserByEmail(email);
  if (!me?.id) return res.json([]);

  const knownUsers = listKnownUsers()
    .filter((user) => Number(user.id) !== Number(me.id))
    .map((contact) => {
      const row = (sqlQuery(
        `
        SELECT content, created_at
        FROM private_messages
        WHERE dossier_id = ?
          AND (
            (sender_id = ? AND recipient_id = ?)
            OR
            (sender_id = ? AND recipient_id = ?)
          )
        ORDER BY created_at DESC, id DESC
        LIMIT 1
        `,
        [req.params.dossier_id, me.id, contact.id, contact.id, me.id]
      ) || [])[0];
      return {
        id: contact.id,
        email: contact.email,
        nom: contact.nom || contact.email,
        last_message: row?.content || null,
        last_message_at: row?.created_at || null,
      };
    })
    .sort((a, b) => {
      if (!a.last_message_at && !b.last_message_at) return String(a.nom).localeCompare(String(b.nom));
      if (!a.last_message_at) return 1;
      if (!b.last_message_at) return -1;
      return String(b.last_message_at).localeCompare(String(a.last_message_at));
    });
  res.json(knownUsers);
});

app.get("/chat/private/:dossier_id/:other_user_id", (req, res) => {
  const email = requireAuth(req, res);
  if (!email) return;

  const me = getUserByEmail(email);
  if (!me?.id) return res.json([]);

  const rows = sqlQuery(
    `
    SELECT id, dossier_id, sender_id, recipient_id, content, created_at
    FROM private_messages
    WHERE dossier_id = ?
      AND (
        (sender_id = ? AND recipient_id = ?)
        OR
        (sender_id = ? AND recipient_id = ?)
      )
    ORDER BY created_at ASC, id ASC
    `,
    [req.params.dossier_id, me.id, req.params.other_user_id, req.params.other_user_id, me.id]
  ) || [];

  res.json(
    rows.map((row) => {
      const sender = getUserById(row.sender_id) || getUserByEmail(email);
      return {
        ...row,
        sender_name: sender?.nom || sender?.email || email,
        sender_email: sender?.email || email,
      };
    })
  );
});

app.post("/chat/team/:dossier_id", (req, res) => {
  const email = requireAuth(req, res);
  if (!email) return;

  const content = (req.body?.content || "").trim();
  if (!content) return res.status(400).json({ detail: "Message vide" });

  const user = (sqlQuery("SELECT id, email, nom FROM users WHERE email = ?", [email]) || [])[0];
  const fallbackUser = getUserByEmail(email);
  const insert = sqlRun(
    "INSERT INTO team_messages (dossier_id, user_id, content, created_at) VALUES (?, ?, ?, datetime('now'))",
    [req.params.dossier_id, user?.id || fallbackUser?.id || null, content]
  );

  if (!insert?.lastrowid) {
    return res.status(500).json({ detail: "Impossible d'envoyer le message" });
  }

  const row = (sqlQuery(
    "SELECT id, dossier_id, user_id, content, created_at FROM team_messages WHERE id = ?",
    [insert.lastrowid]
  ) || [])[0];

  const author = user || fallbackUser || getUserByEmail(email);
  res.json(row ? {
    ...row,
    user_name: author?.nom || author?.email || email,
    user_email: author?.email || email,
  } : {
    id: insert.lastrowid,
    dossier_id: Number(req.params.dossier_id),
    user_id: author?.id || null,
    user_name: author?.nom || author?.email || email,
    user_email: author?.email || email,
    content,
    created_at: new Date().toISOString(),
  });
});

app.post("/chat/private/:dossier_id/:other_user_id", (req, res) => {
  const email = requireAuth(req, res);
  if (!email) return;

  const content = (req.body?.content || "").trim();
  if (!content) return res.status(400).json({ detail: "Message vide" });

  const me = getUserByEmail(email);
  const otherUser = getUserById(req.params.other_user_id);

  if (!me?.id || !otherUser?.id) {
    return res.status(404).json({ detail: "Utilisateur introuvable" });
  }

  const insert = sqlRun(
    "INSERT INTO private_messages (dossier_id, sender_id, recipient_id, content, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
    [req.params.dossier_id, me.id, otherUser.id, content]
  );

  if (!insert?.lastrowid) {
    return res.status(500).json({ detail: "Impossible d'envoyer le message" });
  }

  const row = (sqlQuery(
    "SELECT id, dossier_id, sender_id, recipient_id, content, created_at FROM private_messages WHERE id = ?",
    [insert.lastrowid]
  ) || [])[0];

  res.json(row ? {
    ...row,
    sender_name: me.nom || me.email,
    sender_email: me.email,
  } : {
    id: insert.lastrowid,
    dossier_id: Number(req.params.dossier_id),
    sender_id: me.id,
    recipient_id: otherUser.id,
    sender_name: me.nom || me.email,
    sender_email: me.email,
    content,
    created_at: new Date().toISOString(),
  });
});

// ── Audit log ────────────────────────────────────────────────────────────────
function logAction(userEmail, action, ressource, ressourceId, details, ip) {
  try {
    const user = getUserByEmail(userEmail);
    sqlRun(
      "INSERT INTO audit_logs (user_id, user_email, action, ressource, ressource_id, details, ip, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))",
      [user?.id || null, userEmail, action, ressource || null, ressourceId || null, details || null, ip || null]
    );
  } catch {}
}

app.get("/admin/audit", (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  const limit = Math.min(500, parseInt(req.query.limit, 10) || 200);
  const rows = sqlQuery(
    "SELECT * FROM audit_logs ORDER BY created_at DESC, id DESC LIMIT ?",
    [limit]
  ) || [];
  res.json(rows);
});

// ── Relances ─────────────────────────────────────────────────────────────────
app.post("/relances/send", (req, res) => {
  const email = requireAuth(req, res);
  if (!email) return;

  const { facture_ids, destinataire_email, destinataire_nom, sujet, corps, niveau } = req.body || {};
  if (!facture_ids || !facture_ids.length) return res.status(400).json({ detail: "facture_ids requis" });

  const user = getUserByEmail(email);
  let count = 0;

  for (const facId of facture_ids) {
    sqlRun(
      "INSERT INTO relances (facture_id, niveau, destinataire_email, destinataire_nom, sujet, corps, envoye, envoye_at, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?, datetime('now'))",
      [facId, niveau || 1, destinataire_email || null, destinataire_nom || null, sujet || null, corps || null, user?.id || null]
    );
    count++;
  }

  logAction(email, "send_relance", "relance", null, `${count} relance(s) pour ${destinataire_email || "—"}`, req.headers["x-forwarded-for"] || req.socket?.remoteAddress);

  res.json({ envoye: false, count, message: `${count} relance(s) enregistree(s). Configurez SMTP pour l'envoi réel.` });
});

app.get("/relances/:dossier_id", (req, res) => {
  const email = requireAuth(req, res);
  if (!email) return;
  const factureIds = (sqlQuery("SELECT id FROM factures WHERE dossier_id=?", [req.params.dossier_id]) || []).map((r) => r.id);
  if (!factureIds.length) return res.json([]);
  const placeholders = factureIds.map(() => "?").join(",");
  const rows = sqlQuery(`SELECT * FROM relances WHERE facture_id IN (${placeholders}) ORDER BY created_at DESC`, factureIds) || [];
  res.json(rows);
});

// ── DGI TVA export ────────────────────────────────────────────────────────────
app.get("/factures/:dossier_id/export-dgi", (req, res) => {
  const email = requireAuth(req, res);
  if (!email) return;

  const dossierId = req.params.dossier_id;
  const mois = parseInt(req.query.mois, 10) || 0;
  const annee = parseInt(req.query.annee, 10) || 0;

  let factures = sqlQuery("SELECT * FROM factures WHERE dossier_id=?", [dossierId]) || [];

  if (mois && annee) {
    factures = factures.filter((f) => {
      if (!f.date_facture) return false;
      const d = new Date(String(f.date_facture).slice(0, 7));
      return d.getMonth() + 1 === mois && d.getFullYear() === annee;
    });
  } else if (annee) {
    factures = factures.filter((f) => f.date_facture && String(f.date_facture).startsWith(String(annee)));
  }

  const achats = factures.filter((f) => (f.type || "achat") === "achat");
  const ventes = factures.filter((f) => f.type === "vente");
  const tvaCollectee = ventes.reduce((s, f) => s + Number(f.tva || 0), 0);
  const tvaDeductible = achats.reduce((s, f) => s + Number(f.tva || 0), 0);
  const solde = Math.round((tvaCollectee - tvaDeductible) * 100) / 100;

  const now = new Date().toISOString().slice(0, 16).replace("T", " ");
  const periode = mois && annee ? `${String(mois).padStart(2, "0")}/${annee}` : String(annee || "Tous");

  const lines = [
    `=== DECLARATION TVA — Format DGI Maroc ===`,
    `Dossier ID;${dossierId}`,
    `Periode;${periode}`,
    `Genere le;${now}`,
    ``,
    `RUBRIQUE;BASE HT (MAD);TAUX TVA (%);TVA (MAD)`,
    ...ventes.map((f) => {
      const ht = Math.round(Number(f.montant_ht || 0) * 100) / 100;
      const tva = Math.round(Number(f.tva || 0) * 100) / 100;
      const taux = ht ? Math.round((tva / ht) * 10000) / 100 : 20;
      return `Vente - ${f.fournisseur || "Client"};${ht};${taux};${tva}`;
    }),
    ``,
    `TOTAL TVA COLLECTEE;;;${Math.round(tvaCollectee * 100) / 100}`,
    ``,
    ...achats.map((f) => {
      const ht = Math.round(Number(f.montant_ht || 0) * 100) / 100;
      const tva = Math.round(Number(f.tva || 0) * 100) / 100;
      const taux = ht ? Math.round((tva / ht) * 10000) / 100 : 20;
      return `Achat - ${f.fournisseur || "Fournisseur"};${ht};${taux};${tva}`;
    }),
    ``,
    `TOTAL TVA DEDUCTIBLE;;;${Math.round(tvaDeductible * 100) / 100}`,
    ``,
    `SOLDE TVA NET;;;${solde}`,
    `(+ = a reverser DGI  /  - = credit TVA);;;`,
  ];

  const csv = lines.join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=declaration_tva_${dossierId}.csv`);
  res.send("﻿" + csv);
});

app.get("/", (req, res) => res.json({ message: "FinDoc API is running", db: !!PYTHON && fs.existsSync(DB_PATH) }));
app.get("/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST || "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`INFO: FinDoc Node.js server -> http://${HOST}:${PORT}`);
  console.log(`INFO: SQLite via Python: ${PYTHON ? "OK" : "fallback in-memory"}`);
});
