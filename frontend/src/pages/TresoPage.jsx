import { useMemo, useState } from "react";
import { TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { formatMAD, formatDate } from "../utils/format";

function buildForecast(factures, soldeInitial = 0, horizon = 90) {
  const now = new Date();
  const end = new Date(now.getTime() + horizon * 86400000);
  const days = [];

  // Construire flux jour par jour
  const fluxMap = {};
  (factures || []).forEach(f => {
    const date = f.date_echeance || f.date_facture;
    if (!date) return;
    const d = new Date(date);
    if (d < now || d > end) return;
    const key = d.toISOString().slice(0, 10);
    fluxMap[key] = fluxMap[key] || { entrees: 0, sorties: 0, items: [] };
    const isVente = f.type === "vente" || (f.code_tiers || "").startsWith("CL");
    const montant = f.montant_ttc || 0;
    if (isVente) {
      fluxMap[key].entrees += montant;
    } else {
      fluxMap[key].sorties += montant;
    }
    fluxMap[key].items.push({ fournisseur: f.fournisseur, montant, type: isVente ? "encaissement" : "décaissement" });
  });

  // Construire la courbe cumulée
  let solde = soldeInitial;
  for (let i = 0; i <= horizon; i++) {
    const d = new Date(now.getTime() + i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const flux = fluxMap[key] || { entrees: 0, sorties: 0, items: [] };
    solde += flux.entrees - flux.sorties;
    if (flux.entrees > 0 || flux.sorties > 0 || i % 10 === 0) {
      days.push({ date: key, solde: Math.round(solde), entrees: flux.entrees, sorties: flux.sorties, items: flux.items });
    }
  }
  return days;
}

function SparkLine({ data, color, height = 80 }) {
  const w = 600, h = height;
  if (!data.length) return null;
  const vals = data.map(d => d.solde);
  const min = Math.min(...vals);
  const max = Math.max(...vals, min + 1);
  const scaleX = w / (data.length - 1 || 1);
  const scaleY = (h - 12) / (max - min);
  const pts = data.map((d, i) => [i * scaleX, h - 6 - (d.solde - min) * scaleY]);
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const zero = min < 0 ? h - 6 - (0 - min) * scaleY : null;

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
      {zero !== null && <line x1={0} x2={w} y1={zero} y2={zero} stroke="var(--neg-ink)" strokeWidth={1} strokeDasharray="4 4" opacity={0.4} />}
      <path d={`${path} L${w},${h} L0,${h} Z`} fill={color} opacity="0.12" />
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {pts.filter((_, i) => data[i].entrees > 0 || data[i].sorties > 0).map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={3} fill={color} />
      ))}
    </svg>
  );
}

const HORIZONS = [
  { key: 30,  label: "30 jours" },
  { key: 60,  label: "60 jours" },
  { key: 90,  label: "90 jours" },
];

