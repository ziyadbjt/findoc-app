import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import { Check, ChevronRight, Download, FileText, RefreshCw, Search, Sparkles, Upload, X } from "lucide-react";

import { uploadBankStatement, uploadFactures } from "../api";
import ExportDialog from "../components/ExportDialog";
import FactureDetail from "../components/FactureDetail";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { formatMAD, formatDate, formatDateShort } from "../utils/format";


const TABS = [
  { key: "achats", label: "Achats" },
  { key: "ventes", label: "Ventes" },
  { key: "banque", label: "Banque" },
  { key: "tpe", label: "TPE" },
];

const buildTpeStorageKey = (dossierId) => `tpe-transactions:${dossierId || "demo"}`;

function ModalPortal({ children }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}


function StatutBadge({ statut }) {
  const map = {
    traite: { cls: "badge pos", label: "Traitee" },
    "traité": { cls: "badge pos", label: "Traitee" },
    a_valider: { cls: "badge warn", label: "A valider" },
    extraction: { cls: "badge accent", label: "Extraction" },
    erreur: { cls: "badge neg", label: "Erreur" },
  };
  const { cls, label } = map[statut] || { cls: "badge", label: statut || "-" };
  return <span className={cls}>{label}</span>;
}


function PaiementBadge({ paiement }) {
  const map = {
    payee: { cls: "badge pos", label: "Payee" },
    "payée": { cls: "badge pos", label: "Payee" },
    en_attente: { cls: "badge", label: "En attente" },
    en_retard: { cls: "badge neg", label: "En retard" },
  };
  const { cls, label } = map[paiement] || { cls: "badge", label: paiement || "-" };
  return <span className={cls}>{label}</span>;
}


function AmountDiff({ a, b }) {
  const diff = Math.abs(a - b);
  if (diff < 1) return <span style={{ color: "var(--pos-ink)", fontSize: 11 }}>exact</span>;
  return <span style={{ color: "var(--warn-ink)", fontSize: 11 }}>Delta {formatMAD(diff).split(",")[0]}</span>;
}


