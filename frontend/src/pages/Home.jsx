import { ArrowRight, BadgeCheck, Bot, BriefcaseBusiness, ChartNoAxesCombined, FileCode2, FileSearch, ShieldCheck, Sparkles, Target, WandSparkles } from "lucide-react"
import { Link } from "react-router-dom"

const metrics = [
  { value: "Full-stack", label: "interface métier, auth, routing et parcours produit complet" },
  { value: "IA appliquée", label: "lecture documentaire, alertes et aide à la décision contextualisée" },
  { value: "UX produit", label: "une démo pensée pour raconter la valeur en quelques écrans" },
]

const highlights = [
  {
    icon: <FileSearch size={18} />,
    title: "Un vrai cas d’usage métier",
    text: "Le produit répond à une friction concrète: transformer des documents comptables en actions utiles et lisibles.",
  },
  {
    icon: <ChartNoAxesCombined size={18} />,
    title: "Un pilotage orienté décision",
    text: "La démo met en scène des signaux, des priorités et un workflow, pas seulement des tableaux statiques.",
  },
  {
    icon: <Bot size={18} />,
    title: "Une IA intégrée avec discernement",
    text: "L’automatisation assiste le professionnel sans prétendre remplacer l’expertise métier.",
  },
]

const recruiterSignals = [
  {
    icon: <BriefcaseBusiness size={18} />,
    title: "Vision produit",
    text: "Positionnement, hiérarchie de l’information et narration orientée démonstration.",
  },
  {
    icon: <FileCode2 size={18} />,
    title: "Exécution front-end",
    text: "Routing, composants réutilisables, design tokens, responsive et cohérence visuelle.",
  },
  {
    icon: <Target size={18} />,
    title: "Pensée business",
    text: "Chaque écran aide à expliquer le bénéfice utilisateur, pas juste à montrer une fonctionnalité.",
  },
]

const modules = [
  "Dossiers clients",
  "Dashboard financier",
  "Rapprochement bancaire",
  "Anomalies & alertes",
  "Relances clients",
  "Administration cabinet",
]

const proofItems = ["Produit métier", "IA utile", "Design system", "Démo narrative"]

export default function Home() {
  return (
    <div className="home-page">
      <div className="home-background" aria-hidden="true" />

      <header className="home-topbar">
        <Link to="/" className="home-brand" aria-label="FinDoc accueil">
          <img className="home-brand__logo" src="/logo-findoc.png" alt="FinDoc" />
        </Link>

        <div className="home-topbar__actions">
          <Link to="/login" className="btn btn-ghost">Connexion</Link>
          <Link to="/dossiers" className="btn btn-primary">
            Voir la démo
            <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      <main className="home-main">
        <section className="home-hero">
          <div className="home-hero__copy">
            <div className="home-pill">
              <Sparkles size={14} />
              Démo produit à montrer à un recruteur
            </div>

            <h1 className="home-title">
              FinDoc montre comment je conçois un produit métier, une expérience claire et une IA qui sert vraiment l’utilisateur.
            </h1>

            <p className="home-subtitle">
              Cette démo n’est pas seulement une interface jolie. C’est une vitrine de réflexion produit, de qualité
              d’exécution et de capacité à transformer un besoin métier complexe en expérience lisible.
            </p>

            <div className="home-cta">
              <Link to="/dossiers" className="btn btn-primary lg">
                Voir le produit
                <ArrowRight size={16} />
              </Link>
              <Link to="/login" className="btn btn-secondary lg">
                Accès application
              </Link>
            </div>

            <div className="home-proof-strip" aria-label="Signaux clés">
              {proofItems.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>

            <div className="home-metrics">
              {metrics.map((item) => (
                <div key={item.label} className="home-metric">
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <aside className="home-showcase" aria-label="Aperçu produit">
            <div className="home-showcase__card home-showcase__card--primary">
              <div className="home-showcase__eyebrow">
                <BadgeCheck size={14} />
                Ce que le recruteur peut lire vite
              </div>
              <h2>Un projet qui articule métier, design et exécution technique dans une même démo.</h2>
              <p>
                En quelques interactions, on voit un scope crédible: onboarding dossier, lecture documentaire,
                dashboard, exceptions métier et administration.
              </p>
              <div className="home-showcase__stack">
                {modules.map((module) => (
                  <div key={module} className="home-module-chip">{module}</div>
                ))}
              </div>
            </div>

            <div className="home-showcase__story">
              <div className="home-story-step">
                <strong>01</strong>
                <div>
                  <span>Compréhension métier</span>
                  <p>Le problème ciblé est concret: simplifier la gestion documentaire et le pilotage comptable.</p>
                </div>
              </div>
              <div className="home-story-step">
                <strong>02</strong>
                <div>
                  <span>Produit racontable</span>
                  <p>La homepage, les CTA et les modules servent à vendre la proposition de valeur rapidement.</p>
                </div>
              </div>
              <div className="home-story-step">
                <strong>03</strong>
                <div>
                  <span>Détails qui comptent</span>
                  <p>Responsive, système visuel, cohérence des composants et ton produit montrent le niveau d’attention.</p>
                </div>
              </div>
            </div>

            <div className="home-testimonial">
              <span className="home-mini-card__label">Lecture idéale côté recrutement</span>
              <p>
                “Cette démo me montre quelqu’un qui sait cadrer un produit, lui donner une forme crédible et raconter
                sa valeur sans surjouer la complexité.”
              </p>
            </div>
          </aside>
        </section>

        <section className="home-section">
          <div className="home-section__head">
            <span>Ce que ça démontre</span>
            <h2>La landing ne vend pas juste FinDoc. Elle met aussi en avant la manière dont le produit a été pensé et exécuté.</h2>
          </div>

          <div className="home-highlights">
            {highlights.map((item) => (
              <article key={item.title} className="home-highlight">
                <div className="home-highlight__icon">{item.icon}</div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="home-section">
          <div className="home-section__head">
            <span>Signaux pour recruteurs</span>
            <h2>Une lecture rapide des compétences visibles dans la démo, sans avoir besoin d’expliquer longtemps le projet.</h2>
          </div>

          <div className="home-outcomes">
            {recruiterSignals.map((item) => (
              <article key={item.title} className="home-outcome">
                <div className="home-highlight__icon">{item.icon}</div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="home-banner">
          <div>
            <span className="home-banner__eyebrow">Prêt pour la visite</span>
            <h2>Ouvrez la démo et laissez l’interface raconter à la fois le produit et le niveau de craft derrière.</h2>
          </div>
          <div className="home-banner__actions">
            <Link to="/dossiers" className="btn btn-primary">
              Explorer la démo
              <ArrowRight size={15} />
            </Link>
            <div className="home-banner__note">
              <ShieldCheck size={14} />
              Une entrée pensée pour portfolio, entretien, partage d’écran et revue produit.
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
