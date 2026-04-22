import { useMemo } from "react";
import {
  Download, AlertTriangle, Check, Mail, Upload, Sparkles, ArrowUpRight, Building2,
} from "lucide-react";
import { formatMAD, formatDate } from "../utils/format";

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

export default function OverviewPage({ factures, dossier, onNavigate }) {
  const now = new Date();

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
    { icon: "sparkles", color: "accent", title: "Extraction automatique terminee", sub: "98% de confiance moyenne sur les derniers lots", time: "Il y a 2 min" },
    { icon: "check", color: "pos", title: "Rapprochement bancaire valide", sub: "5 lignes confirmee cote banque et achats", time: "Il y a 1 h" },
    { icon: "alert", color: "warn", title: "Retards a traiter", sub: `${overdue.length || 0} facture${overdue.length > 1 ? "s" : ""} doivent etre relancees`, time: "Ce matin" },
    { icon: "mail", color: "info", title: "Relance niveau 2 preparee", sub: "Le brouillon email est pret pour validation", time: "Hier" },
    { icon: "upload", color: "", title: "Export SAGE pret", sub: "Le journal des ecritures est disponible en export", time: "Hier" },
  ];

  return (
    <div className="page-inner">
      <section
        className="card"
        style={{
          padding: 28,
          marginBottom: 16,
          background: "linear-gradient(135deg, rgba(255,255,255,0.56), rgba(255,255,255,0.26)), linear-gradient(120deg, rgba(164,104,60,0.08), rgba(81,108,138,0.08))",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(320px, 0.9fr)", gap: 20, alignItems: "stretch" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <div className="badge accent" style={{ marginBottom: 14 }}>Vue cabinet</div>
              <h1 className="page-title" style={{ marginBottom: 10 }}>
                Une lecture plus executive du dossier {dossier?.raison_sociale || "client"}.
              </h1>
              <p className="page-subtitle" style={{ maxWidth: 720, fontSize: 15, lineHeight: 1.7 }}>
                L'interface met maintenant en avant les signaux de gestion avant les widgets.
                On voit d'abord la situation du dossier, puis les actions a prendre.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
              <MetricCard
                label="Achats suivis"
                value={formatMAD(totalAchats).split(",")[0]}
                unit="MAD"
                hint={`${processed.length} factures comptabilisees`}
              />
              <MetricCard
                label="TVA recuperable"
                value={formatMAD(totalTva).split(",")[0]}
                unit="MAD"
                hint="Ventilation prete pour declaration"
              />
              <MetricCard
                label="Retards ouverts"
                value={String(overdue.length)}
                unit="dossiers"
                hint={`${formatMAD(overdueTotal).split(",")[0]} MAD exposes`}
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

          <div className="card" style={{ padding: 22, background: "rgba(255,255,255,0.46)" }}>
            <div className="kpi-label">Lecture rapide</div>
            <div style={{ display: "grid", gap: 18 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                  <span className="card-title" style={{ fontSize: 28 }}>Tresorerie pilotee</span>
                  <span className="badge pos">+3.1%</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 10 }}>
                  Solde BMCE estime au fil des mouvements rapproches.
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

      <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.15fr) minmax(340px, 0.85fr)", gap: 16, marginBottom: 16 }}>
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 16 }}>
            <div>
              <div className="kpi-label">Tendance achats</div>
              <div className="card-title">Flux d'achats sur 12 mois</div>
              <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 6 }}>
                Une presentation plus calme et plus lisible que la grille KPI classique.
              </div>
            </div>
            <button className="btn btn-ghost sm">
              <Download size={13} />
              Rapport
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 220px", gap: 18, alignItems: "center" }}>
            <div className="card" style={{ padding: 18, background: "rgba(255,255,255,0.34)" }}>
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
              <DataPoint label="Ecritures traitees" value={String(processed.length)} />
              <DataPoint label="Montant moyen" value={formatMAD(processed.length ? totalAchats / processed.length : 0).split(",")[0]} mono />
              <DataPoint label="Derniere mise a jour" value={formatDate(new Date().toISOString())} />
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <div className="kpi-label">Exposition fournisseurs</div>
          <div className="card-title" style={{ marginBottom: 6 }}>Balance agee</div>
          <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 18 }}>
            Les montants a surveiller remontent avant la table detaillee.
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

      <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.95fr) minmax(0, 1.05fr)", gap: 16 }}>
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
                Aucune donnee fournisseur pour le moment.
              </div>
            )}
            {topFournisseurs.map(([name, amt], i) => (
              <div key={name} className="card" style={{ padding: 16, background: "rgba(255,255,255,0.32)" }}>
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

        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
            <div>
              <div className="kpi-label">Actions recentes</div>
              <div className="card-title">Activite du dossier</div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {activity.map((a, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "34px 1fr auto", gap: 12, alignItems: "center", padding: "14px 0", borderBottom: i < activity.length - 1 ? "1px solid var(--line-1)" : "none" }}>
                <div style={{ width: 34, height: 34, borderRadius: 12, background: a.color ? `var(--${a.color}-bg)` : "rgba(255,255,255,0.36)", color: a.color ? `var(--${a.color}-ink)` : "var(--ink-2)", display: "grid", placeItems: "center" }}>
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
      </section>
    </div>
  );
}

function MetricCard({ label, value, unit, hint, tone = "neutral" }) {
  const toneStyle = tone === "warn"
    ? { borderColor: "rgba(195,139,28,0.22)", background: "rgba(195,139,28,0.08)" }
    : {};

  return (
    <div className="card" style={{ padding: 18, background: "rgba(255,255,255,0.34)", ...toneStyle }}>
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
    <div className="card" style={{ padding: 14, background: "rgba(255,255,255,0.3)" }}>
      <div className="kpi-label" style={{ marginBottom: 8 }}>{label}</div>
      <div className={mono ? "mono tabular" : ""} style={{ fontSize: 13, fontWeight: 600 }}>
        {value}
      </div>
    </div>
  );
}
