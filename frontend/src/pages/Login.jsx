import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Lock, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import BrandLogo from "../components/BrandLogo";

export default function Login() {
  const [identifier, setIdentifier] = useState("ziyad");
  const [password, setPassword] = useState("ziyad123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();
  const theme = document.documentElement.getAttribute("data-theme") || "dark";

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(identifier, password);
      navigate("/dossiers");
    } catch {
      setError("Identifiant ou mot de passe incorrect.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <header className="login-topbar">
        <div className="login-brand">
          <BrandLogo className="login-brand__logo" surface="auth" theme={theme} />
        </div>
      </header>

      <main className="login-canvas">
        <section className="login-panel" aria-labelledby="login-title">
          <div className="login-panel__top">
            <h1 id="login-title" className="login-panel__title">Connexion</h1>
            <p className="login-panel__copy">Accédez à votre espace FinDoc</p>
            <div className="login-demo-strip" aria-label="Identifiants de démonstration">
              <span>Accès démo</span>
              <strong>ziyad</strong>
              <strong>ziyad123</strong>
            </div>
          </div>

          <form className="login-form" onSubmit={submit}>
            <div className="login-field">
              <label className="login-label" htmlFor="login-identifier">Identifiant</label>
              <div className="login-input-wrap">
                <User size={18} aria-hidden="true" />
                <input
                  id="login-identifier"
                  className="login-input"
                  type="text"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  autoComplete="username"
                  placeholder="ziyad"
                />
              </div>
            </div>

            <div className="login-field">
              <div className="login-form__label-row">
                <label className="login-label" htmlFor="login-password">Mot de passe</label>
              </div>
              <div className="login-input-wrap">
                <Lock size={18} aria-hidden="true" />
                <input
                  id="login-password"
                  className="login-input"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="Mot de passe"
                />
              </div>
            </div>

            {error ? <div className="login-error">{error}</div> : null}

            <button type="submit" className="btn btn-primary lg login-submit" disabled={loading}>
              {loading ? "Connexion..." : "Se connecter"}
              {!loading && <ArrowRight size={15} />}
            </button>
          </form>
        </section>
      </main>

      <footer className="login-footer">
        <BrandLogo className="login-footer__logo" surface="auth" theme={theme} />
        <span>2026 FinDoc. Tous droits réservés.</span>
      </footer>
    </div>
  );
}
