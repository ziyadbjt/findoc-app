import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  Database,
  Globe,
  GraduationCap,
  Mail,
  Rocket,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react"

const metrics = [
  { value: "20", label: "entreprises suivies" },
  { value: "60%", label: "de gain de temps sur le traitement" },
  { value: "4", label: "langues de travail" },
]

const experience = [
  {
    title: "Stagiaire Finance & Comptabilite",
    company: "UHY Ben Mokhtar & Co",
    period: "Fev. 2026 - Present",
    body:
      "Gestion comptable et fiscale d'un portefeuille de 20 clients, avec automatisation IA des dossiers et renforcement de la fiabilite des reportings.",
  },
  {
    title: "Stagiaire Comptabilite & Fiscalite",
    company: "Banque Populaire Offshore",
    period: "Juil. 2024 - Aout 2024",
    body:
      "Rapprochements bancaires, suivi de la comptabilite generale et integration des evolutions fiscales offshore dans les procedures internes.",
  },
  {
    title: "Fondateur",
    company: "Z-Services",
    period: "Mars 2021 - Sept. 2021",
    body:
      "Lancement d'une activite de services digitaux avec acquisition clients, analytics marketing et pilotage de tresorerie.",
  },
]

const stack = [
  "Analyse financiere",
  "Reporting financier",
  "Automatisation comptable par IA",
  "Python",
  "SQL",
  "Power BI",
  "Excel avance",
  "SAP FI/CO",
  "Sage 100",
  "Google Data Analytics",
  "Bloomberg Market Concepts",
  "Google AI Essentials",
]

const pillars = [
  {
    icon: Workflow,
    title: "Workflow comptable automatise",
    body: "Lecture des factures, generation d'ecritures, rapprochement bancaire et suivi des relances dans une experience unifiee.",
  },
  {
    icon: ShieldCheck,
    title: "Confidentialite preservee",
    body: "Traitement IA pense pour proteger le secret professionnel, avec stockage local des donnees et maitrise des flux sensibles.",
  },
  {
    icon: Database,
    title: "Pilotage exploitable",
    body: "Des sorties concretes pour la direction : fiabilite, vitesse, tracabilite et meilleur usage des equipes sur des missions a forte valeur.",
  },
]

const launchNeeds = [
  "Un nom de domaine et un hebergement pour publier le site en ligne.",
  "Ton identite finale : photo, logo si tu en veux un, et liens definitifs LinkedIn et email.",
  "Une demo Findoc en captures, video courte ou maquette si tu veux presenter le produit sans backend.",
  "Un PDF de CV telechargeable pour les recruteurs et partenaires.",
]

