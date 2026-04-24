const express = require("express");
const bcrypt = require("bcrypt");
const cors = require("cors");
const multer = require("multer");
const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());

const DB_PATH = path.join(__dirname, "..", "backend", "findoc.db");
const BACKEND_ENV_PATH = path.join(__dirname, "..", "backend", ".env");
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
cur = conn.execute(${JSON.stringify(sql)}, ${JSON.stringify(params)})
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
cur = conn.execute(${JSON.stringify(sql)}, ${JSON.stringify(params)})
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
  hashed_password TEXT,
  nom TEXT,
  role TEXT DEFAULT 'collab',
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
""")
columns = {row[1] for row in conn.execute("PRAGMA table_info(users)").fetchall()}
if "status" not in columns:
    conn.execute("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'")
if "created_at" not in columns:
    conn.execute("ALTER TABLE users ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP")
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

async function streamOpenAIChat({ message, history, context, res }) {
  const apiKey = readEnvValue("OPENAI_API_KEY");
  if (!apiKey) {
    const answer = fallbackChatAnswer(message, context);
    answer.split(" ").forEach((token) => writeSse(res, "chunk", { text: `${token} ` }));
    writeSse(res, "done", { ok: true, fallback: true });
    return;
  }

  const systemPrompt = [
    "Tu es FinDoc, copilote comptable marocain.",
    "Reponds en francais, de maniere concise, claire et operationnelle.",
    "Base-toi sur le plan comptable marocain, la Loi 69-21 sur les delais de paiement, et les donnees du dossier.",
    "Quand une information manque, dis-le clairement sans l'inventer.",
    "",
    buildChatContextSummary(context),
  ].join("\n");

  const input = [
    { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
    ...(Array.isArray(history) ? history.slice(-8) : []).map((item) => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: [{ type: "input_text", text: String(item.content || "") }],
    })),
    { role: "user", content: [{ type: "input_text", text: String(message || "") }] },
  ];

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`OpenAI error ${response.status}`);
  }

  const decoder = new TextDecoder();
  let buffer = "";

  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const eventBlock of events) {
      const lines = eventBlock.split("\n").filter(Boolean);
      const dataLines = lines.filter((line) => line.startsWith("data: ")).map((line) => line.slice(6));
      for (const rawData of dataLines) {
        if (rawData === "[DONE]") continue;
        let payload;
        try {
          payload = JSON.parse(rawData);
        } catch {
          continue;
        }
        if (payload.type === "response.output_text.delta" && payload.delta) {
          writeSse(res, "chunk", { text: payload.delta });
        }
      }
    }
  }

  writeSse(res, "done", { ok: true });
}

const tokens = {};
let nextId = 100;
const memDossiers = [];

const ROLES = ["admin", "collab", "invite"];
const USERS = {
  "ziyad@cabinetchami.ma": { id: 1, email: "ziyad@cabinetchami.ma", nom: "Ziyad", role: "admin", status: "active" },
  "sarah@cabinetchami.ma": { id: 2, email: "sarah@cabinetchami.ma", nom: "Sarah", role: "collab", status: "active" },
  "youssef@cabinetchami.ma": { id: 3, email: "youssef@cabinetchami.ma", nom: "Youssef", role: "invite", status: "active" },
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
      "INSERT INTO users (email, hashed_password, nom, role, status, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      [user.email, bcrypt.hashSync("password123", 10), user.nom, normalizeRole(user.role), user.status || "active"]
    );
  });
}

seedDefaultUsers();

function getUserByEmail(email) {
  const rows = sqlQuery("SELECT id, email, nom, role, status, created_at FROM users WHERE email = ?", [email]);
  if (rows && rows.length > 0) return { ...rows[0], role: normalizeRole(rows[0].role) };
  return USERS[email] || null;
}

function getUserById(id) {
  const rows = sqlQuery("SELECT id, email, nom, role, status, created_at FROM users WHERE id = ?", [id]);
  if (rows && rows.length > 0) return { ...rows[0], role: normalizeRole(rows[0].role) };
  return Object.values(USERS).find((user) => Number(user.id) === Number(id)) || null;
}

function listKnownUsers() {
  const rows = sqlQuery("SELECT id, email, nom, role, status, created_at FROM users ORDER BY nom ASC, email ASC");
  if (rows && rows.length > 0) return rows.map((row) => ({ ...row, role: normalizeRole(row.role) }));
  return Object.values(USERS);
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
  const email = tokens[authHeader.substring(7)];
  if (!email) {
    res.status(401).json({ detail: "Token invalide" });
    return null;
  }
  return email;
}

app.post("/auth/login", express.urlencoded({ extended: true }), (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(401).json({ detail: "Email ou mot de passe incorrect" });

  const rows = sqlQuery("SELECT email, nom, role, status, hashed_password FROM users WHERE email = ?", [username]);
  if (rows && rows.length > 0) {
    const user = rows[0];
    if (user.status === "disabled") {
      return res.status(403).json({ detail: "Compte desactive" });
    }
    const hash = user.hashed_password || "";
    const isBcryptHash = typeof hash === "string" && hash.startsWith("$2");
    const passwordOk = isBcryptHash ? bcrypt.compareSync(password, hash) : hash === password;
    if (!passwordOk) return res.status(401).json({ detail: "Email ou mot de passe incorrect" });
    const tok = "tok_" + Math.random().toString(36).slice(2, 14);
    tokens[tok] = username;
    return res.json({ access_token: tok, token_type: "bearer" });
  }

  if (!USERS[username] || password !== "password123") {
    return res.status(401).json({ detail: "Email ou mot de passe incorrect" });
  }
  const tok = "tok_" + Math.random().toString(36).slice(2, 14);
  tokens[tok] = username;
  return res.json({ access_token: tok, token_type: "bearer" });
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

app.get("/factures/:dossier_id", (req, res) => {
  const email = requireAuth(req, res);
  if (!email) return;
  const rows = sqlQuery("SELECT * FROM factures WHERE dossier_id=? ORDER BY date_facture DESC", [req.params.dossier_id]);
  res.json(rows || []);
});

app.get("/factures/:dossier_id/ecritures", (req, res) => {
  const email = requireAuth(req, res);
  if (!email) return;
  const factureIds = (sqlQuery("SELECT id FROM factures WHERE dossier_id=?", [req.params.dossier_id]) || []).map((row) => row.id);
  if (!factureIds.length) return res.json([]);
  const placeholders = factureIds.map(() => "?").join(",");
  const rows = sqlQuery(`SELECT * FROM ecritures WHERE facture_id IN (${placeholders}) ORDER BY id`, factureIds);
  res.json(rows || []);
});

app.post("/factures/:dossier_id/upload", upload.array("files"), (req, res) => {
  const email = requireAuth(req, res);
  if (!email) return;
  res.json({ total: 0, resultats: [], message: "Utilisez le backend Python pour l'extraction PDF." });
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
    await streamOpenAIChat({ message, history, context, res });
  } catch (error) {
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

app.get("/", (req, res) => res.json({ message: "FinDoc API is running", db: !!PYTHON && fs.existsSync(DB_PATH) }));

const PORT = 8000;
app.listen(PORT, "127.0.0.1", () => {
  console.log(`INFO: FinDoc Node.js server -> http://127.0.0.1:${PORT}`);
  console.log(`INFO: SQLite via Python: ${PYTHON ? "OK" : "fallback in-memory"}`);
});
