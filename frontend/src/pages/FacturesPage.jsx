import { useState, useRef, useCallback } from "react";
import { Upload, Download, Search, X, FileText, Sparkles, Check, RefreshCw, ChevronRight } from "lucide-react";
import { formatMAD, formatDate, formatDateShort, enrichFacture } from "../utils/format";
import { uploadFactures, exportJournal, MOCK_BANK_LINES } from "../api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import FactureDetail from "../components/FactureDetail";

const TABS = [
  { key: "achats",  label: "Achats" },
  { key: "ventes",  label: "Ventes" },
  { key: "banque",  label: "Banque" },
  { key: "tpe",     label: "TPE" },
];

function StatutBadge({ statut }) {
  const map = {
    "traité":    { cls: "badge pos",    label: "Traité" },
    "à_valider": { cls: "badge warn",   label: "À valider" },
    "extraction":{ cls: "badge accent", label: "Extraction" },
    "erreur":    { cls: "badge neg",    label: "Erreur" },
  };
  const { cls, label } = map[statut] || { cls: "badge", label: statut };
  return <span className={cls}>{label}</span>;
}

function PaiementBadge({ paiement }) {
  const map = {
    "payée":      { cls: "badge pos", label: "Payée" },
    "en_attente": { cls: "badge",     label: "En attente" },
    "en_retard":  { cls: "badge neg", label: "En retard" },
  };
  const { cls, label } = map[paiement] || { cls: "badge", label: paiement || "—" };
  return <span className={cls}>{label}</span>;
}

// ─── Banque (réconciliation) ───────────────────────────────────────────────

function AmountDiff({ a, b }) {
  const diff = Math.abs(a - b);
  if (diff < 1) return <span style={{ color: "var(--pos-ink)", fontSize: 11 }}>✓ exact</span>;
  return <span style={{ color: "var(--warn-ink)", fontSize: 11 }}>Δ {formatMAD(diff).split(",")[0]}</span>;
}