export default function App() {
  return (
    <main className="portfolio-shell">
      <div className="portfolio-noise" aria-hidden="true" />
      <div className="portfolio-aurora portfolio-aurora--one" aria-hidden="true" />
      <div className="portfolio-aurora portfolio-aurora--two" aria-hidden="true" />

      <header className="portfolio-topbar">
        <a className="portfolio-brand" href="#top">
          <span className="portfolio-brand__mark">ZB</span>
          <span className="portfolio-brand__text">
            <strong>Ziyad Boujettou</strong>
            <small>Finance, data and AI systems</small>
          </span>
        </a>

        <nav className="portfolio-nav" aria-label="Navigation principale">
          <a href="#findoc">Findoc</a>
          <a href="#experience">Experience</a>
          <a href="#stack">Competences</a>
          <a href="#launch">Mise en ligne</a>
        </nav>

        <div className="portfolio-actions">
          <a
            className="portfolio-btn portfolio-btn--ghost"
            href="https://www.linkedin.com/in/ziyad-boujettou"
            target="_blank"
            rel="noreferrer"
          >
            LinkedIn
          </a>
          <a className="portfolio-btn portfolio-btn--solid" href="mailto:ziyadbjt@outlook.fr">
            Me contacter
          </a>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow">
            <Sparkles size={14} />
            Portfolio personnel et vitrine produit
          </div>
          <h1>
            Un univers <span>liquid metal</span> pour presenter ton profil, ton ambition en finance et la vision Findoc.
          </h1>
          <p className="hero-lead">
            Etudiant en finance et big data, base a Paris, je construis des outils qui rendent la comptabilite plus rapide, plus fiable et plus intelligente.
          </p>

          <div className="hero-cta">
            <a className="portfolio-btn portfolio-btn--solid" href="#findoc">
              Voir Findoc
              <ArrowRight size={16} />
            </a>
            <a className="portfolio-btn portfolio-btn--ghost" href="mailto:ziyadbjt@outlook.fr">
              Me contacter
            </a>
          </div>

          <div className="hero-metrics">
            {metrics.map((item) => (
              <article key={item.label} className="metric-card">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </article>
            ))}
          </div>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="liquid-orb" />
          <div className="glass-panel">
            <div className="glass-panel__top">
              <span>Findoc Signal</span>
              <BadgeCheck size={16} />
            </div>
            <div className="glass-panel__body">
              <p>Automatisation comptable concue pour les cabinets, directions financieres et organisations sensibles a la confidentialite.</p>
              <div className="signal-list">
                <span>factures</span>
                <span>ecritures</span>
                <span>reconciliation</span>
                <span>relances</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-grid">
        <article className="info-card">
          <div className="section-kicker">
            <GraduationCap size={16} />
            Profil
          </div>
          <h2>Finance, comptabilite, data et execution.</h2>
          <p>
            Disponible pour une alternance de 12 mois a partir de septembre 2026, avec un parcours entre ENCG Tanger et le MSc Finance & Big Data de NEOMA Business School.
          </p>
          <div className="mini-list">
            <span>Paris, France</span>
            <span>Francais C1</span>
            <span>Anglais B2</span>
            <span>Arabe natif</span>
          </div>
        </article>

        <article className="info-card" id="findoc">
          <div className="section-kicker">
            <Rocket size={16} />
            Findoc
          </div>
          <h2>Une solution IA d'automatisation comptable pensee pour le terrain.</h2>
          <p>
            Findoc transforme les taches de saisie les plus chronophages en flux assistes par IA, pour liberer les equipes et fiabiliser les operations.
          </p>
          <p>
            Cette version du site presente la vision produit et ton positionnement. La demo complete peut venir dans une deuxieme phase, separee du portfolio.
          </p>
        </article>
      </section>

      <section className="section-block">
        <div className="section-head">
          <div className="section-kicker">
            <Building2 size={16} />
            Proposition de valeur
          </div>
          <h2>Ce que Findoc raconte de toi</h2>
          <p>Le site ne doit pas seulement montrer un CV. Il doit prouver une vision, une execution et un potentiel produit.</p>
        </div>

        <div className="pillar-grid">
          {pillars.map(({ icon: Icon, title, body }) => (
            <article key={title} className="pillar-card">
              <div className="pillar-icon">
                <Icon size={20} />
              </div>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block" id="experience">
        <div className="section-head">
          <div className="section-kicker">
            <BriefcaseBusiness size={16} />
            Experience
          </div>
          <h2>Un parcours deja ancre dans la realite operationnelle</h2>
        </div>

        <div className="timeline">
          {experience.map((item) => (
            <article key={`${item.company}-${item.period}`} className="timeline-card">
              <div className="timeline-meta">
                <span>{item.period}</span>
                <strong>{item.company}</strong>
              </div>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-grid" id="stack">
        <article className="info-card">
          <div className="section-kicker">
            <Database size={16} />
            Competences
          </div>
          <h2>Le socle technique et metier</h2>
          <div className="chip-wrap">
            {stack.map((item) => (
              <span key={item} className="metal-chip">{item}</span>
            ))}
          </div>
        </article>

        <article className="info-card">
          <div className="section-kicker">
            <Globe size={16} />
            Contact
          </div>
          <h2>Un site utile doit aussi convertir</h2>
          <div className="contact-list">
            <a href="mailto:ziyadbjt@outlook.fr">
              <Mail size={16} />
              ziyadbjt@outlook.fr
            </a>
            <a href="https://www.linkedin.com/in/ziyad-boujettou" target="_blank" rel="noreferrer">
              <BadgeCheck size={16} />
              linkedin.com/in/ziyad-boujettou
            </a>
          </div>
        </article>
      </section>

      <section className="section-block" id="launch">
        <div className="section-head">
          <div className="section-kicker">
            <Rocket size={16} />
            Pour que ce soit fonctionnel
          </div>
          <h2>Ce qu'il te faut pour passer d'une belle vitrine a un site vraiment utile</h2>
        </div>

        <div className="launch-grid">
          {launchNeeds.map((item) => (
            <article key={item} className="launch-card">
              <span className="launch-card__dot" />
              <p>{item}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
