import {
  ArrowRight,
  FileText,
  Zap,
  ShieldCheck,
  TrendingUp,
  Bell,
  RefreshCw,
  Clock,
  CheckCircle2,
  Star,
} from "lucide-react"
import { Link } from "react-router-dom"
import BrandLogo from "../components/BrandLogo"

const stats = [
  { value: "3×", label: "Plus rapide qu'une saisie manuelle" },
  { value: "<30s", label: "Par facture traitée par l'IA" },
  { value: "100%", label: "Conformité réglementaire garantie" },
  { value: "0", label: "Erreur de TVA non détectée" },
]

const features = [
  {
    icon: <FileText size={20} />,
    tag: "Extraction IA",
    title: "Vos factures lues en 3 secondes",
    text: "Importez un PDF ou une image. FinDoc extrait fournisseur, montant HT, TVA et date d'échéance automatiquement. Zéro ressaisie.",
  },
  {
    icon: <Zap size={20} />,
    tag: "Journal comptable",
    title: "Écritures générées instantanément",
    text: "Chaque facture produit des écritures comptables directement exploitables, classées par fournisseur, type d'achat et nature de la dépense.",
  },
  {
    icon: <Bell size={20} />,
    tag: "Délais de paiement",
    title: "Alertes avant les pénalités",
    text: "FinDoc surveille chaque échéance et calcule les pénalités de retard automatiquement. Vos clients reçoivent des relances avant que ça coûte cher.",
  },
  {
    icon: <TrendingUp size={20} />,
    tag: "Tableau de bord",
    title: "TVA, tréso et marges en un coup d'oeil",
    text: "Dashboard temps réel : TVA collectée vs déductible, solde de trésorerie, factures en retard et indicateurs financiers clés, sans ouvrir Excel.",
  },
  {
    icon: <RefreshCw size={20} />,
    tag: "Rapprochement bancaire",
    title: "Reliez relevés et factures sans effort",
    text: "Glissez votre relevé bancaire. FinDoc propose les associations automatiquement. Vous validez en un clic. Votre trésorerie est toujours à jour.",
  },
  {
    icon: <ShieldCheck size={20} />,
    tag: "Audit et anomalies",
    title: "Rien ne passe entre les mailles",
    text: "Détection des doublons, TVA incohérente, fournisseurs inconnus. Piste d'audit complète pour chaque écriture. Votre cabinet est couvert.",
  },
]

const steps = [
  {
    n: "01",
    title: "Importez vos pièces",
    text: "PDF, JPG, XML, FinDoc accepte tout. Glissez une facture ou un relevé bancaire.",
  },
  {
    n: "02",
    title: "L'IA extrait et comptabilise",
    text: "Montants, comptes, TVA, tout est extrait et journalisé en quelques secondes.",
  },
  {
    n: "03",
    title: "Pilotez depuis le dashboard",
    text: "Tableau de bord en temps réel, alertes de délais, relances clients, export prêt.",
  },
]

const proof = [
  { value: "16", label: "factures traitées dans la démo" },
  { value: "52", label: "écritures générées automatiquement" },
  { value: "4", label: "retards détectés en temps réel" },
  { value: "3", label: "modules de déclaration fiscale" },
]

