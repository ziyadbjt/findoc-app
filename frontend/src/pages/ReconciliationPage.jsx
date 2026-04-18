import { useState, useMemo } from "react";
import { GitMerge, Check, AlertTriangle, RefreshCw, X, ChevronRight } from "lucide-react";
import { formatMAD, formatDate, formatDateShort } from "../utils/format";
import { MOCK_BANK_LINES } from "../api";

const STATUS_COLORS = {
  rapproché:     { bg: "var(--pos-bg)",    ink: "var(--pos-ink)" },
  "non rapproché": { bg: "var(--warn-bg)", ink: "var(--warn-ink)" },
  ignoré:        { bg: "var(--bg-2)",      ink: "var(--ink-2)" },
};

function AmountDiff({ a, b }) {
  const diff = Math.abs(a - b);
  if (diff < 1) return <span style={{ color: "var(--pos-ink)", fontSize: 11 }}>✓ exact</span>;
  return <span style={{ color: "var(--warn-ink)", fontSize: 11 }}>Δ {formatMAD(diff).split(",")[0]}</span>;
}

export default function ReconciliationPage({ factures }) {
  const bankLines = MOCK_BANK_LINES;
  const [pairs, setPairs] = useState({});       // bankLineId → factureId
  const [ignored, setIgnored] = useState({});   // bankLineId → true
  const [activeLine, setActiveLine] = useState(null);
  const [filter, setFilter] = useState("all");

  const pendingFactures = useMemo(
    () => factures.filter(f => f.paiement !== "payée" && f.statut === "traité"),
    [factures]
  );

  const matchedBankIds = new Set(Object.keys(pairs));
  const matchedFactureIds = new Set(Object.values(pairs));

  const stats = useMemo(() => {
    const total = bankLines.length;
    const matched = matchedBankIds.size;
    const ign = Object.keys(ignored).length;
    return { total, matched, pending: total - matched - ign, ign };
  }, [bankLines, matchedBankIds, ignored]);

  const pct = Math.round((stats.matched / (stats.total || 1)) * 100);

  const linesToShow = bankLines.filter(l => {
    if (filter === "matched") return matchedBankIds.has(String(l.id));
    if (filter === "pending") return !matchedBankIds.has(String(l.id)) && !ignored[l.id];
    if (filter === "ignored") return !!ignored[l.id];
    return true;
  });

  const autoMatch = () => {
    const newPairs = { ...pairs };
    bankLines.forEach(bl => {
      if (newPairs[bl.id] || ignored[bl.id]) return;
      const match = pendingFactures.find(f =>
        !matchedFactureIds.has(String(f.id)) &&
        Math.abs((f.montant_ttc || 0) - Math.abs(bl.montant)) < 1
      );
      if (match) newPairs[bl.id] = String(match.id);
    });
    setPairs(newPairs);
  };

  const linkPair = (bankId, factureId) => {
    setPairs(p => ({ ...p, [bankId]: factureId }));
    setActiveLine(null);
  };

  const unlink = (bankId) => {
    setPairs(p => { const n = { ...p }; delete n[bankId]; return n; });
  };

  const ignoreToggle = (bankId) => {
    setIgnored(p => {
      const n = { ...p };
      if (n[bankId]) delete n[bankId];
      else n[bankId] = true;
      return n;
    });
  };

  const paired = bankLines.filter(l => pairs[l.id]);
  const totalBankMatched = paired.reduce((s, l) => s + Math.abs(l.montant), 0);
  const totalFactureMatched = paired.reduce((s, l) => {
    const f = factures.find(f => String(f.id) === String(pairs[l.id]));
    return s + (f?.montant_ttc || 0);
  }, 0);

  return (
    <div className="page-inner">
      <div className="page-header">
        <div>
          <h1 className="page-title">Réconciliation bancaire</h1>
          <p className="page-subtitle">Rapprochement relevé BMCE · {bankLines.length} lignes</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={autoMatch}><RefreshCw size={13} /> Auto-match</button>
        </div>
      </div>

      {/* Progress */}
      <div className="card" style={{ padding: "16px 20px", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
              <span style={{ color: "var(--ink-2)" }}>Progression du rapprochement</span>
              <span className="mono tabular" style={{ fontWeight: 600 }}>{pct}%</span>
            </div>
            <div style={{ height: 6, background: "var(--bg-inset)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "var(--pos-ink)" : "var(--accent)", borderRadius: 3, transition: "width 0.5s" }} />
            </div>
          </div>
          {[
            { label: "Rapprochées", val: stats.matched, color: "var(--pos-ink)" },
            { label: "En attente",  val: stats.pending, color: "var(--warn-ink)" },
            { label: "Ignorées",    val: stats.ign,     color: "var(--ink-3)" },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center", minWidth: 64 }}>
              <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.03em", color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 11, color: "var(--ink-2)" }}>{s.label}</div>
            </div>
          ))}
        </div>
        {stats.matched > 0 && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line-1)", display: "flex", gap: 24, fontSize: 12 }}>
            <span style={{ color: "var(--ink-2)" }}>Relevé rapproché · <span className="mono tabular" style={{ color: "var(--ink-0)" }}>{formatMAD(totalBankMatched).split(",")[0]} MAD</span></span>
            <span style={{ color: "var(--ink-2)" }}>Factures liées · <span className="mono tabular" style={{ color: "var(--ink-0)" }}>{formatMAD(totalFactureMatched).split(",")[0]} MAD</span></span>
            <AmountDiff a={totalBankMatched} b={totalFactureMatched} />
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        {[["all", "Tout"], ["pending", `En attente (${stats.pending})`], ["matched", `Rapprochées (${stats.matched})`], ["ignored", "Ignorées"]].map(([k, l]) => (
          <button key={k} className={`chip${filter === k ? " active" : ""}`} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: activeLine ? "1fr 1fr" : "1fr", gap: 12 }}>
        {/* Bank lines */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-1)", fontSize: 13, fontWeight: 500 }}>
            Lignes de relevé
          </div>
          <div style={{ overflowY: "auto", maxHeight: 520 }}>
            {linesToShow.map(line => {
              const matchedFactureId = pairs[line.id];
              const matchedF = matchedFactureId ? factures.find(f => String(f.id) === String(matchedFactureId)) : null;
              const isIgnored = !!ignored[line.id];
              const isActive = activeLine === line.id;
              return (
                <div key={line.id}
                  style={{
                    padding: "12px 16px", borderBottom: "1px solid var(--line-1)",
                    background: isActive ? "var(--accent-bg)" : matchedF ? "var(--pos-bg)" : isIgnored ? "var(--bg-inset)" : "var(--bg-1)",
                    opacity: isIgnored ? 0.55 : 1,
                    cursor: matchedF || isIgnored ? "default" : "pointer",
                    transition: "background 120ms",
                  }}
                  onClick={() => !matchedF && !isIgnored && setActiveLine(isActive ? null : line.id)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 2 }}>{line.libelle}</div>
                      <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{formatDate(line.date)} · <span className="mono">{line.reference}</span></div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div className="mono tabular" style={{ fontSize: 13, fontWeight: 600, color: line.montant < 0 ? "var(--neg-ink)" : "var(--pos-ink)" }}>
                        {line.montant < 0 ? "−" : "+"}{formatMAD(Math.abs(line.montant)).split(",")[0]}
                      </div>
                      <div style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 2 }}>MAD</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                      {matchedF ? (
                        <button className="icon-btn" title="Délier" onClick={() => unlink(line.id)} style={{ color: "var(--pos-ink)" }}>
                          <X size={12} />
                        </button>
                      ) : !isIgnored ? (
                        <ChevronRight size={14} style={{ color: isActive ? "var(--accent-ink)" : "var(--ink-3)" }} />
                      ) : null}
                      <button className="icon-btn" title={isIgnored ? "Restaurer" : "Ignorer"} onClick={() => ignoreToggle(line.id)}
                        style={{ color: isIgnored ? "var(--accent-ink)" : "var(--ink-3)", fontSize: 10 }}>
                        {isIgnored ? "↩" : "—"}
                      </button>
                    </div>
                  </div>
                  {matchedF && (
                    <div style={{ marginTop: 8, padding: "6px 10px", background: "var(--bg-1)", borderRadius: 6, fontSize: 11.5, display: "flex", gap: 10, alignItems: "center" }}>
                      <Check size={12} style={{ color: "var(--pos-ink)", flexShrink: 0 }} />
                      <span style={{ fontWeight: 500 }}>{matchedF.fournisseur}</span>
                      <span style={{ color: "var(--ink-2)" }}>{matchedF.num_facture}</span>
                      <span className="mono tabular" style={{ marginLeft: "auto" }}>{formatMAD(matchedF.montant_ttc).split(",")[0]}</span>
                      <AmountDiff a={Math.abs(line.montant)} b={matchedF.montant_ttc || 0} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Factures panel for linking */}
        {activeLine && (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-1)", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>Lier à une facture</div>
              <button className="icon-btn" onClick={() => setActiveLine(null)}><X size={14} /></button>
            </div>
            <div style={{ overflowY: "auto", maxHeight: 520 }}>
              {pendingFactures.filter(f => !matchedFactureIds.has(String(f.id))).map(f => (
                <div key={f.id}
                  style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-1)", cursor: "pointer" }}
                  onClick={() => linkPair(activeLine, f.id)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 2 }}>{f.fournisseur}</div>
                      <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{f.num_facture} · {formatDateShort(f.date_echeance)}</div>
                    </div>
                    <div className="mono tabular" style={{ fontSize: 13, fontWeight: 600 }}>{formatMAD(f.montant_ttc).split(",")[0]}</div>
                  </div>
                  {activeLine && bankLines.find(b => b.id === activeLine) && (
                    <div style={{ marginTop: 6 }}>
                      <AmountDiff a={Math.abs(bankLines.find(b => b.id === activeLine).montant)} b={f.montant_ttc || 0} />
                    </div>
                  )}
                </div>
              ))}
              {pendingFactures.filter(f => !matchedFactureIds.has(String(f.id))).length === 0 && (
                <div style={{ padding: 40, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>Toutes les factures sont rapprochées.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
