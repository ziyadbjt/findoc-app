import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, ArrowRight, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getDossiers, createDossier as apiCreateDossier } from "../api";
import { enrichDossier, formatMAD } from "../utils/format";
import { DossierAvatar } from "../components/Shell";

export default function Dossiers() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [dossiers, setDossiers] = useState([]);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ raison_sociale: "", ice: "", forme_juridique: "SARL", ville: "", secteur: "", regime_tva: "debits" });

  useEffect(() => {
    getDossiers(token).then(res => setDossiers(res.data.map(enrichDossier)));
  }, [token]);

  const filtered = dossiers.filter(d =>
    !q.trim() ||
    d.raison_sociale.toLowerCase().includes(q.toLowerCase()) ||
    (d.ville || "").toLowerCase().includes(q.toLowerCase()) ||
    (d.ice || "").includes(q)
  );

  const handleCreate = async () => {
    await apiCreateDossier(token, form);
    const res = await getDossiers(token);
    setDossiers(res.data.map(enrichDossier));
    setShowForm(false);
    setForm({ raison_sociale: "", ice: "", forme_juridique: "SARL", ville: "", secteur: "", regime_tva: "debits" });
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-0)" }}>
      <header style={{ padding: "16px 40px", borderBottom: "1px solid var(--line-0)", display: "flex", alignItems: "center", background: "var(--bg-1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="brand-mark">F</div>
          <span style={{ fontWeight: 600, fontSize: 14 }}>FINDOC</span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "var(--ink-2)" }}>{user?.nom || "Ziyad B."}</div>
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
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={14} /> Nouveau dossier
          </button>
        </div>

        {showForm && (
          <div className="card" style={{ padding: 24, marginBottom: 20 }}>
            <div className="card-title" style={{ marginBottom: 16 }}>Nouveau dossier client</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              {[
                { key: "raison_sociale", label: "Raison sociale", placeholder: "ATLAS INDUSTRIES SA" },
                { key: "ice", label: "ICE", placeholder: "000000000000000" },
                { key: "ville", label: "Ville", placeholder: "Casablanca" },
                { key: "secteur", label: "Secteur", placeholder: "Industrie" },
              ].map(f => (
                <div key={f.key}>
                  <label className="label">{f.label}</label>
                  <input className="input" value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.placeholder} />
                </div>
              ))}
              <div>
                <label className="label">Forme juridique</label>
                <select className="input" value={form.forme_juridique} onChange={e => setForm({ ...form, forme_juridique: e.target.value })}>
                  {["SARL", "SA", "SARL-AU", "SNC", "Auto-entrepreneur"].map(v => <option key={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Régime TVA</label>
                <select className="input" value={form.regime_tva} onChange={e => setForm({ ...form, regime_tva: e.target.value })}>
                  <option value="debits">Régime des débits</option>
                  <option value="encaissements">Régime des encaissements</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={handleCreate}>Créer le dossier</button>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
          {filtered.map(d => (
            <button key={d.id} onClick={() => navigate(`/dashboard/${d.id}`)} className="card"
              style={{ textAlign: "left", padding: 0, cursor: "pointer", transition: "box-shadow 120ms, border-color 120ms" }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--shadow-md)"; e.currentTarget.style.borderColor = "var(--line-strong)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "var(--shadow-xs)"; e.currentTarget.style.borderColor = "var(--line-0)"; }}>
              <div style={{ padding: "16px 18px" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
                  <DossierAvatar dossier={d} size={40} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, letterSpacing: "-0.01em" }}>{d.raison_sociale}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{d.forme_juridique} · {d.ville} · {d.secteur}</div>
                  </div>
                  <ArrowRight size={14} style={{ color: "var(--ink-3)" }} />
                </div>
              </div>
              <div style={{ padding: "10px 18px", borderTop: "1px solid var(--line-1)", background: "var(--bg-inset)", fontSize: 11, color: "var(--ink-2)", fontFamily: "var(--font-mono)", display: "flex", gap: 14 }}>
                <span>ICE · {d.ice || "—"}</span>
                <span style={{ marginLeft: "auto" }}>{d.regime_tva === "debits" ? "Rég. débits" : "Rég. encaiss."}</span>
              </div>
            </button>
          ))}
          {filtered.length === 0 && !showForm && (
            <div style={{ gridColumn: "1 / -1", padding: 40, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
              Aucun dossier trouvé. Cliquez sur "Nouveau dossier" pour commencer.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
