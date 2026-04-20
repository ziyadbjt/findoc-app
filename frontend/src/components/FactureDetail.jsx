import { useState, useEffect } from "react";
import { X, FileText, Sparkles, AlertTriangle, Download, Check, Database, Upload, Edit2, MoreHorizontal, ArrowRight } from "lucide-react";
import { formatMAD, formatDate } from "../utils/format";

export default function FactureDetail({ facture, ecritures, onClose, onUpdate }) {
  const [activeField, setActiveField] = useState(null);
  const [localF, setLocalF] = useState(facture);
  const [editing, setEditing] = useState(null);

  useEffect(() => { setLocalF(facture); }, [facture?.id]);

  if (!facture) return null;

  const update = (key, value) => {
    const next = { ...localF, [key]: value };
    if (key === "montant_ht" || key === "tva_taux") {
      next.tva = +(next.montant_ht * next.tva_taux / 100).toFixed(2);
      next.montant_ttc = +(next.montant_ht + next.tva).toFixed(2);
    }
    setLocalF(next);
    onUpdate?.(next);
  };

  const boxes = {
    fournisseur:  { top: 78,  left: 48,  width: 220, height: 20 },
    num_facture:  { top: 90,  left: 338, width: 140, height: 16 },
    date_facture: { top: 114, left: 338, width: 130, height: 14 },
    montant_ht:   { top: 520, left: 340, width: 140, height: 16 },
    tva:          { top: 542, left: 340, width: 140, height: 16 },
    montant_ttc:  { top: 568, left: 340, width: 140, height: 20 },
  };

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-head">
          <button className="icon-btn" onClick={onClose}><X size={15} /></button>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, background: "var(--bg-inset)", display: "grid", placeItems: "center" }}><FileText size={14} /></div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }} className="truncate">{localF.fournisseur || "Extraction…"}</div>
              <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{localF.nom_fichier} · {localF.num_facture}</div>
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            {localF.confidence > 0 && (
              <span className={`badge ${localF.confidence > 0.94 ? "pos" : "warn"}`}>
                <Sparkles size={11} />
                <span className="mono tabular">{Math.round(localF.confidence * 100)}%</span> confiance
              </span>
            )}
            <button className="btn btn-ghost sm"><Download size={13} /> PDF</button>
            <button className="btn btn-secondary sm"><Check size={13} /> Valider</button>
            <button className="icon-btn"><MoreHorizontal size={15} /></button>
          </div>
        </div>

        <div className="drawer-body" style={{ display: "grid", gridTemplateColumns: "minmax(440px, 1fr) minmax(440px, 1fr)", minHeight: 0 }}>
          <div className="pdf-stage">
            <div className="pdf-page">
              <PdfMock f={localF} activeField={activeField} boxes={boxes} />
            </div>
          </div>

          <div style={{ padding: "20px 24px", overflowY: "auto", borderLeft: "1px solid var(--line-0)", background: "var(--bg-0)" }}>
            {localF.paiement === "en_retard" && (
              <div style={{ padding: 12, background: "var(--warn-bg)", border: "1px solid var(--warn)", borderRadius: 10, marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-start" }}>
                <AlertTriangle size={16} style={{ color: "var(--warn-ink)", flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--warn-ink)" }}>Retard de paiement</div>
                  <div style={{ fontSize: 11.5, color: "var(--warn-ink)", marginTop: 2, opacity: 0.85 }}>
                    Retard de paiement · pénalité calculée au taux BAM 2,25% + 7 pts
                  </div>
                </div>
                <button className="btn sm" style={{ marginLeft: "auto", color: "var(--warn-ink)", background: "transparent", border: "1px solid var(--warn)" }}>
                  Relancer <ArrowRight size={11} />
                </button>
              </div>
            )}

            <div style={{ fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 0.06, marginBottom: 10, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
              <Sparkles size={11} style={{ color: "var(--accent)" }} /> Champs extraits
            </div>

            <FieldsTable f={localF} onFocus={setActiveField} editing={editing} setEditing={setEditing} onUpdate={update} />

            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 0.06, marginBottom: 10, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                <Database size={11} /> Écritures générées · PCM Maroc
                <span style={{ marginLeft: "auto", fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "var(--ink-2)" }}>Journal <span className="mono">ACH</span></span>
              </div>
              <Ledger rows={ecritures || []} />
              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                <button className="btn btn-secondary sm"><Edit2 size={12} /> Modifier comptes</button>
                <button className="btn btn-ghost sm"><Download size={12} /> Exporter ligne</button>
              </div>
            </div>

            <div style={{ marginTop: 28 }}>
              <div style={{ fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 0.06, marginBottom: 10, fontWeight: 500 }}>Historique</div>
              {[
                { icon: <Upload size={11} />, t: "Fichier uploadé",          by: "Ziyad B.", ts: "il y a 28 min" },
                { icon: <Sparkles size={11} />, t: "Extraction Claude · " + Math.round((localF.confidence || 0.95) * 100) + "%", by: "IA", ts: "il y a 28 min" },
                { icon: <Database size={11} />, t: "Écritures générées",     by: "IA",       ts: "il y a 28 min" },
                { icon: <Check size={11} />, t: "Validée par Senior",         by: "Ziyad B.", ts: "il y a 14 min" },
              ].map((h, i) => (
                <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: i < 3 ? "1px solid var(--line-1)" : 0, fontSize: 12 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 99, background: "var(--bg-inset)", display: "grid", placeItems: "center", color: "var(--ink-2)", flexShrink: 0 }}>{h.icon}</div>
                  <div style={{ flex: 1 }}>{h.t}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{h.by} · {h.ts}</div>
                </div>
              ))}
            </div>
            <div style={{ height: 40 }} />
          </div>
        </div>
      </div>
    </>
  );
}

function PdfMock({ f, activeField, boxes }) {
  const box = (key) => {
    const b = boxes[key]; if (!b) return null;
    return (
      <div key={key} className={`pdf-field-box${activeField === key ? " active" : ""}`}
        style={{ top: b.top, left: b.left, width: b.width, height: b.height }}>
        {activeField === key && <div className="pdf-field-label">{key.replace("_", " ")}</div>}
      </div>
    );
  };
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{f.fournisseur || "——————"}</div>
          <div style={{ color: "#555", fontSize: 10.5, marginTop: 4 }}>12 rue des Ingénieurs, Casablanca</div>
          <div style={{ color: "#555", fontSize: 10.5 }}>ICE · <span style={{ fontFamily: "var(--font-mono)" }}>001789456000012</span></div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 700, fontSize: 20, color: "#111", letterSpacing: "0.05em" }}>FACTURE</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, marginTop: 6 }}>N° {f.num_facture}</div>
          <div style={{ fontSize: 10.5, color: "#555", marginTop: 2 }}>Date · {formatDate(f.date_facture)}</div>
          <div style={{ fontSize: 10.5, color: "#555" }}>Échéance · {formatDate(f.date_echeance)}</div>
        </div>
      </div>
      <div style={{ height: 1, background: "#eee", marginBottom: 14 }} />
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.08 }}>Facturé à</div>
        <div style={{ fontWeight: 600, fontSize: 12, color: "#111", marginTop: 3 }}>CLIENT</div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5, marginBottom: 20 }}>
        <thead>
          <tr style={{ borderBottom: "1.5px solid #222" }}>
            <th style={{ textAlign: "left", padding: "6px 4px", fontWeight: 600 }}>Désignation</th>
            <th style={{ textAlign: "right", padding: "6px 4px", fontWeight: 600, width: 90 }}>Montant HT</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: "1px solid #eee" }}>
            <td style={{ padding: "6px 4px" }}>Prestation de services</td>
            <td style={{ padding: "6px 4px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
              {(f.montant_ht || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}
            </td>
          </tr>
        </tbody>
      </table>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 20 }}>
        <div style={{ fontSize: 9.5, color: "#666" }}>
          Règlement à 30 jours · En cas de retard, délai contractuel applicable.
        </div>
        <div style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: "#555" }}>
            <span>Total HT</span><span>{(f.montant_ht || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: "#555" }}>
            <span>TVA {f.tva_taux || 20}%</span><span>{(f.tva || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={{ borderTop: "1.5px solid #222", marginTop: 4, paddingTop: 6, display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 13 }}>
            <span>Total TTC</span><span>{(f.montant_ttc || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} MAD</span>
          </div>
        </div>
      </div>
      {Object.keys(boxes).map(k => box(k))}
    </>
  );
}

function FieldsTable({ f, onFocus, editing, setEditing, onUpdate }) {
  const rows = [
    { key: "fournisseur",   label: "Fournisseur",   value: f.fournisseur,                          conf: f.confidence,        editable: true },
    { key: "code_tiers",    label: "Code tiers",    value: f.code_tiers,                           conf: f.confidence - 0.05, editable: true, mono: true },
    { key: "num_facture",   label: "N° Facture",    value: f.num_facture,                          conf: f.confidence + 0.01, editable: true, mono: true },
    { key: "date_facture",  label: "Date facture",  value: formatDate(f.date_facture),             conf: f.confidence + 0.01, editable: false },
    { key: "date_echeance", label: "Échéance",      value: formatDate(f.date_echeance),            conf: f.confidence,        editable: false },
    { key: "montant_ht",    label: "Montant HT",    value: formatMAD(f.montant_ht) + " MAD",       conf: f.confidence + 0.02, editable: true, mono: true, raw: f.montant_ht },
    { key: "tva_taux",      label: "Taux TVA",      value: (f.tva_taux || 20) + "%",              conf: 1.0,                 editable: true, mono: true, raw: f.tva_taux },
    { key: "tva",           label: "Montant TVA",   value: formatMAD(f.tva) + " MAD",              conf: f.confidence + 0.02, editable: false, mono: true },
    { key: "montant_ttc",   label: "Montant TTC",   value: formatMAD(f.montant_ttc) + " MAD",      conf: f.confidence + 0.03, editable: false, mono: true, strong: true },
    { key: "compte_pcm",    label: "Compte PCM",    value: f.compte_pcm,                           conf: Math.max(0.75, f.confidence - 0.1), editable: true, mono: true },
    { key: "categorie",     label: "Catégorie",     value: f.categorie,                            conf: f.confidence - 0.1, editable: true },
  ];

  return (
    <div style={{ background: "var(--bg-1)", border: "1px solid var(--line-0)", borderRadius: 10, overflow: "hidden" }}>
      {rows.map((r, i) => (
        <div key={r.key}
          onMouseEnter={() => onFocus(r.key)}
          onMouseLeave={() => onFocus(null)}
          style={{ display: "grid", gridTemplateColumns: "135px 1fr auto", gap: 10, padding: "10px 14px", borderBottom: i < rows.length - 1 ? "1px solid var(--line-1)" : 0, alignItems: "center", fontSize: 13 }}>
          <div style={{ fontSize: 12, color: "var(--ink-2)" }}>{r.label}</div>
          <div>
            {r.editable && editing === r.key ? (
              <input autoFocus className="input"
                style={{ padding: "3px 8px", fontSize: 12.5, fontFamily: r.mono ? "var(--font-mono)" : "inherit" }}
                defaultValue={r.raw ?? r.value}
                onBlur={e => {
                  let v = e.target.value;
                  if (r.key === "montant_ht" || r.key === "tva_taux") v = parseFloat(v) || 0;
                  onUpdate(r.key, v);
                  setEditing(null);
                }}
                onKeyDown={e => e.key === "Enter" && e.target.blur()} />
            ) : (
              <span className={r.mono ? "mono tabular" : ""}
                style={{ color: "var(--ink-0)", fontWeight: r.strong ? 600 : 500, cursor: r.editable ? "text" : "default", padding: "3px 6px", margin: "-3px -6px", borderRadius: 4, display: "inline-block" }}
                onClick={() => r.editable && setEditing(r.key)}>
                {r.value || "—"}
              </span>
            )}
          </div>
          <div className="mono tabular" style={{ fontSize: 10.5, color: (r.conf || 0) > 0.94 ? "var(--pos-ink)" : (r.conf || 0) > 0.85 ? "var(--warn-ink)" : "var(--neg-ink)", fontWeight: 500 }}>
            {Math.round(Math.min(1, r.conf || 0) * 100)}%
          </div>
        </div>
      ))}
    </div>
  );
}

function Ledger({ rows }) {
  const debitSum = rows.reduce((s, r) => s + (r.debit || 0), 0);
  const creditSum = rows.reduce((s, r) => s + (r.credit || 0), 0);
  return (
    <div className="ledger">
      <div className="ledger-row head">
        <div>Compte</div><div>Journal</div><div>Libellé</div><div className="num">Débit</div><div className="num">Crédit</div>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="ledger-row">
          <div style={{ color: "var(--accent-ink)", fontWeight: 500 }}>{r.compte_pcm}</div>
          <div style={{ color: "var(--ink-2)" }}>ACH</div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 12 }}>{r.libelle}</div>
          <div className="num debit">{r.debit ? formatMAD(r.debit) : ""}</div>
          <div className="num credit">{r.credit ? formatMAD(r.credit) : ""}</div>
        </div>
      ))}
      <div className="ledger-total">
        <span className="k">Totaux</span>
        <span className="v">Débit {formatMAD(debitSum)}</span>
        <span className="v">Crédit {formatMAD(creditSum)}</span>
        {Math.abs(debitSum - creditSum) < 0.01 && (
          <span style={{ color: "var(--pos-ink)", background: "var(--pos-bg)", padding: "1px 7px", borderRadius: 4, fontSize: 10.5, textTransform: "uppercase", fontWeight: 500 }}>équilibré</span>
        )}
      </div>
    </div>
  );
}
