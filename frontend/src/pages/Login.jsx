import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Lock, Mail } from "lucide-react";
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
      <header className="login-topbar">
        <div className="login-brand">
          <span className="login-brand__name">FinDoc</span>
        </div>
        <button type="button" className="login-help">Besoin d'aide ?</button>
      </header>

      <main className="login-canvas">
        <section className="login-panel" aria-labelledby="login-title">
          <div className="login-panel__top">
            <h1 id="login-title" className="login-panel__title">Connexion</h1>
            <p className="login-panel__copy">Accédez à votre espace cabinet</p>
          </div>

          <form className="login-form" onSubmit={submit}>
            <div className="login-field">
              <label className="login-label" htmlFor="login-email">Adresse e-mail</label>
              <div className="login-input-wrap">
                <Mail size={18} aria-hidden="true" />
                <input
                  id="login-email"
                  className="login-input"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  placeholder="nom@cabinet.ma"
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
                  placeholder="••••••••"
                />
              </div>
              <button type="button" className="login-link-btn">Mot de passe oublié ?</button>
            </div>

            {error ? <div className="login-error">{error}</div> : null}

            <button type="submit" className="btn btn-primary lg login-submit" disabled={loading}>
              {loading ? "Connexion..." : "Se connecter"}
              {!loading && <ArrowRight size={15} />}
            </button>
          </form>

          <div className="login-divider">
            <small>ou</small>
          </div>

          <div className="login-contact">
            Pas encore de compte ? <button type="button">Contacter un conseiller</button>
          </div>
        </section>
      </main>

      <footer className="login-footer">
        <strong>FinDoc</strong>
        <nav aria-label="Liens légaux">
          <button type="button">Mentions légales</button>
          <button type="button">Confidentialité</button>
          <button type="button">CGU</button>
          <button type="button">Contact</button>
        </nav>
        <span>© 2026 FinDoc. Tous droits réservés.</span>
      </footer>
    </div>
  );
}
