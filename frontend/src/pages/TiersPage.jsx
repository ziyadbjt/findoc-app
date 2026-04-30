import { useMemo, useRef, useState } from "react";
import { Building2, Download, Search, Upload, User, Pencil, Check, X } from "lucide-react";

import { formatDate, formatMAD } from "../utils/format";
import { useCorrection } from "../hooks/useCorrection";

const escapeCsv = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

const parseNumber = (value) => {
  if (value == null || value === "") return 0;
  const cleaned = String(value).replace(/\u00A0/g, "").replace(/\s/g, "").replace(",", ".");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseCsv = (content) => {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
};

function EditableCodeTiers({ tier, dossierId }) {
  const correct = useCorrection(dossierId);
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(tier.code_tiers || "");

  const submit = async () => {
    if (!val.trim() || val === tier.code_tiers) { setEditing(false); return; }
    await correct({
      facture: { fournisseur: tier.nom, montant_ht: tier.total_ttc },
      champ: "code_tiers",
      original: tier.code_tiers || "",
      corrige: val.trim(),
    });
    setEditing(false);
  };

  if (editing) return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input autoFocus
        style={{ width: 120, fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--accent)", background: "var(--bg-0)", color: "var(--ink-0)", fontFamily: "var(--font-mono)" }}
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") setEditing(false); }}
      />
      <button className="icon-btn" onClick={submit}><Check size={12} /></button>
      <button className="icon-btn" onClick={() => setEditing(false)}><X size={12} /></button>
    </div>
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span className="mono" style={{ fontSize: 12, color: "var(--ink-2)" }}>{val || "Non renseigné"}</span>
      <button className="icon-btn" onClick={() => setEditing(true)} title="Corriger — FinAI apprend" style={{ opacity: 0.5 }}><Pencil size={11} /></button>
    </div>
  );
}

function TiersSection({ factures, tiersType, dossierId }) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);
  const fileInputRef = useRef(null);
  const storageKey = useMemo(() => `findoc:tiers:${dossierId}:${tiersType}`, [dossierId, tiersType]);
  const [importedTiers, setImportedTiers] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "[]");
    } catch {
      return [];
    }
  });

  const computedTiers = useMemo(() => {
    const map = new Map();

    factures
      .filter((facture) => {
        if (tiersType === "fournisseurs") return (facture.type || "achat") === "achat";
        return facture.type === "vente";
      })
      .forEach((facture) => {
        const key = facture.fournisseur || facture.client || "—";
        const previous = map.get(key) || {
          nom: key,
          code_tiers: facture.code_tiers || "",
          factures: [],
          total_ttc: 0,
          total_tva: 0,
          en_retard: 0,
          derniere_facture: null,
        };
        previous.factures.push(facture);
        previous.total_ttc += facture.montant_ttc || 0;
        previous.total_tva += facture.tva || 0;
        if (facture.paiement === "en_retard") previous.en_retard += facture.montant_ttc || 0;
        if (!previous.derniere_facture || facture.date_facture > previous.derniere_facture) {
          previous.derniere_facture = facture.date_facture;
        }
        map.set(key, previous);
      });

    if (map.size === 0 && tiersType === "fournisseurs") {
      factures.forEach((facture) => {
        const key = facture.fournisseur || "—";
        const previous = map.get(key) || {
          nom: key,
          code_tiers: facture.code_tiers || "",
          factures: [],
          total_ttc: 0,
          total_tva: 0,
          en_retard: 0,
          derniere_facture: null,
        };
        previous.factures.push(facture);
        previous.total_ttc += facture.montant_ttc || 0;
        previous.total_tva += facture.tva || 0;
        if (facture.paiement === "en_retard") previous.en_retard += facture.montant_ttc || 0;
        if (!previous.derniere_facture || facture.date_facture > previous.derniere_facture) {
          previous.derniere_facture = facture.date_facture;
        }
        map.set(key, previous);
      });
    }

    return [...map.values()].sort((a, b) => b.total_ttc - a.total_ttc);
  }, [factures, tiersType]);

  const tiers = useMemo(() => {
    const map = new Map();
    computedTiers.forEach((tier) => map.set(tier.nom, { ...tier, imported: false }));

    importedTiers.forEach((tier) => {
      const previous = map.get(tier.nom);
      if (previous) {
        map.set(tier.nom, {
          ...previous,
          code_tiers: tier.code_tiers || previous.code_tiers,
          imported: true,
        });
      } else {
        map.set(tier.nom, {
          nom: tier.nom,
          code_tiers: tier.code_tiers || "",
          factures: [],
          total_ttc: parseNumber(tier.total_ttc),
          total_tva: parseNumber(tier.total_tva),
          en_retard: parseNumber(tier.en_retard),
          derniere_facture: tier.derniere_facture || null,
          imported: true,
        });
      }
    });

    return [...map.values()].sort((a, b) => b.total_ttc - a.total_ttc);
  }, [computedTiers, importedTiers]);

  const filtered = tiers.filter((tier) =>
    !q.trim() ||
    tier.nom.toLowerCase().includes(q.toLowerCase()) ||
    tier.code_tiers.toLowerCase().includes(q.toLowerCase())
  );

  const persistImportedTiers = (rows) => {
    setImportedTiers(rows);
    localStorage.setItem(storageKey, JSON.stringify(rows));
  };

  const handleExport = async () => {
    const rows = tiers.map((tier) => ({
      type: tiersType,
      nom: tier.nom,
      code_tiers: tier.code_tiers || "",
      factures: tier.factures.length,
      total_ttc: tier.total_ttc ?? 0,
      total_tva: tier.total_tva ?? 0,
      en_retard: tier.en_retard ?? 0,
      derniere_facture: tier.derniere_facture || "",
    }));

    const headers = Object.keys(rows[0] || {
      type: "",
      nom: "",
      code_tiers: "",
      factures: "",
      total_ttc: "",
      total_tva: "",
      en_retard: "",
      derniere_facture: "",
    });

    const csvLines = [
      headers.join(","),
      ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(",")),
    ];
    const csvBlob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const csvUrl = URL.createObjectURL(csvBlob);
    const csvLink = document.createElement("a");
    csvLink.href = csvUrl;
    csvLink.download = `tiers_${tiersType}_${dossierId || "demo"}.csv`;
    csvLink.click();
    URL.revokeObjectURL(csvUrl);

    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, tiersType === "fournisseurs" ? "Fournisseurs" : "Clients");
    XLSX.writeFile(workbook, `tiers_${tiersType}_${dossierId || "demo"}.xlsx`);
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      let rows = [];

      if (file.name.toLowerCase().endsWith(".json")) {
        const parsed = JSON.parse(text);
        rows = Array.isArray(parsed) ? parsed : [];
      } else if (file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls")) {
        const XLSX = await import("xlsx");
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      } else {
        const [headers = [], ...dataRows] = parseCsv(text);
        rows = dataRows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
      }

      const normalized = rows
        .filter((row) => !row.type || row.type === tiersType)
        .map((row) => ({
          nom: row.nom || row.fournisseur || row.client || "",
          code_tiers: row.code_tiers || "",
          total_ttc: parseNumber(row.total_ttc),
          total_tva: parseNumber(row.total_tva),
          en_retard: parseNumber(row.en_retard),
          derniere_facture: row.derniere_facture || null,
        }))
        .filter((row) => row.nom);

      persistImportedTiers(normalized);
      setSelected(null);
    } finally {
      event.target.value = "";
    }
  };

  const Icon = tiersType === "fournisseurs" ? Building2 : User;
  const totalTTC = tiers.reduce((sum, tier) => sum + tier.total_ttc, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, fontSize: 12, color: "var(--ink-2)" }}>
          {tiers.length} tiers · {formatMAD(totalTTC).split(",")[0]} MAD TTC cumulé
        </div>
        <input ref={fileInputRef} type="file" accept=".csv,.json,.xls,.xlsx" style={{ display: "none" }} onChange={handleImport} />
        <button className="btn" onClick={() => fileInputRef.current?.click()}><Upload size={13} /> Importer</button>
        <button className="btn btn-primary" onClick={handleExport}><Download size={13} /> Exporter</button>
      </div>

      <div className="filter-bar">
        <div className="filter-search">
          <Search size={14} />
          <input
            placeholder={`Chercher un ${tiersType === "fournisseurs" ? "fournisseur" : "client"}…`}
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 360px" : "1fr", gap: 12 }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="table">
            <thead>
              <tr>
                <th className="th">{tiersType === "fournisseurs" ? "Fournisseur" : "Client"}</th>
                <th className="th">Code tiers</th>
                <th className="th right">Factures</th>
                <th className="th right">Total TTC</th>
                <th className="th right">TVA</th>
                <th className="th right">Retards</th>
                <th className="th">Dernière facture</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--ink-3)", fontSize: 13 }}>
                    Aucun {tiersType === "fournisseurs" ? "fournisseur" : "client"} trouvé
                  </td>
                </tr>
              )}
              {filtered.map((tier) => (
                <tr
                  key={tier.nom}
                  className="tr-hover"
                  style={{ cursor: "pointer", background: selected?.nom === tier.nom ? "var(--accent-bg)" : undefined }}
                  onClick={() => setSelected((current) => (current?.nom === tier.nom ? null : tier))}
                >
                  <td className="td" style={{ fontWeight: 500 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: "var(--bg-2)", display: "grid", placeItems: "center" }}>
                        <Icon size={13} style={{ color: "var(--ink-2)" }} />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span>{tier.nom}</span>
                        {tier.imported && <span className="badge neutral">import</span>}
                      </div>
                    </div>
                  </td>
                  <td className="td mono" style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{tier.code_tiers || "—"}</td>
                  <td className="td right tabular">{tier.factures.length}</td>
                  <td className="td right tabular" style={{ fontWeight: 500 }}>{formatMAD(tier.total_ttc).split(",")[0]}</td>
                  <td className="td right tabular" style={{ color: "var(--ink-2)" }}>{formatMAD(tier.total_tva).split(",")[0]}</td>
                  <td className="td right tabular" style={{ color: tier.en_retard > 0 ? "var(--neg-ink)" : "var(--ink-3)" }}>
                    {tier.en_retard > 0 ? formatMAD(tier.en_retard).split(",")[0] : "—"}
                  </td>
                  <td className="td" style={{ color: "var(--ink-2)" }}>{formatDate(tier.derniere_facture)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected && (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "15px 18px", borderBottom: "1px solid var(--line-1)" }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{selected.nom}</div>
              <EditableCodeTiers tier={selected} dossierId={dossierId} />
            </div>
            <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--line-1)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { label: "Total TTC", val: `${formatMAD(selected.total_ttc).split(",")[0]} MAD` },
                { label: "TVA récupérable", val: `${formatMAD(selected.total_tva).split(",")[0]} MAD` },
                { label: "Factures", val: selected.factures.length },
                { label: "En retard", val: selected.en_retard > 0 ? `${formatMAD(selected.en_retard).split(",")[0]} MAD` : "—" },
              ].map(({ label, val }) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{val}</div>
                </div>
              ))}
            </div>
            <div style={{ overflowY: "auto", maxHeight: 360 }}>
              <div style={{ padding: "10px 18px", fontSize: 12, fontWeight: 500, color: "var(--ink-2)" }}>Historique</div>
              {selected.factures
                .sort((a, b) => (b.date_facture || "").localeCompare(a.date_facture || ""))
                .map((facture) => (
                  <div key={facture.id} style={{ padding: "10px 18px", borderBottom: "1px solid var(--line-1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 1 }}>{facture.num_facture || facture.nom_fichier}</div>
                      <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{formatDate(facture.date_facture)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="mono tabular" style={{ fontSize: 13, fontWeight: 500 }}>{formatMAD(facture.montant_ttc).split(",")[0]}</div>
                      <div style={{ fontSize: 11, color: facture.paiement === "en_retard" ? "var(--neg-ink)" : "var(--ink-3)" }}>{facture.paiement || "en attente"}</div>
                    </div>
                  </div>
                ))}
              {selected.factures.length === 0 && (
                <div style={{ padding: "16px 18px", color: "var(--ink-3)", fontSize: 12.5 }}>
                  Tier importé sans historique de facture pour le moment.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TiersPage({ factures, dossierId }) {
  const [tab, setTab] = useState("fournisseurs");
  const totalFourn = factures.filter(f => (f.type || "achat") === "achat").length;
  const totalClients = factures.filter(f => f.type === "vente").length;

  return (
    <div className="page-inner">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tiers</h1>
          <p className="page-subtitle">Fournisseurs et clients du dossier</p>
        </div>
      </div>

      <div className="filter-chips" style={{ marginBottom: 8 }}>
        <button className={`chip${tab === "fournisseurs" ? " active" : ""}`} onClick={() => setTab("fournisseurs")}>
          <Building2 size={12} style={{ marginRight: 4 }} />
          Fournisseurs
          {totalFourn > 0 && <span style={{ marginLeft: 6, background: "var(--bg-2)", borderRadius: 999, padding: "1px 6px", fontSize: 11 }}>{totalFourn}</span>}
        </button>
        <button className={`chip${tab === "clients" ? " active" : ""}`} onClick={() => setTab("clients")}>
          <User size={12} style={{ marginRight: 4 }} />
          Clients
          {totalClients > 0 && <span style={{ marginLeft: 6, background: "var(--bg-2)", borderRadius: 999, padding: "1px 6px", fontSize: 11 }}>{totalClients}</span>}
        </button>
      </div>

      <TiersSection factures={factures} tiersType={tab} dossierId={dossierId} />
    </div>
  );
}
