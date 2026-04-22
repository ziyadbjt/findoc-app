const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const DB_PATH = path.join(__dirname, "..", "backend", "findoc.db");
const DOSSIER_ID = 2;
const PURCHASE_TOTAL = Number.parseInt(process.argv[2] || "100", 10);
const SALES_TOTAL = Number.parseInt(process.argv[3] || process.argv[2] || "100", 10);

const PURCHASE_PROFILES = [
  { label: "Industries", category: "Matieres premieres", account: "6111000", vat: 20 },
  { label: "Logistique", category: "Transport", account: "6142000", vat: 20 },
  { label: "Digital", category: "Services informatiques", account: "6135000", vat: 20 },
  { label: "Energie", category: "Electricite", account: "6164000", vat: 14 },
  { label: "Maintenance", category: "Maintenance industrielle", account: "6156000", vat: 20 },
  { label: "Packaging", category: "Consommables", account: "6125000", vat: 20 },
  { label: "Conseil", category: "Honoraires", account: "6131000", vat: 20 },
  { label: "Location", category: "Location materiel", account: "6132000", vat: 20 },
];

const SALES_PROFILES = [
  { label: "Distribution", category: "Vente produits finis", account: "7111000", vat: 20 },
  { label: "Construction", category: "Maintenance usine", account: "7061000", vat: 20 },
  { label: "Mining", category: "Prestation assemblage", account: "7061000", vat: 20 },
  { label: "Retail", category: "Vente pieces", account: "7111000", vat: 20 },
  { label: "Export", category: "Vente equipements", account: "7121000", vat: 20 },
  { label: "Services", category: "Prestation technique", account: "7061000", vat: 20 },
];

function pad(number, size = 3) {
  return String(number).padStart(size, "0");
}

