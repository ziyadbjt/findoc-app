import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Lock } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("ziyad@cabinetchami.ma");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      navigate("/dossiers");
    } catch {
      setError("Email ou mot de passe incorrect.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "1fr 1fr", background: "var(--bg-0)" }}>
      {/* Left: form */}
      <div style={{ display: "flex", flexDirection: "column", padding: "40px 56px", minHeight: "100vh" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="brand-mark" style={{ width: 28, height: 28, borderRadius: 8, fontSize: 13 }}>F</div>
          <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: "-0.01em" }}>FINDOC</span>
          <span style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)", marginLeft: 6 }}>v2.4</span>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 380 }}>
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: "var(--accent-ink)", background: "var(--accent-bg)", display: "inline-block", padding: "3px 9px", borderRadius: 999, marginBottom: 16 }}>
              Cabinets comptables · Maroc
            </div>
            <h1 style={{ fontSize: 36, fontWeight: 500, letterSpacing: "-0.03em", margin: "0 0 10px", lineHeight: 1.05 }}>
              La comptabilité<br />
              <span style={{ color: "var(--ink-2)" }}>sans ressaisie.</span>
            </h1>
            <p style={{ fontSize: 14, color: "var(--ink-2)", margin: 0, lineHeight: 1.55 }}>
              Extraction PDF, journal SAGE 100, réconciliation bancaire et Loi 69-21 — automatisés.
            </p>
          </div>

          <form onSubmit={submit}>
            <div style={{ marginBottom: 12 }}>
              <label className="label">Email professionnel</label>
              <input className="input lg" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label className="label">Mot de passe</label>
                <a href="#" style={{ fontSize: 11.5, color: "var(--accent-ink)" }}>Oublié ?</a>
              </div>
              <input className="input lg" type="password" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            {error && (
              <div style={{ fontSize: 12.5, color: "var(--neg-ink)", marginBottom: 12, padding: "8px 12px", background: "var(--neg-bg)", borderRadius: 8 }}>
                {error}
              </div>
            )}
            <button type="submit" className="btn btn-primary lg" style={{ width: "100%", justifyContent: "center" }} disabled={loading}>
              {loading ? <span className="spinner" /> : <>Se connecter <ArrowRight size={14} /></>}
            </button>
          </form>

          <div style={{ marginTop: 24, display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ height: 1, flex: 1, background: "var(--line-1)" }} />
            <span style={{ fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 0.06 }}>ou</span>
            <div style={{ height: 1, flex: 1, background: "var(--line-1)" }} />
          </div>
          <button className="btn btn-secondary lg" style={{ width: "100%", justifyContent: "center", marginTop: 16 }}>
            <Lock size={14} /> SSO via CNEC Maroc
          </button>
        </div>

        <div style={{ fontSize: 11, color: "var(--ink-3)", display: "flex", gap: 14 }}>
          <span>© 2026 FINDOC</span><span>Confidentialité</span><span>Loi 09-08 · conforme</span>
        </div>
      </div>

      {/* Right: visual */}
      <div style={{ background: "var(--bg-inset)", borderLeft: "1px solid var(--line-0)", padding: 40, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <div style={{ maxWidth: 480, width: "100%" }}>
          <div className="card" style={{ padding: 0, overflow: "hidden", boxShadow: "var(--shadow-lg)" }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--line-1)", display: "flex", alignItems: "center", gap: 8, background: "var(--bg-inset)" }}>
              <div style={{ display: "flex", gap: 5 }}>
                {[0, 1, 2].map(i => <div key={i} style={{ width: 9, height: 9, borderRadius: 99, background: "var(--line-strong)" }} />)}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-2)", fontFamily: "var(--font-mono)", marginLeft: 6 }}>FAC-2026-0132.pdf</div>
              <span className="badge accent" style={{ marginLeft: "auto" }}>
                <span className="dot" style={{ animation: "pulse-dot 1.4s infinite" }} />Extraction
              </span>
            </div>
            <div style={{ padding: 20 }}>
              {[
                ["Fournisseur", "ATECH DIGITAL SARL", 99],
                ["N° facture", "ATC-260318", 97],
                ["Montant HT", "4 800,00 MAD", 99],
                ["TVA 20%", "960,00 MAD", 99],
                ["Montant TTC", "5 760,00 MAD", 100],
                ["Compte PCM", "6135000", 92],
              ].map(([k, v, c]) => (
                <div key={k} style={{ padding: "7px 0", borderBottom: "1px solid var(--line-1)", fontSize: 11.5 }}>
                  <div style={{ color: "var(--ink-2)", fontSize: 10.5, marginBottom: 2, display: "flex", justifyContent: "space-between" }}>
                    <span>{k}</span>
                    <span className="mono tabular" style={{ color: c > 95 ? "var(--pos-ink)" : "var(--warn-ink)" }}>{c}%</span>
                  </div>
                  <div className="mono" style={{ color: "var(--ink-0)", fontWeight: 500 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {[["PDF → journal", "en 4 secondes"], ["PCM marocain", "7 comptes auto"], ["Loi 69-21", "pénalités calculées"]].map(([a, b]) => (
              <div key={a} style={{ padding: 12, background: "var(--bg-1)", border: "1px solid var(--line-0)", borderRadius: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{a}</div>
                <div style={{ fontSize: 11, color: "var(--ink-2)" }}>{b}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
