import { useState, useEffect } from "react";
import { X, FileText, Sparkles, AlertTriangle, Download, Check, Database, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { formatMAD, formatDate } from "../utils/format";
import { useCorrection } from "../hooks/useCorrection";
import { getFactureFile, updateFacture } from "../api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Drawer from "./Drawer";

export default function FactureDetail({ facture, ecritures, onClose, onUpdate, dossierId, reviewQueue = [], onSelectFacture, onAdvanceAfterDecision }) {
  const [activeField, setActiveField] = useState(null);
  const [localF, setLocalF] = useState(facture);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filePreview, setFilePreview] = useState(null);
  const correct = useCorrection(dossierId);
  const { token } = useAuth();
  const toast = useToast();

  useEffect(() => { setLocalF(facture); }, [facture]);

  useEffect(() => {
    let active = true;
    let objectUrl = null;
    setFilePreview(null);

    if (!facture?.id || !token) return undefined;

    getFactureFile(token, facture.id)
      .then((response) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(response.data);
        setFilePreview({
          url: objectUrl,
          type: response.data.type || "",
        });
      })
      .catch(() => {
        if (active) setFilePreview({ error: true });
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [facture?.id, token]);

  const update = async (key, value, options = {}) => {
    const original = localF[key];
    const next = { ...localF, [key]: value };
    if (key === "montant_ht" || key === "tva_taux") {
      next.tva = +(next.montant_ht * next.tva_taux / 100).toFixed(2);
      next.montant_ttc = +(next.montant_ht + next.tva).toFixed(2);
    }
    setLocalF(next);
    setSaving(true);
    try {
      const payload = key === "tva_taux" ? { montant_ht: next.montant_ht, tva: next.tva, montant_ttc: next.montant_ttc } : { [key]: value };
      const response = await updateFacture(token, localF.id, payload);
      const saved = { ...next, ...response.data };
      setLocalF(saved);
      onUpdate?.(saved);
      if (options.advanceReview) onAdvanceAfterDecision?.(saved);
    } catch {
      setLocalF(localF);
      toast("Correction non sauvegardée", "neg");
    } finally {
      setSaving(false);
    }
    // Apprentissage automatique sur les champs clés
    if (["fournisseur", "compte_pcm", "code_tiers", "categorie"].includes(key)) {
      correct({ facture: localF, champ: key, original: String(original ?? ""), corrige: String(value ?? "") });
    }
  };

  const boxes = {
    fournisseur:  { top: 78,  left: 48,  width: 220, height: 20 },
    num_facture:  { top: 90,  left: 338, width: 140, height: 16 },
    date_facture: { top: 114, left: 338, width: 130, height: 14 },
    montant_ht:   { top: 520, left: 340, width: 140, height: 16 },
    tva:          { top: 542, left: 340, width: 140, height: 16 },
    montant_ttc:  { top: 568, left: 340, width: 140, height: 20 },
  };

  const invoiceYear = localF.date_facture ? String(localF.date_facture).slice(0, 4) : "";
  const hasAccountingAlert =
    localF.traitement_comptable &&
    localF.traitement_comptable !== "exercice_courant";
  const currentReviewIndex = reviewQueue.findIndex((item) => String(item.id) === String(localF.id));
  const hasReviewQueue = currentReviewIndex >= 0 && reviewQueue.length > 1;
  const previousReviewFacture = hasReviewQueue ? reviewQueue[currentReviewIndex - 1] : null;
  const nextReviewFacture = hasReviewQueue ? reviewQueue[currentReviewIndex + 1] : null;

  useEffect(() => {
    if (!facture || !hasReviewQueue) return undefined;

    const handleKeyDown = (event) => {
      const target = event.target;
      const isEditableTarget =
        target instanceof HTMLElement &&
        (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable
        );
      if (isEditableTarget) return;

      if (event.key === "ArrowLeft" && previousReviewFacture) {
        event.preventDefault();
        onSelectFacture?.(previousReviewFacture);
      }
      if (event.key === "ArrowRight" && nextReviewFacture) {
        event.preventDefault();
        onSelectFacture?.(nextReviewFacture);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [facture, hasReviewQueue, nextReviewFacture, onSelectFacture, previousReviewFacture]);

  const handleDecision = (status) => {
    update("validation_status", status, { advanceReview: true });
  };

  if (!facture) return null;

  return (
    <Drawer
      open={!!facture}
      onClose={onClose}
      placement="center"
      className="invoice-review-drawer"
      closeOnBackdrop
      bodyClassName="invoice-review-drawer-body"
    >
        <section className="invoice-review-viewer">
          <div className="invoice-review-toolbar">
            <button className="invoice-icon-btn" onClick={onClose} title="Fermer"><X size={16} /></button>
            <div className="invoice-toolbar-title">
              <FileText size={15} />
              <span>{localF.nom_fichier || "Facture"}</span>
            </div>
            <div className="invoice-toolbar-spacer" />
            <button className="invoice-icon-btn" title="Télécharger"><Download size={16} /></button>
          </div>
          <div className="invoice-document-stage">
            <DocumentPreview filePreview={filePreview} facture={localF} activeField={activeField} boxes={boxes} />
          </div>
        </section>

        <aside className="invoice-review-panel">
          <div className="invoice-summary">
            <div>
              <h2>{localF.fournisseur || "Fournisseur à confirmer"}</h2>
              <div className="invoice-summary-meta">{localF.num_facture || "Sans numéro"} · {formatDate(localF.date_facture)}</div>
              {hasReviewQueue && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                  <button
                    className="btn btn-ghost sm"
                    onClick={() => previousReviewFacture && onSelectFacture?.(previousReviewFacture)}
                    disabled={!previousReviewFacture}
                  >
                    <ChevronLeft size={13} /> Précédente
                  </button>
                  <span className="mono" style={{ fontSize: 11, color: "var(--ink-2)" }}>
                    {currentReviewIndex + 1} / {reviewQueue.length}
                  </span>
                  <button
                    className="btn btn-ghost sm"
                    onClick={() => nextReviewFacture && onSelectFacture?.(nextReviewFacture)}
                    disabled={!nextReviewFacture}
                  >
                    Suivante <ChevronRight size={13} />
                  </button>
                </div>
              )}
            </div>
            <div className="invoice-summary-amount">
              <strong>{formatMAD(localF.montant_ttc)} MAD</strong>
              <span>{localF.type || "achat"}</span>
            </div>
          </div>

          <div className="invoice-panel-scroll">
            {hasAccountingAlert && (
              <div className="invoice-alert">
                <AlertTriangle size={17} />
                <div>
                  <strong>Rattachement d'exercice à vérifier</strong>
                  <p>{localF.analyse_ai || "La facture semble concerner un exercice différent."}</p>
                </div>
              </div>
            )}

            <section className="invoice-section">
              <h3>Décision comptable</h3>
              <div className="invoice-form-grid">
                <Field label="Exercice">
                  <input
                    className="invoice-input"
                    type="number"
                    min="2000"
                    max="2100"
                    defaultValue={localF.exercice_rattachement || invoiceYear}
                    onBlur={(event) => update("exercice_rattachement", parseInt(event.target.value, 10) || null)}
                  />
                </Field>
                <Field label="Traitement">
                  <select className="invoice-input" value={localF.traitement_comptable || "exercice_courant"} onChange={(event) => update("traitement_comptable", event.target.value)}>
                    <option value="exercice_courant">Exercice courant</option>
                    <option value="charge_constatee_avance">Charge constatée d'avance</option>
                    <option value="produit_constate_avance">Produit constaté d'avance</option>
                    <option value="rattachement_exercice_precedent">Exercice précédent</option>
                    <option value="a_verifier">À vérifier</option>
                  </select>
                </Field>
                <Field label="Statut">
                  <select className="invoice-input" value={localF.validation_status || "a_valider"} onChange={(event) => update("validation_status", event.target.value)}>
                    <option value="a_valider">À valider</option>
                    <option value="a_verifier">À vérifier</option>
                    <option value="valide">Validée</option>
                    <option value="exclue">Exclue</option>
                  </select>
                </Field>
              </div>
            </section>

            <section className="invoice-section">
              <div className="invoice-section-head">
                <h3>Champs essentiels</h3>
                <span><Sparkles size={12} /> IA {Math.round((localF.confidence || 0) * 100)}%</span>
              </div>
              <div className="invoice-form-grid">
                <Field label="Type">
                  <select className="invoice-input" value={localF.type || "achat"} onChange={(event) => update("type", event.target.value)}>
                    <option value="achat">Achat</option>
                    <option value="vente">Vente</option>
                  </select>
                </Field>
                <Field label="Échéance">
                  <input className="invoice-input" type="date" defaultValue={localF.date_echeance || ""} onBlur={(event) => update("date_echeance", event.target.value)} />
                </Field>
                <Field label="Montant HT">
                  <input className="invoice-input tabular" type="number" step="0.01" defaultValue={localF.montant_ht || 0} onBlur={(event) => update("montant_ht", parseFloat(event.target.value) || 0)} />
                </Field>
                <Field label="TVA">
                  <input className="invoice-input tabular" type="number" step="0.01" defaultValue={localF.tva || 0} onBlur={(event) => update("tva", parseFloat(event.target.value) || 0)} />
                </Field>
                <Field label="Total TTC" wide>
                  <input className="invoice-input tabular strong" readOnly value={formatMAD(localF.montant_ttc)} />
                </Field>
                <Field label="Compte PCM">
                  <input className="invoice-input tabular" defaultValue={localF.compte_pcm || ""} onBlur={(event) => update("compte_pcm", event.target.value)} />
                </Field>
              </div>
            </section>

            <details className="invoice-section invoice-details">
              <summary>
                Détails avancés
                <ChevronDown size={16} />
              </summary>
              <div className="invoice-advanced-body">
                <FieldsTable f={localF} onFocus={setActiveField} editing={editing} setEditing={setEditing} onUpdate={update} />
                <div className="invoice-ledger-block">
                  <div className="invoice-ledger-title"><Database size={13} /> Écritures générées</div>
                  <Ledger rows={ecritures || []} />
                </div>
              </div>
            </details>
          </div>

          <div className="invoice-actionbar">
            <button className="invoice-secondary-btn" onClick={() => handleDecision("a_verifier")} disabled={saving}>
              À vérifier
            </button>
            <button className="invoice-primary-btn" onClick={() => handleDecision("valide")} disabled={saving}>
              <Check size={16} /> {saving ? "Sauvegarde..." : "Valider facture"}
            </button>
          </div>
        </aside>
    </Drawer>
  );
}

function Field({ label, children, wide }) {
  return (
    <label className={`invoice-field${wide ? " wide" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function DocumentPreview({ filePreview, facture, activeField, boxes }) {
  if (filePreview?.url && filePreview.type === "application/pdf") {
    return (
      <iframe
        title={facture.nom_fichier || "Facture"}
        src={filePreview.url}
        style={{ width: "100%", height: "100%", minHeight: 720, border: 0, background: "white", borderRadius: 8 }}
      />
    );
  }

  if (filePreview?.url && filePreview.type.startsWith("image/")) {
    return (
      <img
        src={filePreview.url}
        alt={facture.nom_fichier || "Facture"}
        style={{ maxWidth: "100%", height: "auto", display: "block", background: "white", borderRadius: 8 }}
      />
    );
  }

  if (filePreview?.error) {
    return (
      <div className="pdf-page">
        <div style={{ padding: 14, marginBottom: 14, background: "var(--warn-bg)", border: "1px solid var(--warn)", borderRadius: 8, color: "var(--warn-ink)", fontSize: 12 }}>
          Fichier original non disponible pour cette facture. Aperçu reconstruit à partir des champs extraits.
        </div>
        <PdfMock f={facture} activeField={activeField} boxes={boxes} />
      </div>
    );
  }

  return (
    <div className="pdf-page">
      <div style={{ padding: 14, marginBottom: 14, background: "var(--bg-inset)", borderRadius: 8, color: "var(--ink-2)", fontSize: 12 }}>
        Chargement du fichier original...
      </div>
      <PdfMock f={facture} activeField={activeField} boxes={boxes} />
    </div>
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
    { key: "type",          label: "Type",          value: f.type || "achat",                         conf: 1.0, editable: true, mono: true },
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
    { key: "exercice_rattachement", label: "Exercice", value: f.exercice_rattachement || (f.date_facture || "").slice(0, 4), conf: 1.0, editable: true, mono: true, raw: f.exercice_rattachement || (f.date_facture || "").slice(0, 4) },
    { key: "traitement_comptable", label: "Traitement", value: f.traitement_comptable || "exercice_courant", conf: 1.0, editable: true, mono: true },
    { key: "validation_status", label: "Validation", value: f.validation_status || "a_valider", conf: 1.0, editable: true, mono: true },
    { key: "analyse_ai", label: "Analyse IA", value: f.analyse_ai, conf: 1.0, editable: false },
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
                  if (r.key === "exercice_rattachement") v = parseInt(v, 10) || null;
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

  if (rows.length === 0) {
    return (
      <div style={{ padding: "16px 14px", fontSize: 12, color: "var(--ink-3)", background: "rgba(143,212,188,0.04)", border: "1px solid rgba(143,212,188,0.14)", borderRadius: 6 }}>
        Aucune écriture générée.
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid rgba(143,212,188,0.22)", borderRadius: 6, overflow: "hidden", fontFamily: "var(--font-mono)", fontSize: 12 }}>
      {/* Header */}
      <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 90px 90px", gap: 8, padding: "7px 12px", background: "rgba(143,212,188,0.12)", borderBottom: "1px solid rgba(143,212,188,0.18)", color: "var(--mint)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em" }}>
        <div>Compte</div>
        <div>Libellé</div>
        <div style={{ textAlign: "right" }}>Débit</div>
        <div style={{ textAlign: "right" }}>Crédit</div>
      </div>
      {/* Rows */}
      {rows.map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "90px 1fr 90px 90px", gap: 8, padding: "8px 12px", borderBottom: i < rows.length - 1 ? "1px solid rgba(143,212,188,0.08)" : "none", background: i % 2 === 0 ? "rgba(0,45,36,0.5)" : "rgba(0,35,28,0.4)", alignItems: "center", color: "var(--ink-0)" }}>
          <div style={{ color: "var(--accent-ink)", fontWeight: 600, fontSize: 11 }}>{r.compte_pcm}</div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 11.5, color: "var(--ink-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.libelle}</div>
          <div style={{ textAlign: "right", color: r.debit ? "var(--ink-0)" : "var(--ink-3)", fontWeight: r.debit ? 600 : 400 }}>{r.debit ? formatMAD(r.debit).split(",")[0] : "—"}</div>
          <div style={{ textAlign: "right", color: r.credit ? "var(--mint)" : "var(--ink-3)", fontWeight: r.credit ? 600 : 400 }}>{r.credit ? formatMAD(r.credit).split(",")[0] : "—"}</div>
        </div>
      ))}
      {/* Footer */}
      <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 90px 90px", gap: 8, padding: "8px 12px", background: "rgba(143,212,188,0.08)", borderTop: "1px solid rgba(143,212,188,0.18)", fontSize: 11, fontWeight: 700, color: "var(--ink-0)" }}>
        <div style={{ color: "var(--ink-2)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", alignSelf: "center" }}>
          {Math.abs(debitSum - creditSum) < 0.01
            ? <span style={{ color: "var(--pos-ink)" }}>✓ Équilibré</span>
            : <span style={{ color: "var(--neg-ink)" }}>⚠ Déséquilibré</span>}
        </div>
        <div />
        <div style={{ textAlign: "right" }}>{formatMAD(debitSum).split(",")[0]}</div>
        <div style={{ textAlign: "right", color: "var(--mint)" }}>{formatMAD(creditSum).split(",")[0]}</div>
      </div>
    </div>
  );
}
