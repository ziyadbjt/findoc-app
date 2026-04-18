import { useState, useMemo } from "react";
import { Download, Search, Filter } from "lucide-react";
import { formatMAD, formatDate } from "../utils/format";
import { exportJournal } from "../api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

const JOURNALS = ["Tous", "AC", "BQ", "OD"];

export default function JournalPage({ ecritures, dossierId }) {
  const { token } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [journalFilter, setJournalFilter] = useState("Tous");
  const [sortCol, setSortCol] = useState("date");
  const [sortDir, setSortDir] = useState("desc");

  const filtered = useMemo(() => {
    return (ecritures || [])
      .filter(e => {
        if (journalFilter !== "Tous" && e.journal !== journalFilter) return false;
        if (q.trim()) {
          const qq = q.toLowerCase();
          if (!(e.libelle || "").toLowerCase().includes(qq) &&
              !(e.compte || "").includes(qq) &&
              !(e.tiers || "").toLowerCase().includes(qq)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let va = a[sortCol], vb = b[sortCol];
        if (va < vb) return sortDir === "asc" ? -1 : 1;
        if (va > vb) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
  }, [ecritures, q, journalFilter, sortCol, sortDir]);

  const totalDebit  = filtered.reduce((s, e) => s + (e.debit  || 0), 0);
  const totalCredit = filtered.reduce((s, e) => s + (e.credit || 0), 0);
  const isBalanced  = Math.abs(totalDebit - totalCredit) < 0.01;

  const sort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };
  const Th = ({ col, children, right }) => (
    <th className={`th${right ? " right" : ""}`} onClick={() => sort(col)} style={{ cursor: "pointer", userSelect: "none" }}>
      {children}{sortCol === col ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
    </th>
  );

  const handleExport = async () => {
    try {
      const res = await exportJournal(token, dossierId);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `journal_sage100_${dossierId}.xlsx`;
      a.click();
      toast("Journal SAGE 100 exporté", "pos");
    } catch {
      toast("Erreur lors de l'export", "neg");
    }
  };

  return (
    <div className="page-inner">
      <div className="page-header">
        <div>
          <h1 className="page-title">Journal SAGE 100</h1>
          <p className="page-subtitle">{filtered.length} écritures · Plan Comptable Marocain</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={handleExport}><Download size={13} /> Exporter SAGE 100</button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-search">
          <Search size={14} />
          <input placeholder="Libellé, compte, tiers…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="filter-chips">
          {JOURNALS.map(j => (
            <button key={j} className={`chip${journalFilter === j ? " active" : ""}`} onClick={() => setJournalFilter(j)}>{j}</button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", fontSize: 11.5, display: "flex", alignItems: "center", gap: 8 }}>
          {isBalanced && filtered.length > 0
            ? <span style={{ color: "var(--pos-ink)", fontSize: 12 }}>✓ Équilibré</span>
            : filtered.length > 0 && <span style={{ color: "var(--neg-ink)", fontSize: 12 }}>⚠ Déséquilibré</span>}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="table">
          <thead>
            <tr>
              <Th col="date">Date</Th>
              <Th col="journal">Journal</Th>
              <Th col="compte">Compte PCM</Th>
              <Th col="tiers">Tiers</Th>
              <Th col="libelle">Libellé</Th>
              <Th col="debit" right>Débit</Th>
              <Th col="credit" right>Crédit</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--ink-3)", fontSize: 13 }}>
                {ecritures?.length === 0 ? "Aucune écriture générée. Uploadez des factures pour créer le journal." : "Aucun résultat."}
              </td></tr>
            )}
            {filtered.map((e, i) => (
              <tr key={e.id || i} className="tr-hover">
                <td className="td">{formatDate(e.date)}</td>
                <td className="td"><span className="badge">{e.journal || "AC"}</span></td>
                <td className="td mono" style={{ fontSize: 12, letterSpacing: "0.02em" }}>{e.compte}</td>
                <td className="td" style={{ fontSize: 12, color: "var(--ink-2)" }}>{e.tiers || "—"}</td>
                <td className="td" style={{ color: "var(--ink-1)" }}>{e.libelle}</td>
                <td className="td right tabular" style={{ color: e.debit > 0 ? "var(--ink-0)" : "var(--ink-3)" }}>
                  {e.debit > 0 ? formatMAD(e.debit).split(",")[0] : "—"}
                </td>
                <td className="td right tabular" style={{ color: e.credit > 0 ? "var(--ink-0)" : "var(--ink-3)" }}>
                  {e.credit > 0 ? formatMAD(e.credit).split(",")[0] : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr style={{ borderTop: "1.5px solid var(--line-1)", background: "var(--bg-inset)", fontWeight: 600 }}>
                <td colSpan={5} className="td" style={{ fontSize: 12 }}>Total · {filtered.length} écritures</td>
                <td className="td right tabular">{formatMAD(totalDebit).split(",")[0]}</td>
                <td className="td right tabular" style={{ color: isBalanced ? "var(--pos-ink)" : "var(--neg-ink)" }}>
                  {formatMAD(totalCredit).split(",")[0]}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
