import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Plus, ArrowRight, LogOut, X, Building2, Hash, MapPin,
  Upload, FileText, CheckCircle, AlertCircle, Loader, FileImage, FileCode,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getDossiers, createDossier as apiCreateDossier, extractSocieteFromDoc } from "../api";
import { enrichDossier } from "../utils/format";
import { DossierAvatar } from "../components/Shell";

const EMPTY_FORM = {
  raison_sociale: "", ice: "", forme_juridique: "SARL", ville: "", secteur: "",
  regime_tva: "debits", if_number: "", rc_number: "", cnss_number: "",
  capital_social: "", adresse: "", telephone: "", email_societe: "", site_web: "",
  logo_hue: null,
};

const HUE_PALETTE = [220, 260, 160, 30, 340, 190, 85, 0];

const FILE_TYPES = [
  { ext: "PDF", icon: <FileText size={18} />, color: "#e53e3e", accept: ".pdf" },
  { ext: "JPG/PNG", icon: <FileImage size={18} />, color: "#dd6b20", accept: ".jpg,.jpeg,.png" },
  { ext: "XML", icon: <FileCode size={18} />, color: "#2b6cb0", accept: ".xml" },
];

function computeEnriched(form) {
  const words = (form.raison_sociale || "").toUpperCase().split(/\s+/).filter(Boolean);
  const initials = words.length >= 2 ? words[0][0] + words[1][0] : (form.raison_sociale || "??").slice(0, 2).toUpperCase();
  const computedHue = Math.abs((form.raison_sociale || "").split("").reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0)) % 360;
  const hue = form.logo_hue != null ? form.logo_hue : computedHue;
  return { ...form, initials, hue };
}

