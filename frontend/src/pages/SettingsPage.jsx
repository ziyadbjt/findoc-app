import { useState } from "react";
import { Check, RefreshCw, Sparkles, Database, Building2 } from "lucide-react";
import { useToast } from "../context/ToastContext";

const INTEGRATIONS = [
  { key: "sage", label: "SAGE 100", desc: "Export journal comptable", icon: <Database size={16} />, status: "connected" },
  { key: "dgi",  label: "DGI · Portail fiscal", desc: "Déclaration TVA automatisée", icon: <Building2 size={16} />, status: "disconnected" },
  { key: "claude", label: "Claude AI", desc: "Extraction factures et génération relances", icon: <Sparkles size={16} />, status: "connected" },
];

export default function SettingsPage({ dossier, onUpdateDossier }) {
  const toast = useToast();
  const [form, setForm] = useState({
    raison_sociale: dossier?.raison_sociale || "",
    ice: dossier?.ice || "",
    forme_juridique: dossier?.forme_juridique || "SARL",
    ville: dossier?.ville || "",
    secteur: dossier?.secteur || "",
    regime_tva: dossier?.regime_tva || "debits",
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onUpdateDossier?.(form);
    setSaved(true);
    toast("Paramètres sauvegardés", "pos");
    setTimeout(() => setSaved(false), 2500);
  };

  const field = (key, label, placeholder, opts) => (
    <div key={key}>
      <label className="label">{label}</label>
      {opts ? (
        <select className="input" value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}>
          {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      ) : (
        <input className="input" value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} placeholder={placeholder} />
      )}
    </div>
  );

  return (
    <div className="page-inner">
      <div className="page-header">
        <div>
          <h1 className="page-title">Paramètres</h1>
          <p className="page-subtitle">Dossier client · intégrations · configuration</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 12, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Dossier info */}
          <div className="card" style={{ padding: 20 }}>
            <div className="card-title" style={{ marginBottom: 16 }}>Informations du dossier</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              {field("raison_sociale", "Raison sociale", "ATLAS INDUSTRIES SA")}
              {field("ice", "ICE", "000000000000000")}
              {field("ville", "Ville", "Casablanca")}
              {field("secteur", "Secteur", "Industrie")}
              {field("forme_juridique", "Forme juridique", null, [
                ["SARL", "SARL"], ["SA", "SA"], ["SARL-AU", "SARL-AU"], ["SNC", "SNC"], ["Auto-entrepreneur", "Auto-entrepreneur"],
              ])}
              {field("regime_tva", "Régime TVA", null, [
                ["debits", "Régime des débits"], ["encaissements", "Régime des encaissements"],
              ])}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-primary" onClick={handleSave}>
                {saved ? <><Check size={13} /> Sauvegardé</> : "Sauvegarder"}
              </button>
            </div>
          </div>

          {/* Loi 69-21 config */}
          <div className="card" style={{ padding: 20 }}>
            <div className="card-title" style={{ marginBottom: 4 }}>Loi 69-21 · Paramètres</div>
            <div style={{ fontSize: 11.5, color: "var(--ink-2)", marginBottom: 16 }}>Configuration des délais et taux applicables</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label className="label">Délai légal (jours)</label>
                <input className="input" type="number" defaultValue={60} />
              </div>
              <div>
                <label className="label">Taux BAM (%/an)</label>
                <input className="input" type="number" defaultValue={2.25} step={0.25} />
              </div>
              <div>
                <label className="label">Majoration pénalité</label>
                <input className="input" type="number" defaultValue={3} step={0.5} />
              </div>
              <div>
                <label className="label">Délai max. convention (j)</label>
                <input className="input" type="number" defaultValue={120} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button className="btn btn-primary" onClick={() => toast("Configuration Loi 69-21 sauvegardée", "pos")}>Sauvegarder</button>
            </div>
          </div>
        </div>

        {/* Integrations */}
        <div className="card" style={{ padding: 20 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>Intégrations</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {INTEGRATIONS.map(integ => (
              <div key={integ.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--bg-inset)", borderRadius: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--bg-1)", border: "1px solid var(--line-1)", display: "grid", placeItems: "center", color: "var(--ink-2)", flexShrink: 0 }}>
                  {integ.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{integ.label}</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{integ.desc}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 99,
                    background: integ.status === "connected" ? "var(--pos-bg)" : "var(--bg-2)",
                    color: integ.status === "connected" ? "var(--pos-ink)" : "var(--ink-3)",
                  }}>
                    {integ.status === "connected" ? "Connecté" : "Déconnecté"}
                  </span>
                  <button className="icon-btn" title="Rafraîchir"><RefreshCw size={13} /></button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: "12px 14px", background: "var(--accent-bg)", borderRadius: 10, fontSize: 12, color: "var(--accent-ink)" }}>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>Plan actuel · Pro</div>
            <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>3 dossiers actifs · 500 factures/mois · export SAGE inclus</div>
          </div>
        </div>
      </div>
    </div>
  );
}
