import { useState, useMemo } from "react";
import { Send, Mail, AlertTriangle, Clock, Check } from "lucide-react";
import { formatMAD, formatDate, daysBetween } from "../utils/format";

const BAM_RATE = 0.0225;
const PENALTY_RATE = BAM_RATE + 0.03;
const LEGAL_DELAY = 60;

const LEVELS = [
  { key: 1, label: "Niveau 1", desc: "Rappel courtois", color: "var(--accent-ink)" },
  { key: 2, label: "Niveau 2", desc: "Relance ferme", color: "var(--warn-ink)" },
  { key: 3, label: "Niveau 3", desc: "Mise en demeure", color: "var(--neg-ink)" },
];

const TONES = ["courtois", "ferme", "formel"];

function calcPenalty(montant, overdueDays) {
  return (montant * PENALTY_RATE * Math.max(0, overdueDays - LEGAL_DELAY)) / 365;
}

function RelanceRow({ f, overdueDays, penalty, selected, onSelect }) {
  const levelColor = overdueDays > 90 ? "var(--neg-ink)" : overdueDays > 30 ? "var(--warn-ink)" : "var(--accent-ink)";
  return (
    <div
      style={{
        display: "grid", gridTemplateColumns: "28px 1fr auto", gap: 12,
        padding: "12px 16px", borderBottom: "1px solid var(--line-1)",
        background: selected ? "var(--accent-bg)" : "var(--bg-1)",
        cursor: "pointer", transition: "background 100ms",
      }}
      onClick={onSelect}
    >
      <input type="checkbox" checked={selected} onChange={onSelect} onClick={e => e.stopPropagation()} style={{ marginTop: 2, cursor: "pointer" }} />
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 2 }}>{f.fournisseur}</div>
        <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>
          {f.num_facture} · échéance {formatDate(f.date_echeance)}
        </div>
        {penalty > 0 && (
          <div style={{ fontSize: 11, color: "var(--neg-ink)", marginTop: 3 }}>
            Pénalité Loi 69-21 · {formatMAD(penalty).split(",")[0]} MAD
          </div>
        )}
      </div>
      <div style={{ textAlign: "right" }}>
        <div className="mono tabular" style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{formatMAD(f.montant_ttc).split(",")[0]}</div>
        <span style={{ fontSize: 11, fontWeight: 500, color: levelColor, background: `${levelColor}18`, padding: "1px 7px", borderRadius: 99 }}>
          +{overdueDays}j
        </span>
      </div>
    </div>
  );
}

function generateEmail(factures, level, tone, now) {
  const total = factures.reduce((s, f) => s + (f.montant_ttc || 0), 0);
  const penalties = factures.reduce((s, f) => {
    const days = daysBetween(f.date_echeance, now.toISOString());
    return s + calcPenalty(f.montant_ttc || 0, days);
  }, 0);

  const openings = {
    courtois: "Nous nous permettons de vous contacter concernant",
    ferme: "Malgré nos précédentes relances, nous constatons que",
    formel: "Par la présente mise en demeure, nous vous signifions que",
  };
  const closings = {
    courtois: "Dans l'attente de votre règlement, nous restons à votre disposition.",
    ferme: "Nous vous prions de procéder au règlement dans les plus brefs délais.",
    formel: "À défaut de règlement sous 8 jours, nous nous réserverons le droit d'engager toute procédure de recouvrement.",
  };

  const refs = factures.map(f => `  • ${f.num_facture || f.id} — ${formatMAD(f.montant_ttc).split(",")[0]} MAD (échéance ${formatDate(f.date_echeance)})`).join("\n");

  return `Objet : ${level === 3 ? "MISE EN DEMEURE — " : ""}Relance paiement · ${level === 1 ? "Premier rappel" : level === 2 ? "Deuxième relance" : "Niveau 3"}

Madame, Monsieur,

${openings[tone]} le(s) facture(s) suivante(s) demeurant impayée(s) :

${refs}

Montant total dû : ${formatMAD(total).split(",")[0]} MAD TTC${penalties > 0.5 ? `\nPénalités Loi 69-21 (taux BAM ${(BAM_RATE * 100).toFixed(2)}% + 3%) : ${formatMAD(penalties).split(",")[0]} MAD` : ""}

${closings[tone]}

Cordialement,
Cabinet Chami · Expert-Comptable
`;
}

