import { useState, useMemo, useRef } from "react";
import { Upload, Plus, Check, AlertTriangle, Clock, X, FileText } from "lucide-react";
import { formatMAD, formatDate, daysBetween } from "../utils/format";

const BAM_RATE   = 0.0225;
const PENALTY_RATE = BAM_RATE + 0.03;
const LEGAL_DELAY  = 60;

function calcPenalty(montant, overdueDays) {
  return (montant * PENALTY_RATE * Math.max(0, overdueDays - LEGAL_DELAY)) / 365;
}

// ─── Retards tab ──────────────────────────────────────────────────────────

function RetardsTab({ factures }) {
  const now = new Date();
  const overdue = useMemo(() =>
    factures
      .filter(f => f.paiement !== "payée" && f.date_echeance)
      .map(f => ({ ...f, overdueDays: Math.max(0, Math.floor((now - new Date(f.date_echeance)) / 86400000)) }))
      .filter(f => f.overdueDays > 0)
      .sort((a, b) => b.overdueDays - a.overdueDays),
    [factures]
  );

  const totalOverdue   = overdue.reduce((s,f) => s + (f.montant_ttc||0), 0);
  const totalPenalties = overdue.reduce((s,f) => s + calcPenalty(f.montant_ttc||0, f.overdueDays), 0);

  if (overdue.length === 0) {
    return (
      <div className="card" style={{ padding:40, textAlign:"center" }}>
        <Check size={28} style={{ color:"var(--pos-ink)", margin:"0 auto 12px" }} />
        <div style={{ fontSize:14, fontWeight:500, marginBottom:4 }}>Aucun retard détecté</div>
        <div style={{ fontSize:12.5, color:"var(--ink-2)" }}>Toutes les factures sont dans les délais réglementaires.</div>
      </div>
    );
  }

  return (
    <div>
      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:12 }}>
        {[
          { label:"Factures en retard",   val:overdue.length,              color:"var(--warn-ink)", unit:"" },
          { label:"Montant total dû",      val:formatMAD(totalOverdue).split(",")[0], color:"var(--ink-0)", unit:"MAD" },
          { label:"Pénalités de retard",   val:formatMAD(totalPenalties).split(",")[0], color:totalPenalties>1?"var(--neg-ink)":"var(--ink-3)", unit:"MAD" },
        ].map(k => (
          <div key={k.label} className="kpi">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value"><span className="tabular" style={{ color:k.color }}>{k.val}</span><span className="unit">{k.unit}</span></div>
          </div>
        ))}
      </div>

      {totalPenalties > 1 && (
        <div style={{ padding:"9px 14px", background:"var(--warn-bg)", borderRadius:9, fontSize:12, color:"var(--warn-ink)", marginBottom:12, display:"flex", gap:8, alignItems:"center" }}>
          <Clock size={13} />
          Pénalités calculées au taux BAM {(BAM_RATE*100).toFixed(2)}% + 3% = {((PENALTY_RATE)*100).toFixed(2)}%/an · délai légal {LEGAL_DELAY}j
        </div>
      )}

      <div className="card" style={{ padding:0, overflow:"hidden" }}>
        <table className="table">
          <thead>
            <tr>
              <th className="th">Fournisseur</th>
              <th className="th">N° Facture</th>
              <th className="th">Échéance</th>
              <th className="th right">Retard</th>
              <th className="th right">Montant TTC</th>
              <th className="th right">Pénalité</th>
              <th className="th">Statut</th>
            </tr>
          </thead>
          <tbody>
            {overdue.map(f => {
              const penalty   = calcPenalty(f.montant_ttc||0, f.overdueDays);
              const levelColor = f.overdueDays > 90 ? "var(--neg-ink)" : f.overdueDays > 30 ? "var(--warn-ink)" : "var(--accent-ink)";
              return (
                <tr key={f.id} className="tr-hover">
                  <td className="td" style={{ fontWeight:500 }}>{f.fournisseur||"—"}</td>
                  <td className="td mono" style={{ fontSize:11.5, color:"var(--ink-2)" }}>{f.num_facture||"—"}</td>
                  <td className="td">{formatDate(f.date_echeance)}</td>
                  <td className="td right tabular">
                    <span style={{ fontWeight:600, color:levelColor }}>+{f.overdueDays}j</span>
                  </td>
                  <td className="td right tabular" style={{ fontWeight:500 }}>{formatMAD(f.montant_ttc).split(",")[0]}</td>
                  <td className="td right tabular" style={{ color:penalty>0.5?"var(--neg-ink)":"var(--ink-3)" }}>
                    {penalty > 0.5 ? formatMAD(penalty).split(",")[0] : "—"}
                  </td>
                  <td className="td">
                    <span style={{
                      fontSize:11, fontWeight:500, padding:"2px 8px", borderRadius:99,
                      background: f.overdueDays > 90 ? "var(--neg-bg)" : f.overdueDays > 30 ? "var(--warn-bg)" : "var(--accent-bg)",
                      color: levelColor,
                    }}>
                      {f.overdueDays > 90 ? "Critique" : f.overdueDays > 30 ? "Retard" : "Récent"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop:"1.5px solid var(--line-1)", background:"var(--bg-inset)", fontWeight:600 }}>
              <td colSpan={4} className="td" style={{ fontSize:12 }}>Total · {overdue.length} factures</td>
              <td className="td right tabular">{formatMAD(totalOverdue).split(",")[0]}</td>
              <td className="td right tabular" style={{ color:"var(--neg-ink)" }}>{formatMAD(totalPenalties).split(",")[0]}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Conventions tab ──────────────────────────────────────────────────────

const EMPTY_FORM = { fournisseur:"", delai:"", date_validite:"", reference:"", notes:"" };

function ConventionsTab() {
  const [conventions, setConventions] = useState([]);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const [extracted, setExtracted] = useState(null);
  const [editIdx, setEditIdx]     = useState(null);
  const fileRef = useRef(null);

  const handlePDFUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    // Simulate Claude extraction
    setTimeout(() => {
      setExtracted({
        fournisseur: "CASATEX IMPEX SARL",
        delai: "120",
        date_validite: "2026-12-31",
        reference: "CONV-2024-047",
        notes: "Délai conventionne 120j — extrait automatiquement",
        confidence: { fournisseur:98, delai:95, date_validite:81, reference:99 },
      });
      setUploading(false);
    }, 1400);
  };

  const handleSave = () => {
    if (!form.fournisseur || !form.delai) return;
    if (editIdx !== null) {
      setConventions(c => c.map((x,i) => i===editIdx ? { ...form } : x));
      setEditIdx(null);
    } else {
      setConventions(c => [...c, { ...form }]);
    }
    setForm(EMPTY_FORM);
    setShowForm(false);
  };

  const handleValidateExtracted = () => {
    setConventions(c => [...c, {
      fournisseur: extracted.fournisseur,
      delai: extracted.delai,
      date_validite: extracted.date_validite,
      reference: extracted.reference,
      notes: extracted.notes,
    }]);
    setExtracted(null);
  };

  const startEdit = (i) => { setForm({ ...conventions[i] }); setEditIdx(i); setShowForm(true); };
  const remove    = (i) => setConventions(c => c.filter((_,j) => j !== i));

  const f = (key, label, type="text", placeholder="") => (
    <div key={key}>
      <label className="label">{label}</label>
      <input className="input" type={type} value={form[key]} placeholder={placeholder}
        onChange={e => setForm({ ...form, [key]: e.target.value })} />
    </div>
  );

  return (
    <div>
      {/* Upload zone */}
      <div className="card" style={{ padding:20, marginBottom:12 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div>
            <div className="card-title">Importer une convention PDF</div>
            <div style={{ fontSize:11.5, color:"var(--ink-2)", marginTop:2 }}>Claude extrait automatiquement le délai, la validité et le tiers</div>
          </div>
          <button className="btn btn-secondary" onClick={() => { setShowForm(true); setEditIdx(null); setForm(EMPTY_FORM); }}>
            <Plus size={13} /> Saisie manuelle
          </button>
        </div>
        <label className={`dropzone${uploading?" drag-over":""}`} style={{ cursor:"pointer", padding:24 }} onClick={()=>fileRef.current?.click()}>
          <div className="dropzone-icon"><FileText size={20}/></div>
          <div className="dropzone-title">{uploading ? "Analyse par Claude…" : "Déposer une convention PDF"}</div>
          <div className="dropzone-sub">{uploading ? <span className="mono" style={{ color:"var(--accent-ink)", fontSize:11 }}>●  Extraction en cours…</span> : "Cliquez ou glissez un contrat PDF"}</div>
          <input ref={fileRef} type="file" accept=".pdf" style={{ display:"none" }} onChange={handlePDFUpload} />
        </label>
      </div>

      {/* Extracted preview */}
      {extracted && (
        <div className="card" style={{ padding:20, marginBottom:12, borderColor:"var(--accent-line)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14, fontSize:13, fontWeight:500 }}>
            <span style={{ width:8, height:8, borderRadius:"50%", background:"var(--accent)", display:"inline-block" }} />
            Extraction Claude — vérifiez avant de valider
          </div>
          {[
            { key:"fournisseur", label:"Tiers" },
            { key:"delai",       label:"Délai conventionne (j)" },
            { key:"date_validite", label:"Date de validité" },
            { key:"reference",   label:"Référence contrat" },
          ].map(({ key, label }) => (
            <div key={key} style={{ display:"flex", alignItems:"center", gap:12, padding:"7px 0", borderBottom:"1px solid var(--line-1)" }}>
              <span style={{ fontSize:12, color:"var(--ink-2)", width:160, flexShrink:0 }}>{label}</span>
              <input className="input" defaultValue={extracted[key]} style={{ flex:1 }}
                onChange={e => setExtracted(x => ({ ...x, [key]: e.target.value }))} />
              <span style={{ fontSize:11, padding:"2px 8px", borderRadius:99, background:extracted.confidence[key]>=90?"var(--pos-bg)":"var(--warn-bg)", color:extracted.confidence[key]>=90?"var(--pos-ink)":"var(--warn-ink)", flexShrink:0 }}>
                {extracted.confidence[key]}%
              </span>
            </div>
          ))}
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:14 }}>
            <button className="btn btn-ghost" onClick={() => setExtracted(null)}>Ignorer</button>
            <button className="btn btn-primary" onClick={handleValidateExtracted}><Check size={13}/> Valider et enregistrer</button>
          </div>
        </div>
      )}

      {/* Manual form */}
      {showForm && (
        <div className="card" style={{ padding:20, marginBottom:12 }}>
          <div className="card-title" style={{ marginBottom:14 }}>{editIdx !== null ? "Modifier la convention" : "Nouvelle convention"}</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
            {f("fournisseur", "Nom du fournisseur", "text", "ATLAS INDUSTRIES SARL")}
            {f("delai", "Délai conventionne (jours)", "number", "120")}
            {f("date_validite", "Date de validité", "date")}
            {f("reference", "Référence contrat", "text", "CONV-2024-001")}
          </div>
          <div style={{ marginBottom:14 }}>
            <label className="label">Notes</label>
            <input className="input" value={form.notes} placeholder="Observations…" onChange={e => setForm({ ...form, notes:e.target.value })} />
          </div>
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
            <button className="btn btn-ghost" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setEditIdx(null); }}>Annuler</button>
            <button className="btn btn-primary" disabled={!form.fournisseur||!form.delai} onClick={handleSave}>
              {editIdx !== null ? "Mettre à jour" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}

      {/* Conventions list */}
      {conventions.length > 0 ? (
        <div className="card" style={{ padding:0, overflow:"hidden" }}>
          <table className="table">
            <thead>
              <tr>
                <th className="th">Fournisseur</th>
                <th className="th right">Délai (j)</th>
                <th className="th">Validité</th>
                <th className="th">Référence</th>
                <th className="th">Notes</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody>
              {conventions.map((c, i) => (
                <tr key={i} className="tr-hover">
                  <td className="td" style={{ fontWeight:500 }}>{c.fournisseur}</td>
                  <td className="td right tabular">
                    <span style={{ fontWeight:600, color:"var(--accent-ink)", background:"var(--accent-bg)", padding:"2px 8px", borderRadius:99, fontSize:12 }}>{c.delai}j</span>
                  </td>
                  <td className="td">{c.date_validite ? new Date(c.date_validite).toLocaleDateString("fr-FR") : "—"}</td>
                  <td className="td mono" style={{ fontSize:11.5, color:"var(--ink-2)" }}>{c.reference||"—"}</td>
                  <td className="td" style={{ fontSize:12, color:"var(--ink-2)" }}>{c.notes||"—"}</td>
                  <td className="td" style={{ textAlign:"right" }}>
                    <button className="btn btn-ghost sm" style={{ fontSize:11, marginRight:4 }} onClick={() => startEdit(i)}>Modifier</button>
                    <button className="icon-btn" onClick={() => remove(i)}><X size={13}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !showForm && !extracted && (
        <div className="card" style={{ padding:40, textAlign:"center" }}>
          <div style={{ fontSize:13, color:"var(--ink-3)" }}>Aucune convention enregistrée. Uploadez un PDF ou utilisez la saisie manuelle.</div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function DelaiPaiementPage({ factures }) {
  const [tab, setTab] = useState("retards");
  const TABS = [{ key:"retards", label:"Retards" }, { key:"conventions", label:"Conventions" }];

  return (
    <div className="page-inner">
      <div className="page-header">
        <div>
          <h1 className="page-title">Délai de paiement</h1>
          <p className="page-subtitle">Analyse des retards et conventions</p>
        </div>
      </div>

      <div style={{ display:"flex", gap:2, marginBottom:14, borderBottom:"1px solid var(--line-0)" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding:"9px 16px", fontSize:13, fontWeight:tab===t.key?500:400, color:tab===t.key?"var(--ink-0)":"var(--ink-2)", background:"transparent", border:"none", borderBottom:tab===t.key?"2px solid var(--accent)":"2px solid transparent", marginBottom:-1, cursor:"pointer" }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "retards"     && <RetardsTab factures={factures} />}
      {tab === "conventions" && <ConventionsTab />}
    </div>
  );
}