function BanqueTab({ factures }) {
  const bankLines = MOCK_BANK_LINES;
  const [pairs, setPairs]     = useState({});
  const [ignored, setIgnored] = useState({});
  const [activeLine, setActiveLine] = useState(null);
  const [filter, setFilter]   = useState("all");

  const pendingFactures = factures.filter(f => f.paiement !== "payée" && f.statut === "traité");
  const matchedBankIds    = new Set(Object.keys(pairs));
  const matchedFactureIds = new Set(Object.values(pairs));

  const matched = matchedBankIds.size;
  const ign     = Object.keys(ignored).length;
  const pending = bankLines.length - matched - ign;
  const pct     = Math.round((matched / (bankLines.length || 1)) * 100);

  const autoMatch = () => {
    const np = { ...pairs };
    bankLines.forEach(bl => {
      if (np[bl.id] || ignored[bl.id]) return;
      const m = pendingFactures.find(f =>
        !matchedFactureIds.has(String(f.id)) &&
        Math.abs((f.montant_ttc || 0) - Math.abs(bl.montant)) < 1
      );
      if (m) np[bl.id] = String(m.id);
    });
    setPairs(np);
  };

  const linesToShow = bankLines.filter(l => {
    if (filter === "matched") return matchedBankIds.has(String(l.id));
    if (filter === "pending") return !matchedBankIds.has(String(l.id)) && !ignored[l.id];
    if (filter === "ignored") return !!ignored[l.id];
    return true;
  });

  const paired = bankLines.filter(l => pairs[l.id]);
  const totalBank    = paired.reduce((s, l) => s + Math.abs(l.montant), 0);
  const totalFacture = paired.reduce((s, l) => {
    const f = factures.find(f => String(f.id) === String(pairs[l.id]));
    return s + (f?.montant_ttc || 0);
  }, 0);

  return (
    <div>
      {/* Progress */}
      <div className="card" style={{ padding: "14px 18px", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12 }}>
              <span style={{ color: "var(--ink-2)" }}>Rapprochement</span>
              <span className="mono tabular" style={{ fontWeight: 600 }}>{pct}%</span>
            </div>
            <div style={{ height: 5, background: "var(--bg-inset)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "var(--pos-ink)" : "var(--accent)", borderRadius: 3, transition: "width 0.5s" }} />
            </div>
          </div>
          {[{ label: "Rapprochées", val: matched, color: "var(--pos-ink)" }, { label: "En attente", val: pending, color: "var(--warn-ink)" }, { label: "Ignorées", val: ign, color: "var(--ink-3)" }].map(s => (
            <div key={s.label} style={{ textAlign: "center", minWidth: 56 }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 11, color: "var(--ink-2)" }}>{s.label}</div>
            </div>
          ))}
          <button className="btn btn-secondary" onClick={autoMatch}><RefreshCw size={13} /> Auto-match</button>
        </div>
        {matched > 0 && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line-1)", display: "flex", gap: 20, fontSize: 12 }}>
            <span style={{ color: "var(--ink-2)" }}>Relevé · <span className="mono tabular" style={{ color: "var(--ink-0)" }}>{formatMAD(totalBank).split(",")[0]} MAD</span></span>
            <span style={{ color: "var(--ink-2)" }}>Factures · <span className="mono tabular" style={{ color: "var(--ink-0)" }}>{formatMAD(totalFacture).split(",")[0]} MAD</span></span>
            <AmountDiff a={totalBank} b={totalFacture} />
          </div>
        )}
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        {[["all","Tout"], ["pending",`En attente (${pending})`], ["matched",`Rapprochées (${matched})`], ["ignored","Ignorées"]].map(([k,l]) => (
          <button key={k} className={`chip${filter===k?" active":""}`} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: activeLine ? "1fr 1fr" : "1fr", gap: 12 }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "11px 16px", borderBottom: "1px solid var(--line-1)", fontSize: 13, fontWeight: 500 }}>Lignes de relevé</div>
          <div style={{ overflowY: "auto", maxHeight: 480 }}>
            {linesToShow.map(line => {
              const mfId = pairs[line.id];
              const mf   = mfId ? factures.find(f => String(f.id) === String(mfId)) : null;
              const isIg = !!ignored[line.id];
              const isAc = activeLine === line.id;
              return (
                <div key={line.id}
                  style={{ padding: "11px 16px", borderBottom: "1px solid var(--line-1)", background: isAc ? "var(--accent-bg)" : mf ? "var(--pos-bg)" : isIg ? "var(--bg-inset)" : "var(--bg-1)", opacity: isIg ? 0.55 : 1, cursor: mf || isIg ? "default" : "pointer" }}
                  onClick={() => !mf && !isIg && setActiveLine(isAc ? null : line.id)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 2 }}>{line.libelle}</div>
                      <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{formatDate(line.date)} · <span className="mono">{line.reference}</span></div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="mono tabular" style={{ fontSize: 13, fontWeight: 600, color: line.montant < 0 ? "var(--neg-ink)" : "var(--pos-ink)" }}>
                        {line.montant < 0 ? "−" : "+"}{formatMAD(Math.abs(line.montant)).split(",")[0]}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {mf ? <button className="icon-btn" onClick={() => setPairs(p => { const n={...p}; delete n[line.id]; return n; })}><X size={12} /></button>
                           : !isIg && <ChevronRight size={14} style={{ color: isAc ? "var(--accent-ink)" : "var(--ink-3)" }} />}
                      <button className="icon-btn" style={{ fontSize: 10 }} onClick={() => setIgnored(p => { const n={...p}; if(n[line.id]) delete n[line.id]; else n[line.id]=true; return n; })}>
                        {isIg ? "↩" : "—"}
                      </button>
                    </div>
                  </div>
                  {mf && (
                    <div style={{ marginTop: 7, padding: "5px 10px", background: "var(--bg-1)", borderRadius: 6, fontSize: 11.5, display: "flex", gap: 8, alignItems: "center" }}>
                      <Check size={12} style={{ color: "var(--pos-ink)" }} />
                      <span style={{ fontWeight: 500 }}>{mf.fournisseur}</span>
                      <span style={{ color: "var(--ink-2)" }}>{mf.num_facture}</span>
                      <span className="mono tabular" style={{ marginLeft: "auto" }}>{formatMAD(mf.montant_ttc).split(",")[0]}</span>
                      <AmountDiff a={Math.abs(line.montant)} b={mf.montant_ttc||0} />
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
              <div style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>Lier à une facture</div>
              <button className="icon-btn" onClick={() => setActiveLine(null)}><X size={14} /></button>
            </div>
            <div style={{ overflowY: "auto", maxHeight: 480 }}>
              {pendingFactures.filter(f => !matchedFactureIds.has(String(f.id))).map(f => (
                <div key={f.id} style={{ padding: "11px 16px", borderBottom: "1px solid var(--line-1)", cursor: "pointer" }}
                  onClick={() => { setPairs(p => ({ ...p, [activeLine]: f.id })); setActiveLine(null); }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 500 }}>{f.fournisseur}</div>
                      <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{f.num_facture} · {formatDateShort(f.date_echeance)}</div>
                    </div>
                    <div className="mono tabular" style={{ fontSize: 13, fontWeight: 600 }}>{formatMAD(f.montant_ttc).split(",")[0]}</div>
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

// ─── TPE ──────────────────────────────────────────────────────────────────

function TPETab() {
  return (
    <div className="card" style={{ padding: 40, textAlign: "center" }}>
      <div style={{ fontSize: 28, marginBottom: 12 }}>💳</div>
      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Terminal de Paiement Électronique</div>
      <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>Connectez votre TPE pour importer automatiquement les transactions.</div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export default function FacturesPage({ factures, dossierId, onRefresh, ecritures, layout }) {
  const { token }  = useAuth();
  const toast      = useToast();
  const [tab, setTab]       = useState("achats");
  const [q, setQ]           = useState("");
  const [statutFilter, setStatutFilter] = useState("toutes");
  const [sortCol, setSortCol] = useState("date_facture");
  const [sortDir, setSortDir] = useState("desc");
  const [selected, setSelected] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [dragging, setDragging]    = useState(false);
  const [uploading, setUploading]  = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]);
  const fileRef = useRef(null);

  const tabFactures = factures.filter(f =>
    tab === "achats" ? (f.type || "achat") === "achat"
    : tab === "ventes" ? f.type === "vente"
    : true
  );

  const STATUTS = ["toutes", "traité", "à_valider", "en_retard"];
  const filtered = tabFactures
    .filter(f => {
      if (statutFilter !== "toutes" && f.statut !== statutFilter && !(statutFilter === "en_retard" && f.paiement === "en_retard")) return false;
      if (q.trim()) {
        const qq = q.toLowerCase();
        if (!(f.fournisseur||"").toLowerCase().includes(qq) && !(f.num_facture||"").toLowerCase().includes(qq) && !(f.code_tiers||"").toLowerCase().includes(qq)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      let va = a[sortCol], vb = b[sortCol];
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      return va < vb ? (sortDir==="asc"?-1:1) : va > vb ? (sortDir==="asc"?1:-1) : 0;
    });

  const sort = (col) => { if (sortCol===col) setSortDir(d=>d==="asc"?"desc":"asc"); else { setSortCol(col); setSortDir("asc"); } };
  const Th = ({ col, children, right }) => (
    <th className={`th${right?" right":""}`} onClick={() => sort(col)} style={{ cursor:"pointer", userSelect:"none" }}>
      {children}{sortCol===col?(sortDir==="asc"?" ↑":" ↓"):""}
    </th>
  );

  const handleDrop = useCallback(e => { e.preventDefault(); setDragging(false); setUploadFiles([...e.dataTransfer.files].filter(f=>f.type==="application/pdf")); }, []);
  const handleUpload = async () => {
    if (!uploadFiles.length) return;
    setUploading(true);
    try {
      await uploadFactures(token, dossierId, uploadFiles);
      toast(`${uploadFiles.length} facture(s) traitée(s)`, "pos");
      setShowUpload(false); setUploadFiles([]); onRefresh();
    } catch { toast("Erreur upload", "neg"); }
    finally { setUploading(false); }
  };
  const handleExport = async () => {
    try {
      const res = await exportJournal(token, dossierId);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a"); a.href=url; a.download=`journal_${dossierId}.xlsx`; a.click();
      toast("Export SAGE 100 généré", "pos");
    } catch { toast("Erreur export", "neg"); }
  };

  const totalTTC = filtered.reduce((s,f)=>s+(f.montant_ttc||0),0);

  return (
    <div className="page-inner">
      <div className="page-header">
        <div>
          <h1 className="page-title">Factures</h1>
          <p className="page-subtitle">{factures.length} total · {formatMAD(factures.reduce((s,f)=>s+(f.montant_ttc||0),0))} MAD</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={handleExport}><Download size={13} /> SAGE 100</button>
          <button className="btn btn-primary" onClick={() => setShowUpload(true)}><Upload size={13} /> Uploader</button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 14, borderBottom: "1px solid var(--line-0)", paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: "9px 16px", fontSize: 13, fontWeight: tab===t.key ? 500 : 400, color: tab===t.key ? "var(--ink-0)" : "var(--ink-2)", background: "transparent", border: "none", borderBottom: tab===t.key ? "2px solid var(--accent)" : "2px solid transparent", marginBottom: -1, cursor: "pointer", transition: "color 120ms" }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "banque" && <BanqueTab factures={factures} />}
      {tab === "tpe"    && <TPETab />}

      {(tab === "achats" || tab === "ventes") && (
        <>
          <div className="filter-bar">
            <div className="filter-search">
              <Search size={14} />
              <input placeholder="Fournisseur, N° facture…" value={q} onChange={e=>setQ(e.target.value)} />
              {q && <button className="icon-btn" style={{width:20,height:20}} onClick={()=>setQ("")}><X size={11}/></button>}
            </div>
            <div className="filter-chips">
              {STATUTS.map(s => (
                <button key={s} className={`chip${statutFilter===s?" active":""}`} onClick={()=>setStatutFilter(s)}>
                  {s==="toutes"?"Toutes":s==="traité"?"Traitées":s==="à_valider"?"À valider":"En retard"}
                </button>
              ))}
            </div>
            <div style={{ marginLeft:"auto", fontSize:11.5, color:"var(--ink-2)" }}>{filtered.length} résultat{filtered.length>1?"s":""}</div>
          </div>

          {layout === "cards" ? (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:10 }}>
              {filtered.map(f => (
                <button key={f.id} className="card" style={{ padding:16, textAlign:"left", cursor:"pointer" }} onClick={()=>setSelected(f)}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                    <div style={{ fontSize:12.5, fontWeight:500 }}>{f.fournisseur||"—"}</div>
                    <StatutBadge statut={f.statut} />
                  </div>
                  <div style={{ fontSize:11.5, color:"var(--ink-2)", marginBottom:8 }}>{f.num_facture} · {formatDate(f.date_facture)}</div>
                  <div style={{ fontSize:18, fontWeight:500 }}>{formatMAD(f.montant_ttc).split(",")[0]} <span style={{ fontSize:11, color:"var(--ink-2)" }}>MAD</span></div>
                  <div style={{ marginTop:8 }}><PaiementBadge paiement={f.paiement} /></div>
                </button>
              ))}
            </div>
          ) : (
            <div className="card" style={{ padding:0, overflow:"hidden" }}>
              <table className="table">
                <thead>
                  <tr>
                    <Th col="fournisseur">Fournisseur</Th>
                    <Th col="num_facture">N° Facture</Th>
                    <Th col="date_facture">Date</Th>
                    <Th col="date_echeance">Échéance</Th>
                    <Th col="code_tiers">Code tiers</Th>
                    <Th col="montant_ht" right>HT</Th>
                    <Th col="tva" right>TVA</Th>
                    <Th col="montant_ttc" right>TTC</Th>
                    <th className="th">Statut</th>
                    <th className="th">Paiement</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && <tr><td colSpan={10} style={{ textAlign:"center", padding:40, color:"var(--ink-3)", fontSize:13 }}>Aucune facture</td></tr>}
                  {filtered.map(f => (
                    <tr key={f.id} className="tr-hover" onClick={()=>setSelected(f)} style={{ cursor:"pointer" }}>
                      <td className="td" style={{ fontWeight:500 }}>{f.fournisseur||"—"}</td>
                      <td className="td mono" style={{ fontSize:11.5, color:"var(--ink-2)" }}>{f.num_facture||"—"}</td>
                      <td className="td">{formatDateShort(f.date_facture)}</td>
                      <td className="td" style={{ color:f.paiement==="en_retard"?"var(--neg-ink)":undefined }}>{formatDateShort(f.date_echeance)}</td>
                      <td className="td mono" style={{ fontSize:11, color:"var(--ink-2)" }}>{f.code_tiers||"—"}</td>
                      <td className="td right tabular">{formatMAD(f.montant_ht).split(",")[0]}</td>
                      <td className="td right tabular" style={{ color:"var(--ink-2)" }}>{formatMAD(f.tva).split(",")[0]}</td>
                      <td className="td right tabular" style={{ fontWeight:500 }}>{formatMAD(f.montant_ttc).split(",")[0]}</td>
                      <td className="td"><StatutBadge statut={f.statut} /></td>
                      <td className="td"><PaiementBadge paiement={f.paiement} /></td>
                    </tr>
                  ))}
                </tbody>
                {filtered.length > 0 && (
                  <tfoot>
                    <tr style={{ borderTop:"1px solid var(--line-1)", background:"var(--bg-inset)" }}>
                      <td colSpan={5} className="td" style={{ fontWeight:500, fontSize:12 }}>Total · {filtered.length} factures</td>
                      <td className="td right tabular" style={{ fontWeight:500 }}>{formatMAD(filtered.reduce((s,f)=>s+(f.montant_ht||0),0)).split(",")[0]}</td>
                      <td className="td right tabular" style={{ color:"var(--ink-2)", fontWeight:500 }}>{formatMAD(filtered.reduce((s,f)=>s+(f.tva||0),0)).split(",")[0]}</td>
                      <td className="td right tabular" style={{ fontWeight:600 }}>{formatMAD(totalTTC).split(",")[0]}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </>
      )}

      {/* Upload modal */}
      {showUpload && (
        <>
          <div className="scrim" onClick={()=>{setShowUpload(false);setUploadFiles([]);}} />
          <div className="modal">
            <div className="modal-head">
              <FileText size={16} /><div style={{ fontWeight:500, fontSize:14 }}>Uploader des factures</div>
              <button className="icon-btn" style={{ marginLeft:"auto" }} onClick={()=>{setShowUpload(false);setUploadFiles([]);}}><X size={15}/></button>
            </div>
            <div className="modal-body">
              <div className={`dropzone${dragging?" drag-over":""}`}
                onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={handleDrop}
                onClick={()=>fileRef.current?.click()}>
                <div className="dropzone-icon"><Upload size={20}/></div>
                <div className="dropzone-title">Glissez vos PDFs ici</div>
                <div className="dropzone-sub">ou cliquez · PDF uniquement</div>
                <input ref={fileRef} type="file" multiple accept=".pdf" style={{ display:"none" }} onChange={e=>setUploadFiles([...e.target.files])} />
              </div>
              {uploadFiles.length > 0 && (
                <div style={{ marginTop:12, display:"flex", flexDirection:"column", gap:6 }}>
                  {uploadFiles.map((f,i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 12px", background:"var(--bg-inset)", borderRadius:8, fontSize:12.5 }}>
                      <FileText size={13} style={{ color:"var(--accent-ink)" }} />
                      <span style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name}</span>
                      <span className="mono" style={{ fontSize:11, color:"var(--ink-3)" }}>{(f.size/1024).toFixed(0)} Ko</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={()=>{setShowUpload(false);setUploadFiles([]);}}>Annuler</button>
              <button className="btn btn-primary" disabled={!uploadFiles.length||uploading} onClick={handleUpload}>
                {uploading ? <><span className="spinner"/> Traitement…</> : <><Sparkles size={13}/> Extraire · {uploadFiles.length} fichier{uploadFiles.length>1?"s":""}</>}
              </button>
            </div>
          </div>
        </>
      )}

      {selected && (
        <FactureDetail facture={selected} ecritures={(ecritures||[]).filter(e=>e.facture_id===selected.id)}
          onClose={()=>setSelected(null)} onUpdate={()=>{setSelected(null);onRefresh();}} />
      )}
    </div>
  );
}