export default function RelancesPage({ factures }) {
  const now = new Date();

  const overdueFactures = useMemo(() => {
    return factures
      .filter(f => f.paiement !== "payée" && f.date_echeance)
      .map(f => ({
        ...f,
        overdueDays: Math.max(0, Math.floor((now - new Date(f.date_echeance)) / 86400000)),
      }))
      .filter(f => f.overdueDays > 0)
      .sort((a, b) => b.overdueDays - a.overdueDays);
  }, [factures]);

  const [selected, setSelected] = useState(new Set());
  const [level, setLevel] = useState(1);
  const [tone, setTone] = useState("courtois");
  const [sent, setSent] = useState(new Set());

  const toggleSelect = (id) => {
    setSelected(s => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const selectAll = () => {
    if (selected.size === overdueFactures.length) setSelected(new Set());
    else setSelected(new Set(overdueFactures.map(f => f.id)));
  };

  const selectedFactures = overdueFactures.filter(f => selected.has(f.id));
  const emailBody = selectedFactures.length > 0 ? generateEmail(selectedFactures, level, tone, now) : "";

  const totalPenalties = overdueFactures.reduce((s, f) => s + calcPenalty(f.montant_ttc || 0, f.overdueDays), 0);
  const totalOverdue = overdueFactures.reduce((s, f) => s + (f.montant_ttc || 0), 0);

  const handleSend = () => {
    const ids = new Set([...sent, ...selected]);
    setSent(ids);
    setSelected(new Set());
  };

  return (
    <div className="page-inner">
      <div className="page-header">
        <div>
          <h1 className="page-title">Relances</h1>
          <p className="page-subtitle">
            {overdueFactures.length} factures en retard · {formatMAD(totalOverdue).split(",")[0]} MAD
            {totalPenalties > 1 && <> · <span style={{ color: "var(--neg-ink)" }}>pénalités {formatMAD(totalPenalties).split(",")[0]} MAD</span></>}
          </p>
        </div>
      </div>

      {overdueFactures.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <Check size={28} style={{ color: "var(--pos-ink)", margin: "0 auto 12px" }} />
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Aucun retard détecté</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>Toutes les factures sont dans les délais Loi 69-21.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 12, alignItems: "start" }}>
          {/* Left: facture list */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-1)", display: "flex", alignItems: "center", gap: 10 }}>
              <input type="checkbox"
                checked={selected.size === overdueFactures.length && overdueFactures.length > 0}
                onChange={selectAll} style={{ cursor: "pointer" }} />
              <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>Factures en retard</span>
              <span style={{ fontSize: 11, color: "var(--ink-2)" }}>{selected.size} sélectionnée{selected.size > 1 ? "s" : ""}</span>
            </div>
            <div style={{ overflowY: "auto", maxHeight: 520 }}>
              {overdueFactures.map(f => (
                <RelanceRow
                  key={f.id} f={f}
                  overdueDays={f.overdueDays}
                  penalty={calcPenalty(f.montant_ttc || 0, f.overdueDays)}
                  selected={selected.has(f.id)}
                  onSelect={() => toggleSelect(f.id)}
                />
              ))}
            </div>
          </div>

          {/* Right: email composer */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ marginBottom: 16 }}>
              <div className="card-title" style={{ marginBottom: 12 }}>Composer la relance</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label className="label">Niveau</label>
                  <div className="segmented" style={{ width: "100%" }}>
                    {LEVELS.map(l => (
                      <button key={l.key} className={level === l.key ? "active" : ""} onClick={() => setLevel(l.key)} title={l.desc}>
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label">Ton</label>
                  <div className="segmented" style={{ width: "100%" }}>
                    {TONES.map(t => (
                      <button key={t} className={tone === t ? "active" : ""} onClick={() => setTone(t)} style={{ textTransform: "capitalize" }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {level === 3 && (
                <div style={{ padding: "8px 12px", background: "var(--neg-bg)", borderRadius: 8, fontSize: 12, color: "var(--neg-ink)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  <AlertTriangle size={13} />
                  Mise en demeure — document à valeur légale selon Loi 69-21
                </div>
              )}

              {totalPenalties > 1 && (
                <div style={{ padding: "8px 12px", background: "var(--warn-bg)", borderRadius: 8, fontSize: 12, color: "var(--warn-ink)", marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
                  <Clock size={13} />
                  Pénalités calculées au taux BAM {(BAM_RATE * 100).toFixed(2)}% + 3% = {((BAM_RATE + 0.03) * 100).toFixed(2)}%/an
                </div>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="label">Aperçu email</label>
              <div className="email-shell">
                {selectedFactures.length === 0 ? (
                  <div style={{ padding: 24, textAlign: "center", color: "var(--ink-3)", fontSize: 12.5 }}>
                    Sélectionnez des factures pour prévisualiser la relance.
                  </div>
                ) : (
                  <pre style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 11.5, lineHeight: 1.65, color: "var(--ink-1)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {emailBody}
                  </pre>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" disabled={!selectedFactures.length}>Copier</button>
              <button className="btn btn-primary" disabled={!selectedFactures.length} onClick={handleSend}>
                <Send size={13} /> Envoyer · {selectedFactures.length} facture{selectedFactures.length > 1 ? "s" : ""}
              </button>
            </div>

            {sent.size > 0 && (
              <div style={{ marginTop: 12, padding: "8px 12px", background: "var(--pos-bg)", borderRadius: 8, fontSize: 12, color: "var(--pos-ink)", display: "flex", gap: 8, alignItems: "center" }}>
                <Check size={13} />
                {sent.size} relance{sent.size > 1 ? "s" : ""} envoyée{sent.size > 1 ? "s" : ""} avec succès
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