function isoDate(month, day) {
  return `2026-${pad(month, 2)}-${pad(day, 2)}`;
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function paymentStatus(index, type) {
  if (type === "achat") {
    if (index % 5 === 0) return "en_retard";
    if (index % 2 === 0) return "payee";
    return "en_attente";
  }
  if (index % 6 === 0) return "en_retard";
  if (index % 2 === 0) return "payee";
  return "en_attente";
}

function confidence(index) {
  return Number((0.91 + (index % 8) * 0.01).toFixed(2));
}

function purchaseHt(index) {
  return 4500 + index * 375 + (index % 4) * 420;
}

function salesHt(index) {
  return 18000 + index * 890 + (index % 5) * 730;
}

function purchaseRow(index) {
  const profile = PURCHASE_PROFILES[(index - 1) % PURCHASE_PROFILES.length];
  const foreign = index % 4 === 0;
  const prefix = foreign ? "FE" : "FL";
  const supplier = `${profile.label.toUpperCase()} FOURNISSEUR ${pad(index)}`;
  const code = `${prefix}${profile.label.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6)}${pad(index)}`;
  const dateFacture = isoDate(((index - 1) % 4) + 1, ((index * 3) % 26) + 1);
  return {
    nom_fichier: `ACH-${pad(index)}.pdf`,
    fournisseur: supplier,
    code_tiers: code,
    montant_ht: purchaseHt(index),
    tva_pct: profile.vat,
    date_facture: dateFacture,
    date_echeance: addDays(dateFacture, 30),
    paiement: paymentStatus(index, "achat"),
    confidence: confidence(index),
    categorie: profile.category,
    num_facture: `ACH-2026-${pad(index, 4)}`,
    compte_pcm: profile.account,
    type: "achat",
  };
}

function salesRow(index) {
  const profile = SALES_PROFILES[(index - 1) % SALES_PROFILES.length];
  const client = `${profile.label.toUpperCase()} CLIENT ${pad(index)}`;
  const code = `CL${profile.label.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6)}${pad(index)}`;
  const dateFacture = isoDate(((index + 1) % 4) + 1, ((index * 2) % 26) + 1);
  return {
    nom_fichier: `VTE-${pad(index)}.pdf`,
    fournisseur: client,
    code_tiers: code,
    montant_ht: salesHt(index),
    tva_pct: profile.vat,
    date_facture: dateFacture,
    date_echeance: addDays(dateFacture, 35),
    paiement: paymentStatus(index, "vente"),
    confidence: confidence(index + 3),
    categorie: profile.category,
    num_facture: `VTE-2026-${pad(index, 4)}`,
    compte_pcm: profile.account,
    type: "vente",
  };
}

function ensureFactureColumns(db) {
  const columns = db.prepare("PRAGMA table_info(factures)").all().map((row) => row.name);
  const required = [
    ["type", "TEXT DEFAULT 'achat'"],
    ["paiement", "TEXT DEFAULT 'en_attente'"],
    ["num_facture", "TEXT"],
    ["date_echeance", "TEXT"],
    ["confidence", "REAL DEFAULT 0.95"],
    ["categorie", "TEXT"],
    ["compte_pcm", "TEXT"],
  ];

  for (const [name, definition] of required) {
    if (!columns.includes(name)) {
      db.exec(`ALTER TABLE factures ADD COLUMN ${name} ${definition}`);
      console.log(`+ factures.${name}`);
    }
  }
}

function seed() {
  if (!Number.isInteger(PURCHASE_TOTAL) || PURCHASE_TOTAL <= 0) {
    throw new Error(`Nombre de fournisseurs invalide: ${PURCHASE_TOTAL}`);
  }
  if (!Number.isInteger(SALES_TOTAL) || SALES_TOTAL <= 0) {
    throw new Error(`Nombre de clients invalide: ${SALES_TOTAL}`);
  }

  const db = new DatabaseSync(DB_PATH);
  ensureFactureColumns(db);

  const dossier = db.prepare("SELECT id, raison_sociale FROM dossiers WHERE id = ?").get(DOSSIER_ID);
  if (!dossier) {
    throw new Error(`Dossier ${DOSSIER_ID} introuvable dans ${DB_PATH}`);
  }

  const existingIds = db.prepare("SELECT id FROM factures WHERE dossier_id = ?").all(DOSSIER_ID).map((row) => row.id);
  if (existingIds.length) {
    const placeholders = existingIds.map(() => "?").join(",");
    db.prepare(`DELETE FROM ecritures WHERE facture_id IN (${placeholders})`).run(...existingIds);
    db.prepare("DELETE FROM factures WHERE dossier_id = ?").run(DOSSIER_ID);
    console.log(`Cleared ${existingIds.length} old factures`);
  }

  const insertFacture = db.prepare(`
    INSERT INTO factures
      (dossier_id, nom_fichier, fournisseur, code_tiers, montant_ht, tva, montant_ttc,
       date_facture, statut, created_at, type, paiement, num_facture, date_echeance,
       confidence, categorie, compte_pcm)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertEcriture = db.prepare(`
    INSERT INTO ecritures (facture_id, compte_pcm, libelle, debit, credit, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  const factures = [
    ...Array.from({ length: PURCHASE_TOTAL }, (_, index) => purchaseRow(index + 1)),
    ...Array.from({ length: SALES_TOTAL }, (_, index) => salesRow(index + 1)),
  ];

  const inserted = [];

  try {
    db.exec("BEGIN");

    for (const row of factures) {
      const tva = Number((row.montant_ht * row.tva_pct / 100).toFixed(2));
      const montantTtc = Number((row.montant_ht + tva).toFixed(2));
      const result = insertFacture.run(
        DOSSIER_ID,
        row.nom_fichier,
        row.fournisseur,
        row.code_tiers,
        row.montant_ht,
        tva,
        montantTtc,
        row.date_facture,
        "traite",
        now,
        row.type,
        row.paiement,
        row.num_facture,
        row.date_echeance,
        row.confidence,
        row.categorie,
        row.compte_pcm,
      );

      inserted.push({
        id: Number(result.lastInsertRowid),
        fournisseur: row.fournisseur,
        code_tiers: row.code_tiers,
        montant_ht: row.montant_ht,
        tva,
        montant_ttc: montantTtc,
        type: row.type,
        compte_pcm: row.compte_pcm,
      });
    }

    for (const row of inserted) {
      if (row.type === "achat") {
        insertEcriture.run(row.id, row.compte_pcm || "6111000", row.fournisseur, row.montant_ht, 0, now);
        if (row.tva > 0) {
          insertEcriture.run(row.id, "344100", `TVA ded. - ${row.fournisseur}`, row.tva, 0, now);
        }
        if (row.code_tiers.startsWith("FE")) {
          const ras = Number((row.montant_ht * 0.1).toFixed(2));
          insertEcriture.run(row.id, "4455", `RAS DGI 10% - ${row.fournisseur}`, 0, ras, now);
          insertEcriture.run(row.id, "401100", row.fournisseur, 0, Number((row.montant_ttc - ras).toFixed(2)), now);
        } else {
          insertEcriture.run(row.id, "401100", row.fournisseur, 0, row.montant_ttc, now);
        }
      } else {
        insertEcriture.run(row.id, "342100", row.fournisseur, row.montant_ttc, 0, now);
        if (row.tva > 0) {
          insertEcriture.run(row.id, "342200", `TVA coll. - ${row.fournisseur}`, 0, row.tva, now);
        }
        insertEcriture.run(row.id, row.compte_pcm || "7111000", `Vente - ${row.fournisseur}`, 0, row.montant_ht, now);
      }
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    db.close();
    throw error;
  }

  const stats = {
    factures: db.prepare("SELECT COUNT(*) AS total FROM factures WHERE dossier_id = ?").get(DOSSIER_ID).total,
    fournisseurs: db.prepare("SELECT COUNT(DISTINCT fournisseur) AS total FROM factures WHERE dossier_id = ? AND type = 'achat'").get(DOSSIER_ID).total,
    clients: db.prepare("SELECT COUNT(DISTINCT fournisseur) AS total FROM factures WHERE dossier_id = ? AND type = 'vente'").get(DOSSIER_ID).total,
    ecritures: db.prepare(`
      SELECT COUNT(*) AS total
      FROM ecritures
      WHERE facture_id IN (SELECT id FROM factures WHERE dossier_id = ?)
    `).get(DOSSIER_ID).total,
  };

  console.log(`Dossier: ${dossier.raison_sociale} (#${dossier.id})`);
  console.log(`Factures: ${stats.factures}`);
  console.log(`Fournisseurs distincts: ${stats.fournisseurs}`);
  console.log(`Clients distincts: ${stats.clients}`);
  console.log(`Ecritures: ${stats.ecritures}`);
  console.log(`OK - seed ${PURCHASE_TOTAL} fournisseurs / ${SALES_TOTAL} clients termine.`);

  db.close();
}

seed();
