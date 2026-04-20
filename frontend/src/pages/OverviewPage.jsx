import { useMemo } from "react";
import { Download, AlertTriangle, Check, Mail, Upload, Sparkles, GitMerge, ChevronRight } from "lucide-react";
import { formatMAD, formatDate } from "../utils/format";

function Sparkline({ data, color = "var(--accent)", height = 34, width = 140 }) {
  const max = Math.max(...data, 1), min = Math.min(...data, 0);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const pts = data.map((v, i) => [i * stepX, height - ((v - min) / range) * (height - 4) - 2]);
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <path d={d + ` L${width},${height} L0,${height} Z`} fill={color} opacity="0.12" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default function OverviewPage({ factures, dossier, bankLines, onNavigate }) {
  const now = new Date();

  const aging = useMemo(() => {
    const buckets = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
    factures.filter(f => f.paiement !== "payée" && f.date_echeance).forEach(f => {
      const days = Math.max(0, (now - new Date(f.date_echeance)) / (1000 * 60 * 60 * 24));
      if (days <= 30) buckets["0-30"] += f.montant_ttc || 0;
      else if (days <= 60) buckets["31-60"] += f.montant_ttc || 0;
      else if (days <= 90) buckets["61-90"] += f.montant_ttc || 0;
      else buckets["90+"] += f.montant_ttc || 0;
    });
    return buckets;
  }, [factures]);

  const total_achats = factures.filter(f => f.statut === "traité").reduce((s, f) => s + (f.montant_ttc || 0), 0);
  const total_tva = factures.filter(f => f.statut === "traité").reduce((s, f) => s + (f.tva || 0), 0);
  const en_retard = factures.filter(f => f.paiement === "en_retard");
  const en_retard_total = en_retard.reduce((s, f) => s + (f.montant_ttc || 0), 0);

  const topFournisseurs = useMemo(() => {
    const map = new Map();
    factures.filter(f => f.statut === "traité").forEach(f => {
      map.set(f.fournisseur, (map.get(f.fournisseur) || 0) + (f.montant_ttc || 0));
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [factures]);

  const totalAging = Object.values(aging).reduce((a, b) => a + b, 0) || 1;
  const trend_achats = [120, 135, 118, 142, 167, 189, 203, 195, 178, 210, 232, 248];
  const trend_cash = [420, 445, 460, 510, 495, 540, 580, 620, 610, 695, 780, 847];

  return (
    <div className="page-inner">
      <div className="page-header">
        <div>
          <h1 className="page-title">Aperçu</h1>
          <p className="page-subtitle">{dossier?.raison_sociale} · exercice 2026 · <span className="mono">ICE {dossier?.ice}</span></p>
        </div>
        <div className="page-actions">
          <div className="segmented">
            <button>7j</button><button>30j</button><button className="active">90j</button><button>YTD</button>
          </div>
          <button className="btn btn-secondary"><Download size={13} /> Rapport</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 12 }}>
        <div className="kpi">
          <div className="kpi-label">Achats TTC · 90j</div>
          <div className="kpi-value"><span className="tabular">{formatMAD(total_achats).split(",")[0]}</span><span className="unit">MAD</span></div>
          <div className="kpi-delta">
            <span className="chip pos">▲ 12,4%</span>
            <Sparkline data={trend_achats} color="var(--ink-1)" />
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">TVA récupérable</div>
          <div className="kpi-value"><span className="tabular">{formatMAD(total_tva).split(",")[0]}</span><span className="unit">MAD</span></div>
          <div className="kpi-delta"><span className="chip">{factures.filter(f => f.statut === "traité").length} écritures</span></div>
        </div>
        <div className="kpi" style={{ borderColor: en_retard.length > 0 ? "var(--warn-line)" : undefined }}>
          <div className="kpi-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            Retards
          </div>
          <div className="kpi-value"><span className="tabular" style={{ color: "var(--warn-ink)" }}>{formatMAD(en_retard_total).split(",")[0]}</span><span className="unit">MAD</span></div>
          <div className="kpi-delta">
            <span className="chip warn"><span className="dot" style={{ background: "var(--warn)", width: 5, height: 5, borderRadius: 99, display: "inline-block", marginRight: 4 }} />{en_retard.length} factures</span>
            <button className="btn btn-ghost sm" style={{ marginLeft: "auto", fontSize: 11 }} onClick={() => onNavigate("relances")}>Relancer →</button>
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Trésorerie BMCE</div>
          <div className="kpi-value"><span className="tabular">847 230</span><span className="unit">MAD</span></div>
          <div className="kpi-delta">
            <span className="chip pos">▲ 3,1%</span>
            <Sparkline data={trend_cash} color="var(--pos-ink)" />
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 12 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <div className="card-title">Flux de trésorerie</div>
              <div style={{ fontSize: 11.5, color: "var(--ink-2)", marginTop: 2 }}>Encaissements vs décaissements · 12 mois</div>
            </div>
            <div style={{ display: "flex", gap: 14, fontSize: 11 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, background: "var(--pos-ink)", borderRadius: 2 }} />Encaissements</span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, background: "var(--neg-ink)", borderRadius: 2 }} />Décaissements</span>
            </div>
          </div>
          <CashFlowChart />
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div className="card-title" style={{ marginBottom: 4 }}>Balance âgée fournisseurs</div>
          <div style={{ fontSize: 11.5, color: "var(--ink-2)", marginBottom: 20 }}>Total à payer · <span className="mono tabular">{formatMAD(totalAging)} MAD</span></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {Object.entries(aging).map(([bucket, amount]) => {
              const pct = (amount / totalAging) * 100;
              const warn = bucket === "61-90" || bucket === "90+";
              return (
                <div key={bucket}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: "var(--ink-1)", fontWeight: 500 }}>{bucket} jours</span>
                    <span className="mono tabular" style={{ fontSize: 12 }}>{formatMAD(amount).split(",")[0]}</span>
                  </div>
                  <div style={{ height: 6, background: "var(--bg-inset)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: warn ? "var(--warn-ink)" : "var(--ink-1)", borderRadius: 3, transition: "width 0.6s" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
            <div>
              <div className="card-title">Top fournisseurs · 90j</div>
              <div style={{ fontSize: 11.5, color: "var(--ink-2)", marginTop: 2 }}>Par volume TTC</div>
            </div>
            <button className="btn btn-ghost sm" onClick={() => onNavigate("tiers")}>Voir tiers →</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {topFournisseurs.length === 0 && <div style={{ fontSize: 12, color: "var(--ink-3)", padding: "20px 0", textAlign: "center" }}>Aucune donnée</div>}
            {topFournisseurs.map(([name, amt], i) => (
              <div key={name} style={{ display: "grid", gridTemplateColumns: "20px 1fr", gap: 12, alignItems: "center" }}>
                <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 500 }}>{name}</span>
                    <span className="mono tabular" style={{ fontSize: 12 }}>{formatMAD(amt).split(",")[0]}</span>
                  </div>
                  <div style={{ height: 4, background: "var(--bg-inset)", borderRadius: 2 }}>
                    <div style={{ height: "100%", width: `${(amt / (topFournisseurs[0]?.[1] || 1)) * 100}%`, background: `oklch(${0.55 + i * 0.05} 0.08 ${200 + i * 40})`, borderRadius: 2 }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
            <div className="card-title">Activité récente</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {[
              { icon: "sparkles", color: "accent", title: "Factures extraites automatiquement", sub: "98% conf. moyenne", time: "2min" },
              { icon: "check", color: "pos", title: "Rapprochement BMCE validé", sub: "5 lignes sur 8 · rapproché", time: "1h" },
              { icon: "alert", color: "warn", title: "Retard de paiement détecté", sub: "pénalité calculée au taux BAM 2,25%", time: "3h" },
              { icon: "mail", color: "info", title: "Relance envoyée · niveau 2", sub: "Fournisseur · en retard", time: "hier" },
              { icon: "upload", color: "", title: "Export SAGE 100 · journal", sub: "Écritures générées · prêt", time: "hier" },
            ].map((a, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "26px 1fr auto", gap: 10, alignItems: "center", padding: "10px 0", borderBottom: i < 4 ? "1px solid var(--line-1)" : "none" }}>
                <div style={{ width: 26, height: 26, borderRadius: 6, background: a.color ? `var(--${a.color}-bg)` : "var(--bg-inset)", color: a.color ? `var(--${a.color}-ink)` : "var(--ink-2)", display: "grid", placeItems: "center" }}>
                  {a.icon === "sparkles" ? <Sparkles size={13} /> : a.icon === "check" ? <Check size={13} /> : a.icon === "alert" ? <AlertTriangle size={13} /> : a.icon === "mail" ? <Mail size={13} /> : <Upload size={13} />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500 }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 2 }} className="truncate">{a.sub}</div>
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>{a.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CashFlowChart() {
  const months = ["Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc", "Jan", "Fév", "Mar", "Avr"];
  const inc = [380, 420, 390, 460, 510, 490, 540, 620, 580, 610, 720, 780];
  const out = [310, 355, 340, 380, 420, 445, 465, 540, 510, 528, 612, 680];
  const max = Math.max(...inc, ...out) * 1.1;
  const W = 600, H = 220, pad = 28;
  const chartW = W - pad * 2, chartH = H - pad * 2;
  const stepX = chartW / (months.length - 1);
  const yAt = (v) => H - pad - (v / max) * chartH;
  const toPath = (arr) => arr.map((v, i) => `${i === 0 ? "M" : "L"}${pad + i * stepX},${yAt(v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
        <line key={i} x1={pad} x2={W - pad} y1={pad + f * chartH} y2={pad + f * chartH} stroke="var(--line-1)" strokeDasharray={f === 1 ? "" : "2 3"} />
      ))}
      <path d={toPath(inc) + ` L${pad + (months.length - 1) * stepX},${H - pad} L${pad},${H - pad} Z`} fill="var(--pos-ink)" opacity="0.1" />
      <path d={toPath(inc)} fill="none" stroke="var(--pos-ink)" strokeWidth="1.75" strokeLinejoin="round" />
      <path d={toPath(out)} fill="none" stroke="var(--neg-ink)" strokeWidth="1.75" strokeLinejoin="round" strokeDasharray="3 2" />
      {months.map((m, i) => (
        <g key={m}>
          <circle cx={pad + i * stepX} cy={yAt(inc[i])} r="2.5" fill="var(--pos-ink)" />
          <text x={pad + i * stepX} y={H - 4} fontSize="9.5" fill="var(--ink-3)" textAnchor="middle">{m}</text>
        </g>
      ))}
    </svg>
  );
}