function BanqueTab({ factures, dossierId }) {
  const { token } = useAuth();
  const toast = useToast();
  const uploadRef = useRef(null);
  const [bankLines, setBankLines] = useState([]);
  const [pairs, setPairs] = useState({});
  const [ignored, setIgnored] = useState({});
  const [activeLine, setActiveLine] = useState(null);
  const [filter, setFilter] = useState("all");
  const [uploadingBank, setUploadingBank] = useState(false);

  const pendingFactures = factures.filter((facture) => facture.paiement !== "payee" && facture.paiement !== "payée" && facture.statut !== "erreur");
  const matchedBankIds = new Set(Object.keys(pairs));
  const matchedFactureIds = new Set(Object.values(pairs));
  const matched = matchedBankIds.size;
  const ignoredCount = Object.keys(ignored).length;
  const pending = bankLines.length - matched - ignoredCount;
  const pct = Math.round((matched / (bankLines.length || 1)) * 100);

  const autoMatch = () => {
    const nextPairs = { ...pairs };
    bankLines.forEach((line) => {
      if (nextPairs[line.id] || ignored[line.id]) return;
      const match = pendingFactures.find(
        (facture) =>
          !matchedFactureIds.has(String(facture.id)) &&
          Math.abs((facture.montant_ttc || 0) - Math.abs(line.montant)) < 5
      );
      if (match) nextPairs[line.id] = String(match.id);
    });
    setPairs(nextPairs);
  };

  const handleBankUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingBank(true);
    try {
      const res = await uploadBankStatement(token, dossierId, file);
      const lines = res.data?.bank_lines || [];
      const suggestedPairs = {};
      lines.forEach((line) => {
        if (line.matched_to != null) suggestedPairs[line.id] = String(line.matched_to);
      });
      setBankLines(lines);
      setPairs(suggestedPairs);
      setIgnored({});
      setActiveLine(null);
      toast(`${lines.length} ligne(s) de releve extraites`, "pos");
    } catch {
      toast("Erreur import releve bancaire", "neg");
    } finally {
      setUploadingBank(false);
      event.target.value = "";
    }
  };

  const linesToShow = bankLines.filter((line) => {
    if (filter === "matched") return matchedBankIds.has(String(line.id));
    if (filter === "pending") return !matchedBankIds.has(String(line.id)) && !ignored[line.id];
    if (filter === "ignored") return !!ignored[line.id];
    return true;
  });

  const paired = bankLines.filter((line) => pairs[line.id]);
  const totalBank = paired.reduce((sum, line) => sum + Math.abs(line.montant), 0);
  const totalFacture = paired.reduce((sum, line) => {
    const facture = factures.find((row) => String(row.id) === String(pairs[line.id]));
    return sum + (facture?.montant_ttc || 0);
  }, 0);

  return (
    <div>
      <div className="card" style={{ padding: "14px 18px", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12 }}>
              <span style={{ color: "var(--ink-2)" }}>Rapprochement</span>
              <span className="mono tabular" style={{ fontWeight: 600 }}>{pct}%</span>
            </div>
            <div style={{ height: 5, background: "var(--bg-inset)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "var(--pos-ink)" : "var(--accent)", borderRadius: 3, transition: "width 0.5s" }} />
            </div>
          </div>

          {[
            { label: "Rapprochees", val: matched, color: "var(--pos-ink)" },
            { label: "En attente", val: pending, color: "var(--warn-ink)" },
            { label: "Ignorees", val: ignoredCount, color: "var(--ink-3)" },
          ].map((stat) => (
            <div key={stat.label} style={{ textAlign: "center", minWidth: 56 }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: stat.color }}>{stat.val}</div>
              <div style={{ fontSize: 11, color: "var(--ink-2)" }}>{stat.label}</div>
            </div>
          ))}

          <button className="btn btn-secondary" onClick={autoMatch} disabled={!bankLines.length}>
            <RefreshCw size={13} /> Auto-match
          </button>
          <button className="btn btn-primary" onClick={() => uploadRef.current?.click()} disabled={uploadingBank}>
            <Upload size={13} /> {uploadingBank ? "Analyse..." : "Importer releve"}
          </button>
          <input ref={uploadRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.csv,.txt" style={{ display: "none" }} onChange={handleBankUpload} />
        </div>

        {matched > 0 && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line-1)", display: "flex", gap: 20, fontSize: 12, flexWrap: "wrap" }}>
            <span style={{ color: "var(--ink-2)" }}>Releve · <span className="mono tabular" style={{ color: "var(--ink-0)" }}>{formatMAD(totalBank).split(",")[0]} MAD</span></span>
            <span style={{ color: "var(--ink-2)" }}>Factures · <span className="mono tabular" style={{ color: "var(--ink-0)" }}>{formatMAD(totalFacture).split(",")[0]} MAD</span></span>
            <AmountDiff a={totalBank} b={totalFacture} />
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
        {[["all", "Tout"], ["pending", `En attente (${pending})`], ["matched", `Rapprochees (${matched})`], ["ignored", "Ignorees"]].map(([key, label]) => (
          <button key={key} className={`chip${filter === key ? " active" : ""}`} onClick={() => setFilter(key)}>{label}</button>
        ))}
      </div>

      {bankLines.length === 0 && (
        <div className="card" style={{ padding: 28, marginBottom: 12, textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Aucun releve importe</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>Importez un PDF ou une image de releve bancaire pour lancer l'extraction Google Document AI.</div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: activeLine ? "1fr 1fr" : "1fr", gap: 12 }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "11px 16px", borderBottom: "1px solid var(--line-1)", fontSize: 13, fontWeight: 500 }}>Lignes de releve</div>
          <div style={{ overflowY: "auto", maxHeight: 480 }}>
            {linesToShow.map((line) => {
              const matchedFactureId = pairs[line.id];
              const matchedFacture = matchedFactureId ? factures.find((facture) => String(facture.id) === String(matchedFactureId)) : null;
              const isIgnored = !!ignored[line.id];
              const isActive = activeLine === line.id;

              return (
                <div
                  key={line.id}
                  style={{ padding: "11px 16px", borderBottom: "1px solid var(--line-1)", background: isActive ? "var(--accent-bg)" : matchedFacture ? "var(--pos-bg)" : isIgnored ? "var(--bg-inset)" : "var(--bg-1)", opacity: isIgnored ? 0.55 : 1, cursor: matchedFacture || isIgnored ? "default" : "pointer" }}
                  onClick={() => !matchedFacture && !isIgnored && setActiveLine(isActive ? null : line.id)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 2 }}>{line.libelle}</div>
                      <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{formatDate(line.date)} · <span className="mono">{line.reference}</span></div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="mono tabular" style={{ fontSize: 13, fontWeight: 600, color: line.montant < 0 ? "var(--neg-ink)" : "var(--pos-ink)" }}>
                        {line.montant < 0 ? "-" : "+"}{formatMAD(Math.abs(line.montant)).split(",")[0]}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {matchedFacture ? (
                        <button className="icon-btn" onClick={() => setPairs((prev) => { const next = { ...prev }; delete next[line.id]; return next; })}><X size={12} /></button>
                      ) : (
                        !isIgnored && <ChevronRight size={14} style={{ color: isActive ? "var(--accent-ink)" : "var(--ink-3)" }} />
                      )}
                      <button className="icon-btn" style={{ fontSize: 10 }} onClick={() => setIgnored((prev) => { const next = { ...prev }; if (next[line.id]) delete next[line.id]; else next[line.id] = true; return next; })}>
                        {isIgnored ? "<" : "-"}
                      </button>
                    </div>
                  </div>
                  {matchedFacture && (
                    <div style={{ marginTop: 7, padding: "5px 10px", background: "var(--bg-1)", borderRadius: 6, fontSize: 11.5, display: "flex", gap: 8, alignItems: "center" }}>
                      <Check size={12} style={{ color: "var(--pos-ink)" }} />
                      <span style={{ fontWeight: 500 }}>{matchedFacture.fournisseur}</span>
                      <span style={{ color: "var(--ink-2)" }}>{matchedFacture.num_facture}</span>
                      <span className="mono tabular" style={{ marginLeft: "auto" }}>{formatMAD(matchedFacture.montant_ttc).split(",")[0]}</span>
                      <AmountDiff a={Math.abs(line.montant)} b={matchedFacture.montant_ttc || 0} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {activeLine && (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "11px 16px", borderBottom: "1px solid var(--line-1)", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>Lier a une facture</div>
              <button className="icon-btn" onClick={() => setActiveLine(null)}><X size={14} /></button>
            </div>
            <div style={{ overflowY: "auto", maxHeight: 480 }}>
              {pendingFactures.filter((facture) => !matchedFactureIds.has(String(facture.id))).map((facture) => (
                <div
                  key={facture.id}
                  style={{ padding: "11px 16px", borderBottom: "1px solid var(--line-1)", cursor: "pointer" }}
                  onClick={() => {
                    setPairs((prev) => ({ ...prev, [activeLine]: facture.id }));
                    setActiveLine(null);
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 500 }}>{facture.fournisseur}</div>
                      <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{facture.num_facture} · {formatDateShort(facture.date_echeance)}</div>
                    </div>
                    <div className="mono tabular" style={{ fontSize: 13, fontWeight: 600 }}>{formatMAD(facture.montant_ttc).split(",")[0]}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


function TPETab({ dossierId, transactions, setTransactions, onExport }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const totals = useMemo(() => ({
    count: transactions.length,
    amount: transactions.reduce((sum, row) => sum + (Number(row.montant) || 0), 0),
    settled: transactions.filter((row) => (row.statut || "").toLowerCase() === "valide").length,
  }), [transactions]);

  const parseCsv = (text) => {
    const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean);
    if (!headerLine) return [];
    const headers = headerLine.split(/[;,]/).map((item) => item.trim().toLowerCase());
    return lines.map((line, index) => {
      const values = line.split(/[;,]/);
      const row = Object.fromEntries(headers.map((header, i) => [header, values[i]?.trim() || ""]));
      return {
        id: `tpe-${Date.now()}-${index}`,
        date: row.date || row.transaction_date || row.created_at || "",
        reference: row.reference || row.ref || row.operation || `TPE-${index + 1}`,
        libelle: row.libelle || row.label || row.description || "Encaissement TPE",
        client: row.client || row.customer || "",
        terminal: row.terminal || row.tpe || "",
        canal: row.canal || "TPE",
        statut: row.statut || row.status || "valide",
        montant: Number(String(row.montant || row.amount || 0).replace(",", ".")) || 0,
        tva: Number(String(row.tva || 0).replace(",", ".")) || 0,
        montant_ht: Number(String(row.montant_ht || row.ht || row.amount_ht || 0).replace(",", ".")) || 0,
        compte_pcm: row.compte_pcm || "511100",
      };
    }).filter((row) => row.date || row.reference || row.montant);
  };

  const normalizeJsonRows = (rows) =>
    (rows || []).map((row, index) => ({
      id: row.id || `tpe-${Date.now()}-${index}`,
      date: row.date || row.transaction_date || row.created_at || "",
      reference: row.reference || row.ref || row.operation || `TPE-${index + 1}`,
      libelle: row.libelle || row.label || row.description || "Encaissement TPE",
      client: row.client || row.customer || "",
      terminal: row.terminal || row.tpe || "",
      canal: row.canal || "TPE",
      statut: row.statut || row.status || "valide",
      montant: Number(row.montant ?? row.amount ?? 0) || 0,
      tva: Number(row.tva ?? 0) || 0,
      montant_ht: Number(row.montant_ht ?? row.ht ?? row.amount_ht ?? 0) || 0,
      compte_pcm: row.compte_pcm || "511100",
    })).filter((row) => row.date || row.reference || row.montant);

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      let rows = [];
      if (file.name.toLowerCase().endsWith(".json")) {
        rows = normalizeJsonRows(JSON.parse(await file.text()));
      } else if (file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls")) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = normalizeJsonRows(XLSX.utils.sheet_to_json(sheet, { defval: "" }));
      } else {
        rows = parseCsv(await file.text());
      }

      if (!rows.length) {
        toast("Aucune transaction TPE exploitable trouvee", "neg");
      } else {
        setTransactions(rows);
        toast(`${rows.length} transaction(s) TPE importee(s)`, "pos");
      }
    } catch {
      toast("Erreur import TPE", "neg");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="card" style={{ padding: "14px 18px" }}>
        <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Terminal de paiement electronique</div>
            <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
              Importez vos remises TPE depuis CSV, JSON ou Excel puis exportez le journal correspondant.
            </div>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ textAlign: "center", minWidth: 74 }}>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{totals.count}</div>
              <div style={{ fontSize: 11, color: "var(--ink-2)" }}>Transactions</div>
            </div>
            <div style={{ textAlign: "center", minWidth: 110 }}>
              <div className="mono tabular" style={{ fontSize: 20, fontWeight: 600 }}>{formatMAD(totals.amount).split(",")[0]}</div>
              <div style={{ fontSize: 11, color: "var(--ink-2)" }}>Montant total</div>
            </div>
            <div style={{ textAlign: "center", minWidth: 74 }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: "var(--pos-ink)" }}>{totals.settled}</div>
              <div style={{ fontSize: 11, color: "var(--ink-2)" }}>Validées</div>
            </div>
            <button className="btn btn-secondary" onClick={onExport}>
              <Download size={13} /> Exporter
            </button>
            <button className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload size={13} /> {uploading ? "Import..." : "Importer"}
            </button>
            <input ref={fileRef} type="file" accept=".csv,.json,.xlsx,.xls" style={{ display: "none" }} onChange={handleImport} />
          </div>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Aucune transaction TPE importee</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
            Chargez un export de terminal ou un relevé de remises pour alimenter ce journal.
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="table">
            <thead>
              <tr>
                <th className="th">Date</th>
                <th className="th">Reference</th>
                <th className="th">Libelle</th>
                <th className="th">Terminal</th>
                <th className="th">Statut</th>
                <th className="th right">Montant</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((row) => (
                <tr key={row.id} className="tr-hover">
                  <td className="td">{row.date ? formatDateShort(row.date) : "—"}</td>
                  <td className="td mono" style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{row.reference || "—"}</td>
                  <td className="td" style={{ fontWeight: 500 }}>{row.libelle || row.client || "Transaction TPE"}</td>
                  <td className="td mono" style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{row.terminal || "—"}</td>
                  <td className="td"><span className={`badge ${(row.statut || "").toLowerCase() === "valide" ? "pos" : "warn"}`}>{row.statut || "valide"}</span></td>
                  <td className="td right tabular" style={{ fontWeight: 600, color: "var(--pos-ink)" }}>{formatMAD(row.montant || 0).split(",")[0]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


export default function FacturesPage({ factures, dossierId, onRefresh, ecritures, layout }) {
  const { token } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState("achats");
  const [q, setQ] = useState("");
  const [statutFilter, setStatutFilter] = useState("toutes");
  const [sortCol, setSortCol] = useState("date_facture");
  const [sortDir, setSortDir] = useState("desc");
  const [selected, setSelected] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [tpeTransactions, setTpeTransactions] = useState([]);
  const fileRef = useRef(null);

  const addUploadFiles = useCallback((files) => {
    const incoming = [...(files || [])].filter((file) => {
      const name = String(file.name || "").toLowerCase();
      return (
        file.type === "application/pdf" ||
        file.type.startsWith("image/") ||
        /\.(pdf|png|jpe?g)$/.test(name)
      );
    });
    if (!incoming.length) return;
    setUploadFiles((current) => {
      const seen = new Set(current.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
      return [
        ...current,
        ...incoming.filter((file) => {
          const key = `${file.name}:${file.size}:${file.lastModified}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }),
      ];
    });
  }, []);

  useEffect(() => {
    try {
      setTpeTransactions(JSON.parse(localStorage.getItem(buildTpeStorageKey(dossierId)) || "[]"));
    } catch {
      setTpeTransactions([]);
    }
  }, [dossierId]);

  useEffect(() => {
    localStorage.setItem(buildTpeStorageKey(dossierId), JSON.stringify(tpeTransactions));
  }, [dossierId, tpeTransactions]);

  const tabFactures = factures.filter((facture) => (tab === "achats" ? (facture.type || "achat") === "achat" : tab === "ventes" ? facture.type === "vente" : true));

  const statuts = ["toutes", "traite", "a_valider", "en_retard"];
  const filtered = tabFactures
    .filter((facture) => {
      if (statutFilter !== "toutes" && facture.statut !== statutFilter && !(statutFilter === "en_retard" && facture.paiement === "en_retard")) return false;
      if (q.trim()) {
        const qq = q.toLowerCase();
        if (!(facture.fournisseur || "").toLowerCase().includes(qq) && !(facture.num_facture || "").toLowerCase().includes(qq) && !(facture.code_tiers || "").toLowerCase().includes(qq)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      let va = a[sortCol];
      let vb = b[sortCol];
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      return va < vb ? (sortDir === "asc" ? -1 : 1) : va > vb ? (sortDir === "asc" ? 1 : -1) : 0;
    });

  const sort = (col) => {
    if (sortCol === col) setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const Th = ({ col, children, right }) => (
    <th className={`th${right ? " right" : ""}`} onClick={() => sort(col)} style={{ cursor: "pointer", userSelect: "none" }}>
      {children}
      {sortCol === col ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
    </th>
  );

  const handleDrop = useCallback((event) => {
    event.preventDefault();
    setDragging(false);
    addUploadFiles(event.dataTransfer.files);
  }, [addUploadFiles]);

  const handleUpload = async () => {
    if (!uploadFiles.length) return;
    setUploading(true);
    try {
      const response = await uploadFactures(token, dossierId, uploadFiles);
      const results = response.data?.resultats || [];
      const fallbackCount = results.filter((row) => row.source_ai === "fallback").length;
      toast(
        fallbackCount
          ? `${uploadFiles.length} fichier(s) importé(s), ${fallbackCount} à vérifier (Claude non disponible ou lecture faible)`
          : `${uploadFiles.length} facture(s) extraite(s)`,
        fallbackCount ? "warn" : "pos"
      );
      setShowUpload(false);
      setUploadFiles([]);
      onRefresh();
    } catch {
      toast("Erreur upload", "neg");
    } finally {
      setUploading(false);
    }
  };

  const totalTTC = filtered.reduce((sum, facture) => sum + (facture.montant_ttc || 0), 0);
  const lowConfidenceFactures = useMemo(
    () => factures.filter(f => f.confidence != null && f.confidence < 0.8 && f.statut !== "erreur"),
    [factures]
  );
  const [showBatchValidation, setShowBatchValidation] = useState(false);

  return (
    <div className="page-inner">
      <div className="page-header">
        <div>
          <h1 className="page-title">Factures</h1>
          <p className="page-subtitle">{factures.length} total · {formatMAD(factures.reduce((sum, facture) => sum + (facture.montant_ttc || 0), 0))} MAD</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={() => setShowExport(true)}><Download size={13} /> Exporter</button>
          <button className="btn btn-primary" onClick={() => setShowUpload(true)}><Upload size={13} /> Importer</button>
        </div>
      </div>

      {lowConfidenceFactures.length > 0 && (
        <div style={{
          background: "var(--warn-bg)", borderRadius: 10, padding: "12px 16px",
          marginBottom: 14, display: "flex", alignItems: "center", gap: 12,
          border: "1px solid color-mix(in srgb, var(--warn-ink) 25%, transparent)"
        }}>
          <Sparkles size={15} style={{ color: "var(--warn-ink)", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--warn-ink)" }}>
              {lowConfidenceFactures.length} facture{lowConfidenceFactures.length > 1 ? "s" : ""} à valider
            </span>
            <span style={{ fontSize: 12, color: "var(--ink-2)", marginLeft: 8 }}>
              Confiance d'extraction &lt; 80% — vérifiez les montants extraits
            </span>
          </div>
          <button
            className="btn btn-secondary"
            style={{ fontSize: 12 }}
            onClick={() => setShowBatchValidation(v => !v)}
          >
            {showBatchValidation ? "Masquer" : "Voir toutes"}
          </button>
        </div>
      )}

      {showBatchValidation && lowConfidenceFactures.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 14 }}>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--line-1)", fontSize: 12.5, fontWeight: 500 }}>
            Factures à confiance faible
          </div>
          {lowConfidenceFactures.map(f => (
            <div key={f.id}
              style={{ padding: "10px 16px", borderBottom: "1px solid var(--line-1)", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
              onClick={() => setSelected(f)}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500 }}>{f.fournisseur || "—"}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{f.num_facture} · {formatDate(f.date_facture)}</div>
              </div>
              <div className="mono tabular" style={{ fontSize: 13, fontWeight: 600 }}>{formatMAD(f.montant_ttc).split(",")[0]}</div>
              <span style={{
                fontSize: 11, padding: "2px 8px", borderRadius: 99, fontWeight: 600,
                background: "var(--warn-bg)", color: "var(--warn-ink)",
                border: "1px solid color-mix(in srgb, var(--warn-ink) 20%, transparent)"
              }}>
                {Math.round((f.confidence || 0) * 100)}% confiance
              </span>
              <ChevronRight size={14} style={{ color: "var(--ink-3)" }} />
            </div>
          ))}
        </div>
      )}

      <div className="facture-tabs">
        {TABS.map((tabItem) => (
          <button
            key={tabItem.key}
            className={`facture-tab${tab === tabItem.key ? " active" : ""}`}
            onClick={() => setTab(tabItem.key)}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      {tab === "banque" && <BanqueTab factures={factures} dossierId={dossierId} />}
      {tab === "tpe" && <TPETab dossierId={dossierId} transactions={tpeTransactions} setTransactions={setTpeTransactions} onExport={() => setShowExport(true)} />}

      {(tab === "achats" || tab === "ventes") && (
        <>
          {/* Stats rapides */}
          <div className="facture-stats">
            {[
              { label: "Total", val: formatMAD(tabFactures.reduce((s, f) => s + (f.montant_ttc || 0), 0)).split(",")[0], sub: `${tabFactures.length} facture${tabFactures.length > 1 ? "s" : ""}`, color: "var(--ink-0)" },
              { label: "Payées", val: tabFactures.filter(f => f.paiement === "payee" || f.paiement === "payée").length, sub: formatMAD(tabFactures.filter(f => f.paiement === "payee" || f.paiement === "payée").reduce((s, f) => s + (f.montant_ttc || 0), 0)).split(",")[0] + " MAD", color: "var(--pos-ink)" },
              { label: "En attente", val: tabFactures.filter(f => f.paiement === "en_attente").length, sub: formatMAD(tabFactures.filter(f => f.paiement === "en_attente").reduce((s, f) => s + (f.montant_ttc || 0), 0)).split(",")[0] + " MAD", color: "var(--warn-ink)" },
              { label: "En retard", val: tabFactures.filter(f => f.paiement === "en_retard").length, sub: formatMAD(tabFactures.filter(f => f.paiement === "en_retard").reduce((s, f) => s + (f.montant_ttc || 0), 0)).split(",")[0] + " MAD", color: "var(--neg-ink)" },
            ].map((s) => (
              <div key={s.label} className="facture-stat">
                <div className="facture-stat__val" style={{ color: s.color }}>{s.val}</div>
                <div className="facture-stat__label">{s.label}</div>
                <div className="facture-stat__sub">{s.sub}</div>
              </div>
            ))}
          </div>

          <div className="filter-bar">
            <div className="filter-search">
              <Search size={14} />
              <input placeholder="Fournisseur, numéro facture..." value={q} onChange={(e) => setQ(e.target.value)} />
              {q && <button className="icon-btn" style={{ width: 20, height: 20 }} onClick={() => setQ("")}><X size={11} /></button>}
            </div>
            <div className="filter-chips">
              <button className={`chip${statutFilter === "toutes" ? " active" : ""}`} onClick={() => setStatutFilter("toutes")}>Toutes</button>
              <button className={`chip${statutFilter === "traite" ? " active" : ""}`} onClick={() => setStatutFilter("traite")}>
                <span className="chip-dot pos" />Traitées
              </button>
              <button className={`chip${statutFilter === "a_valider" ? " active" : ""}`} onClick={() => setStatutFilter("a_valider")}>
                <span className="chip-dot warn" />À valider
              </button>
              <button className={`chip${statutFilter === "en_retard" ? " active" : ""}`} onClick={() => setStatutFilter("en_retard")}>
                <span className="chip-dot neg" />En retard
              </button>
            </div>
            <div style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--ink-2)" }}>{filtered.length} résultat{filtered.length > 1 ? "s" : ""}</div>
          </div>

          {layout === "cards" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 10 }}>
              {filtered.map((facture) => (
                <button key={facture.id} className="card" style={{ padding: 16, textAlign: "left", cursor: "pointer" }} onClick={() => setSelected(facture)}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500 }}>{facture.fournisseur || "-"}</div>
                    <StatutBadge statut={facture.statut} />
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-2)", marginBottom: 8 }}>{facture.num_facture} · {formatDate(facture.date_facture)}</div>
                  <div style={{ fontSize: 18, fontWeight: 500 }}>{formatMAD(facture.montant_ttc).split(",")[0]} <span style={{ fontSize: 11, color: "var(--ink-2)" }}>MAD</span></div>
                  <div style={{ marginTop: 8 }}><PaiementBadge paiement={facture.paiement} /></div>
                </button>
              ))}
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table className="table">
                <thead>
                  <tr>
                    <Th col="fournisseur">Fournisseur</Th>
                    <Th col="num_facture">N° Facture</Th>
                    <Th col="date_facture">Date</Th>
                    <Th col="date_echeance">Échéance</Th>
                    <Th col="montant_ttc" right>Montant TTC</Th>
                    <th className="th">Statut</th>
                    <th className="th">Paiement</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: 48, color: "var(--ink-3)", fontSize: 13 }}>
                        <div style={{ marginBottom: 6 }}>Aucune facture</div>
                        <div style={{ fontSize: 12 }}>Importez des factures via le bouton Importer</div>
                      </td>
                    </tr>
                  )}
                  {filtered.map((facture) => (
                    <tr key={facture.id} className="tr-hover" onClick={() => setSelected(facture)} style={{ cursor: "pointer" }}>
                      <td className="td">
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{facture.fournisseur || "—"}</div>
                        <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 1 }}>{facture.code_tiers || facture.categorie || ""}</div>
                      </td>
                      <td className="td mono" style={{ fontSize: 12, color: "var(--ink-2)" }}>{facture.num_facture || "—"}</td>
                      <td className="td" style={{ fontSize: 12.5 }}>{formatDateShort(facture.date_facture)}</td>
                      <td className="td" style={{ fontSize: 12.5, color: facture.paiement === "en_retard" ? "var(--neg-ink)" : "var(--ink-1)", fontWeight: facture.paiement === "en_retard" ? 600 : 400 }}>
                        {formatDateShort(facture.date_echeance)}
                      </td>
                      <td className="td right">
                        <div className="tabular" style={{ fontWeight: 600, fontSize: 13 }}>{formatMAD(facture.montant_ttc).split(",")[0]} <span style={{ fontSize: 10, color: "var(--ink-3)", fontWeight: 400 }}>MAD</span></div>
                        <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 1 }}>HT {formatMAD(facture.montant_ht).split(",")[0]}</div>
                      </td>
                      <td className="td"><StatutBadge statut={facture.statut} /></td>
                      <td className="td"><PaiementBadge paiement={facture.paiement} /></td>
                    </tr>
                  ))}
                </tbody>
                {filtered.length > 0 && (
                  <tfoot>
                    <tr style={{ borderTop: "2px solid var(--line-0)", background: "var(--bg-inset)" }}>
                      <td colSpan={4} className="td" style={{ fontWeight: 600, fontSize: 12, color: "var(--ink-2)" }}>
                        Total · {filtered.length} facture{filtered.length > 1 ? "s" : ""}
                      </td>
                      <td className="td right tabular" style={{ fontWeight: 700, fontSize: 14 }}>
                        {formatMAD(totalTTC).split(",")[0]} <span style={{ fontSize: 10, fontWeight: 400, color: "var(--ink-3)" }}>MAD</span>
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </>
      )}

      {showUpload && (
        <ModalPortal>
          <div className="scrim" onClick={() => { setShowUpload(false); setUploadFiles([]); }} />
          <div className="modal">
            <div className="modal-head">
              <FileText size={16} /><div style={{ fontWeight: 500, fontSize: 14 }}>Importer des factures</div>
              <button className="icon-btn" style={{ marginLeft: "auto" }} onClick={() => { setShowUpload(false); setUploadFiles([]); }}><X size={15} /></button>
            </div>
            <div className="modal-body">
              <div className={`dropzone${dragging ? " drag-over" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop} onClick={() => fileRef.current?.click()}>
                <div className="dropzone-icon"><Upload size={20} /></div>
                <div className="dropzone-title">Glissez vos factures ici</div>
                <div className="dropzone-sub">PDF, PNG ou JPG · vous pouvez ajouter plusieurs lots</div>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    addUploadFiles(event.target.files);
                    event.target.value = "";
                  }}
                />
              </div>
              {uploadFiles.length > 0 && (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 2 }}>
                    <span style={{ fontSize: 12, color: "var(--ink-2)" }}>{uploadFiles.length} fichier{uploadFiles.length > 1 ? "s" : ""} en attente</span>
                    <button type="button" className="btn btn-ghost sm" onClick={() => fileRef.current?.click()}>
                      Ajouter
                    </button>
                  </div>
                  {uploadFiles.map((file, index) => (
                    <div key={index} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", background: "var(--bg-inset)", borderRadius: 8, fontSize: 12.5 }}>
                      <FileText size={13} style={{ color: "var(--accent-ink)" }} />
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
                      <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{(file.size / 1024).toFixed(0)} Ko</span>
                      <button
                        type="button"
                        className="icon-btn"
                        title="Retirer"
                        onClick={() => setUploadFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
                        style={{ width: 26, height: 26 }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => { setShowUpload(false); setUploadFiles([]); }}>Annuler</button>
              <button className="btn btn-primary" disabled={!uploadFiles.length || uploading} onClick={handleUpload}>
                {uploading ? <><span className="spinner" /> Traitement...</> : <><Sparkles size={13} /> Extraire · {uploadFiles.length} fichier{uploadFiles.length > 1 ? "s" : ""}</>}
              </button>
            </div>
          </div>
        </ModalPortal>
      )}

      <ExportDialog
        open={showExport}
        onClose={() => setShowExport(false)}
        dossierId={dossierId}
        factures={factures}
        ecritures={ecritures}
        tpeTransactions={tpeTransactions}
        defaultJournal={tab}
      />

      {selected && (
        <FactureDetail
          facture={selected}
          ecritures={(ecritures || []).filter((ecriture) => ecriture.facture_id === selected.id)}
          onClose={() => setSelected(null)}
          onUpdate={(next) => {
            setSelected(next);
            onRefresh();
          }}
          dossierId={dossierId}
        />
      )}
    </div>
  );
}