// ── Import tab ────────────────────────────────────────────────────────────────
function ImportTab({ onExtracted }) {
  const { token } = useAuth();
  const [drag, setDrag] = useState(false);
  const [state, setState] = useState("idle"); // idle | loading | success | error
  const [fileName, setFileName] = useState("");
  const [confiance, setConfiance] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef();

  const process = useCallback(async (file) => {
    if (!file) return;
    setFileName(file.name);
    setState("loading");
    setErrorMsg("");
    try {
      const res = await extractSocieteFromDoc(token, file);
      setConfiance(res.data.confiance);
      setState("success");
      onExtracted(res.data);
    } catch (e) {
      setState("error");
      setErrorMsg(e?.response?.data?.detail || "Erreur lors de l'extraction. Vérifiez votre clé API.");
    }
  }, [token, onExtracted]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files[0];
    if (file) process(file);
  }, [process]);

  const onInput = (e) => { if (e.target.files[0]) process(e.target.files[0]); };

  return (
    <div style={{ padding: "28px 32px" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Importer un document</div>
        <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5 }}>
          Glissez un document de la société (statuts, facture entête, extrait RC…) — Claude extraira automatiquement les informations.
        </div>
      </div>

      {/* Supported formats */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {FILE_TYPES.map(f => (
          <div key={f.ext} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 7, border: "1px solid var(--line-0)", background: "var(--bg-inset)", fontSize: 11, color: "var(--ink-2)" }}>
            <span style={{ color: f.color }}>{f.icon}</span>{f.ext}
          </div>
        ))}
      </div>

      {/* Dropzone */}
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        onClick={() => state !== "loading" && inputRef.current?.click()}
        style={{
          border: `2px dashed ${drag ? "var(--accent-ink)" : "var(--line-strong)"}`,
          borderRadius: 12,
          padding: "40px 24px",
          textAlign: "center",
          cursor: state === "loading" ? "default" : "pointer",
          background: drag ? "var(--accent-bg)" : "var(--bg-inset)",
          transition: "all 150ms",
          marginBottom: 16,
        }}>
        <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.xml" style={{ display: "none" }} onChange={onInput} />

        {state === "idle" && (
          <>
            <Upload size={28} style={{ color: "var(--ink-3)", marginBottom: 10 }} />
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Glissez un document ici</div>
            <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>ou cliquez pour sélectionner · PDF, JPG, PNG, XML</div>
          </>
        )}

        {state === "loading" && (
          <>
            <Loader size={28} style={{ color: "var(--accent-ink)", marginBottom: 10, animation: "spin 1s linear infinite" }} />
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Extraction en cours…</div>
            <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{fileName}</div>
          </>
        )}

        {state === "success" && (
          <>
            <CheckCircle size={28} style={{ color: "var(--pos-ink)", marginBottom: 10 }} />
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, color: "var(--pos-ink)" }}>Extraction réussie</div>
            <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{fileName}</div>
            {confiance != null && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 8, padding: "3px 10px", background: "var(--pos-bg)", borderRadius: 99, fontSize: 11, color: "var(--pos-ink)" }}>
                Confiance · {Math.round(confiance * 100)}%
              </div>
            )}
          </>
        )}

        {state === "error" && (
          <>
            <AlertCircle size={28} style={{ color: "var(--neg-ink)", marginBottom: 10 }} />
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, color: "var(--neg-ink)" }}>Échec de l'extraction</div>
            <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{errorMsg}</div>
          </>
        )}
      </div>

      {state === "success" && (
        <div style={{ fontSize: 12, color: "var(--ink-2)", textAlign: "center" }}>
          Les champs ont été remplis automatiquement. Passez à l'onglet <strong>Formulaire</strong> pour vérifier et créer le dossier.
        </div>
      )}
      {(state === "error" || state === "success") && (
        <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center", marginTop: 10 }}
          onClick={() => { setState("idle"); setFileName(""); setConfiance(null); }}>
          Importer un autre document
        </button>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Form tab ──────────────────────────────────────────────────────────────────
function FormTab({ form, setForm }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
      <Section label="Identité légale" icon={<Building2 size={13} />}>
        <Row>
          <Field label="Raison sociale *" span={2}>
            <input className="input" value={form.raison_sociale} onChange={e => set("raison_sociale", e.target.value)} placeholder="ATLAS INDUSTRIES SA" autoFocus />
          </Field>
          <Field label="Forme juridique">
            <select className="input" value={form.forme_juridique} onChange={e => set("forme_juridique", e.target.value)}>
              {["SARL", "SA", "SARL-AU", "SNC", "SCS", "Auto-entrepreneur", "GIE"].map(v => <option key={v}>{v}</option>)}
            </select>
          </Field>
        </Row>
        <Row>
          <Field label="Secteur d'activité" span={2}>
            <input className="input" value={form.secteur} onChange={e => set("secteur", e.target.value)} placeholder="Industrie, Commerce, Services…" />
          </Field>
          <Field label="Capital social (MAD)">
            <input className="input" type="number" value={form.capital_social} onChange={e => set("capital_social", e.target.value)} placeholder="100 000" />
          </Field>
        </Row>
      </Section>

      <Section label="Identifiants fiscaux" icon={<Hash size={13} />}>
        <Row>
          <Field label="ICE">
            <input className="input" value={form.ice} onChange={e => set("ice", e.target.value)} placeholder="000000000000000" maxLength={15} />
          </Field>
          <Field label="Identifiant Fiscal (IF)">
            <input className="input" value={form.if_number} onChange={e => set("if_number", e.target.value)} placeholder="12345678" />
          </Field>
          <Field label="Registre de Commerce (RC)">
            <input className="input" value={form.rc_number} onChange={e => set("rc_number", e.target.value)} placeholder="12345 Casa" />
          </Field>
        </Row>
        <Row>
          <Field label="N° CNSS">
            <input className="input" value={form.cnss_number} onChange={e => set("cnss_number", e.target.value)} placeholder="9876543" />
          </Field>
          <Field label="Régime TVA">
            <select className="input" value={form.regime_tva} onChange={e => set("regime_tva", e.target.value)}>
              <option value="debits">Régime des débits</option>
              <option value="encaissements">Régime des encaissements</option>
            </select>
          </Field>
        </Row>
      </Section>

      <Section label="Coordonnées" icon={<MapPin size={13} />}>
        <Row>
          <Field label="Ville">
            <input className="input" value={form.ville} onChange={e => set("ville", e.target.value)} placeholder="Casablanca" />
          </Field>
          <Field label="Téléphone">
            <input className="input" value={form.telephone} onChange={e => set("telephone", e.target.value)} placeholder="+212 5 22 XX XX XX" />
          </Field>
          <Field label="Email société">
            <input className="input" type="email" value={form.email_societe} onChange={e => set("email_societe", e.target.value)} placeholder="contact@societe.ma" />
          </Field>
        </Row>
        <Row>
          <Field label="Adresse complète" span={2}>
            <input className="input" value={form.adresse} onChange={e => set("adresse", e.target.value)} placeholder="123, Bd Mohammed V, Casablanca 20000" />
          </Field>
          <Field label="Site web">
            <input className="input" value={form.site_web} onChange={e => set("site_web", e.target.value)} placeholder="www.societe.ma" />
          </Field>
        </Row>
      </Section>
    </div>
  );
}

function Section({ label, icon, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid var(--line-0)" }}>
        <span style={{ color: "var(--ink-2)" }}>{icon}</span>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink-1)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
    </div>
  );
}

