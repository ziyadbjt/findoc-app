import { useEffect, useState } from "react";
import { Check, RefreshCw, Sparkles, Database, Building2 } from "lucide-react";
import { useToast } from "../context/ToastContext";

const INTEGRATIONS = [
  { key: "sage", label: "SAGE 100", desc: "Export journal comptable", icon: <Database size={16} />, status: "connected" },
  { key: "dgi", label: "DGI · Portail fiscal", desc: "Déclaration TVA automatisée", icon: <Building2 size={16} />, status: "disconnected" },
  { key: "claude", label: "Claude AI", desc: "Extraction factures et génération relances", icon: <Sparkles size={16} />, status: "connected" },
];

const readTVAConfig = (dossier) => {
  const key = `tva-config:${dossier?.id || "default"}`;
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "{}");
    return {
      regime_tva: dossier?.regime_tva || "debits",
      default_rate: 20,
      enable_tpe: true,
      enable_bank: true,
      cmi_base_ht: 12500,
      cmi_rate: 20,
      bank_base_ht: 6400,
      bank_rate: 10,
      ...saved,
    };
  } catch {
    return {
      regime_tva: dossier?.regime_tva || "debits",
      default_rate: 20,
      enable_tpe: true,
      enable_bank: true,
      cmi_base_ht: 12500,
      cmi_rate: 20,
      bank_base_ht: 6400,
      bank_rate: 10,
    };
  }
};

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
  const [tvaConfig, setTvaConfig] = useState(() => readTVAConfig(dossier));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm({
      raison_sociale: dossier?.raison_sociale || "",
      ice: dossier?.ice || "",
      forme_juridique: dossier?.forme_juridique || "SARL",
      ville: dossier?.ville || "",
      secteur: dossier?.secteur || "",
      regime_tva: dossier?.regime_tva || "debits",
    });
    setTvaConfig(readTVAConfig(dossier));
  }, [dossier]);

  const handleSave = () => {
    const next = { ...form };
    onUpdateDossier?.(next);
    setSaved(true);
    toast("Paramètres sauvegardés", "pos");
    setTimeout(() => setSaved(false), 2500);
  };

  const handleSaveTVA = () => {
    const key = `tva-config:${dossier?.id || "default"}`;
    const next = { ...tvaConfig, regime_tva: form.regime_tva };
    localStorage.setItem(key, JSON.stringify(next));
    setTvaConfig(next);
    toast("Configuration TVA sauvegardée", "pos");
  };

  const field = (key, label, placeholder, opts) => (
    <div key={key}>
      <label className="label">{label}</label>
      {opts ? (
        <select className="input" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}>
          {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      ) : (
        <input className="input" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={placeholder} />
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

          <div className="card" style={{ padding: 20 }}>
            <div className="card-title" style={{ marginBottom: 4 }}>Déclaration TVA · Configuration</div>
            <div style={{ fontSize: 11.5, color: "var(--ink-2)", marginBottom: 16 }}>
              Paramètres utilisés dans l’onglet déclaration et pour les sources complémentaires.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label className="label">Taux TVA par défaut (%)</label>
                <input
                  className="input"
                  type="number"
                  value={tvaConfig.default_rate}
                  step={0.5}
                  onChange={(e) => setTvaConfig((prev) => ({ ...prev, default_rate: Number(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <label className="label">Régime actif</label>
                <input className="input" value={form.regime_tva === "encaissements" ? "Encaissements" : "Débits"} readOnly />
              </div>
              <label className="card" style={{ padding: 14, display: "flex", alignItems: "center", gap: 10, borderStyle: "dashed" }}>
                <input
                  type="checkbox"
                  checked={tvaConfig.enable_tpe}
                  onChange={(e) => setTvaConfig((prev) => ({ ...prev, enable_tpe: e.target.checked }))}
                />
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 500 }}>Source supplémentaire CMI / TPE</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>Inclure les encaissements carte dans la déclaration</div>
                </div>
              </label>
              <label className="card" style={{ padding: 14, display: "flex", alignItems: "center", gap: 10, borderStyle: "dashed" }}>
                <input
                  type="checkbox"
                  checked={tvaConfig.enable_bank}
                  onChange={(e) => setTvaConfig((prev) => ({ ...prev, enable_bank: e.target.checked }))}
                />
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 500 }}>Source supplémentaire relevés bancaires</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>Ajouter la TVA issue des relevés pour contrôle</div>
                </div>
              </label>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button className="btn btn-primary" onClick={handleSaveTVA}>Sauvegarder</button>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>Intégrations</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {INTEGRATIONS.map((integ) => (
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
