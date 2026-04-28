import { ArrowRight, Bot, ChartNoAxesCombined, FileSearch, ShieldCheck } from "lucide-react"
import { Link } from "react-router-dom"

const highlights = [
  {
    icon: <FileSearch size={18} />,
    title: "Lecture documentaire",
    text: "Importer des pièces et structurer l’information plus vite.",
  },
  {
    icon: <ChartNoAxesCombined size={18} />,
    title: "Pilotage clair",
    text: "Suivre TVA, rapprochement et indicateurs depuis un même espace.",
  },
  {
    icon: <Bot size={18} />,
    title: "IA utile",
    text: "Faire ressortir anomalies, signaux faibles et prochaines actions.",
  },
]

export default function Home() {
  return (
    <div className="home-page">
      <div className="home-background" aria-hidden="true" />

      <header className="home-topbar">
        <Link to="/" className="home-brand" aria-label="FinDoc accueil">
          <img className="home-brand__logo" src="/logo-findoc-transparent.png" alt="FinDoc" />
        </Link>

        <div className="home-topbar__actions">
          <Link to="/dossiers" className="btn btn-primary">
            Entrer
            <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      <main className="home-main">
        <section className="home-hero home-hero--simple">
          <div className="home-hero__copy">
            <span className="home-pill">Plateforme comptable augmentée</span>

            <h1 className="home-title">
              FinDoc centralise les dossiers, automatise la lecture des pièces et rend le suivi plus lisible.
            </h1>

            <p className="home-subtitle">
              Une interface simple pour montrer le produit sans surcharge: un message clair, quelques bénéfices
              concrets et un accès direct à l’application.
            </p>

            <div className="home-cta">
              <Link to="/dossiers" className="btn btn-primary lg">
                Entrer dans FinDoc
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          <aside className="home-showcase home-showcase--simple" aria-label="Aperçu produit">
            <div className="home-showcase__card home-showcase__card--primary">
              <span className="home-showcase__eyebrow">Modules visibles</span>
              <h2>Une démo courte, propre et directement actionnable.</h2>
              <div className="home-showcase__stack home-showcase__stack--single">
                <div className="home-module-chip">Dossiers clients</div>
                <div className="home-module-chip">Dashboard financier</div>
                <div className="home-module-chip">Rapprochement bancaire</div>
                <div className="home-module-chip">Anomalies & relances</div>
              </div>
            </div>
          </aside>
        </section>

        <section className="home-section home-section--compact">
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

        <section className="home-banner home-banner--simple">
          <div>
            <h2>Entrer dans la démo et parcourir le produit en quelques clics.</h2>
          </div>
          <div className="home-banner__actions">
            <Link to="/dossiers" className="btn btn-primary">
              Continuer
              <ArrowRight size={15} />
            </Link>
            <div className="home-banner__note">
              <ShieldCheck size={14} />
              Version épurée pour une première impression plus nette.
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
