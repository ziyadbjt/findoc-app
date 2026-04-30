import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Download, FileSpreadsheet, FileText, X } from "lucide-react";

import OverlayPortal from "./OverlayPortal";
import { useToast } from "../context/ToastContext";
import { formatDate, formatMAD } from "../utils/format";

const FORMAT_OPTIONS = [
  { key: "excel", label: "Excel", desc: "Classeur .xlsx pour partage et analyse." },
  { key: "sage", label: "SAGE 100", desc: "Fichier texte structure pour import comptable." },
  { key: "csv", label: "Autre (CSV)", desc: "Format tabulaire simple et universel." },
];

const JOURNAL_OPTIONS = [
  { key: "achats", label: "Achats" },
  { key: "ventes", label: "Ventes" },
  { key: "banque", label: "Banque" },
  { key: "tpe", label: "TPE" },
];

const MONTH_OPTIONS = [
  { key: "all", label: "Tous les mois" },
  { key: "01", label: "Janvier" },
  { key: "02", label: "Fevrier" },
  { key: "03", label: "Mars" },
  { key: "04", label: "Avril" },
  { key: "05", label: "Mai" },
  { key: "06", label: "Juin" },
  { key: "07", label: "Juillet" },
  { key: "08", label: "Aout" },
  { key: "09", label: "Septembre" },
  { key: "10", label: "Octobre" },
  { key: "11", label: "Novembre" },
  { key: "12", label: "Decembre" },
];

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}

function normalizeJournalValue(value) {
  return (value || "").toString().trim().toLowerCase();
}

function extractYear(dateValue) {
  const value = (dateValue || "").toString().trim();
  const match = value.match(/^(\d{4})-/);
  return match ? match[1] : null;
}

function extractMonth(dateValue) {
  const value = (dateValue || "").toString().trim();
  const match = value.match(/^\d{4}-(\d{2})-/);
  return match ? match[1] : null;
}

function getFactureDate(facture) {
  return facture?.date_facture || facture?.date_echeance || "";
}

function getEcritureDate(ecriture, facture) {
  return ecriture?.date || facture?.date_facture || facture?.date_echeance || "";
}

function matchesPeriod(dateValue, year, month) {
  const valueYear = extractYear(dateValue);
  const valueMonth = extractMonth(dateValue);
  if (year !== "all" && valueYear !== year) return false;
  if (month !== "all" && valueMonth !== month) return false;
  return true;
}

function getFacturesForJournal(factures, journal) {
  const list = factures || [];
  if (journal === "achats") return list.filter((facture) => (facture.type || "achat") === "achat");
  if (journal === "ventes") return list.filter((facture) => facture.type === "vente");
  if (journal === "banque") return list.filter((facture) => ["banque", "bank", "bq"].includes(normalizeJournalValue(facture.type)) || normalizeJournalValue(facture.journal) === "bq");
  if (journal === "tpe") return list.filter((facture) => ["tpe", "cmi"].includes(normalizeJournalValue(facture.type)) || normalizeJournalValue(facture.journal) === "tpe");
  return list;
}

function getEcrituresForJournal(ecritures, factures, journal) {
  const rows = ecritures || [];
  const factureIds = new Set(getFacturesForJournal(factures, journal).map((facture) => facture.id));

  return rows.filter((ecriture) => {
    const code = normalizeJournalValue(ecriture.journal);
    if (journal === "achats") return code === "ac" || factureIds.has(ecriture.facture_id);
    if (journal === "ventes") return code === "vt" || code === "ve" || factureIds.has(ecriture.facture_id);
    if (journal === "banque") return code === "bq";
    if (journal === "tpe") return code === "tpe";
    return true;
  });
}

function buildFactureRows(factures, journal, year, month) {
  return getFacturesForJournal(factures, journal)
    .filter((facture) => matchesPeriod(getFactureDate(facture), year, month))
    .map((facture) => ({
    Journal: JOURNAL_OPTIONS.find((option) => option.key === journal)?.label || journal,
    Type: facture.type || "achat",
    Date: facture.date_facture ? formatDate(facture.date_facture) : "",
    Echeance: facture.date_echeance ? formatDate(facture.date_echeance) : "",
    Reference: facture.num_facture || "",
    Tiers: facture.fournisseur || "",
    CodeTiers: facture.code_tiers || "",
    ComptePCM: facture.compte_pcm || "",
    Categorie: facture.categorie || "",
    HT: facture.montant_ht || 0,
    TVA: facture.tva || 0,
    TTC: facture.montant_ttc || 0,
    Statut: facture.statut || "",
    Paiement: facture.paiement || "",
  }));
}

