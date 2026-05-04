import { useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  Clock,
  Gauge,
  Landmark,
  Receipt,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { formatDate, formatMAD } from "../utils/format";

const DAY = 86400000;

function amount(value) {
  return Number(value || 0);
}

function isSale(facture) {
  return facture?.type === "vente" || String(facture?.code_tiers || "").startsWith("CL");
}

function isPaid(facture) {
  return ["payee", "pay\u00e9e", "paye", "pay\u00e9"].includes(String(facture?.paiement || "").toLowerCase());
}

function daysUntil(dateValue, now = new Date()) {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((target - today) / DAY);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function factureExercise(facture) {
  return Number(facture?.exercice_rattachement || String(facture?.date_facture || "").slice(0, 4)) || null;
}

function filterByExercise(factures, currentExercise) {
  if (!currentExercise) return factures || [];
  return (factures || []).filter((facture) => factureExercise(facture) === Number(currentExercise));
}

function buildPartnerStats(factures) {
  const stats = new Map();
  factures.forEach((facture) => {
    const name = facture.fournisseur || "Sans tiers";
    const current = stats.get(name) || { count: 0, total: 0, overdue: 0, paid: 0, amounts: [] };
    current.count += 1;
    current.total += amount(facture.montant_ttc);
    current.amounts.push(amount(facture.montant_ttc));
    if (facture.paiement === "en_retard") current.overdue += 1;
    if (isPaid(facture)) current.paid += 1;
    stats.set(name, current);
  });
  return stats;
}

function scoreInvoice(facture, partnerStats, now) {
  const dueIn = daysUntil(facture.date_echeance || facture.date_facture, now);
  const partner = partnerStats.get(facture.fournisseur || "Sans tiers");
  const partnerAverage = partner?.count ? partner.total / partner.count : amount(facture.montant_ttc);
  const overdueRatio = partner?.count ? partner.overdue / partner.count : 0;
  const value = amount(facture.montant_ttc);
  const reasons = [];
  let score = isPaid(facture) ? 8 : 24;

  if (facture.paiement === "en_retard" || (dueIn != null && dueIn < 0 && !isPaid(facture))) {
    const lateDays = Math.abs(dueIn || 0);
    score += 34 + clamp(lateDays / 2, 0, 18);
    reasons.push(`${lateDays}j de retard`);
  } else if (dueIn != null && dueIn <= 7 && !isPaid(facture)) {
    score += 14;
    reasons.push("échéance sous 7 jours");
  } else if (dueIn != null && dueIn <= 30 && !isPaid(facture)) {
    score += 7;
    reasons.push("échéance proche");
  }

  if (partnerAverage > 0 && value > partnerAverage * 1.5) {
    score += 13;
    reasons.push("montant supérieur au profil du tiers");
  }

  if (overdueRatio >= 0.25) {
    score += clamp(overdueRatio * 18, 5, 18);
    reasons.push("historique de retards");
  }

  if (facture.validation_status === "a_verifier" || facture.statut === "a_valider" || facture.statut === "\u00e0_valider") {
    score += 8;
    reasons.push("validation humaine conseillée");
  }

  if (facture.confidence != null && Number(facture.confidence) < 0.82) {
    score += 8;
    reasons.push("confiance extraction faible");
  }

  if (!reasons.length) reasons.push(isPaid(facture) ? "facture payée" : "profil normal");

  const finalScore = Math.round(clamp(score, 0, 100));
  const level = finalScore >= 70 ? "high" : finalScore >= 45 ? "medium" : "low";
  return { ...facture, dueIn, riskScore: finalScore, riskLevel: level, riskReasons: reasons.slice(0, 3) };
}

function detectOpsAnomalies(factures) {
  const anomalies = [];
  const byPartner = new Map();

  factures.forEach((facture) => {
    const name = facture.fournisseur || "Sans tiers";
    const rows = byPartner.get(name) || [];
    rows.push(facture);
    byPartner.set(name, rows);

    if (facture.montant_ht && facture.tva) {
      const ratios = [0.2, 0.14, 0.1, 0.07];
      const expected = ratios.some((rate) => Math.abs(amount(facture.montant_ht) * rate - amount(facture.tva)) < 3);
      if (!expected && amount(facture.montant_ht) > 1000) {
        anomalies.push({
          label: "TVA incohérente",
          detail: `${facture.fournisseur || facture.num_facture || "Facture"} - TVA ${formatMAD(facture.tva).split(",")[0]} MAD`,
          tone: "warn",
        });
      }
    }
  });

  factures.forEach((a, i) => {
    factures.slice(i + 1).forEach((b) => {
      if (!a.fournisseur || a.fournisseur !== b.fournisseur) return;
      if (!a.date_facture || !b.date_facture) return;
      if (Math.abs(amount(a.montant_ttc) - amount(b.montant_ttc)) > 1) return;
      const delta = Math.abs(new Date(a.date_facture) - new Date(b.date_facture)) / DAY;
      if (delta <= 7) {
        anomalies.push({
          label: "Doublon probable",
          detail: `${a.fournisseur} - ${formatMAD(a.montant_ttc).split(",")[0]} MAD`,
          tone: "neg",
        });
      }
    });
  });

  byPartner.forEach((rows, name) => {
    if (rows.length < 3) return;
    const values = rows.map((row) => amount(row.montant_ttc)).sort((a, b) => a - b);
    const median = values[Math.floor(values.length / 2)] || 0;
    rows.forEach((row) => {
      if (median > 0 && amount(row.montant_ttc) > median * 2.5 && amount(row.montant_ttc) > 10000) {
        anomalies.push({
          label: "Montant atypique",
          detail: `${name} - x${Math.round(amount(row.montant_ttc) / median)} vs mediane`,
          tone: "accent",
        });
      }
    });
  });

  return anomalies.slice(0, 5);
}

function buildCashForecast(scoredInvoices, now) {
  const weeks = Array.from({ length: 4 }, (_, index) => ({
    label: `S${index + 1}`,
    start: index * 7,
    end: index === 3 ? 30 : index * 7 + 6,
    entrees: 0,
    sorties: 0,
    items: 0,
  }));

  scoredInvoices.forEach((facture) => {
    if (isPaid(facture)) return;
    const dueIn = daysUntil(facture.date_echeance || facture.date_facture, now);
    if (dueIn == null || dueIn < 0 || dueIn > 30) return;
    const week = weeks.find((item) => dueIn >= item.start && dueIn <= item.end);
    if (!week) return;
    const probability = isSale(facture)
      ? clamp(1 - facture.riskScore / 150, 0.38, 0.92)
      : 0.96;
    const weightedAmount = amount(facture.montant_ttc) * probability;
    if (isSale(facture)) week.entrees += weightedAmount;
    else week.sorties += weightedAmount;
    week.items += 1;
  });

  return weeks.map((week) => ({ ...week, net: week.entrees - week.sorties }));
}

function buildActions({ riskItems, anomalies, tvaNet, bfr, payables, receivables }) {
  const actions = [];
  const riskiest = riskItems.find((item) => isSale(item));
  const urgentPayable = payables.find((item) => item.dueIn != null && item.dueIn <= 7);

  if (riskiest) {
    actions.push({
      icon: Users,
      tone: "warn",
      title: "Relance prioritaire",
      text: `${riskiest.fournisseur || "Client"} présente un risque ${riskiest.riskScore}/100.`,
      route: "relances",
    });
  }

  if (urgentPayable) {
    actions.push({
      icon: Clock,
      tone: "neg",
      title: "Décaissement à planifier",
      text: `${urgentPayable.fournisseur || "Fournisseur"} arrive à échéance ${urgentPayable.dueIn <= 0 ? "maintenant" : `dans ${urgentPayable.dueIn}j`}.`,
      route: "treso",
    });
  }

  if (anomalies.length > 0) {
    actions.push({
      icon: ShieldAlert,
      tone: "accent",
      title: "Contrôle comptable",
      text: `${anomalies.length} signal${anomalies.length > 1 ? "s" : ""} à vérifier avant clôture.`,
      route: "anomalies",
    });
  }

  if (tvaNet > 0) {
    actions.push({
      icon: Landmark,
      tone: "info",
      title: "TVA à anticiper",
      text: `${formatMAD(tvaNet).split(",")[0]} MAD de TVA nette à reverser.`,
      route: "tva",
    });
  }

  if (bfr > receivables * 0.45 && receivables > 0) {
    actions.push({
      icon: Target,
      tone: "warn",
      title: "BFR sous tension",
      text: "Les créances ouvertes pèsent fortement sur la trésorerie opérationnelle.",
      route: "delai_paiement",
    });
  }

  if (!actions.length) {
    actions.push({
      icon: Sparkles,
      tone: "pos",
      title: "Pilotage stable",
      text: "Aucun signal critique sur les factures ouvertes de l'exercice.",
      route: "overview",
    });
  }

  return actions.slice(0, 5);
}

function buildHeroInsight(model) {
  if (model.weightedCash < 0) {
    return {
      title: `Cash 30j sous tension: ${money(model.weightedCash)} MAD`,
      text: "Les décaissements probables dépassent les encaissements attendus. Priorité aux relances clients et aux paiements fournisseurs les plus proches.",
    };
  }

  if (model.riskItems.length >= 3) {
    return {
      title: `${model.riskItems.length} factures à surveiller en priorité`,
      text: "Le risque vient surtout des échéances, des retards ouverts et des profils de tiers. Ces montants doivent passer avant les paiements non urgents.",
    };
  }

  if (model.anomalies.length > 0) {
    return {
      title: `${model.anomalies.length} contrôle${model.anomalies.length > 1 ? "s" : ""} à faire avant validation`,
      text: "Des signaux comptables ressortent sur les montants, la TVA ou les doublons possibles. Le traitement peut rester rapide, mais il mérite une revue.",
    };
  }

  if (model.bfr > 0) {
    return {
      title: `BFR positif de ${money(model.bfr)} MAD`,
      text: "Les créances ouvertes restent supérieures aux dettes fournisseurs. Le dossier est sain, mais l'encaissement client reste le levier principal.",
    };
  }

  if (model.tvaNet > 0) {
    return {
      title: `TVA nette à anticiper: ${money(model.tvaNet)} MAD`,
      text: "La position fiscale est lisible sur l'exercice courant. Le pilotage doit surtout garder le calendrier de déclaration sous contrôle.",
    };
  }

  return {
    title: "Situation opérationnelle stable",
    text: "Les flux ouverts ne montrent pas de tension forte. Le dossier peut être suivi par routine avec une attention normale aux prochaines échéances.",
  };
}

function money(value) {
  return formatMAD(value).split(",")[0];
}

function ToneIcon({ tone, children }) {
  return <div className={`finance-ops-icon ${tone || "neutral"}`}>{children}</div>;
}

function KPI({ icon, label, value, unit = "MAD", hint, tone = "neutral" }) {
  return (
    <article className={`finance-ops-kpi ${tone}`}>
      <div className="finance-ops-kpi__head">
        <ToneIcon tone={tone}>{icon}</ToneIcon>
        <span>{label}</span>
      </div>
      <div className="finance-ops-kpi__value">
        <span className="tabular">{value}</span>
        {unit && <small>{unit}</small>}
      </div>
      <p>{hint}</p>
    </article>
  );
}

function ScorePill({ score, level }) {
  const label = level === "high" ? "Élevé" : level === "medium" ? "Moyen" : "Faible";
  return <span className={`finance-score ${level}`}>{label} - {score}</span>;
}

function CashWeeks({ weeks }) {
  const max = Math.max(...weeks.map((week) => Math.max(week.entrees, week.sorties, Math.abs(week.net))), 1);
  return (
    <div className="finance-cash-weeks">
      {weeks.map((week) => (
        <div key={week.label} className="finance-cash-week">
          <div className="finance-cash-week__meta">
            <strong>{week.label}</strong>
            <span>J+{week.start} à J+{week.end}</span>
          </div>
          <div className="finance-cash-bars">
            <span className="pos" style={{ width: `${(week.entrees / max) * 100}%` }} />
            <span className="neg" style={{ width: `${(week.sorties / max) * 100}%` }} />
          </div>
          <div className={`finance-cash-week__net ${week.net >= 0 ? "pos" : "neg"}`}>
            {week.net >= 0 ? "+" : ""}{money(week.net)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function FinanceOpsPage({ factures, dossier, currentExercise, onNavigate }) {
  const now = useMemo(() => new Date(), []);

  const model = useMemo(() => {
    const scoped = filterByExercise(factures, currentExercise);
    const partnerStats = buildPartnerStats(scoped);
    const scored = scoped.map((facture) => scoreInvoice(facture, partnerStats, now));

    const ventes = scoped.filter(isSale);
    const achats = scoped.filter((facture) => !isSale(facture));
    const open = scored.filter((facture) => !isPaid(facture));
    const urgentCount = open.filter((facture) => facture.dueIn != null && facture.dueIn <= 7).length;
    const receivablesRows = open.filter(isSale).sort((a, b) => b.riskScore - a.riskScore);
    const payableRows = open.filter((facture) => !isSale(facture)).sort((a, b) => (a.dueIn ?? 999) - (b.dueIn ?? 999));
    const receivables = receivablesRows.reduce((sum, facture) => sum + amount(facture.montant_ttc), 0);
    const payables = payableRows.reduce((sum, facture) => sum + amount(facture.montant_ttc), 0);
    const revenue = ventes.reduce((sum, facture) => sum + amount(facture.montant_ttc), 0);
    const purchases = achats.reduce((sum, facture) => sum + amount(facture.montant_ttc), 0);
    const tvaCollectee = ventes.reduce((sum, facture) => sum + amount(facture.tva), 0);
    const tvaDeductible = achats.reduce((sum, facture) => sum + amount(facture.tva), 0);
    const anomalies = detectOpsAnomalies(scoped);
    const riskItems = open
      .filter((facture) => facture.riskScore >= 40)
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 6);
    const weeks = buildCashForecast(scored, now);
    const weightedCash = weeks.reduce((sum, week) => sum + week.net, 0);
    const bfr = receivables - payables;

    return {
      scoped,
      revenue,
      purchases,
      receivables,
      payables,
      openAmount: receivables + payables,
      urgentCount,
      bfr,
      tvaNet: tvaCollectee - tvaDeductible,
      anomalies,
      riskItems,
      weeks,
      weightedCash,
      payableRows,
      receivablesRows,
      actions: buildActions({
        riskItems,
        anomalies,
        tvaNet: tvaCollectee - tvaDeductible,
        bfr,
        payables: payableRows,
        receivables,
      }),
    };
  }, [factures, currentExercise, now]);

  const riskAverage = model.riskItems.length
    ? Math.round(model.riskItems.reduce((sum, facture) => sum + facture.riskScore, 0) / model.riskItems.length)
    : 12;
  const cashTone = model.weightedCash >= 0 ? "pos" : "neg";
  const heroInsight = buildHeroInsight(model);
  const heroSignals = [
    { label: "Ouvert", value: `${money(model.openAmount)} MAD` },
    { label: "Urgent 7j", value: String(model.urgentCount) },
    { label: "Anomalies", value: String(model.anomalies.length) },
  ];

  return (
    <div className="page-inner finance-ops-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Pilotage financier</h1>
          <p className="page-subtitle">
            Synthèse risques & trésorerie - {dossier?.raison_sociale || "Dossier"} - exercice {currentExercise || "courant"}
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={() => onNavigate?.("treso")}>
            <TrendingUp size={13} /> Trésorerie
          </button>
          <button className="btn btn-primary" onClick={() => onNavigate?.("relances")}>
            <Sparkles size={13} /> Actions
          </button>
        </div>
      </div>

      <section className="finance-ops-hero card">
        <div>
          <div className="badge accent">Intelligence explicable</div>
          <h2>{heroInsight.title}</h2>
          <p>{heroInsight.text}</p>
          <div className="finance-ops-hero__signals">
            {heroSignals.map((signal) => (
              <span key={signal.label}>
                <strong>{signal.value}</strong>
                {signal.label}
              </span>
            ))}
          </div>
        </div>
        <div className="finance-ops-hero__score">
          <Gauge size={22} />
          <span>Score moyen actif</span>
          <strong>{riskAverage}/100</strong>
          <small>{model.riskItems.length} facture{model.riskItems.length > 1 ? "s" : ""} à surveiller</small>
        </div>
      </section>

      <section className="finance-ops-kpis">
        <KPI
          icon={<Banknote size={15} />}
          label="Cash net 30j"
          value={`${model.weightedCash >= 0 ? "+" : ""}${money(model.weightedCash)}`}
          hint="Flux pondérés par probabilité de paiement"
          tone={cashTone}
        />
        <KPI
          icon={<Activity size={15} />}
          label="BFR simplifié"
          value={money(model.bfr)}
          hint={`${money(model.receivables)} créances - ${money(model.payables)} dettes`}
          tone={model.bfr > 0 ? "warn" : "pos"}
        />
        <KPI
          icon={<Receipt size={15} />}
          label="TVA nette"
          value={money(model.tvaNet)}
          hint={model.tvaNet >= 0 ? "Montant potentiel à reverser" : "Crédit TVA potentiel"}
          tone={model.tvaNet >= 0 ? "accent" : "pos"}
        />
        <KPI
          icon={<AlertTriangle size={15} />}
          label="Signaux ML"
          value={String(model.riskItems.length + model.anomalies.length)}
          unit=""
          hint="Risques, anomalies et contrôles"
          tone={model.riskItems.length + model.anomalies.length > 0 ? "neg" : "pos"}
        />
      </section>

      <section className="finance-ops-grid">
        <article className="card finance-panel">
          <div className="finance-panel__head">
            <div>
              <div className="kpi-label">Projection pondérée</div>
              <div className="card-title">Cash attendu sur 30 jours</div>
            </div>
            <span className={`badge ${cashTone}`}>{cashTone === "pos" ? "positif" : "sous tension"}</span>
          </div>
          <CashWeeks weeks={model.weeks} />
          <div className="finance-legend">
            <span><i className="pos" /> encaissements probables</span>
            <span><i className="neg" /> décaissements prévus</span>
          </div>
        </article>

        <article className="card finance-panel">
          <div className="finance-panel__head">
            <div>
              <div className="kpi-label">Actions recommandées</div>
              <div className="card-title">Prochaines décisions</div>
            </div>
          </div>
          <div className="finance-action-list">
            {model.actions.map((action) => {
              const Icon = action.icon;
              return (
                <button key={`${action.title}-${action.route}`} className="finance-action" onClick={() => onNavigate?.(action.route)}>
                  <ToneIcon tone={action.tone}><Icon size={15} /></ToneIcon>
                  <span>
                    <strong>{action.title}</strong>
                    <small>{action.text}</small>
                  </span>
                  <ArrowUpRight size={14} />
                </button>
              );
            })}
          </div>
        </article>
      </section>

      <section className="finance-ops-grid finance-ops-grid--wide">
        <article className="card finance-panel">
          <div className="finance-panel__head">
            <div>
              <div className="kpi-label">Scoring facture</div>
              <div className="card-title">Factures à risque</div>
            </div>
            <button className="btn btn-ghost sm" onClick={() => onNavigate?.("delai_paiement")}>
              Voir délais
            </button>
          </div>
          {model.riskItems.length === 0 ? (
            <div className="finance-empty">
              <Sparkles size={22} />
              <span>Aucune facture ouverte ne ressort comme prioritaire.</span>
            </div>
          ) : (
            <div className="finance-risk-list">
              {model.riskItems.map((facture) => (
                <div key={facture.id || `${facture.fournisseur}-${facture.num_facture}`} className="finance-risk-row">
                  <div>
                    <strong>{facture.fournisseur || "Sans tiers"}</strong>
                    <span>{facture.num_facture || "Sans numéro"} - {formatDate(facture.date_echeance || facture.date_facture)}</span>
                    <small>{facture.riskReasons.join(" - ")}</small>
                  </div>
                  <div>
                    <ScorePill score={facture.riskScore} level={facture.riskLevel} />
                    <b>{money(facture.montant_ttc)} MAD</b>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="card finance-panel">
          <div className="finance-panel__head">
            <div>
              <div className="kpi-label">Contrôle automatique</div>
              <div className="card-title">Anomalies opérationnelles</div>
            </div>
            <button className="btn btn-ghost sm" onClick={() => onNavigate?.("anomalies")}>
              Audit
            </button>
          </div>
          {model.anomalies.length === 0 ? (
            <div className="finance-empty">
              <ShieldAlert size={22} />
              <span>Aucun signal comptable fort dans l'échantillon courant.</span>
            </div>
          ) : (
            <div className="finance-anomaly-list">
              {model.anomalies.map((item, index) => (
                <div key={`${item.label}-${index}`} className={`finance-anomaly ${item.tone}`}>
                  <ToneIcon tone={item.tone}><AlertTriangle size={14} /></ToneIcon>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </span>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="card finance-panel">
        <div className="finance-panel__head">
          <div>
            <div className="kpi-label">Lecture CFO</div>
            <div className="card-title">Ventes, achats et exposition ouverte</div>
          </div>
        </div>
        <div className="finance-breakdown">
          <BreakdownItem icon={<TrendingUp size={15} />} label="Ventes TTC" value={model.revenue} tone="pos" />
          <BreakdownItem icon={<TrendingDown size={15} />} label="Achats TTC" value={model.purchases} tone="neg" />
          <BreakdownItem icon={<Users size={15} />} label="Créances ouvertes" value={model.receivables} tone="warn" />
          <BreakdownItem icon={<Landmark size={15} />} label="Dettes fournisseurs" value={model.payables} tone="accent" />
        </div>
      </section>
    </div>
  );
}

function BreakdownItem({ icon, label, value, tone }) {
  return (
    <div className="finance-breakdown-item">
      <ToneIcon tone={tone}>{icon}</ToneIcon>
      <span>{label}</span>
      <strong>{money(value)} MAD</strong>
    </div>
  );
}
