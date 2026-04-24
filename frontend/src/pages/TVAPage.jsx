import { useEffect, useMemo, useState } from "react";
import { Calculator, Landmark, CreditCard, Receipt } from "lucide-react";
import { useToast } from "../context/ToastContext";
import { formatMAD } from "../utils/format";

const getQuarter = (month) => Math.floor(month / 3) + 1;

const buildStorageKey = (dossierId) => `tva-config:${dossierId || "default"}`;

const readTVAConfig = (dossier) => {
  try {
    const stored = JSON.parse(localStorage.getItem(buildStorageKey(dossier?.id)) || "{}");
    return {
      regime_tva: dossier?.regime_tva || "debits",
      default_rate: 20,
      enable_tpe: true,
      enable_bank: true,
      cmi_base_ht: 12500,
      cmi_rate: 20,
      bank_base_ht: 6400,
      bank_rate: 10,
      ...stored,
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

export default function TVAPage({ factures, dossier }) {
  const toast = useToast();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQuarter = `Q${getQuarter(now.getMonth())}-${currentYear}`;
  const currentMonth = `${currentYear}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [mode, setMode] = useState("quarter");
  const [selectedPeriod, setSelectedPeriod] = useState(currentQuarter);
  const [config, setConfig] = useState(() => readTVAConfig(dossier));

  useEffect(() => {
    setConfig(readTVAConfig(dossier));
  }, [dossier]);

  const facturePeriods = useMemo(() => {
    const months = new Set();
    const quarters = new Set([currentQuarter]);
    (factures || []).forEach((f) => {
      if (!f?.date_facture) return;
      const date = new Date(f.date_facture);
      if (Number.isNaN(date.getTime())) return;
      months.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
      quarters.add(`Q${getQuarter(date.getMonth())}-${date.getFullYear()}`);
    });
    months.add(currentMonth);
    return {
      months: [...months].sort().reverse(),
      quarters: [...quarters].sort((a, b) => b.localeCompare(a)),
    };
  }, [factures, currentMonth, currentQuarter]);

  useEffect(() => {
    const options = mode === "quarter" ? facturePeriods.quarters : facturePeriods.months;
    if (!options.includes(selectedPeriod)) {
      setSelectedPeriod(options[0] || (mode === "quarter" ? currentQuarter : currentMonth));
    }
  }, [mode, facturePeriods, selectedPeriod, currentQuarter, currentMonth]);

  const filteredFactures = useMemo(() => {
    return (factures || []).filter((f) => {
      if (!f?.date_facture) return mode === "quarter" ? selectedPeriod === currentQuarter : selectedPeriod === currentMonth;
      const date = new Date(f.date_facture);
      if (Number.isNaN(date.getTime())) return false;
      if (mode === "month") {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` === selectedPeriod;
      }
      return `Q${getQuarter(date.getMonth())}-${date.getFullYear()}` === selectedPeriod;
    });
  }, [factures, mode, selectedPeriod, currentQuarter, currentMonth]);

  const achats = filteredFactures.filter((f) => f.type === "achat");
  const ventes = filteredFactures.filter((f) => f.type === "vente");

  const rows = [
    {
      source: "Achats fournisseurs",
      family: "deductible",
      baseHT: achats.reduce((sum, f) => sum + (f.montant_ht || 0), 0),
      rateLabel: "Variable",
      tva: achats.reduce((sum, f) => sum + (f.tva || 0), 0),
    },
    {
      source: "Ventes clients",
      family: "collectee",
      baseHT: ventes.reduce((sum, f) => sum + (f.montant_ht || 0), 0),
      rateLabel: "Variable",
      tva: ventes.reduce((sum, f) => sum + (f.tva || 0), 0),
    },
    ...(config.enable_tpe ? [{
      source: "CMI / TPE",
      family: "collectee",
      baseHT: Number(config.cmi_base_ht) || 0,
      rateLabel: `${Number(config.cmi_rate) || 0}%`,
      tva: ((Number(config.cmi_base_ht) || 0) * (Number(config.cmi_rate) || 0)) / 100,
    }] : []),
    ...(config.enable_bank ? [{
      source: "Relevés bancaires",
      family: "collectee",
      baseHT: Number(config.bank_base_ht) || 0,
      rateLabel: `${Number(config.bank_rate) || 0}%`,
      tva: ((Number(config.bank_base_ht) || 0) * (Number(config.bank_rate) || 0)) / 100,
    }] : []),
  ];

  const deductible = rows.filter((row) => row.family === "deductible").reduce((sum, row) => sum + row.tva, 0);
  const collectee = rows.filter((row) => row.family === "collectee").reduce((sum, row) => sum + row.tva, 0);
  const solde = collectee - deductible;

  const saveConfig = (next) => {
    setConfig(next);
    localStorage.setItem(buildStorageKey(dossier?.id), JSON.stringify(next));
  };

  return (
    <div className="page-inner">
      <div className="page-header">
        <div>
          <h1 className="page-title">Déclaration TVA</h1>
          <p className="page-subtitle">{dossier?.raison_sociale || "Dossier"} · régime {config.regime_tva === "encaissements" ? "encaissements" : "débits"}</p>
        </div>
        <div className="page-actions" style={{ gap: 8 }}>
          <div className="segmented">
            <button className={mode === "month" ? "active" : ""} onClick={() => setMode("month")}>Mois</button>
            <button className={mode === "quarter" ? "active" : ""} onClick={() => setMode("quarter")}>Trimestre</button>
          </div>
          <select className="input" style={{ width: 170 }} value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}>
            {(mode === "quarter" ? facturePeriods.quarters : facturePeriods.months).map((period) => (
              <option key={period} value={period}>{period}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={() => toast("Déclaration TVA générée", "pos")}>
            <Receipt size={13} /> Générer déclaration
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 12 }}>
        <KPI icon={<Calculator size={15} />} label="TVA déductible" value={deductible} tone="ink" />
        <KPI icon={<Receipt size={15} />} label="TVA collectée" value={collectee} tone="accent" />
        <KPI icon={<Landmark size={15} />} label="Solde TVA" value={solde} tone={solde >= 0 ? "warn" : "pos"} />
        <KPI icon={<CreditCard size={15} />} label="Factures prises en compte" value={filteredFactures.length} unit="" tone="ink" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.9fr", gap: 12, alignItems: "start" }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--line-1)" }}>
            <div className="card-title">Ventilation de la déclaration</div>
            <div style={{ fontSize: 11.5, color: "var(--ink-2)", marginTop: 2 }}>Sources agrégées sur la période sélectionnée</div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th className="th">Source</th>
                <th className="th right">Base HT</th>
                <th className="th">Taux</th>
                <th className="th right">Montant TVA</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.source} className="tr-hover">
                  <td className="td" style={{ fontWeight: 500 }}>{row.source}</td>
                  <td className="td right tabular">{formatMAD(row.baseHT).split(",")[0]}</td>
                  <td className="td">{row.rateLabel}</td>
                  <td className="td right tabular" style={{ color: row.family === "collectee" ? "var(--accent-ink)" : "var(--ink-0)" }}>
                    {formatMAD(row.tva).split(",")[0]}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "1.5px solid var(--line-1)", background: "var(--bg-inset)", fontWeight: 600 }}>
                <td className="td">Solde</td>
                <td className="td" />
                <td className="td">{solde >= 0 ? "À payer" : "Crédit TVA"}</td>
                <td className="td right tabular" style={{ color: solde >= 0 ? "var(--warn-ink)" : "var(--pos-ink)" }}>
                  {formatMAD(solde).split(",")[0]}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div className="card-title" style={{ marginBottom: 4 }}>Sources complémentaires</div>
          <div style={{ fontSize: 11.5, color: "var(--ink-2)", marginBottom: 16 }}>
            Simulation configurable des montants TVA hors factures importées.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SourceEditor
              title="CMI / TPE"
              enabled={config.enable_tpe}
              baseValue={config.cmi_base_ht}
              rateValue={config.cmi_rate}
              onToggle={(checked) => saveConfig({ ...config, enable_tpe: checked })}
              onBaseChange={(value) => saveConfig({ ...config, cmi_base_ht: value })}
              onRateChange={(value) => saveConfig({ ...config, cmi_rate: value })}
            />
            <SourceEditor
              title="Relevés bancaires"
              enabled={config.enable_bank}
              baseValue={config.bank_base_ht}
              rateValue={config.bank_rate}
              onToggle={(checked) => saveConfig({ ...config, enable_bank: checked })}
              onBaseChange={(value) => saveConfig({ ...config, bank_base_ht: value })}
              onRateChange={(value) => saveConfig({ ...config, bank_rate: value })}
            />
          </div>

          <div style={{ marginTop: 16, padding: "12px 14px", background: "var(--bg-inset)", borderRadius: 10, fontSize: 12, color: "var(--ink-2)" }}>
            <div style={{ fontWeight: 500, color: "var(--ink-0)", marginBottom: 4 }}>Lecture actuelle</div>
            <div>Taux par défaut: {config.default_rate}%</div>
            <div>Régime TVA: {config.regime_tva === "encaissements" ? "Encaissements" : "Débits"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KPI({ icon, label, value, unit = "MAD", tone }) {
  const palette = {
    ink: {
      icon: "var(--ink-0)",
      value: "var(--ink-0)",
      unit: "var(--ink-2)",
    },
    accent: {
      icon: "#8a6508",
      value: "#7a5a00",
      unit: "#7a5a00",
    },
    warn: {
      icon: "#c79a22",
      value: "#c79a22",
      unit: "#d6aa35",
    },
    pos: {
      icon: "#2f7a5d",
      value: "#2f7a5d",
      unit: "#4f8d7d",
    },
  };

  const colors = palette[tone] || palette.ink;

  return (
    <div className="kpi">
      <div className="kpi-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: colors.icon }}>{icon}</span>
        <span>{label}</span>
      </div>
      <div className="kpi-value">
        <span className="tabular" style={{ color: colors.value }}>
          {typeof value === "number" && unit ? formatMAD(value).split(",")[0] : value}
        </span>
        <span className="unit" style={{ color: colors.unit }}>{unit}</span>
      </div>
    </div>
  );
}

function SourceEditor({ title, enabled, baseValue, rateValue, onToggle, onBaseChange, onRateChange }) {
  return (
    <div style={{ padding: 14, border: "1px solid var(--line-1)", borderRadius: 12, background: "var(--bg-inset)" }}>
      <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 500 }}>{title}</div>
          <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>Montants mock utilisés dans le calcul TVA</div>
        </div>
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, opacity: enabled ? 1 : 0.55 }}>
        <div>
          <label className="label">Base HT</label>
          <input className="input" type="number" value={baseValue} disabled={!enabled} onChange={(e) => onBaseChange(Number(e.target.value) || 0)} />
        </div>
        <div>
          <label className="label">Taux TVA (%)</label>
          <input className="input" type="number" value={rateValue} disabled={!enabled} step={0.5} onChange={(e) => onRateChange(Number(e.target.value) || 0)} />
        </div>
      </div>
    </div>
  );
}