function buildSageRows(ecritures, factures, journal, year, month) {
  const facturesById = new Map((factures || []).map((facture) => [facture.id, facture]));

  return getEcrituresForJournal(ecritures, factures, journal)
    .filter((ecriture) => {
      const facture = facturesById.get(ecriture.facture_id);
      return matchesPeriod(getEcritureDate(ecriture, facture), year, month);
    })
    .map((ecriture) => {
    const facture = facturesById.get(ecriture.facture_id);
    return {
      Journal: ecriture.journal || (journal === "achats" ? "AC" : journal === "ventes" ? "VE" : journal === "banque" ? "BQ" : "TPE"),
      Date: ecriture.date || facture?.date_facture || "",
      Piece: facture?.num_facture || "",
      Compte: ecriture.compte || ecriture.compte_pcm || "",
      Tiers: ecriture.tiers || facture?.fournisseur || "",
      Libelle: ecriture.libelle || "",
      Debit: ecriture.debit || 0,
      Credit: ecriture.credit || 0,
    };
  });
}

function getAvailableYears(factures, ecritures) {
  const years = new Set();
  (factures || []).forEach((facture) => {
    const year = extractYear(getFactureDate(facture));
    if (year) years.add(year);
  });
  const facturesById = new Map((factures || []).map((facture) => [facture.id, facture]));
  (ecritures || []).forEach((ecriture) => {
    const facture = facturesById.get(ecriture.facture_id);
    const year = extractYear(getEcritureDate(ecriture, facture));
    if (year) years.add(year);
  });
  return [...years].sort((a, b) => b.localeCompare(a));
}

