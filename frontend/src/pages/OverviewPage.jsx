import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download, AlertTriangle, Check, Mail, Upload, Sparkles, ArrowUpRight, Building2, TrendingUp, TrendingDown, Settings2, X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Drawer from "../components/Drawer";
import { sendChatMessage } from "../api";
import { formatMAD, formatDate } from "../utils/format";

const DASHBOARD_WIDGETS = [
  { key: "hero", label: "Vue d'ensemble", desc: "Montants, retards et signaux du dossier." },
  { key: "health", label: "Score de santé financière", desc: "Score composite 0-100 basé sur les retards, la TVA, la concentration et la trésorerie." },
  { key: "finance", label: "Tendance & balance âgée", desc: "Flux d'achats et exposition fournisseurs." },
  { key: "comparison", label: "Comparaison N vs N-1", desc: "Vue exercice en cours contre l'exercice précédent." },
  { key: "treso_forecast", label: "Prévision trésorerie", desc: "Projection des encaissements et décaissements à 30, 60 et 90 jours." },
  { key: "ia_narrative", label: "Analyse IA", desc: "Synthèse financière générée par Claude à la demande." },
  { key: "suppliers", label: "Top fournisseurs", desc: "Concentration des achats par tiers." },
  { key: "activity", label: "Activité du dossier", desc: "Actions récentes et signaux de suivi." },
];

function getDefaultWidgetPrefs() {
  return DASHBOARD_WIDGETS.reduce((acc, widget) => ({ ...acc, [widget.key]: true }), {});
}

function getDashboardPrefsKey(user, dossier) {
  return `findoc:dashboard:${user?.email || "anon"}:${dossier?.id || "global"}`;
}

function readDashboardPrefs(user, dossier) {
  try {
    const raw = localStorage.getItem(getDashboardPrefsKey(user, dossier));
    if (!raw) return getDefaultWidgetPrefs();
    const parsed = JSON.parse(raw);
    return DASHBOARD_WIDGETS.reduce((acc, widget) => ({ ...acc, [widget.key]: parsed?.[widget.key] !== false }), {});
  } catch {
    return getDefaultWidgetPrefs();
  }
}

function useThemeColors() {
  const readColors = () => {
    if (typeof window === "undefined") {
      return {
        accent: "#1f9b61",
        pos: "#1f9b61",
        negInk: "#b42318",
        warn: "#d4a72c",
        ink2: "#5d6b63",
        ink3: "#81908a",
      };
    }
    const styles = getComputedStyle(document.documentElement);
    const read = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;
    return {
      accent: read("--accent", "#1f9b61"),
      pos: read("--pos", "#1f9b61"),
      negInk: read("--neg-ink", "#b42318"),
      warn: read("--warn", "#d4a72c"),
      ink2: read("--ink-2", "#5d6b63"),
      ink3: read("--ink-3", "#81908a"),
    };
  };

  const [colors, setColors] = useState(readColors);

  useEffect(() => {
    const update = () => setColors(readColors());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-accent"],
    });
    return () => observer.disconnect();
  }, []);

  return colors;
}

