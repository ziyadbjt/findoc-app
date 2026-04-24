import { useMemo } from "react";
import { AlertTriangle, Copy, TrendingUp, UserX, Zap } from "lucide-react";
import { formatMAD, formatDate } from "../utils/format";

function detectAnomalies(factures) {
  const anomalies = [];
  const now = new Date();

  // 1. Doublons — même fournisseur + même montant + date proche (±7j)
  for (let i = 0; i < factures.length; i++) {
    for (let j = i + 1; j < factures.length; j++) {
      const a = factures[i], b = factures[j];
      if (!a.fournisseur || !b.fournisseur) continue;
      if (a.fournisseur !== b.fournisseur) continue;
      if (Math.abs((a.montant_ttc || 0) - (b.montant_ttc || 0)) > 1) continue;
      const da = new Date(a.date_facture), db = new Date(b.date_facture);
      if (Math.abs(da - db) <= 7 * 86400000) {
        anomalies.push({
          type: "doublon",
          severity: "high",
          label: "Doublon probable",
          desc: `${a.fournisseur} · ${formatMAD(a.montant_ttc || 0)} MAD · 2 factures à ${Math.round(Math.abs(da - db) / 86400000)}j d'intervalle`,
          factures: [a, b],
          icon: "copy",
        });
      }
    }
  }

  // 2. Montant hors norme — > 3x la médiane du fournisseur
  const byFourn = {};
  factures.forEach(f => {
    if (!f.fournisseur) return;
    (byFourn[f.fournisseur] = byFourn[f.fournisseur] || []).push(f.montant_ttc || 0);
  });
  Object.entries(byFourn).forEach(([fourn, montants]) => {
    if (montants.length < 2) return;
    const sorted = [...montants].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    montants.forEach((m, idx) => {
      if (m > median * 3 && m > 5000) {
        const f = factures.filter(x => x.fournisseur === fourn)[idx];
        if (!f) return;
        anomalies.push({
          type: "hors_norme",
          severity: "medium",
          label: "Montant hors norme",
          desc: `${fourn} · ${formatMAD(m)} MAD (médiane : ${formatMAD(median)} MAD — ×${Math.round(m / median)})`,
          factures: [f],
          icon: "trending",
        });
      }
    });
  });

  // 3. Fournisseur à une seule facture avec montant élevé
  Object.entries(byFourn).forEach(([fourn, montants]) => {
    if (montants.length === 1 && montants[0] > 50000) {
      const f = factures.find(x => x.fournisseur === fourn);
      if (!f) return;
      anomalies.push({
        type: "fournisseur_inconnu",
        severity: "low",
        label: "Fournisseur unique facture élevée",
        desc: `${fourn} · ${formatMAD(montants[0])} MAD · 1 seule transaction — à vérifier`,
        factures: [f],
        icon: "userx",
      });
    }
  });

  // 4. TVA incohérente — montant TVA != montant_ht * taux
  factures.forEach(f => {
    if (!f.montant_ht || !f.tva || f.tva < 1) return;
    const expectedTVA20 = Math.round(f.montant_ht * 0.20 * 100) / 100;
    const expectedTVA14 = Math.round(f.montant_ht * 0.14 * 100) / 100;
    const expectedTVA10 = Math.round(f.montant_ht * 0.10 * 100) / 100;
    const actual = Math.round(f.tva * 100) / 100;
    const ok = [expectedTVA20, expectedTVA14, expectedTVA10].some(e => Math.abs(e - actual) < 2);
    if (!ok && f.montant_ht > 1000) {
      anomalies.push({
        type: "tva_incoherente",
        severity: "medium",
        label: "TVA incohérente",
        desc: `${f.fournisseur || f.num_facture} · TVA déclarée ${formatMAD(actual)} vs attendu ${formatMAD(expectedTVA20)} (20%)`,
        factures: [f],
        icon: "zap",
      });
    }
  });

  return anomalies;
}

const SEVERITY_STYLES = {
  high:   { bg: "var(--neg-bg)",    ink: "var(--neg-ink)",  label: "Critique" },
  medium: { bg: "var(--warn-bg)",   ink: "var(--warn-ink)", label: "Attention" },
  low:    { bg: "var(--accent-bg)", ink: "var(--accent-ink)", label: "Info" },
};

const ICONS = {
  copy: <Copy size={15} />,
  trending: <TrendingUp size={15} />,
  userx: <UserX size={15} />,
  zap: <Zap size={15} />,
};

export default function AnomaliesPage({ factures }) {
  const anomalies = useMemo(() => detectAnomalies(factures || []), [factures]);

  const counts = { high: 0, medium: 0, low: 0 };
  anomalies.forEach(a => counts[a.severity]++);

  return (
    <div className="page-inner">
      <div className="page-header">
        <div>
          <h1 className="page-title">Anomalies détectées</h1>
          <p className="page-subtitle">Analyse automatique FinAI · {anomalies.length} anomalie{anomalies.length !== 1 ? "s" : ""} sur {factures?.length || 0} factures</p>
        </div>
      </div>

      {/* Résumé */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { key: "high",   label: "Critiques",  color: "var(--neg-ink)",    bg: "var(--neg-bg)" },
          { key: "medium", label: "Attention",   color: "var(--warn-ink)",   bg: "var(--warn-bg)" },
          { key: "low",    label: "À vérifier",  color: "var(--accent-ink)", bg: "var(--accent-bg)" },
        ].map(s => (
          <div key={s.key} className="card" style={{ padding: 18, background: counts[s.key] > 0 ? s.bg : "var(--bg-inset)" }}>
            <div style={{ fontSize: 11, color: "var(--ink-2)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</div>
            <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "var(--font-mono)", color: counts[s.key] > 0 ? s.color : "var(--ink-3)" }}>
              {counts[s.key]}
            </div>
          </div>
        ))}
      </div>

      {anomalies.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: "center" }}>
          <AlertTriangle size={32} style={{ color: "var(--pos-ink)", margin: "0 auto 16px" }} />
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Aucune anomalie détectée</div>
          <div style={{ fontSize: 13, color: "var(--ink-2)" }}>Toutes les factures semblent cohérentes.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {anomalies.map((a, i) => {
            const s = SEVERITY_STYLES[a.severity];
            return (
              <div key={i} className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "4px 1fr", height: "100%" }}>
                  <div style={{ background: s.ink }} />
                  <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "36px 1fr auto", gap: 14, alignItems: "center" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: s.bg, color: s.ink, display: "grid", placeItems: "center" }}>
                      {ICONS[a.icon]}
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{a.label}</span>
                        <span style={{ fontSize: 11, fontWeight: 500, padding: "1px 7px", borderRadius: 99, background: s.bg, color: s.ink }}>{s.label}</span>
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{a.desc}</div>
                      {a.factures?.[0] && (
                        <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>
                          {formatDate(a.factures[0].date_facture)} · {a.factures[0].num_facture || "—"}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ink-3)" }}>
                      {a.type === "doublon" ? "2 factures" : `${a.factures?.length || 1} facture`}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