function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value) => `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
  return [headers.join(";"), ...rows.map((row) => headers.map((header) => escape(row[header])).join(";"))].join("\n");
}

export default function ExportDialog({
  open,
  onClose,
  dossierId,
  factures,
  ecritures,
  tpeTransactions = [],
  defaultJournal = "achats",
}) {
  const toast = useToast();
  const [format, setFormat] = useState("excel");
  const [journal, setJournal] = useState(defaultJournal);
  const availableYears = useMemo(() => {
    const years = new Set(getAvailableYears(factures, ecritures));
    (tpeTransactions || []).forEach((row) => {
      const year = extractYear(row.date);
      if (year) years.add(year);
    });
    return [...years].sort((a, b) => b.localeCompare(a));
  }, [factures, ecritures, tpeTransactions]);
  const [year, setYear] = useState(availableYears[0] || "all");
  const [month, setMonth] = useState("all");

  useEffect(() => {
    if (open) {
      setJournal(defaultJournal);
      setFormat("excel");
      setYear(availableYears[0] || "all");
      setMonth("all");
    }
  }, [open, defaultJournal, availableYears]);

  const factureRows = useMemo(() => {
    if (journal !== "tpe") return buildFactureRows(factures, journal, year, month);
    return (tpeTransactions || [])
      .filter((row) => matchesPeriod(row.date, year, month))
      .map((row) => ({
        Journal: "TPE",
        Type: "tpe",
        Date: row.date ? formatDate(row.date) : "",
        Echeance: "",
        Reference: row.reference || "",
        Tiers: row.client || row.libelle || "Transaction TPE",
        CodeTiers: row.terminal || "",
        ComptePCM: row.compte_pcm || "511100",
        Categorie: row.canal || "TPE",
        HT: row.montant_ht || row.montant || 0,
        TVA: row.tva || 0,
        TTC: row.montant || 0,
        Statut: row.statut || "traite",
        Paiement: "payee",
      }));
  }, [factures, journal, year, month, tpeTransactions]);
  const sageRows = useMemo(() => {
    if (journal !== "tpe") return buildSageRows(ecritures, factures, journal, year, month);
    return (tpeTransactions || [])
      .filter((row) => matchesPeriod(row.date, year, month))
      .map((row) => ({
        Journal: "TPE",
        Date: row.date || "",
        Piece: row.reference || "",
        Compte: row.compte_pcm || "511100",
        Tiers: row.client || row.libelle || "Transaction TPE",
        Libelle: row.libelle || "Encaissement TPE",
        Debit: 0,
        Credit: row.montant || 0,
      }));
  }, [ecritures, factures, journal, year, month, tpeTransactions]);
  const rows = format === "sage" ? sageRows : factureRows;

  if (!open) return null;

  const handleExport = () => {
    if (!rows.length) {
      toast("Aucune donnée à exporter pour cette sélection", "neg");
      return;
    }

    const journalLabel = JOURNAL_OPTIONS.find((option) => option.key === journal)?.label.toLowerCase() || journal;
    const periodLabel = `${year === "all" ? "toutes-annees" : year}${month === "all" ? "" : `-${month}`}`;
    const baseName = `findoc_${journalLabel}_${periodLabel}_${dossierId || "demo"}`;

    if (format === "excel") {
      const sheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, JOURNAL_OPTIONS.find((option) => option.key === journal)?.label || "Export");
      XLSX.writeFile(workbook, `${baseName}.xlsx`);
      toast(`Export Excel généré pour le journal ${journalLabel}`, "pos");
      onClose?.();
      return;
    }

    if (format === "csv") {
      const csv = toCsv(rows);
      downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `${baseName}.csv`);
      toast(`Export CSV généré pour le journal ${journalLabel}`, "pos");
      onClose?.();
      return;
    }

    const lines = rows.map((row) => [
      row.Journal,
      row.Date,
      row.Piece,
      row.Compte,
      row.Tiers,
      row.Libelle,
      row.Debit ?? 0,
      row.Credit ?? 0,
    ].join(";"));
    const content = ["Journal;Date;Piece;Compte;Tiers;Libelle;Debit;Credit", ...lines].join("\n");
    downloadBlob(new Blob([content], { type: "text/plain;charset=utf-8;" }), `${baseName}_sage100.txt`);
    toast(`Export SAGE 100 généré pour le journal ${journalLabel}`, "pos");
    onClose?.();
  };

  return (
    <OverlayPortal onClose={onClose}>
      <div className="scrim" onClick={onClose} />
      <div className="modal">
        <div className="modal-head">
          <Download size={16} />
          <div style={{ fontWeight: 500, fontSize: 14 }}>Exporter les données</div>
          <button className="icon-btn" style={{ marginLeft: "auto" }} onClick={onClose}><X size={15} /></button>
        </div>
        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: "var(--ink-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Format
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
              {FORMAT_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setFormat(option.key)}
                  style={{
                    textAlign: "left",
                    padding: 14,
                    borderRadius: 12,
                    border: format === option.key ? "1px solid var(--accent)" : "1px solid var(--line-1)",
                    background: format === option.key ? "var(--accent-bg)" : "var(--bg-inset)",
                    color: "var(--ink-0)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontWeight: 600 }}>
                    {option.key === "excel" ? <FileSpreadsheet size={15} /> : <FileText size={15} />}
                    {option.label}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-2)", lineHeight: 1.5 }}>{option.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: "var(--ink-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Journal
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
              {JOURNAL_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setJournal(option.key)}
                  className={`chip${journal === option.key ? " active" : ""}`}
                  style={{ justifyContent: "center", padding: "12px 10px" }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: "var(--ink-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Annee
              </div>
              <select className="input" value={year} onChange={(event) => setYear(event.target.value)}>
                <option value="all">Toutes les annees</option>
                {availableYears.map((optionYear) => (
                  <option key={optionYear} value={optionYear}>{optionYear}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: "var(--ink-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Mois
              </div>
              <select className="input" value={month} onChange={(event) => setMonth(event.target.value)}>
                {MONTH_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ padding: "12px 14px", borderRadius: 12, background: "var(--bg-inset)", display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12 }}>
            <div>
              <div style={{ color: "var(--ink-2)", marginBottom: 4 }}>Aperçu de l'export</div>
              <div style={{ fontWeight: 600 }}>
                {rows.length} ligne{rows.length > 1 ? "s" : ""} · {FORMAT_OPTIONS.find((option) => option.key === format)?.label}
              </div>
              <div style={{ marginTop: 4, color: "var(--ink-2)" }}>
                {year === "all" ? "Toutes les annees" : year}
                {month === "all" ? " · Tous les mois" : ` · ${MONTH_OPTIONS.find((option) => option.key === month)?.label}`}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: "var(--ink-2)", marginBottom: 4 }}>Montant total</div>
              <div style={{ fontWeight: 600 }}>
                {format === "sage"
                  ? formatMAD(sageRows.reduce((sum, row) => sum + (row.Debit || 0) + (row.Credit || 0), 0)).split(",")[0]
                  : formatMAD(factureRows.reduce((sum, row) => sum + (row.TTC || 0), 0)).split(",")[0]} MAD
              </div>
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={handleExport}>
            <Download size={13} /> Exporter
          </button>
        </div>
      </div>
    </OverlayPortal>
  );
}
