import { useState, useRef } from "react";
import { Sparkles, Copy, Check, RefreshCw, FileText, ChevronDown } from "lucide-react";
import { generateMonthlyReport } from "../api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

const MOIS_LABELS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function MarkdownText({ text }) {
  // Minimal markdown: bold, headers, bullets
  const lines = text.split("\n");
  const elements = [];
  let key = 0;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={key++} style={{ fontSize: 15, fontWeight: 700, marginTop: 20, marginBottom: 6, color: "var(--ink-1)" }}>
          {line.slice(3).replace(/\*\*(.*?)\*\*/g, "$1")}
        </h2>
      );
    } else if (line.startsWith("# ")) {
      elements.push(
        <h1 key={key++} style={{ fontSize: 17, fontWeight: 700, marginTop: 24, marginBottom: 8, color: "var(--ink-1)" }}>
          {line.slice(2)}
        </h1>
      );
    } else if (line.startsWith("- ") || line.startsWith("• ")) {
      const content = line.slice(2);
      elements.push(
        <div key={key++} style={{ display: "flex", gap: 8, marginBottom: 4, paddingLeft: 4 }}>
          <span style={{ color: "var(--accent-ink)", flexShrink: 0, marginTop: 2 }}>•</span>
          <span style={{ fontSize: 13, lineHeight: 1.6, color: "var(--ink-2)" }}>{renderInline(content)}</span>
        </div>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={key++} style={{ height: 6 }} />);
    } else {
      elements.push(
        <p key={key++} style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 4, color: "var(--ink-2)" }}>
          {renderInline(line)}
        </p>
      );
    }
  }
  return <>{elements}</>;
}

function renderInline(text) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i} style={{ color: "var(--ink-1)", fontWeight: 600 }}>{part.slice(2, -2)}</strong>
      : part
  );
}

export default function RapportMensuelPage({ dossierId, dossier }) {
  const { token } = useAuth();
  const toast = useToast();
  const now = new Date();
  const [mois, setMois] = useState(now.getMonth() + 1);
  const [annee, setAnnee] = useState(now.getFullYear());
  const [rapport, setRapport] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef(null);

  const annees = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i);

  const generer = async () => {
    if (loading) return;
    setRapport("");
    setLoading(true);
    try {
      await generateMonthlyReport(token, dossierId, mois, annee, {
        onChunk: (text) => setRapport((prev) => prev + text),
        onDone: () => setLoading(false),
      });
    } catch {
      toast("Erreur lors de la génération du rapport", "neg");
      setLoading(false);
    }
  };

  const copier = () => {
    navigator.clipboard.writeText(rapport);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast("Rapport copié", "pos");
  };

  return (
    <div style={{ padding: "0 0 40px", maxWidth: 760, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <FileText size={18} style={{ color: "var(--accent-ink)" }} />
          <h1 style={{ fontSize: 17, fontWeight: 700, color: "var(--ink-1)", margin: 0 }}>
            Rapport mensuel IA
          </h1>
        </div>
        <p style={{ fontSize: 12.5, color: "var(--ink-3)", margin: 0 }}>
          Résumé comptable généré par Claude — CA, achats, TVA, retards, anomalies
        </p>
      </div>

      {/* Controls */}
      <div style={{
        margin: "16px 20px",
        padding: "14px 16px",
        background: "var(--bg-2)",
        borderRadius: 12,
        border: "1px solid var(--line-1)",
        display: "flex",
        gap: 10,
        alignItems: "center",
        flexWrap: "wrap",
      }}>
        <div style={{ position: "relative" }}>
          <select
            value={mois}
            onChange={(e) => setMois(Number(e.target.value))}
            disabled={loading}
            style={{
              appearance: "none",
              background: "var(--bg-1)",
              border: "1px solid var(--line-2)",
              borderRadius: 8,
              padding: "7px 32px 7px 12px",
              fontSize: 13,
              color: "var(--ink-1)",
              cursor: "pointer",
              minWidth: 120,
            }}
          >
            {MOIS_LABELS.map((label, i) => (
              <option key={i + 1} value={i + 1}>{label}</option>
            ))}
          </select>
          <ChevronDown size={13} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)", pointerEvents: "none" }} />
        </div>

        <div style={{ position: "relative" }}>
          <select
            value={annee}
            onChange={(e) => setAnnee(Number(e.target.value))}
            disabled={loading}
            style={{
              appearance: "none",
              background: "var(--bg-1)",
              border: "1px solid var(--line-2)",
              borderRadius: 8,
              padding: "7px 32px 7px 12px",
              fontSize: 13,
              color: "var(--ink-1)",
              cursor: "pointer",
            }}
          >
            {annees.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <ChevronDown size={13} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)", pointerEvents: "none" }} />
        </div>

        <button
          onClick={generer}
          disabled={loading}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            background: loading ? "var(--accent-bg)" : "var(--accent-ink)",
            color: loading ? "var(--accent-ink)" : "white",
            border: "none", borderRadius: 8,
            padding: "7px 16px", fontSize: 13, fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            transition: "all 120ms",
          }}
        >
          {loading
            ? <><RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> Génération...</>
            : <><Sparkles size={13} /> Générer le rapport</>
          }
        </button>

        {rapport && !loading && (
          <button
            onClick={copier}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "var(--bg-1)", border: "1px solid var(--line-2)",
              borderRadius: 8, padding: "7px 14px", fontSize: 13,
              color: "var(--ink-2)", cursor: "pointer",
            }}
          >
            {copied ? <><Check size={13} style={{ color: "var(--pos-ink)" }} /> Copié</> : <><Copy size={13} /> Copier</>}
          </button>
        )}
      </div>

      {/* Report output */}
      {(rapport || loading) && (
        <div style={{
          margin: "0 20px",
          padding: "20px",
          background: "var(--bg-1)",
          borderRadius: 12,
          border: "1px solid var(--line-1)",
          minHeight: 120,
        }}>
          {rapport
            ? <MarkdownText text={rapport} />
            : (
              <div style={{ display: "flex", gap: 10, alignItems: "center", color: "var(--ink-3)", fontSize: 13 }}>
                <RefreshCw size={14} style={{ animation: "spin 1s linear infinite", color: "var(--accent-ink)" }} />
                Analyse en cours...
              </div>
            )
          }
          {loading && rapport && (
            <span style={{
              display: "inline-block", width: 8, height: 14,
              background: "var(--accent-ink)", borderRadius: 2,
              marginLeft: 2, animation: "blink 1s step-end infinite",
              verticalAlign: "middle",
            }} />
          )}
        </div>
      )}

      {!rapport && !loading && (
        <div style={{
          margin: "0 20px",
          padding: "40px 20px",
          textAlign: "center",
          color: "var(--ink-3)",
          fontSize: 13,
        }}>
          <Sparkles size={28} style={{ color: "var(--line-2)", marginBottom: 12 }} />
          <div>Sélectionne une période et clique sur <strong style={{ color: "var(--ink-2)" }}>Générer le rapport</strong></div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes blink { 50% { opacity: 0; } }
      `}</style>
    </div>
  );
}
