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
    <div style={{
      minHeight: "100vh",
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      background: "#060b0a",
    }}>
      {/* Left: form */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        padding: "40px 56px",
        minHeight: "100vh",
        background: "linear-gradient(180deg, #00342c, #00221a)",
        borderRight: "1px solid rgba(143,212,188,0.14)",
      }}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="brand-mark" style={{ width: 32, height: 32, borderRadius: 8, fontSize: 14 }}>F</div>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-0)" }}>Findoc</span>
          <span style={{ fontSize: 10, color: "var(--ink-3)", fontFamily: "var(--font-mono)", marginLeft: 4, letterSpacing: "0.12em" }}>v2.4</span>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 380 }}>
          <div style={{ marginBottom: 36 }}>
            <div style={{
              fontSize: 10,
              fontWeight: 600,
              color: "var(--mint)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              display: "inline-block",
              padding: "4px 10px",
              background: "rgba(143,212,188,0.1)",
              border: "1px solid rgba(143,212,188,0.2)",
              borderRadius: 4,
              marginBottom: 20,
            }}>
              Cabinets comptables · Maroc
            </div>
            <h1 style={{
              fontFamily: "var(--font-display)",
              fontSize: 42,
              fontWeight: 500,
              letterSpacing: "0.01em",
              margin: "0 0 12px",
              lineHeight: 1.1,
              color: "var(--ink-0)",
            }}>
              La comptabilité<br />
              <span style={{ color: "var(--mint)", opacity: 0.75 }}>sans ressaisie.</span>
            </h1>
            <p style={{ fontSize: 14, color: "var(--ink-2)", margin: 0, lineHeight: 1.6 }}>
              Extraction PDF, journal SAGE 100, réconciliation bancaire et TVA automatisées.
            </p>
          </div>

          <form onSubmit={submit}>
            <div style={{ marginBottom: 14 }}>
              <label className="label">Email professionnel</label>
              <input className="input lg" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label className="label">Mot de passe</label>
                <a href="#" style={{ fontSize: 11, color: "var(--accent-ink)", letterSpacing: "0.06em" }}>Oublié ?</a>
              </div>
              <input className="input lg" type="password" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            {error && (
              <div style={{
                fontSize: 12,
                color: "var(--neg-ink)",
                marginBottom: 14,
                padding: "10px 14px",
                background: "var(--neg-bg)",
                border: "1px solid rgba(210,123,106,0.24)",
                borderRadius: 6,
              }}>
                {error}
              </div>
            )}
            <button type="submit" className="btn btn-primary lg" style={{ width: "100%", justifyContent: "center" }} disabled={loading}>
              {loading ? <span className="spinner" /> : <>Se connecter <ArrowRight size={14} /></>}
            </button>
          </form>

          <div style={{ marginTop: 24, display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ height: 1, flex: 1, background: "rgba(143,212,188,0.1)" }} />
            <span style={{ fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.12em" }}>ou</span>
            <div style={{ height: 1, flex: 1, background: "rgba(143,212,188,0.1)" }} />
          </div>
          <button className="btn btn-secondary lg" style={{ width: "100%", justifyContent: "center", marginTop: 14 }}>
            <Lock size={13} /> SSO via CNEC Maroc
          </button>
        </div>

        <div style={{ fontSize: 11, color: "var(--ink-3)", display: "flex", gap: 16, letterSpacing: "0.06em" }}>
          <span>© 2026 Plateforme cabinet</span>
          <span>Confidentialité</span>
          <span>Loi 09-08 · conforme</span>
        </div>
      </div>

      {/* Right: visual demo */}
      <div style={{
        background: "#060b0a",
        padding: 48,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Background glow */}
        <div style={{
          position: "absolute",
          top: "20%",
          left: "30%",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(143,212,188,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{ maxWidth: 460, width: "100%", position: "relative" }}>
          {/* Demo card */}
          <div className="card" style={{ padding: 0, overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(143,212,188,0.18)" }}>
            <div style={{
              padding: "10px 14px",
              borderBottom: "1px solid rgba(143,212,188,0.1)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(0,40,33,0.8)",
            }}>
              <div style={{ display: "flex", gap: 5 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 8, height: 8, borderRadius: 99, background: "rgba(143,212,188,0.2)" }} />
                ))}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-2)", fontFamily: "var(--font-mono)", marginLeft: 6 }}>
                FAC-2026-0132.pdf
              </div>
              <span className="badge accent" style={{ marginLeft: "auto" }}>
                <span className="dot" style={{ animation: "pulse-dot 1.4s infinite", background: "var(--mint)", boxShadow: "0 0 6px rgba(143,212,188,0.5)" }} />
                Extraction
              </span>
            </div>
            <div style={{ padding: 20, background: "rgba(0,30,24,0.6)" }}>
              {[
                ["Fournisseur", "ATECH DIGITAL SARL", 99],
                ["N° facture", "ATC-260318", 97],
                ["Montant HT", "4 800,00 MAD", 99],
                ["TVA 20%", "960,00 MAD", 99],
                ["Montant TTC", "5 760,00 MAD", 100],
                ["Compte PCM", "6135000", 92],
              ].map(([k, v, c]) => (
                <div key={k} style={{ padding: "8px 0", borderBottom: "1px solid rgba(143,212,188,0.07)", fontSize: 12 }}>
                  <div style={{ color: "var(--ink-2)", fontSize: 10, marginBottom: 3, display: "flex", justifyContent: "space-between", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    <span>{k}</span>
                    <span className="mono tabular" style={{ color: c > 95 ? "var(--pos-ink)" : "var(--warn-ink)" }}>{c}%</span>
                  </div>
                  <div className="mono" style={{ color: "var(--ink-0)", fontWeight: 500 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Feature chips */}
          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {[
              ["PDF → journal", "en 4 secondes"],
              ["PCM marocain", "7 comptes auto"],
              ["TVA", "déclaration préparée"],
            ].map(([a, b]) => (
              <div key={a} style={{
                padding: "12px 14px",
                background: "rgba(143,212,188,0.05)",
                border: "1px solid rgba(143,212,188,0.14)",
                borderRadius: 6,
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-0)", marginBottom: 3, letterSpacing: "0.04em" }}>{a}</div>
                <div style={{ fontSize: 11, color: "var(--ink-2)" }}>{b}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