function useMeasuredWidth(defaultWidth = 360) {
  const ref = useRef(null);
  const [width, setWidth] = useState(defaultWidth);

  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const nextWidth = Math.floor(entry.contentRect.width);
      if (nextWidth > 0) setWidth(nextWidth);
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const isSale = (facture) => facture?.type === "vente" || String(facture?.code_tiers || "").startsWith("CL");
const isPaid = (facture) => ["payee", "payée", "paye", "payé", "paid"].includes(String(facture?.paiement || "").toLowerCase());
const factureAmount = (facture) => Number(facture?.montant_ttc || 0);

function calcHealthScore({ factures, overdueCount, tvaSolde, top1Amount, totalAchats }) {
  const totalFactures = Math.max((factures || []).length, 1);
  const paidCount = (factures || []).filter(isPaid).length;
  const confidences = (factures || [])
    .map((f) => Number(f.confidence))
    .filter((value) => Number.isFinite(value));
  const avgConfidence = confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : 0.7;
  const scoreRetards = 100 - Math.min(100, (overdueCount / totalFactures) * 300);
  const scoreTVA = Math.max(0, 100 - (Math.max(0, tvaSolde) / 1000));
  const scoreConc = Math.max(0, 100 - (top1Amount / Math.max(totalAchats, 1)) * 100);
  const scorePaiement = (paidCount / totalFactures) * 100;
  const scoreConf = avgConfidence * 100;
  const healthScore = Math.round(
    0.30 * scoreRetards +
    0.20 * scoreTVA +
    0.20 * scoreConc +
    0.15 * scorePaiement +
    0.15 * scoreConf
  );

  return {
    healthScore: clamp(healthScore, 0, 100),
    details: [
      { label: "Retards", value: Math.round(clamp(scoreRetards, 0, 100)) },
      { label: "TVA", value: Math.round(clamp(scoreTVA, 0, 100)) },
      { label: "Concentration", value: Math.round(clamp(scoreConc, 0, 100)) },
      { label: "Paiement", value: Math.round(clamp(scorePaiement, 0, 100)) },
      { label: "Confiance IA", value: Math.round(clamp(scoreConf, 0, 100)) },
    ],
  };
}

function calcTresoPrevision(factures, now) {
  return [30, 60, 90].map((days) => {
    const horizon = new Date(now.getTime() + days * 86400000);
    const due = (factures || []).filter((facture) => {
      if (isPaid(facture) || !facture.date_echeance) return false;
      const dueDate = new Date(facture.date_echeance);
      return dueDate >= now && dueDate <= horizon;
    });
    const entrees = due.filter(isSale).reduce((sum, facture) => sum + factureAmount(facture), 0);
    const sorties = due.filter((facture) => !isSale(facture)).reduce((sum, facture) => sum + factureAmount(facture), 0);
    return { days, entrees, sorties, net: entrees - sorties };
  });
}

function formatK(value) {
  if (!value) return "0";
  return `${Math.round(value / 1000).toLocaleString("fr-FR")}k`;
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

function ScoreSante({ health, colors }) {
  const score = health.healthScore;
  const color = score > 75 ? "var(--pos)" : score > 50 ? "var(--warn)" : "var(--neg-ink)";
  const radius = 78;
  const circumference = Math.PI * radius;
  const progress = clamp(score, 0, 100) / 100;
  const dashOffset = circumference * (1 - progress);

  return (
    <section className="card" style={{ padding: 24, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 18 }}>
        <div>
          <div className="kpi-label">IA prédictive</div>
          <div className="card-title">Score de santé financière</div>
          <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 6 }}>
            Score composite basé sur les retards, la TVA, la concentration, les paiements et la confiance OCR.
          </div>
        </div>
        <span className="badge accent">0-100</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20, alignItems: "center" }}>
        <svg viewBox="0 0 200 120" width="100%" height="150" role="img" aria-label={`Score ${score} sur 100`}>
          <path
            d="M22 100 A78 78 0 0 1 178 100"
            fill="none"
            stroke="var(--bg-inset)"
            strokeWidth="18"
            strokeLinecap="round"
          />
          <path
            className="health-arc-fill"
            d="M22 100 A78 78 0 0 1 178 100"
            fill="none"
            stroke={color}
            strokeWidth="18"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
          <text x="100" y="78" textAnchor="middle" style={{ fontSize: 34, fontWeight: 800, fill: color, fontFamily: "var(--font-mono)" }}>
            {score}
          </text>
          <text x="100" y="99" textAnchor="middle" style={{ fontSize: 12, fontWeight: 600, fill: colors.ink2 }}>
            /100
          </text>
        </svg>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(112px, 1fr))", gap: 10 }}>
          {health.details.map((detail) => (
            <div key={detail.label} className="card" style={{ padding: 14, background: "var(--bg-inset)" }}>
              <div className="kpi-label" style={{ marginBottom: 8 }}>{detail.label}</div>
              <div className="mono tabular" style={{ fontSize: 22, fontWeight: 800, color: detail.value > 70 ? "var(--pos-ink)" : detail.value > 45 ? "var(--warn-ink)" : "var(--neg-ink)" }}>
                {detail.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TresoPrevision({ data, onNavigate }) {
  const maxAbs = Math.max(...data.map((item) => Math.abs(item.net)), 1);

  return (
    <section className="card" style={{ padding: 24, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, marginBottom: 18 }}>
        <div>
          <div className="kpi-label">Cash forecast</div>
          <div className="card-title">Prévision trésorerie 30/60/90j</div>
          <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 6 }}>
            Encaissements et décaissements attendus sur les factures non payées.
          </div>
        </div>
        {onNavigate && (
          <button className="btn btn-ghost sm" onClick={() => onNavigate("treso")}>
            Voir la trésorerie complète
            <ArrowUpRight size={13} />
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {data.map((item) => {
          const negative = item.net < 0;
          const width = Math.max(8, (Math.abs(item.net) / maxAbs) * 100);
          return (
            <div key={item.days} className="card" style={{ padding: 18, background: "var(--bg-inset)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div className="kpi-label">Dans {item.days}j</div>
                {negative && <AlertTriangle size={14} style={{ color: "var(--warn-ink)" }} />}
              </div>
              <div className="kpi-value" style={{ color: negative ? "var(--neg-ink)" : "var(--pos-ink)", marginBottom: 12 }}>
                <span className="tabular">{formatMAD(item.net).split(",")[0]}</span>
                <span className="unit">MAD</span>
              </div>
              <div className="treso-bar-track" aria-hidden="true">
                <div className="treso-bar-fill" style={{ width: `${width}%`, background: negative ? "var(--neg-ink)" : "var(--pos)" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12, fontSize: 11.5, color: "var(--ink-2)" }}>
                <span>Entrées {formatMAD(item.entrees).split(",")[0]}</span>
                <span>Sorties {formatMAD(item.sorties).split(",")[0]}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FluxAreaChart({ data, colors }) {
  const [ref, width] = useMeasuredWidth(520);
  const chartWidth = Math.max(280, width);

  return (
    <div ref={ref} style={{ height: 230, marginTop: 6, minWidth: 0 }}>
      <AreaChart width={chartWidth} height={230} data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="achatsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colors.accent} stopOpacity={0.34} />
            <stop offset="95%" stopColor={colors.accent} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="ventesGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colors.pos} stopOpacity={0.32} />
            <stop offset="95%" stopColor={colors.pos} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--line-1)" vertical={false} />
        <XAxis dataKey="month" tick={{ fill: colors.ink3, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={formatK} tick={{ fill: colors.ink3, fontSize: 11 }} axisLine={false} tickLine={false} width={46} />
        <Tooltip
          formatter={(value, name) => [`${formatMAD(value).split(",")[0]} MAD`, name === "achats" ? "Achats" : "Ventes"]}
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--line-1)",
            borderRadius: 10,
            color: "var(--ink-1)",
            boxShadow: "var(--shadow-soft)",
          }}
          labelStyle={{ color: "var(--ink-2)", fontSize: 12 }}
        />
        <Area type="monotone" dataKey="achats" stroke={colors.accent} fill="url(#achatsGradient)" strokeWidth={2.5} dot={false} />
        <Area type="monotone" dataKey="ventes" stroke={colors.pos} fill="url(#ventesGradient)" strokeWidth={2.5} dot={false} />
      </AreaChart>
    </div>
  );
}

function SupplierBarChart({ data, colors }) {
  const [ref, width] = useMeasuredWidth(420);
  const chartWidth = Math.max(280, width);

  return (
    <div ref={ref} className="card" style={{ padding: 14, background: "var(--bg-inset)", height: 280, minWidth: 0 }}>
      <BarChart
        width={chartWidth}
        height={250}
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 22, left: 8, bottom: 8 }}
      >
        <CartesianGrid stroke="var(--line-1)" horizontal={false} />
        <XAxis type="number" tickFormatter={formatK} tick={{ fill: colors.ink3, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={112}
          tick={{ fill: colors.ink2, fontSize: 11, fontWeight: 600 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(value) => String(value).length > 16 ? `${String(value).slice(0, 15)}…` : value}
        />
        <Tooltip
          formatter={(value) => [`${formatMAD(value).split(",")[0]} MAD`, "Achats"]}
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--line-1)",
            borderRadius: 10,
            color: "var(--ink-1)",
            boxShadow: "var(--shadow-soft)",
          }}
        />
        <Bar dataKey="amount" radius={[0, 8, 8, 0]} barSize={22} minPointSize={0}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={colors.accent} fillOpacity={entry.opacity} />
          ))}
        </Bar>
      </BarChart>
    </div>
  );
}

function AnalyseIA({ dossierId, dossier, user, factures, totals, overdue, overdueTotal, penaltyTotal, aging, healthScore, topSupplier }) {
  const [iaText, setIaText] = useState("");
  const [iaLoading, setIaLoading] = useState(false);
  const [iaError, setIaError] = useState("");
  const [cachedAt, setCachedAt] = useState(null);
  const cacheKey = useMemo(() => {
    const dossierKey = dossierId || dossier?.id || "global";
    const hourKey = new Date().toISOString().slice(0, 13);
    return `findoc:ia:${user?.email || "anon"}:${dossierKey}:${hourKey}`;
  }, [dossierId, dossier?.id, user?.email]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.text) {
        setIaText(parsed.text);
        setCachedAt(parsed.generatedAt || null);
      }
    } catch {
      setCachedAt(null);
    }
  }, [cacheKey]);

  const generate = async (force = false) => {
    if (iaLoading) return;
    const token = localStorage.getItem("token");
    if (!token) {
      setIaError("Session expirée. Reconnectez-vous pour générer l'analyse IA.");
      return;
    }
    if (force) {
      localStorage.removeItem(cacheKey);
      setCachedAt(null);
    }

    const top1Name = topSupplier?.[0] || "N/A";
    const top1Pct = totals.totalAchats ? Math.round((Number(topSupplier?.[1] || 0) / totals.totalAchats) * 100) : 0;
    const year = dossier?.exercice_courant || new Date().getFullYear();
    const prompt = `Tu es un expert-comptable marocain. Analyse la situation financière de ce dossier.

DONNÉES :
- Société : ${dossier?.raison_sociale || "N/A"} (${dossier?.forme_juridique || "N/A"})
- Exercice : ${year}
- Achats TTC : ${Math.round(totals.totalAchats)} MAD (${factures.length} factures)
- Ventes TTC : ${Math.round(totals.totalVentes)} MAD
- TVA récupérable : ${Math.round(totals.totalTva)} MAD | Solde TVA : ${Math.round(totals.tvaSolde)} MAD
- Retards : ${overdue.length} factures · ${Math.round(overdueTotal)} MAD
- Pénalités Loi 69-21 (5,25%/an) : ${Math.round(penaltyTotal)} MAD
- Balance âgée >90j : ${Math.round(aging["90+"] || 0)} MAD
- Score santé : ${healthScore}/100
- Top fournisseur : ${top1Name} = ${top1Pct}% des achats

INSTRUCTIONS : 1) 2 points forts. 2) Risques prioritaires. 3) 2 actions actionnables. 4) Appréciation globale.
150-200 mots, français, structuré.`;

    setIaText("");
    setIaError("");
    setIaLoading(true);
    try {
      let fullText = "";
      await sendChatMessage(
        token,
        { dossier_id: Number(dossierId || dossier?.id), message: prompt, historique: [] },
        {
          onChunk: (chunk) => {
            fullText += chunk;
            setIaText(fullText);
          },
          onDone: () => {
            const generatedAt = new Date().toISOString();
            setCachedAt(generatedAt);
            localStorage.setItem(cacheKey, JSON.stringify({ text: fullText, generatedAt }));
          },
        }
      );
    } catch {
      setIaError("Analyse indisponible pour le moment.");
    } finally {
      setIaLoading(false);
    }
  };

  const cacheAge = cachedAt ? Math.max(0, Math.round((Date.now() - new Date(cachedAt).getTime()) / 3600000)) : null;

  return (
    <section className="card" style={{ padding: 24, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 16 }}>
        <div>
          <div className="kpi-label">Narrative Claude</div>
          <div className="card-title">Analyse IA du dossier</div>
          <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 6 }}>
            Synthèse générée à la demande à partir des indicateurs calculés localement.
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => generate(Boolean(iaText))} disabled={iaLoading}>
          <Sparkles size={14} />
          {iaLoading ? "Génération..." : iaText ? "Actualiser" : "Générer"}
        </button>
      </div>

      <div className="card" style={{ padding: 18, background: "var(--bg-inset)", minHeight: 150, whiteSpace: "pre-wrap", lineHeight: 1.7, fontSize: 13.5, color: "var(--ink-1)" }}>
        {iaText || "Cliquez sur Générer pour produire une lecture financière structurée du dossier."}
        {iaLoading && <span className="ia-cursor" />}
      </div>
      {iaError && <div style={{ marginTop: 10, fontSize: 12, color: "var(--neg-ink)" }}>{iaError}</div>}
      {cachedAt && !iaLoading && (
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--ink-3)", display: "flex", gap: 8, alignItems: "center" }}>
          <span>Généré il y a ~{cacheAge}h</span>
          <button className="btn btn-ghost sm" onClick={() => generate(true)}>Actualiser</button>
        </div>
      )}
    </section>
  );
}

