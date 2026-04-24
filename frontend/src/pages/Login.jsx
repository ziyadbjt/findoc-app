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

  const submit = async (event) => {
    event.preventDefault();
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
    <div className="login-page">
      <div className="login-page__glow login-page__glow--left" />
      <div className="login-page__glow login-page__glow--right" />

      <section className="login-hero">
        <div className="login-brand">
          <div className="brand-mark login-brand__mark">F</div>
          <div>
            <div className="login-brand__name">FinDoc</div>
            <div className="login-brand__meta">Cabinet workspace</div>
          </div>
        </div>

        <div className="login-hero__content">
          <div className="login-kicker">Suite comptable</div>
          <h1 className="login-title">
            Connecte-toi a
            <br />
            ton espace FinDoc.
          </h1>
          <p className="login-copy">
            Retrouve tes dossiers, tes exports et tes echanges equipe dans une interface plus simple.
          </p>
        </div>

        <div className="login-preview">
          <div className="login-preview__window">
            <div className="login-preview__bar">
              <div className="login-preview__dots">
                <span />
                <span />
                <span />
              </div>
              <div className="login-preview__filename">Dossier CABINET CHAMI • Avril 2026</div>
              <span className="badge accent">Live workflow</span>
            </div>

            <div className="login-preview__body">
              <div className="login-preview__headline">
                <div>
                  <div className="login-preview__label">Vue dossier</div>
                  <div className="login-preview__title">Pilotage comptable fluide</div>
                </div>
                <div className="login-preview__stat">
                  <span>18</span>
                  <small>factures traitees</small>
                </div>
              </div>

              <div className="login-preview__stack">
                <div className="login-preview__stack-card">
                  <div className="login-preview__stack-top">
                    <span>Chat equipe</span>
                    <span className="login-preview__chip">2 non lus</span>
                  </div>
                  <p>Un suivi plus clair entre collaborateurs, sans quitter le dossier.</p>
                </div>

                <div className="login-preview__stack-card">
                  <div className="login-preview__stack-top">
                    <span>Export</span>
                    <span className="login-preview__chip">Excel + SAGE</span>
                  </div>
                  <p>Exports comptables et syntheses disponibles en quelques clics.</p>
                </div>

                <div className="login-preview__kpis">
                  <div>
                    <strong>3 140</strong>
                    <span>Solde TVA</span>
                  </div>
                  <div>
                    <strong>9</strong>
                    <span>Relances ouvertes</span>
                  </div>
                  <div>
                    <strong>98%</strong>
                    <span>OCR moyen</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="login-panel-wrap">
        <div className="login-panel">
          <div className="login-panel__top">
            <div className="login-panel__eyebrow">Connexion</div>
            <h2 className="login-panel__title">Acceder a ton espace</h2>
            <p className="login-panel__copy">
              Entre tes identifiants pour ouvrir FinDoc.
            </p>
          </div>

          <form className="login-form" onSubmit={submit}>
            <div>
              <label className="label">Email professionnel</label>
              <input
                className="input lg"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </div>

            <div>
              <div className="login-form__label-row">
                <label className="label">Mot de passe</label>
                <button type="button" className="login-link-btn">Mot de passe oublie ?</button>
              </div>
              <input
                className="input lg"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error ? <div className="login-error">{error}</div> : null}

            <button type="submit" className="btn btn-primary lg login-submit" disabled={loading}>
              {loading ? "Connexion..." : "Se connecter"}
              {!loading && <ArrowRight size={15} />}
            </button>
          </form>

          <div className="login-divider">
            <span />
            <small>ou</small>
            <span />
          </div>

          <button className="btn btn-secondary lg login-sso" type="button">
            <Lock size={14} />
            SSO cabinet
          </button>

          <div className="login-footer">
            <span>© 2026 FinDoc</span>
            <span>Confidentialite</span>
          </div>
        </div>
      </section>
    </div>
  );
}
