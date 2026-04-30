import { useCallback, useRef, useState, useMemo } from "react";
import { Download, Search, Upload, FileText, Sparkles, X, CheckCircle, AlertCircle, Clock, Pencil, Check } from "lucide-react";
import { formatMAD, formatDate } from "../utils/format";
import { uploadFactures } from "../api";
import ExportDialog from "../components/ExportDialog";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useCorrection } from "../hooks/useCorrection";

const TABS = [
  { key: "extractions", label: "Extractions" },
  { key: "journal",     label: "Journal PCM" },
];

const JOURNALS = ["Tous", "AC", "BQ", "OD"];

function StatusIcon({ statut }) {
  if (statut === "traite" || statut === "traité")
    return <CheckCircle size={13} style={{ color: "var(--pos-ink)" }} />;
  if (statut === "erreur")
    return <AlertCircle size={13} style={{ color: "var(--neg-ink)" }} />;
  return <Clock size={13} style={{ color: "var(--warn-ink)" }} />;
}

function SortHeaderCell({ col, right = false, sortCol, sortDir, onSort, children }) {
  return (
    <th className={`th${right ? " right" : ""}`} onClick={() => onSort(col)} style={{ cursor: "pointer", userSelect: "none" }}>
      {children}{sortCol === col ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
    </th>
  );
}

function UploadZone({ dossierId, onDone }) {
  const { token } = useAuth();
  const toast = useToast();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState([]);

  const process = useCallback(async (files) => {
    if (!files.length) return;
    setUploading(true);
    setResults([]);
    try {
      const res = await uploadFactures(token, dossierId, Array.from(files));
      const data = res.data?.resultats || [];
      setResults(Array.isArray(data) ? data : []);
      toast(`${Array.isArray(data) ? data.length : 0} facture(s) extraite(s)`, "pos");
      onDone?.();
    } catch {
      toast("Erreur lors de l'extraction", "neg");
    } finally {
      setUploading(false);
    }
  }, [token, dossierId, toast, onDone]);

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    process(e.dataTransfer.files);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? "var(--accent)" : "var(--line-1)"}`,
          borderRadius: 16,
          padding: "40px 24px",
          textAlign: "center",
          cursor: "pointer",
          background: dragging ? "var(--accent-bg)" : "var(--bg-inset)",
          transition: "all 0.15s",
        }}
      >
        <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" multiple hidden
          onChange={(e) => process(e.target.files)} />
        <div style={{ width: 48, height: 48, borderRadius: 14, background: "var(--accent-bg)", color: "var(--accent-ink)", display: "grid", placeItems: "center", margin: "0 auto 14px" }}>
          {uploading ? <Sparkles size={22} /> : <Upload size={22} />}
        </div>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
          {uploading ? "Extraction en cours..." : "Déposer vos factures ici"}
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-3)" }}>PDF, JPG, PNG · Cliquer pour parcourir</div>
      </div>

      {results.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-1)", fontSize: 12, fontWeight: 600, color: "var(--ink-2)" }}>
            Résultats — {results.length} facture(s)
          </div>
          {results.map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--line-1)" }}>
              <FileText size={14} style={{ color: "var(--ink-3)", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{f.fournisseur || f.num_facture || "Facture"}</div>
                <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{f.num_facture} · {formatDate(f.date_facture)}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{f.montant_ttc ? formatMAD(f.montant_ttc) : "—"}</div>
              <StatusIcon statut={f.statut} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CorrectionCell({ facture, champ, valeur, dossierId }) {
  const correct = useCorrection(dossierId);
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(valeur || "");
  const [saved, setSaved] = useState(false);

  const submit = async () => {
    if (!val.trim() || val === valeur) { setEditing(false); return; }
    await correct({ facture, champ, original: valeur || "", corrige: val.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setEditing(false);
  };

  if (editing) {
    return (
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <input
          autoFocus
          style={{ width: 110, fontSize: 12, padding: "3px 6px", borderRadius: 6, border: "1px solid var(--accent)", background: "var(--bg-0)", color: "var(--ink-0)" }}
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") setEditing(false); }}
        />
        <button className="icon-btn" onClick={submit}><Check size={11} /></button>
        <button className="icon-btn" onClick={() => setEditing(false)}><X size={11} /></button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{ fontSize: 12, color: saved ? "var(--pos-ink)" : "var(--ink-0)" }}>{val || "—"}</span>
      <button className="icon-btn" onClick={() => setEditing(true)} title="Corriger — FinAI va apprendre" style={{ opacity: 0.5 }}>
        <Pencil size={11} />
      </button>
    </div>
  );
}

function ExtractionsTab({ factures, dossierId, onRefresh }) {
  const [q, setQ] = useState("");
  const [showUpload, setShowUpload] = useState(false);

  const extracted = useMemo(() => {
    return (factures || []).filter(f => {
      if (q.trim()) {
        const qq = q.toLowerCase();
        return (f.fournisseur || "").toLowerCase().includes(qq) ||
               (f.num_facture || "").toLowerCase().includes(qq);
      }
      return true;
    });
  }, [factures, q]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="filter-bar">
        <div className="filter-search">
          <Search size={14} />
          <input placeholder="Fournisseur, numéro…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={() => setShowUpload(v => !v)}>
          <Upload size={13} /> Nouvelle extraction
        </button>
      </div>

      {showUpload && (
        <UploadZone dossierId={dossierId} onDone={() => { onRefresh?.(); setShowUpload(false); }} />
      )}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="table">
          <thead>
            <tr>
              <th className="th">Fournisseur / Client</th>
              <th className="th">Compte PCM</th>
              <th className="th">N° Facture</th>
              <th className="th">Date</th>
              <th className="th right">Montant TTC</th>
              <th className="th">Statut</th>
              <th className="th">Paiement</th>
            </tr>
          </thead>
          <tbody>
            {extracted.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--ink-3)", fontSize: 13 }}>
                Aucune facture extraite. Utilisez "Nouvelle extraction" pour importer des documents.
              </td></tr>
            )}
            {extracted.map((f, i) => (
              <tr key={f.id || i} className="tr-hover">
                <td className="td" style={{ fontWeight: 500 }}>
                  <CorrectionCell facture={f} champ="fournisseur" valeur={f.fournisseur} dossierId={dossierId} />
                </td>
                <td className="td mono">
                  <CorrectionCell facture={f} champ="compte_pcm" valeur={f.compte_pcm} dossierId={dossierId} />
                </td>
                <td className="td mono" style={{ fontSize: 12 }}>{f.num_facture || "—"}</td>
                <td className="td" style={{ fontSize: 12, color: "var(--ink-2)" }}>{formatDate(f.date_facture)}</td>
                <td className="td right tabular" style={{ fontWeight: 600 }}>
                  {f.montant_ttc ? formatMAD(f.montant_ttc) : "—"}
                </td>
                <td className="td">
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <StatusIcon statut={f.statut} />
                    <span style={{ fontSize: 12 }}>{f.statut === "traite" || f.statut === "traité" ? "Traité" : f.statut === "erreur" ? "Erreur" : "En attente"}</span>
                  </div>
                </td>
                <td className="td">
                  <span className={`badge ${f.paiement === "payee" || f.paiement === "payée" ? "pos" : f.paiement === "en_retard" ? "neg" : ""}`}>
                    {f.paiement === "payee" || f.paiement === "payée" ? "Payée" : f.paiement === "en_retard" ? "En retard" : "En attente"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditableCell({ value, dossierId, ecriture, champ }) {
  const correct = useCorrection(dossierId);
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || "");

  const submit = async () => {
    if (!val.trim() || val === value) { setEditing(false); return; }
    await correct({
      facture: { id: ecriture.facture_id, fournisseur: ecriture.tiers, montant_ht: 0 },
      champ,
      original: value || "",
      corrige: val.trim(),
    });
    setEditing(false);
  };

  if (editing) return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      <input autoFocus
        style={{ width: 100, fontSize: 12, padding: "2px 6px", borderRadius: 6, border: "1px solid var(--accent)", background: "var(--bg-0)", color: "var(--ink-0)" }}
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") setEditing(false); }}
      />
      <button className="icon-btn" onClick={submit}><Check size={11} /></button>
      <button className="icon-btn" onClick={() => setEditing(false)}><X size={11} /></button>
    </div>
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, cursor: "text" }} onClick={() => setEditing(true)}>
      <span style={{ fontSize: 12, color: val ? "var(--ink-0)" : "var(--ink-2)" }}>{val || "—"}</span>
      <Pencil size={10} style={{ opacity: 0.55, color: "var(--ink-2)", flexShrink: 0 }} />
    </div>
  );
}

function JournalTab({ ecritures, factures, dossierId }) {
  const [q, setQ] = useState("");
  const [journalFilter, setJournalFilter] = useState("Tous");
  const [sortCol, setSortCol] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [showExport, setShowExport] = useState(false);

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          {filtered.length > 0 && (
            isBalanced
              ? <span style={{ color: "var(--pos-ink)", fontSize: 12 }}>✓ Équilibré</span>
              : <span style={{ color: "var(--neg-ink)", fontSize: 12 }}>⚠ Déséquilibré</span>
          )}
          <button className="btn btn-primary" onClick={() => setShowExport(true)}>
            <Download size={13} /> Exporter
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="table journal-table">
          <thead>
            <tr>
              <SortHeaderCell col="date" sortCol={sortCol} sortDir={sortDir} onSort={sort}>Date</SortHeaderCell>
              <SortHeaderCell col="journal" sortCol={sortCol} sortDir={sortDir} onSort={sort}>Journal</SortHeaderCell>
              <SortHeaderCell col="compte" sortCol={sortCol} sortDir={sortDir} onSort={sort}>Compte PCM</SortHeaderCell>
              <SortHeaderCell col="tiers" sortCol={sortCol} sortDir={sortDir} onSort={sort}>Tiers</SortHeaderCell>
              <SortHeaderCell col="libelle" sortCol={sortCol} sortDir={sortDir} onSort={sort}>Libellé</SortHeaderCell>
              <SortHeaderCell col="debit" right sortCol={sortCol} sortDir={sortDir} onSort={sort}>Débit</SortHeaderCell>
              <SortHeaderCell col="credit" right sortCol={sortCol} sortDir={sortDir} onSort={sort}>Crédit</SortHeaderCell>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--ink-3)", fontSize: 13 }}>
                {ecritures?.length === 0 ? "Aucune écriture générée." : "Aucun résultat."}
              </td></tr>
            )}
            {filtered.map((e, i) => (
              <tr key={e.id || i} className="tr-hover">
                <td className="td">{formatDate(e.date)}</td>
                <td className="td"><span className="badge neutral">{e.journal || "AC"}</span></td>
                <td className="td mono"><EditableCell value={e.compte} dossierId={dossierId} ecriture={e} champ="compte_pcm" /></td>
                <td className="td" style={{ fontSize: 12, color: e.tiers ? "var(--ink-1)" : "var(--ink-2)" }}>{e.tiers || "—"}</td>
                <td className="td"><EditableCell value={e.libelle} dossierId={dossierId} ecriture={e} champ="libelle" /></td>
                <td className="td right tabular" style={{ color: e.debit > 0 ? "var(--ink-0)" : "var(--ink-2)" }}>
                  {e.debit > 0 ? formatMAD(e.debit).split(",")[0] : "—"}
                </td>
                <td className="td right tabular" style={{ color: e.credit > 0 ? "var(--ink-0)" : "var(--ink-2)" }}>
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

      {showExport && (
        <ExportDialog
          open={showExport}
          onClose={() => setShowExport(false)}
          dossierId={dossierId}
          factures={factures}
          ecritures={ecritures}
          defaultJournal="achats"
        />
      )}
    </div>
  );
}

export default function JournalPage({ ecritures, factures, dossierId, onRefresh }) {
  const [tab, setTab] = useState("extractions");

  return (
    <div className="page-inner">
      <div className="page-header">
        <div>
          <h1 className="page-title">Extraction</h1>
          <p className="page-subtitle">Documents importés et écritures comptables générées</p>
        </div>
      </div>

      <div className="filter-chips" style={{ marginBottom: 8 }}>
        {TABS.map(t => (
          <button key={t.key} className={`chip${tab === t.key ? " active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "extractions" && <ExtractionsTab factures={factures} dossierId={dossierId} onRefresh={onRefresh} />}
      {tab === "journal"     && <JournalTab ecritures={ecritures} factures={factures} dossierId={dossierId} />}
    </div>
  );
}