export default function OverviewPage({ factures, dossier, dossierId, onNavigate, user }) {
  const now = useMemo(() => new Date(), []);
  const themeColors = useThemeColors();
  const [showCustomize, setShowCustomize] = useState(false);
  const [visibleWidgets, setVisibleWidgets] = useState(() => readDashboardPrefs(user, dossier));

  useEffect(() => {
    const timeout = window.setTimeout(() => setVisibleWidgets(readDashboardPrefs(user, dossier)), 0);
    return () => window.clearTimeout(timeout);
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

  const processed = useMemo(
    () => factures.filter((f) => f.statut === "traite" || f.statut === "traité"),
    [factures]
  );
  const totalAchats = useMemo(() => processed.reduce((s, f) => s + (f.montant_ttc || 0), 0), [processed]);
  const totalTva = useMemo(() => processed.reduce((s, f) => s + (f.tva || 0), 0), [processed]);
  const overdue = useMemo(() => factures.filter((f) => f.paiement === "en_retard"), [factures]);
  const overdueTotal = useMemo(() => overdue.reduce((s, f) => s + (f.montant_ttc || 0), 0), [overdue]);
  const penaltyTotal = useMemo(() => overdue.reduce((s, f) => {
    const days = Math.max(0, (now - new Date(f.date_echeance)) / 86400000);
    return s + (f.montant_ttc || 0) * 0.0525 * Math.max(0, days - 60) / 365;
  }, 0), [overdue, now]);

  const topFournisseurs = useMemo(() => {
    const map = new Map();
    processed.forEach((f) => {
      if (!f.fournisseur) return;
      map.set(f.fournisseur, (map.get(f.fournisseur) || 0) + (f.montant_ttc || 0));
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [processed]);

  const totalAging = Object.values(aging).reduce((a, b) => a + b, 0) || 1;

  const totalVentes = useMemo(
    () => factures.filter(f => f.type === "vente").reduce((s, f) => s + (f.montant_ttc || 0), 0),
    [factures]
  );
  const tvaSolde = useMemo(
    () => factures.filter(f => f.type === "vente").reduce((s, f) => s + (f.tva || 0), 0)
      - factures.filter(f => f.type !== "vente").reduce((s, f) => s + (f.tva || 0), 0),
    [factures]
  );

  const trendAchats = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      return factures
        .filter(f => {
          const fd = new Date(f.date_facture || "");
          return fd.getFullYear() === d.getFullYear() && fd.getMonth() === d.getMonth() && f.type !== "vente";
        })
        .reduce((s, f) => s + (f.montant_ttc || 0), 0);
    }),
    [factures, now]
  );

  const trendVentes = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      return factures
        .filter(f => {
          const fd = new Date(f.date_facture || "");
          return fd.getFullYear() === d.getFullYear() && fd.getMonth() === d.getMonth() && f.type === "vente";
        })
        .reduce((s, f) => s + (f.montant_ttc || 0), 0);
    }),
    [factures, now]
  );
  const chartData = useMemo(() => {
    const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
    return trendAchats.map((achats, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      return { month: months[d.getMonth()], achats, ventes: trendVentes[i] || 0 };
    });
  }, [trendAchats, trendVentes, now]);
  const supplierChartData = useMemo(
    () => topFournisseurs.map(([name, amount], index) => ({
      name,
      amount,
      opacity: Math.max(0.35, 1 - index * 0.15),
    })),
    [topFournisseurs]
  );
  const health = useMemo(
    () => calcHealthScore({
      factures,
      overdueCount: overdue.length,
      tvaSolde,
      top1Amount: topFournisseurs[0]?.[1] || 0,
      totalAchats,
    }),
    [factures, overdue.length, tvaSolde, topFournisseurs, totalAchats]
  );
  const tresoPrevision = useMemo(() => calcTresoPrevision(factures, now), [factures, now]);

  const deltaAchats = useMemo(() => {
    const ms90 = 90 * 86400000;
    const curr = factures.filter(f => new Date(f.date_facture || "") >= new Date(now - ms90) && f.type !== "vente").reduce((s, f) => s + (f.montant_ttc || 0), 0);
    const prev = factures.filter(f => { const fd = new Date(f.date_facture || ""); return fd >= new Date(now - 2 * ms90) && fd < new Date(now - ms90) && f.type !== "vente"; }).reduce((s, f) => s + (f.montant_ttc || 0), 0);
    return prev > 0 ? Math.round(((curr - prev) / prev) * 100) : null;
  }, [factures, now]);

  const deltaVentes = useMemo(() => {
    const curr = factures.filter(f => { const fd = new Date(f.date_facture || ""); return fd.getFullYear() === now.getFullYear() && fd.getMonth() === now.getMonth() && f.type === "vente"; }).reduce((s, f) => s + (f.montant_ttc || 0), 0);
    const prevD = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prev = factures.filter(f => { const fd = new Date(f.date_facture || ""); return fd.getFullYear() === prevD.getFullYear() && fd.getMonth() === prevD.getMonth() && f.type === "vente"; }).reduce((s, f) => s + (f.montant_ttc || 0), 0);
    return prev > 0 ? Math.round(((curr - prev) / prev) * 100) : null;
  }, [factures, now]);

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
  }, [factures, overdue, now, tvaSolde]);
  const overviewHeroSubtitle = overdue.length > 0
    ? `${overdue.length} retard${overdue.length > 1 ? "s" : ""} ouvert${overdue.length > 1 ? "s" : ""} pour ${formatMAD(overdueTotal).split(",")[0]} MAD exposes.`
    : smartAlerts.length > 0
      ? `${smartAlerts.length} signal${smartAlerts.length > 1 ? "s" : ""} actif${smartAlerts.length > 1 ? "s" : ""} sur le dossier courant.`
      : `${processed.length} facture${processed.length > 1 ? "s" : ""} comptabilisee${processed.length > 1 ? "s" : ""}, ${formatMAD(totalAchats).split(",")[0]} MAD suivis.`;

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

      {visibleWidgets.health !== false && (
        <ScoreSante health={health} colors={themeColors} />
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
                {overviewHeroSubtitle}
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
                  <span className="card-title" style={{ fontSize: 28 }}>Ventes comptabilisées</span>
                  {deltaVentes !== null && (
                    <span className={`badge ${deltaVentes >= 0 ? "pos" : "neg"}`}>{deltaVentes >= 0 ? "+" : ""}{deltaVentes}% ce mois</span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 10 }}>
                  Chiffre d'affaires enregistré sur ce dossier.
                </div>
                <div className="kpi-value">
                  <span className="tabular">{formatMAD(totalVentes).split(",")[0]}</span>
                  <span className="unit">MAD</span>
                </div>
                <div style={{ marginTop: 12 }}>
                  <MiniTrend data={trendVentes.some(v => v > 0) ? trendVentes : trendAchats} color="var(--pos)" />
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
                {deltaAchats !== null && (
                  <span className={`badge ${deltaAchats >= 0 ? "pos" : "neg"}`}>{deltaAchats >= 0 ? "+" : ""}{deltaAchats}%</span>
                )}
                <span style={{ fontSize: 12, color: "var(--ink-2)" }}>sur 90 jours glissants</span>
              </div>
              <FluxAreaChart data={chartData} colors={themeColors} />
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

      {visibleWidgets.treso_forecast !== false && (
        <TresoPrevision data={tresoPrevision} onNavigate={onNavigate} />
      )}

      {visibleWidgets.comparison !== false && <ComparaisonNvsN1 factures={factures} />}

      {visibleWidgets.ia_narrative !== false && (
        <AnalyseIA
          dossierId={dossierId}
          dossier={dossier}
          user={user}
          factures={factures}
          totals={{ totalAchats, totalVentes, totalTva, tvaSolde }}
          overdue={overdue}
          overdueTotal={overdueTotal}
          penaltyTotal={penaltyTotal}
          aging={aging}
          healthScore={health.healthScore}
          topSupplier={topFournisseurs[0]}
        />
      )}

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
              <div style={{ padding: "28px 16px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <Building2 size={22} style={{ color: "var(--ink-3)" }} />
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-2)" }}>Aucun fournisseur comptabilisé</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)" }}>Importez des factures pour voir la concentration par tiers.</div>
                {onNavigate && (
                  <button className="btn btn-secondary" style={{ marginTop: 4, fontSize: 12 }} onClick={() => onNavigate("factures")}>
                    Importer des factures
                  </button>
                )}
              </div>
            )}
            {supplierChartData.length > 0 && (
              <SupplierBarChart data={supplierChartData} colors={themeColors} />
            )}
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
