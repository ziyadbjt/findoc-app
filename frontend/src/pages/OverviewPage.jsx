import { useEffect, useMemo, useState } from "react";
import {
  Download, AlertTriangle, Check, Mail, Upload, Sparkles, ArrowUpRight, Building2, TrendingUp, TrendingDown, Settings2, X,
} from "lucide-react";
import Drawer from "../components/Drawer";
import { formatMAD, formatDate } from "../utils/format";

const DASHBOARD_WIDGETS = [
  { key: "hero", label: "Vue d'ensemble", desc: "Bloc d'ouverture avec KPIs et actions rapides." },
  { key: "finance", label: "Tendance & balance âgée", desc: "Flux d'achats et exposition fournisseurs." },
  { key: "comparison", label: "Comparaison N vs N-1", desc: "Vue exercice en cours contre l'exercice précédent." },
  { key: "suppliers", label: "Top fournisseurs", desc: "Concentration des achats par tiers." },
  { key: "activity", label: "Activité du dossier", desc: "Actions récentes et signaux de suivi." },
];

function getDashboardPrefsKey(user, dossier) {
  return `findoc:dashboard:${user?.email || "anon"}:${dossier?.id || "global"}`;
}

function MiniTrend({ data, color = "var(--accent)" }) {
  const width = 180;
  const height = 56;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const stepX = width / Math.max(data.length - 1, 1);
  const pts = data.map((v, i) => [i * stepX, height - ((v - min) / range) * (height - 8) - 4]);
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <path d={`${d} L${width},${height} L0,${height} Z`} fill={color} opacity="0.12" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function ComparaisonNvsN1({ factures }) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const lastYear = currentYear - 1;

  const byYear = useMemo(() => {
    const curr = { achats: 0, ventes: 0, tva: 0, nb: 0 };
    const prev = { achats: 0, ventes: 0, tva: 0, nb: 0 };
    (factures || []).forEach(f => {
      const y = new Date(f.date_facture || "").getFullYear();
      const target = y === currentYear ? curr : y === lastYear ? prev : null;
      if (!target) return;
      target.nb++;
      target.tva += f.tva || 0;
      if (f.type === "vente" || (f.code_tiers || "").startsWith("CL")) target.ventes += f.montant_ttc || 0;
      else target.achats += f.montant_ttc || 0;
    });
    return { curr, prev };
  }, [factures, currentYear, lastYear]);

  const { curr, prev } = byYear;

  const delta = (a, b) => {
    if (!b) return null;
    return Math.round(((a - b) / b) * 100);
  };

  const rows = [
    { label: "Achats TTC",  curr: curr.achats,  prev: prev.achats  },
    { label: "Ventes TTC",  curr: curr.ventes,  prev: prev.ventes  },
    { label: "TVA",         curr: curr.tva,     prev: prev.tva     },
    { label: "Factures",    curr: curr.nb,      prev: prev.nb, isCount: true },
  ];

  if (prev.nb === 0 && curr.nb === 0) return null;

  return (
    <section className="card" style={{ padding: 24, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div>
          <div className="kpi-label">Exercice comparé</div>
          <div className="card-title">N ({currentYear}) vs N-1 ({lastYear})</div>
        </div>
        {prev.nb === 0 && <span className="badge" style={{ marginLeft: "auto" }}>Données {lastYear} insuffisantes</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {rows.map(r => {
          const d = delta(r.curr, r.prev);
          const up = d !== null && d >= 0;
          return (
            <div key={r.label} className="card" style={{ padding: 16, background: "var(--bg-inset)" }}>
              <div style={{ fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{r.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "var(--font-mono)", marginBottom: 6 }}>
                {r.isCount ? curr[r.label === "Factures" ? "nb" : ""] : formatMAD(r.curr).split(",")[0]}
                {!r.isCount && <span style={{ fontSize: 12, fontWeight: 400, color: "var(--ink-3)", marginLeft: 4 }}>MAD</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {d !== null ? (
                  <>
                    {up ? <TrendingUp size={12} style={{ color: "var(--pos-ink)" }} /> : <TrendingDown size={12} style={{ color: "var(--neg-ink)" }} />}
                    <span style={{ fontSize: 12, fontWeight: 600, color: up ? "var(--pos-ink)" : "var(--neg-ink)" }}>
                      {up ? "+" : ""}{d}%
                    </span>
                    <span style={{ fontSize: 11, color: "var(--ink-3)" }}>vs {lastYear}</span>
                  </>
                ) : (
                  <span style={{ fontSize: 11, color: "var(--ink-3)" }}>Pas de données {lastYear}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function OverviewPage({ factures, dossier, dossierId, onNavigate, user }) {
  const now = new Date();
  const [showCustomize, setShowCustomize] = useState(false);
  const [visibleWidgets, setVisibleWidgets] = useState(() =>
    DASHBOARD_WIDGETS.reduce((acc, widget) => ({ ...acc, [widget.key]: true }), {})
  );

  useEffect(() => {
    const key = getDashboardPrefsKey(user, dossier);
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        setVisibleWidgets(DASHBOARD_WIDGETS.reduce((acc, widget) => ({ ...acc, [widget.key]: true }), {}));
        return;
      }
      const parsed = JSON.parse(raw);
      setVisibleWidgets(DASHBOARD_WIDGETS.reduce((acc, widget) => ({ ...acc, [widget.key]: parsed?.[widget.key] !== false }), {}));
    } catch {
      setVisibleWidgets(DASHBOARD_WIDGETS.reduce((acc, widget) => ({ ...acc, [widget.key]: true }), {}));
    }
  }, [dossier, user]);

  const updateWidgetVisibility = (key, checked) => {
    const next = { ...visibleWidgets, [key]: checked };
    setVisibleWidgets(next);
    localStorage.setItem(getDashboardPrefsKey(user, dossier), JSON.stringify(next));
  };

  const aging = useMemo(() => {
    const buckets = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
    factures.filter((f) => f.paiement !== "payee" && f.paiement !== "payée" && f.date_echeance).forEach((f) => {
      const days = Math.max(0, (now - new Date(f.date_echeance)) / (1000 * 60 * 60 * 24));
      if (days <= 30) buckets["0-30"] += f.montant_ttc || 0;
      else if (days <= 60) buckets["31-60"] += f.montant_ttc || 0;
      else if (days <= 90) buckets["61-90"] += f.montant_ttc || 0;
      else buckets["90+"] += f.montant_ttc || 0;
    });
    return buckets;
  }, [factures, now]);

  const processed = factures.filter((f) => f.statut === "traite" || f.statut === "traité");
  const totalAchats = processed.reduce((s, f) => s + (f.montant_ttc || 0), 0);
  const totalTva = processed.reduce((s, f) => s + (f.tva || 0), 0);
  const overdue = factures.filter((f) => f.paiement === "en_retard");
  const overdueTotal = overdue.reduce((s, f) => s + (f.montant_ttc || 0), 0);

  const topFournisseurs = useMemo(() => {
    const map = new Map();
    processed.forEach((f) => {
      map.set(f.fournisseur, (map.get(f.fournisseur) || 0) + (f.montant_ttc || 0));
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [processed]);

  const totalAging = Object.values(aging).reduce((a, b) => a + b, 0) || 1;
  const trendAchats = [120, 135, 118, 142, 167, 189, 203, 195, 178, 210, 232, 248];
  const trendCash = [420, 445, 460, 510, 495, 540, 580, 620, 610, 695, 780, 847];

  const activity = [
    { icon: "sparkles", color: "accent", title: "Extraction automatique terminée", sub: "98% de confiance moyenne sur les derniers lots", time: "Il y a 2 min" },
    { icon: "check", color: "pos", title: "Rapprochement bancaire validé", sub: "5 lignes confirmées côté banque et achats", time: "Il y a 1 h" },
    { icon: "alert", color: "warn", title: "Retards à traiter", sub: `${overdue.length || 0} facture${overdue.length > 1 ? "s" : ""} à relancer`, time: "Ce matin" },
    { icon: "mail", color: "info", title: "Relance niveau 2 préparée", sub: "Le brouillon email est prêt pour validation", time: "Hier" },
    { icon: "upload", color: "", title: "Export SAGE prêt", sub: "Le journal des écritures est disponible en export", time: "Hier" },
  ];

  // Alertes intelligentes calculées dynamiquement
  const smartAlerts = useMemo(() => {
    const alerts = [];
    if (overdue.length > 0) {
      const penaltyTotal = overdue.reduce((s, f) => {
        const days = Math.max(0, (now - new Date(f.date_echeance)) / 86400000);
        return s + (f.montant_ttc || 0) * 0.0525 * Math.max(0, days - 60) / 365;
      }, 0);
      alerts.push({
        type: "neg",
        icon: "alert",
        msg: `${overdue.length} facture${overdue.length > 1 ? "s" : ""} en retard — pénalité Loi 69-21 estimée : ${Math.round(penaltyTotal).toLocaleString("fr-FR")} MAD`,
        action: "relances",
        actionLabel: "Voir les relances",
      });
    }
    const aValider = factures.filter(f => f.statut === "a_valider" || f.statut === "à_valider");
    if (aValider.length > 0) {
      alerts.push({
        type: "warn",
        icon: "sparkles",
        msg: `${aValider.length} facture${aValider.length > 1 ? "s" : ""} extraite${aValider.length > 1 ? "s" : ""} en attente de validation`,
        action: "factures",
        actionLabel: "Valider",
      });
    }
    const lowConf = factures.filter(f => f.confidence != null && f.confidence < 0.8);
    if (lowConf.length > 0) {
      alerts.push({
        type: "warn",
        icon: "warn",
        msg: `${lowConf.length} facture${lowConf.length > 1 ? "s" : ""} avec confiance d'extraction < 80%`,
        action: "factures",
        actionLabel: "Corriger",
      });
    }
    const tvaSolde = factures.filter(f => f.type === "vente").reduce((s, f) => s + (f.tva || 0), 0)
      - factures.filter(f => f.type !== "vente").reduce((s, f) => s + (f.tva || 0), 0);
    if (tvaSolde > 10000) {
      alerts.push({
        type: "accent",
        icon: "info",
        msg: `TVA à reverser à la DGI : ${Math.round(tvaSolde).toLocaleString("fr-FR")} MAD`,
        action: "tva",
        actionLabel: "Voir TVA",
      });
    }
    return alerts;
  }, [factures, overdue, now]);

  return (
    <div className="page-inner">

      {smartAlerts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          {smartAlerts.map((alert, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
              borderRadius: 10,
              background: alert.type === "neg" ? "var(--neg-bg)" : alert.type === "warn" ? "var(--warn-bg)" : "var(--accent-bg)",
              border: `1px solid color-mix(in srgb, var(--${alert.type === "accent" ? "accent" : alert.type}-ink) 20%, transparent)`,
            }}>
              <AlertTriangle size={14} style={{ color: `var(--${alert.type === "accent" ? "accent" : alert.type}-ink)`, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 12.5, color: `var(--${alert.type === "accent" ? "accent" : alert.type}-ink)` }}>
                {alert.msg}
              </span>
              {onNavigate && (
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: 11.5, padding: "3px 10px" }}
                  onClick={() => onNavigate(alert.action)}
                >
                  {alert.actionLabel}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showCustomize && (
        <Drawer
          open={showCustomize}
          onClose={() => setShowCustomize(false)}
          width={420}
          bodyClassName="drawer-body-padded drawer-body-stack"
          header={(
            <>
              <Settings2 size={16} style={{ color: "var(--ink-1)" }} />
              <div style={{ fontWeight: 600, fontSize: 14 }}>Personnaliser le dashboard</div>
              <button className="icon-btn" style={{ marginLeft: "auto" }} onClick={() => setShowCustomize(false)}><X size={15} /></button>
            </>
          )}
        >
              {DASHBOARD_WIDGETS.map((widget) => (
                <label key={widget.key} className="card" style={{ padding: 16, display: "flex", gap: 12, alignItems: "flex-start", background: "var(--bg-inset)" }}>
                  <input
                    type="checkbox"
                    checked={visibleWidgets[widget.key] !== false}
                    onChange={(event) => updateWidgetVisibility(widget.key, event.target.checked)}
                    style={{ marginTop: 3 }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{widget.label}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-2)", marginTop: 4 }}>{widget.desc}</div>
                  </div>
                </label>
              ))}
        </Drawer>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
          Personnalisez les blocs visibles dans votre aperçu.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {onNavigate && (
            <button className="btn btn-primary" onClick={() => onNavigate("rapport_mensuel")}>
              <Sparkles size={14} />
              Rapport IA
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => setShowCustomize(true)}>
            <Settings2 size={14} />
            Personnaliser
          </button>
        </div>
      </div>

      {visibleWidgets.hero !== false && (
        <section
          className="card"
          style={{
            padding: 28,
            marginBottom: 16,
          }}
        >
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(320px, 0.9fr)", gap: 20, alignItems: "stretch" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <div className="badge accent" style={{ marginBottom: 14 }}>Vue d'ensemble</div>
              <h1 className="page-title" style={{ marginBottom: 10 }}>
                {dossier?.raison_sociale || "Tableau de bord"}
              </h1>
              <p className="page-subtitle" style={{ maxWidth: 720, fontSize: 15, lineHeight: 1.7 }}>
                Santé financière du dossier, alertes actives et actions prioritaires en un coup d'œil.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
              <MetricCard
                label="Achats suivis"
                value={formatMAD(totalAchats).split(",")[0]}
                unit="MAD"
                hint={`${processed.length} factures comptabilisées`}
              />
              <MetricCard
                label="TVA récupérable"
                value={formatMAD(totalTva).split(",")[0]}
                unit="MAD"
                hint="Ventilation prête pour déclaration"
              />
              <MetricCard
                label="Retards ouverts"
                value={String(overdue.length)}
                unit="dossiers"
                hint={`${formatMAD(overdueTotal).split(",")[0]} MAD exposés`}
                tone="warn"
              />
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn btn-primary" onClick={() => onNavigate("factures")}>
                Voir les factures
                <ArrowUpRight size={14} />
              </button>
              <button className="btn btn-secondary" onClick={() => onNavigate("relances")}>
                Ouvrir les relances
              </button>
            </div>
          </div>

          <div className="card" style={{ padding: 22, background: "var(--bg-inset)" }}>
            <div className="kpi-label">Lecture rapide</div>
            <div style={{ display: "grid", gap: 18 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                  <span className="card-title" style={{ fontSize: 28 }}>Trésorerie pilotée</span>
                  <span className="badge pos">+3.1%</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 10 }}>
                  Solde BMCE estimé au fil des mouvements rapprochés.
                </div>
                <div className="kpi-value">
                  <span className="tabular">847 230</span>
                  <span className="unit">MAD</span>
                </div>
                <div style={{ marginTop: 12 }}>
                  <MiniTrend data={trendCash} color="var(--pos)" />
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--line-1)", paddingTop: 16, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                <DataPoint label="Exercice" value="2026" />
                <DataPoint label="ICE" value={dossier?.ice || "--"} mono />
                <DataPoint label="Forme" value={dossier?.forme_juridique || "SARL"} />
                <DataPoint label="Ville" value={dossier?.ville || "Casablanca"} />
              </div>
            </div>
          </div>
        </div>
        </section>
      )}

      {visibleWidgets.finance !== false && (
        <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.15fr) minmax(340px, 0.85fr)", gap: 16, marginBottom: 16 }}>
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 16 }}>
            <div>
              <div className="kpi-label">Tendance achats</div>
              <div className="card-title">Flux d'achats sur 12 mois</div>
              <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 6 }}>
                Évolution mensuelle du volume d'achats sur 12 mois glissants.
              </div>
            </div>
            <button className="btn btn-ghost sm">
              <Download size={13} />
              Rapport
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 220px", gap: 18, alignItems: "center" }}>
            <div className="card" style={{ padding: 18, background: "var(--bg-inset)" }}>
              <div className="kpi-value" style={{ marginBottom: 8 }}>
                <span className="tabular">{formatMAD(totalAchats).split(",")[0]}</span>
                <span className="unit">MAD</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span className="badge pos">+12.4%</span>
                <span style={{ fontSize: 12, color: "var(--ink-2)" }}>sur 90 jours glissants</span>
              </div>
              <MiniTrend data={trendAchats} color="var(--accent)" />
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <DataPoint label="Écritures traitées" value={String(processed.length)} />
              <DataPoint label="Montant moyen" value={formatMAD(processed.length ? totalAchats / processed.length : 0).split(",")[0]} mono />
              <DataPoint label="Dernière mise à jour" value={formatDate(new Date().toISOString())} />
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <div className="kpi-label">Exposition fournisseurs</div>
          <div className="card-title" style={{ marginBottom: 6 }}>Balance âgée</div>
          <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 18 }}>
            Répartition des factures impayées par tranche d'ancienneté.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {Object.entries(aging).map(([bucket, amount]) => {
              const pct = (amount / totalAging) * 100;
              const tone = bucket === "61-90" || bucket === "90+" ? "var(--warn)" : "var(--accent)";
              return (
                <div key={bucket}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: "var(--ink-1)", fontWeight: 600 }}>{bucket} jours</span>
                    <span className="mono tabular" style={{ fontSize: 12 }}>{formatMAD(amount).split(",")[0]}</span>
                  </div>
                  <div className="aging-bar">
                    <div className="aging-seg" style={{ width: `${pct}%`, background: tone }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        </section>
      )}

      {visibleWidgets.comparison !== false && <ComparaisonNvsN1 factures={factures} />}

      {(visibleWidgets.suppliers !== false || visibleWidgets.activity !== false) && (
        <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.95fr) minmax(0, 1.05fr)", gap: 16 }}>
        {visibleWidgets.suppliers !== false && (
          <div className="card" style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
            <div>
              <div className="kpi-label">Concentration</div>
              <div className="card-title">Top fournisseurs</div>
            </div>
            <button className="btn btn-ghost sm" onClick={() => onNavigate("tiers")}>
              Voir les tiers
            </button>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {topFournisseurs.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--ink-3)", padding: "20px 0", textAlign: "center" }}>
                Aucune donnée fournisseur pour le moment.
              </div>
            )}
            {topFournisseurs.map(([name, amt], i) => (
              <div key={name} className="card" style={{ padding: 16, background: "var(--bg-inset)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "32px 1fr auto", gap: 12, alignItems: "center" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 999, background: "var(--accent-bg)", color: "var(--accent-ink)", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700 }}>
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{name}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                      <Building2 size={12} />
                      fournisseur actif
                    </div>
                  </div>
                  <div className="mono tabular" style={{ fontSize: 12, fontWeight: 600 }}>{formatMAD(amt).split(",")[0]}</div>
                </div>
              </div>
            ))}
          </div>
          </div>
        )}

        {visibleWidgets.activity !== false && (
          <div className="card" style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
            <div>
              <div className="kpi-label">Actions récentes</div>
              <div className="card-title">Activité du dossier</div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {activity.map((a, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "34px 1fr auto", gap: 12, alignItems: "center", padding: "14px 0", borderBottom: i < activity.length - 1 ? "1px solid var(--line-1)" : "none" }}>
                <div style={{ width: 34, height: 34, borderRadius: 12, background: a.color ? `var(--${a.color}-bg)` : "var(--bg-inset)", color: a.color ? `var(--${a.color}-ink)` : "var(--ink-2)", display: "grid", placeItems: "center" }}>
                  {a.icon === "sparkles" ? <Sparkles size={14} /> : a.icon === "check" ? <Check size={14} /> : a.icon === "alert" ? <AlertTriangle size={14} /> : a.icon === "mail" ? <Mail size={14} /> : <Upload size={14} />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{a.title}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 3 }} className="truncate">{a.sub}</div>
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>{a.time}</div>
              </div>
            ))}
          </div>
          </div>
        )}
        </section>
      )}
    </div>
  );
}

function MetricCard({ label, value, unit, hint, tone = "neutral" }) {
  const toneStyle = tone === "warn"
    ? { borderColor: "rgba(212,185,106,0.28)", background: "rgba(212,185,106,0.08)" }
    : {};

  return (
    <div className="card" style={{ padding: 18, background: "var(--bg-inset)", ...toneStyle }}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">
        <span className="tabular">{value}</span>
        {unit && <span className="unit">{unit}</span>}
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 10 }}>{hint}</div>
    </div>
  );
}

function DataPoint({ label, value, mono = false }) {
  return (
    <div className="card" style={{ padding: 14, background: "var(--bg-inset)" }}>
      <div className="kpi-label" style={{ marginBottom: 8 }}>{label}</div>
      <div className={mono ? "mono tabular" : ""} style={{ fontSize: 13, fontWeight: 600 }}>
        {value}
      </div>
    </div>
  );
}