export default function Home() {
  return (
    <div className="home-page">
      <div className="home-background" aria-hidden="true" />

      <header className="home-topbar">
        <Link to="/" className="home-brand" aria-label="FinDoc accueil">
          <BrandLogo className="home-brand__logo" surface="marketing" />
        </Link>
        <nav className="home-nav">
          <a href="#features" className="home-nav__link">Fonctionnalités</a>
          <a href="#how" className="home-nav__link">Comment ça marche</a>
        </nav>
        <div className="home-topbar__actions">
          <Link to="/dossiers" className="btn btn-primary">
            Voir la démo
            <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      <main className="home-main">

        {/* HERO */}
        <section className="home-hero home-hero--simple">
          <div className="home-hero__copy">
            <span className="home-pill">
              <Star size={10} style={{ marginRight: 5 }} />
              Plateforme comptable · Maroc
            </span>

            <h1 className="home-title">
              Clôturez plus vite.<br />
              Relancez à temps.<br />
              <span className="home-title__accent">Dormez tranquille.</span>
            </h1>

            <p className="home-subtitle">
              FinDoc lit vos factures par IA, génère les écritures comptables, surveille vos délais
              et vous alerte avant que les pénalités s'accumulent. En quelques secondes par pièce.
            </p>

            <div className="home-cta">
              <Link to="/dossiers" className="btn btn-primary lg">
                Accéder à la démo gratuite
                <ArrowRight size={16} />
              </Link>
              <a href="#features" className="btn btn-ghost lg">
                Découvrir les fonctionnalités
              </a>
            </div>

            <div className="home-trust">
              <CheckCircle2 size={13} className="home-trust__icon" />
              <span>Aucun compte requis · Données de démo incluses · 100% marocain</span>
            </div>
          </div>

          <aside className="home-hero__visual" aria-label="Aperçu chiffres clés">
            <div className="home-stat-card">
              <div className="home-stat-card__header">
                <span className="home-stat-card__dot" />
                <span className="home-stat-card__label">Atlas Industries SA · Tableau de bord</span>
              </div>
              <div className="home-stat-grid">
                {proof.map((p) => (
                  <div key={p.label} className="home-stat-item">
                    <span className="home-stat-item__value">{p.value}</span>
                    <span className="home-stat-item__label">{p.label}</span>
                  </div>
                ))}
              </div>
              <div className="home-stat-card__footer">
                <div className="home-alert-row">
                  <span className="home-alert-dot home-alert-dot--warn" />
                  <span>4 factures en retard · pénalités calculées</span>
                </div>
                <div className="home-alert-row">
                  <span className="home-alert-dot home-alert-dot--pos" />
                  <span>TVA déductible · solde à jour</span>
                </div>
                <div className="home-alert-row">
                  <span className="home-alert-dot home-alert-dot--pos" />
                  <span>Rapprochement bancaire · 0 écart</span>
                </div>
              </div>
            </div>
          </aside>
        </section>

        {/* STATS BAR */}
        <section className="home-stats-bar">
          {stats.map((s) => (
            <div key={s.label} className="home-stat-bar-item">
              <span className="home-stat-bar-item__value">{s.value}</span>
              <span className="home-stat-bar-item__label">{s.label}</span>
            </div>
          ))}
        </section>

        {/* FEATURES */}
        <section className="home-section" id="features">
          <div className="home-section__head">
            <span className="home-pill">Ce que FinDoc fait pour vous</span>
            <h2>Tout ce qu'un cabinet perd du temps à faire manuellement,<br />FinDoc le fait automatiquement.</h2>
          </div>
          <div className="home-features-grid">
            {features.map((f) => (
              <article key={f.title} className="home-feature-card">
                <div className="home-feature-card__top">
                  <div className="home-highlight__icon">{f.icon}</div>
                  <span className="home-feature-tag">{f.tag}</span>
                </div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="home-section" id="how">
          <div className="home-section__head">
            <span className="home-pill">En 3 étapes</span>
            <h2>De la facture brute au bilan propre,<br />sans friction.</h2>
          </div>
          <div className="home-steps">
            {steps.map((s, i) => (
              <div key={s.n} className="home-step">
                <div className="home-step__number">{s.n}</div>
                <div className="home-step__body">
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </div>
                {i < steps.length - 1 && <div className="home-step__arrow"><ArrowRight size={18} /></div>}
              </div>
            ))}
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="home-banner home-banner--cta">
          <div className="home-banner__copy">
            <span className="home-pill">Démo disponible maintenant</span>
            <h2>Voyez FinDoc en action.<br />Dossier réel, données réelles.</h2>
            <p>Parcourez un cabinet complet : 16 factures, 52 écritures, tableau de bord, relances et exports. Sans rien configurer.</p>
          </div>
          <div className="home-banner__actions">
            <Link to="/dossiers" className="btn btn-primary lg">
              Ouvrir FinDoc maintenant
              <ArrowRight size={16} />
            </Link>
            <div className="home-banner__note">
              <ShieldCheck size={14} />
              Données démo · Aucun engagement
            </div>
          </div>
        </section>

      </main>

      <footer className="home-footer">
        <span>© 2025 FinDoc · Plateforme comptable marocaine</span>
        <span className="home-footer__sep">·</span>
        <span>Plateforme comptable pour le Maroc</span>
      </footer>
    </div>
  )
}
