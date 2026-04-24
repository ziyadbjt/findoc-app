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
const PYTHON = (() => {
  for (const candidate of ["C:/Python314/python.exe", "python3", "python"]) {
    try {
      execFileSync(candidate, ["--version"], { timeout: 2000 });
      return candidate;
    } catch {}
  }
  return null;
})();

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
CREATE TABLE IF NOT EXISTS team_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dossier_id INTEGER NOT NULL,
  user_id INTEGER,
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

const tokens = {};
let nextId = 100;
const memDossiers = [];

const USERS = { "ziyad@cabinetchami.ma": { email: "ziyad@cabinetchami.ma", nom: "Ziyad", role: "admin" } };

ensureSchema();

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

  const rows = sqlQuery("SELECT email, nom, role, hashed_password FROM users WHERE email = ?", [username]);
  if (rows && rows.length > 0) {
    const user = rows[0];
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
  const rows = sqlQuery("SELECT email, nom, role FROM users WHERE email = ?", [email]);
  if (rows && rows.length > 0) return res.json(rows[0]);
  return res.json(USERS[email] || { email, nom: email, role: "user" });
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

  const envPath = path.join(__dirname, "..", "backend", ".env");
  const apiKey = fs.existsSync(envPath)
    ? (fs.readFileSync(envPath, "utf8").match(/ANTHROPIC_API_KEY=(.+)/)?.[1]?.trim() || "")
    : "";

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

app.get("/chat/team/:dossier_id", (req, res) => {
  const email = requireAuth(req, res);
  if (!email) return;

  const rows = sqlQuery(
    `
    SELECT
      tm.id,
      tm.dossier_id,
      tm.user_id,
      tm.content,
      tm.created_at,
      COALESCE(u.nom, u.email, ?) AS user_name,
      COALESCE(u.email, ?) AS user_email
    FROM team_messages tm
    LEFT JOIN users u ON u.id = tm.user_id
    WHERE tm.dossier_id = ?
    ORDER BY tm.created_at ASC, tm.id ASC
    `,
    [email, email, req.params.dossier_id]
  );

  res.json(rows || []);
});

app.post("/chat/team/:dossier_id", (req, res) => {
  const email = requireAuth(req, res);
  if (!email) return;

  const content = (req.body?.content || "").trim();
  if (!content) return res.status(400).json({ detail: "Message vide" });

  const user = (sqlQuery("SELECT id, email, nom FROM users WHERE email = ?", [email]) || [])[0];
  const insert = sqlRun(
    "INSERT INTO team_messages (dossier_id, user_id, content, created_at) VALUES (?, ?, ?, datetime('now'))",
    [req.params.dossier_id, user?.id || null, content]
  );

  if (!insert?.lastrowid) {
    return res.status(500).json({ detail: "Impossible d'envoyer le message" });
  }

  const row = (sqlQuery(
    `
    SELECT
      tm.id,
      tm.dossier_id,
      tm.user_id,
      tm.content,
      tm.created_at,
      COALESCE(u.nom, u.email, ?) AS user_name,
      COALESCE(u.email, ?) AS user_email
    FROM team_messages tm
    LEFT JOIN users u ON u.id = tm.user_id
    WHERE tm.id = ?
    `,
    [email, email, insert.lastrowid]
  ) || [])[0];

  res.json(row || {
    id: insert.lastrowid,
    dossier_id: Number(req.params.dossier_id),
    user_id: user?.id || null,
    user_name: user?.nom || user?.email || email,
    user_email: user?.email || email,
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