function Row({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>{children}</div>;
}

function Field({ label, children, span = 1 }) {
  return (
    <div style={{ gridColumn: `span ${span}` }}>
      <label className="label" style={{ marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function NewDossierModal({ onClose, onCreated }) {
  const [tab, setTab] = useState("import"); // "import" | "form"
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const { token } = useAuth();
  const preview = useMemo(() => computeEnriched(form), [form]);

  const handleExtracted = useCallback((data) => {
    setForm(f => ({
      ...f,
      raison_sociale: data.raison_sociale || f.raison_sociale,
      forme_juridique: data.forme_juridique || f.forme_juridique,
      ice: data.ice || f.ice,
      if_number: data.if_number || f.if_number,
      rc_number: data.rc_number || f.rc_number,
      cnss_number: data.cnss_number || f.cnss_number,
      capital_social: data.capital_social != null ? String(data.capital_social) : f.capital_social,
      adresse: data.adresse || f.adresse,
      ville: data.ville || f.ville,
      telephone: data.telephone || f.telephone,
      email_societe: data.email_societe || f.email_societe,
      site_web: data.site_web || f.site_web,
      secteur: data.secteur || f.secteur,
      regime_tva: data.regime_tva || f.regime_tva,
    }));
    setTimeout(() => setTab("form"), 1200);
  }, []);

  const handleCreate = async () => {
    if (!form.raison_sociale.trim()) return;
    setLoading(true);
    try {
      const payload = { ...form };
      if (payload.logo_hue == null) payload.logo_hue = preview.hue;
      await apiCreateDossier(token, payload);
      onCreated();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "var(--bg-1)", border: "1px solid var(--line-0)", borderRadius: 16,
        width: "min(960px, 95vw)", maxHeight: "90vh",
        display: "flex", flexDirection: "column", overflow: "hidden",
        boxShadow: "var(--shadow-lg)",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--line-0)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>Nouveau dossier client</div>
          </div>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 2, background: "var(--bg-inset)", borderRadius: 8, padding: 3 }}>
            {[
              { key: "import", label: "Importer", icon: <Upload size={12} /> },
              { key: "form", label: "Formulaire", icon: <Plus size={12} /> },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 6,
                border: "none", cursor: "pointer", fontSize: 12, fontWeight: 500,
                background: tab === t.key ? "var(--bg-1)" : "transparent",
                color: tab === t.key ? "var(--ink-0)" : "var(--ink-2)",
                boxShadow: tab === t.key ? "var(--shadow-xs)" : "none",
                transition: "all 100ms",
              }}>{t.icon}{t.label}</button>
            ))}
          </div>
          <button className="icon-btn" onClick={onClose}><X size={15} /></button>
        </div>

        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Left panel: logo preview */}
          <div style={{
            width: 210, flexShrink: 0, borderRight: "1px solid var(--line-0)",
            background: "var(--bg-inset)", padding: "28px 18px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 18,
          }}>
            <DossierAvatar dossier={preview} size={80} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12.5, fontWeight: 500, letterSpacing: "-0.01em", wordBreak: "break-word" }}>
                {form.raison_sociale || <span style={{ color: "var(--ink-3)" }}>Raison sociale</span>}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 3 }}>
                {form.forme_juridique}{form.ville ? ` · ${form.ville}` : ""}
              </div>
            </div>
            {form.ice && <div style={{ fontSize: 10, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>ICE · {form.ice}</div>}

            <div>
              <div style={{ fontSize: 10.5, color: "var(--ink-3)", marginBottom: 7, textAlign: "center" }}>Couleur du logo</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "center" }}>
                {HUE_PALETTE.map(h => {
                  const h2 = (h + 40) % 360;
                  const active = (form.logo_hue ?? preview.hue) === h;
                  return (
                    <button key={h} onClick={() => setForm(f => ({ ...f, logo_hue: h }))} style={{
                      width: 20, height: 20, borderRadius: 5,
                      border: active ? "2px solid var(--ink-0)" : "2px solid transparent",
                      background: `linear-gradient(135deg, oklch(0.72 0.18 ${h}), oklch(0.55 0.22 ${h2}))`,
                      cursor: "pointer", padding: 0, outline: "none",
                    }} />
                  );
                })}
              </div>
            </div>

            {/* Filled fields summary */}
            {tab === "form" && (
              <div style={{ width: "100%", marginTop: 4 }}>
                {[
                  ["ICE", form.ice], ["IF", form.if_number], ["RC", form.rc_number],
                  ["CNSS", form.cnss_number], ["Tél.", form.telephone],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--ink-2)", padding: "2px 0" }}>
                    <span style={{ color: "var(--ink-3)" }}>{k}</span>
                    <span style={{ fontFamily: "var(--font-mono)", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right panel */}
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {tab === "import"
              ? <ImportTab onExtracted={handleExtracted} />
              : <FormTab form={form} setForm={setForm} />
            }
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "13px 24px", borderTop: "1px solid var(--line-0)", display: "flex", gap: 8, justifyContent: "flex-end", background: "var(--bg-inset)" }}>
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          {tab === "import"
            ? <button className="btn btn-secondary" onClick={() => setTab("form")}><Plus size={13} /> Remplir manuellement</button>
            : <button className="btn btn-primary" onClick={handleCreate} disabled={loading || !form.raison_sociale.trim()}>
                {loading ? <span className="spinner" /> : <><Plus size={13} /> Créer le dossier</>}
              </button>
          }
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Dossiers() {
  const { user, token, logout, authReady } = useAuth();
  const navigate = useNavigate();
  const [dossiers, setDossiers] = useState([]);
  const [q, setQ] = useState("");
  const [showModal, setShowModal] = useState(false);

  const FALLBACK_DOSSIERS = [
    { id: 1, raison_sociale: "ZIYAD CORP", ice: "1928299939292", forme_juridique: "SARL", ville: "Casablanca", secteur: "Commerce", regime_tva: "debits", logo_hue: 28 },
    { id: 2, raison_sociale: "ATLAS INDUSTRIES SA", ice: "002345678901234", forme_juridique: "SA", ville: "Casablanca", secteur: "Industrie", regime_tva: "debits", logo_hue: 200 },
    { id: 3, raison_sociale: "CABINET CHAMI & ASSOCIES", ice: "002987654300001", forme_juridique: "SARL", ville: "Casablanca", secteur: "Expertise Comptable", regime_tva: "debits", logo_hue: 160 },
  ];

  const load = async () => {
    try {
      const res = await getDossiers(token);
      const data = res.data.map(enrichDossier);
      setDossiers(data.length > 0 ? data : FALLBACK_DOSSIERS.map(enrichDossier));
    } catch {
      setDossiers(FALLBACK_DOSSIERS.map(enrichDossier));
    }
  };
  useEffect(() => { if (authReady) load(); }, [token, authReady]);

  const filtered = dossiers.filter(d =>
    !q.trim() ||
    d.raison_sociale.toLowerCase().includes(q.toLowerCase()) ||
    (d.ville || "").toLowerCase().includes(q.toLowerCase()) ||
    (d.ice || "").includes(q)
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-0)" }}>
      {showModal && <NewDossierModal onClose={() => setShowModal(false)} onCreated={load} />}

      <header style={{ padding: "16px 40px", borderBottom: "1px solid var(--line-0)", display: "flex", alignItems: "center", background: "var(--bg-1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="brand-mark">F</div>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Espace dossiers</span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "var(--ink-2)" }}>{user?.nom || "Ziyad B."}</div>
          {user?.role === "admin" && (
            <button className="btn btn-secondary" onClick={() => navigate("/admin")}>
              Admin
            </button>
          )}
          <button className="icon-btn" onClick={() => { logout(); navigate("/login"); }} title="Déconnexion">
            <LogOut size={15} />
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 40px" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 32, fontWeight: 500, letterSpacing: "-0.025em", margin: "0 0 6px" }}>
            Sur quel dossier travaillez-vous ?
          </h1>
          <p style={{ fontSize: 14, color: "var(--ink-2)", margin: 0 }}>
            Sélectionnez un client pour charger son environnement comptable.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20 }}>
          <div className="filter-search" style={{ flex: 1, maxWidth: 420 }}>
            <Search size={14} />
            <input placeholder="Rechercher par raison sociale, ville, ICE…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink-2)" }}>
            <span className="mono tabular">{filtered.length}</span> dossier{filtered.length > 1 ? "s" : ""}
          </div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={14} /> Nouveau dossier
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
          {filtered.map(d => (
            <button key={d.id} onClick={() => navigate(`/dashboard/${d.id}`)} className="card"
              style={{ textAlign: "left", padding: 0, cursor: "pointer", transition: "box-shadow 120ms, border-color 120ms" }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--shadow-md)"; e.currentTarget.style.borderColor = "var(--line-strong)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "var(--shadow-xs)"; e.currentTarget.style.borderColor = "var(--line-0)"; }}>
              <div style={{ padding: "16px 18px" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
                  <DossierAvatar dossier={d} size={42} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, letterSpacing: "-0.01em" }}>{d.raison_sociale}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{d.forme_juridique} · {d.ville}{d.secteur ? ` · ${d.secteur}` : ""}</div>
                  </div>
                  <ArrowRight size={14} style={{ color: "var(--ink-3)" }} />
                </div>
                {(d.telephone || d.email_societe) && (
                  <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--ink-3)" }}>
                    {d.telephone && <span>{d.telephone}</span>}
                    {d.email_societe && <span>{d.email_societe}</span>}
                  </div>
                )}
              </div>
              <div style={{ padding: "10px 18px", borderTop: "1px solid var(--line-1)", background: "var(--bg-inset)", fontSize: 11, color: "var(--ink-2)", fontFamily: "var(--font-mono)", display: "flex", gap: 14 }}>
                <span>ICE · {d.ice || "—"}</span>
                {d.if_number && <span>IF · {d.if_number}</span>}
                <span style={{ marginLeft: "auto" }}>{d.regime_tva === "debits" ? "Rég. débits" : "Rég. encaiss."}</span>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div style={{ gridColumn: "1 / -1", padding: 40, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
              Aucun dossier trouvé. Cliquez sur "Nouveau dossier" pour commencer.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