export default function TresoPage({ factures, dossier }) {
  const soldeInitial = 847230; // TODO: brancher sur relevé bancaire réel

  const forecast30  = useMemo(() => buildForecast(factures, soldeInitial, 30),  [factures]);
  const forecast60  = useMemo(() => buildForecast(factures, soldeInitial, 60),  [factures]);
  const forecast90  = useMemo(() => buildForecast(factures, soldeInitial, 90),  [factures]);

  const allForecasts = { 30: forecast30, 60: forecast60, 90: forecast90 };

  const totalEncaissements = useMemo(() => (factures || []).filter(f => f.type === "vente" || (f.code_tiers || "").startsWith("CL")).reduce((s, f) => s + (f.montant_ttc || 0), 0), [factures]);
  const totalDecaissements = useMemo(() => (factures || []).filter(f => f.type !== "vente" && !(f.code_tiers || "").startsWith("CL")).filter(f => f.paiement !== "payee" && f.paiement !== "payée").reduce((s, f) => s + (f.montant_ttc || 0), 0), [factures]);

  const solde90 = forecast90.length > 0 ? forecast90[forecast90.length - 1].solde : soldeInitial;
  const trend = solde90 > soldeInitial;
  const [hoveredFlux, setHoveredFlux] = useState(null);
  const [hoveredKpi, setHoveredKpi] = useState(null);

  // Prochains flux significatifs
  const upcomingFlux = useMemo(() => {
    const now = new Date();
    return (factures || [])
      .filter(f => f.date_echeance && new Date(f.date_echeance) >= now && f.paiement !== "payee" && f.paiement !== "payée")
      .map(f => ({
        ...f,
        isVente: f.type === "vente" || (f.code_tiers || "").startsWith("CL"),
        daysLeft: Math.round((new Date(f.date_echeance) - now) / 86400000),
      }))
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 8);
  }, [factures]);

  return (
    <div className="page-inner">
      <div className="page-header">
        <div>
          <h1 className="page-title">Trésorerie prévisionnelle</h1>
          <p className="page-subtitle">Projection basée sur les échéances · solde initial {formatMAD(soldeInitial).split(",")[0]} MAD</p>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { id: 0, label: "Solde actuel estimé", value: formatMAD(soldeInitial).split(",")[0], sub: "MAD", bg: undefined, color: "var(--ink-2)", valColor: "var(--ink-0)" },
          { id: 1, label: "Encaissements attendus", value: formatMAD(totalEncaissements).split(",")[0], sub: "MAD · ventes non encaissées", bg: "var(--pos-bg)", color: "var(--pos-ink)", valColor: "var(--pos-ink)" },
          { id: 2, label: "Décaissements à venir", value: formatMAD(totalDecaissements).split(",")[0], sub: "MAD · factures non payées", bg: totalDecaissements > soldeInitial ? "var(--neg-bg)" : "var(--bg-inset)", color: totalDecaissements > soldeInitial ? "var(--neg-ink)" : "var(--ink-2)", valColor: totalDecaissements > soldeInitial ? "var(--neg-ink)" : "var(--ink-0)" },
        ].map(({ id, label, value, sub, bg, color, valColor }) => (
          <div
            key={id}
            className="card"
            onMouseEnter={() => setHoveredKpi(id)}
            onMouseLeave={() => setHoveredKpi(null)}
            style={{
              padding: 20,
              background: bg,
              transform: hoveredKpi === id ? "translateY(-3px)" : "translateY(0)",
              boxShadow: hoveredKpi === id ? "0 8px 24px rgba(0,0,0,0.18)" : undefined,
              transition: "transform 180ms ease, box-shadow 180ms ease",
              cursor: "default",
            }}
          >
            <div style={{ fontSize: 11, color, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-mono)", color: valColor }}>{value}</div>
            <div style={{ fontSize: 11.5, color: hoveredKpi === id ? color : "var(--ink-3)", marginTop: 4, transition: "color 180ms ease" }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Graphique */}
      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "var(--ink-2)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Projection 90 jours</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{formatMAD(solde90).split(",")[0]} MAD</span>
              {trend
                ? <span className="badge pos" style={{ display: "flex", alignItems: "center", gap: 4 }}><TrendingUp size={11} /> Hausse</span>
                : <span className="badge neg" style={{ display: "flex", alignItems: "center", gap: 4 }}><TrendingDown size={11} /> Baisse</span>}
            </div>
          </div>
        </div>
        <SparkLine data={forecast90} color={trend ? "var(--pos)" : "var(--neg-ink)"} height={120} />
        {solde90 < 0 && (
          <div style={{ marginTop: 12, padding: "8px 12px", background: "var(--neg-bg)", borderRadius: 8, fontSize: 12, color: "var(--neg-ink)", display: "flex", gap: 8, alignItems: "center" }}>
            <AlertTriangle size={13} /> Solde prévisionnel négatif dans 90 jours — actions requises
          </div>
        )}
      </div>

      {/* Prochains flux */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line-1)", fontSize: 13, fontWeight: 600 }}>
            Prochains flux
          </div>
          {upcomingFlux.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "var(--ink-3)" }}>Aucune échéance à venir.</div>
          ) : (
            upcomingFlux.map((f, i) => {
              const rowId = f.id || i;
              const isHovered = hoveredFlux === rowId;
              return (
                <div
                  key={rowId}
                  onMouseEnter={() => setHoveredFlux(rowId)}
                  onMouseLeave={() => setHoveredFlux(null)}
                  style={{
                    borderBottom: "1px solid var(--line-1)",
                    background: isHovered ? "rgba(143, 212, 188, 0.05)" : "transparent",
                    transition: "background 150ms ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: f.isVente ? "var(--pos-bg)" : "var(--neg-bg)", color: f.isVente ? "var(--pos-ink)" : "var(--neg-ink)", display: "grid", placeItems: "center", flexShrink: 0, transition: "transform 150ms ease", transform: isHovered ? "scale(1.08)" : "scale(1)" }}>
                      {f.isVente ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }} className="truncate">{f.fournisseur || "—"}</div>
                      <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>Dans {f.daysLeft}j · {formatDate(f.date_echeance)}</div>
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: f.isVente ? "var(--pos-ink)" : "var(--neg-ink)" }}>
                      {f.isVente ? "+" : "-"}{formatMAD(f.montant_ttc || 0).split(",")[0]}
                    </div>
                  </div>
                  {/* Détails expandés */}
                  <div style={{ maxHeight: isHovered ? 48 : 0, overflow: "hidden", transition: "max-height 220ms ease" }}>
                    <div style={{ display: "flex", gap: 16, padding: "0 18px 12px 66px", fontSize: 11.5, color: "var(--ink-3)" }}>
                      {f.num_facture && <span style={{ fontFamily: "var(--font-mono)" }}>{f.num_facture}</span>}
                      {f.statut && <span className={`badge${f.statut === "traite" || f.statut === "traité" ? " pos" : f.statut === "a_valider" ? " warn" : ""}`}>{f.statut}</span>}
                      {f.montant_ht != null && <span>HT {formatMAD(f.montant_ht).split(",")[0]} · TVA {formatMAD((f.tva || 0)).split(",")[0]}</span>}
                      {f.categorie && <span style={{ color: "var(--ink-2)" }}>{f.categorie}</span>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Synthèse par horizon</div>
          {HORIZONS.map(({ key, label }) => {
            const data = allForecasts[key];
            const final = data.length > 0 ? data[data.length - 1].solde : soldeInitial;
            const delta = final - soldeInitial;
            return (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--line-1)" }}>
                <div style={{ width: 60, fontSize: 12, color: "var(--ink-2)" }}>{label}</div>
                <div style={{ flex: 1, height: 4, borderRadius: 99, background: "var(--bg-inset)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, Math.abs(final / (soldeInitial || 1)) * 100)}%`, background: delta >= 0 ? "var(--pos)" : "var(--neg-ink)", borderRadius: 99 }} />
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, minWidth: 80, textAlign: "right", color: delta >= 0 ? "var(--pos-ink)" : "var(--neg-ink)" }}>
                  {delta >= 0 ? "+" : ""}{formatMAD(delta).split(",")[0]}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
