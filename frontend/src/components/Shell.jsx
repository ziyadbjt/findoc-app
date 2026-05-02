import { useState, useEffect, useRef, useMemo } from "react";
import {
  Home, FileText, GitMerge, Mail, Building2, Database, Settings,
  ChevronsUpDown, LogOut, ChevronLeft, ChevronRight, Search, Bell, Sun, Moon,
  Sparkles, AlertTriangle, Download, X, Plus, Send,
  Receipt, ShieldCheck, MessageSquare, TrendingUp,
} from "lucide-react";
import Drawer from "./Drawer";
import Modal from "./Modal";

export function DossierAvatar({ dossier, size = 28 }) {
  const hue = dossier?.hue ?? 28;
  const initials = dossier?.initials || "--";
  const secondary = (hue + 38) % 360;
  const id = `lg-${hue}`;
  const fontSize = size < 32 ? Math.round(size * 0.38) : Math.round(size * 0.36);

  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ borderRadius: size * 0.32, display: "block", flexShrink: 0 }}>
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={`oklch(0.72 0.14 ${hue})`} />
          <stop offset="100%" stopColor={`oklch(0.54 0.12 ${secondary})`} />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="14" fill={`url(#${id})`} />
      <circle cx="32" cy="8" r="10" fill={`oklch(0.99 0.01 ${hue} / 0.12)`} />
      <circle cx="6" cy="34" r="8" fill={`oklch(0.18 0.03 ${secondary} / 0.22)`} />
      <text
        x="20"
        y="20"
        dominantBaseline="central"
        textAnchor="middle"
        fill="white"
        fontFamily="Georgia, serif"
        fontWeight="700"
        fontSize={fontSize}
        letterSpacing="-0.5"
      >{initials}</text>
    </svg>
  );
}

export function Sidebar({ route, setRoute, dossier, onSwitchDossier, counts, onLogout, onToggleTheme, theme }) {
  const primaryNav = [
    { key: "overview",       label: "Aperçu",      icon: <Home size={16} /> },
    { key: "factures",       label: "Factures",     icon: <FileText size={16} />, badge: counts?.factures },
    { key: "delai_paiement", label: "Délais",       icon: <GitMerge size={16} />, badge: counts?.relances },
    { key: "relances",       label: "Relances",     icon: <Mail size={16} /> },
    { key: "tiers",          label: "Tiers",        icon: <Building2 size={16} /> },
    { key: "tva",            label: "TVA",          icon: <Receipt size={16} /> },
    { key: "treso",          label: "Trésorerie",   icon: <TrendingUp size={16} /> },
    { key: "finance_ops",    label: "Pilotage",     icon: <Sparkles size={16} /> },
  ];

  const secondaryNav = [
    { key: "anomalies",  label: "Anomalies",  icon: <AlertTriangle size={16} /> },
    { key: "audit",      label: "Audit",      icon: <ShieldCheck size={16} /> },
    { key: "journal",    label: "Extraction", icon: <Database size={16} /> },
    { key: "parametres", label: "Paramètres", icon: <Settings size={16} /> },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-surface">
        {/* Brand + toggle */}
        <div className="sidebar-brand">
          <div className="sidebar-brand__media" aria-hidden="true">
            <img src="/logo-findoc-sidebar.png" alt="" className="sidebar-brand__logo" />
            <img src="/logo-findoc-icon.png" alt="" className="sidebar-brand__mark" />
          </div>
        </div>

        {/* Dossier switcher */}
        <button className="sidebar-dossier" onClick={onSwitchDossier} title={dossier?.raison_sociale || "Sélectionner un dossier"}>
          <DossierAvatar dossier={dossier} size={26} />
          <span className="sidebar-dossier__label truncate">
            {dossier?.raison_sociale || "Sélectionner un dossier"}
          </span>
          <ChevronsUpDown className="sidebar-dossier__chevron" size={12} style={{ color: "var(--ink-3)", flexShrink: 0 }} />
        </button>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {primaryNav.map((n) => (
            <button
            key={n.key}
            className={`sidebar-item${route === n.key ? " active" : ""}`}
            onClick={() => setRoute(n.key)}
          >
            {n.icon}
            <span className="sidebar-item__label">{n.label}</span>
              <span className={`sidebar-badge${n.badge > 0 ? "" : " is-hidden"}`}>{n.badge}</span>
            </button>
          ))}

          <div className="sidebar-divider" />

          {secondaryNav.map((n) => (
            <button
            key={n.key}
            className={`sidebar-item${route === n.key ? " active" : ""}`}
            onClick={() => setRoute(n.key)}
          >
            {n.icon}
            <span className="sidebar-item__label">{n.label}</span>
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <button
            className="sidebar-footer-btn"
            onClick={onToggleTheme}
            title={theme === "dark" ? "Mode clair" : "Mode sombre"}
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            <span className="sidebar-footer-btn__label">{theme === "dark" ? "Mode clair" : "Mode sombre"}</span>
          </button>
          <button
            className="sidebar-footer-btn logout"
            onClick={onLogout}
            title="Déconnexion"
          >
            <LogOut size={15} />
            <span className="sidebar-footer-btn__label">Déconnexion</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

const ROUTE_LABELS = {
  overview:       "Aperçu",
  factures:       "Factures",
  delai_paiement: "Délais de paiement",
  relances:       "Relances",
  tiers:          "Tiers",
  tva:            "Déclaration TVA",
  treso:          "Trésorerie",
  finance_ops:    "Pilotage financier",
  anomalies:      "Anomalies",
  audit:          "Audit",
  journal:        "Extraction",
  parametres:     "Paramètres",
  reconciliation: "Rapprochement",
  rapport_mensuel:"Rapport mensuel",
};

export function Topbar({ route, dossier, onOpenCmd, onOpenNotifs, onOpenChat, hasNotifs, currentExercise, onChangeExercise }) {
  return (
    <header className="topnav">
      {/* Page title — left */}
      <div className="topnav-title">
        <span className="topnav-title__page">{ROUTE_LABELS[route] || "Tableau de bord"}</span>
        {dossier?.raison_sociale && (
          <span className="topnav-title__dossier">{dossier.raison_sociale}</span>
        )}
      </div>

      {/* Right group: exercice + actions */}
      <div className="topnav-right">
        <label className="topnav-exercise">
          <span>Exercice</span>
          <select value={currentExercise || new Date().getFullYear()} onChange={(e) => onChangeExercise?.(Number(e.target.value))}>
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </label>

        <div className="topnav-actions">
          <button className="topnav-search" onClick={onOpenCmd} title="Rechercher (Ctrl K)">
            <Search size={13} />
            <kbd>Ctrl K</kbd>
          </button>
          <button className="icon-btn" onClick={onOpenChat} title="Assistant IA">
            <MessageSquare size={14} />
          </button>
          <button className={`icon-btn${hasNotifs ? " has-dot" : ""}`} onClick={onOpenNotifs} title="Notifications">
            <Bell size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}

export function CmdK({ open, onClose, onNavigate, onUpload, onExport }) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);

  const items = useMemo(() => [
    { group: "Navigation", label: "Aperçu", icon: <Home size={14} />, action: () => onNavigate("overview"), kbd: "G O" },
    { group: "Navigation", label: "Factures", icon: <FileText size={14} />, action: () => onNavigate("factures"), kbd: "G F" },
    { group: "Navigation", label: "Relances", icon: <Mail size={14} />, action: () => onNavigate("relances"), kbd: "G R" },
    { group: "Navigation", label: "Tiers", icon: <Building2 size={14} />, action: () => onNavigate("tiers"), kbd: "G T" },
    { group: "Navigation", label: "Déclaration TVA", icon: <Receipt size={14} />, action: () => onNavigate("tva"), kbd: "G V" },
    { group: "Navigation", label: "Trésorerie", icon: <Home size={14} />, action: () => onNavigate("treso"), kbd: "G C" },
    { group: "Navigation", label: "Pilotage financier", icon: <Sparkles size={14} />, action: () => onNavigate("finance_ops"), kbd: "G P" },
    { group: "Navigation", label: "Réconciliation", icon: <Building2 size={14} />, action: () => onNavigate("reconciliation"), kbd: "G B" },
    { group: "Navigation", label: "Audit", icon: <ShieldCheck size={14} />, action: () => onNavigate("audit") },
    { group: "Actions", label: "Importer des factures", icon: <Plus size={14} />, action: onUpload, kbd: "U" },
    { group: "Actions", label: "Exporter journal SAGE", icon: <Download size={14} />, action: onExport, kbd: "E" },
    { group: "Actions", label: "Générer une relance", icon: <Send size={14} />, action: () => onNavigate("relances") },
    { group: "Aide", label: "Raccourcis clavier — Ctrl+K pour ouvrir", icon: <ShieldCheck size={14} />, action: () => {}, kbd: "?" },
    { group: "Aide", label: "G + lettre = navigation rapide", icon: <ShieldCheck size={14} />, action: () => {} },
    { group: "Aide", label: "Échap = fermer la palette", icon: <ShieldCheck size={14} />, action: () => {} },
  ], [onNavigate, onUpload, onExport]);

  const filtered = useMemo(() => {
    if (!q.trim()) return items;
    const qq = q.toLowerCase();
    return items.filter((it) => it.label.toLowerCase().includes(qq) || it.group.toLowerCase().includes(qq));
  }, [items, q]);

  useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowDown") {
        e.preventDefault();
        setIdx((i) => Math.min(filtered.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        filtered[idx]?.action();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, idx, onClose]);

  if (!open) return null;

  const groups = {};
  filtered.forEach((it) => { (groups[it.group] ||= []).push(it); });
  let runIdx = -1;

  return (
    <Modal
      open={open}
      onClose={onClose}
      className="cmdk-modal"
      contentClassName="cmdk-modal-content"
      bodyClassName="cmdk-body"
    >
      <div className="cmdk">
        <div className="cmdk-input-wrap">
          <Search size={15} style={{ color: "var(--ink-2)" }} />
          <input
            ref={inputRef}
            className="cmdk-input"
            placeholder="Tape une page, une action ou un dossier..."
            value={q}
            onChange={(e) => { setQ(e.target.value); setIdx(0); }}
          />
          <kbd style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-3)", background: "var(--bg-2)", border: "1px solid var(--line-1)", borderRadius: 999, padding: "3px 8px" }}>esc</kbd>
        </div>
        <div className="cmdk-list">
          {Object.entries(groups).map(([g, list]) => (
            <div key={g}>
              <div className="cmdk-group-label">{g}</div>
              {list.map((it) => {
                runIdx++;
                const active = runIdx === idx;
                return (
                  <div
                    key={it.label}
                    className={`cmdk-item${active ? " active" : ""}`}
                    onMouseEnter={() => setIdx(runIdx)}
                    onClick={() => { it.action(); onClose(); }}
                  >
                    <span className="icon">{it.icon}</span>
                    <span>{it.label}</span>
                    {it.kbd && <span className="kbd">{it.kbd}</span>}
                  </div>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>Aucun resultat.</div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function NotificationsPanel({ open, onClose, notifications }) {
  if (!open) return null;
  const iconFor = (k) => k === "ai" ? <Sparkles size={14} /> : k === "warn" ? <AlertTriangle size={14} /> : k === "reconcile" ? <GitMerge size={14} /> : <Download size={14} />;
  const colorFor = (k) => k === "ai" ? "accent" : k === "warn" ? "warn" : k === "reconcile" ? "info" : "pos";

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={420}
      bodyClassName="drawer-body-padded"
      header={(
        <>
          <Bell size={16} style={{ color: "var(--ink-1)" }} />
          <div style={{ fontWeight: 600, fontSize: 14 }}>Activite recente</div>
          <button className="icon-btn" style={{ marginLeft: "auto" }} onClick={onClose}><X size={15} /></button>
        </>
      )}
    >
          {notifications.map((n) => (
            <div key={n.id} style={{ display: "grid", gridTemplateColumns: "30px 1fr", gap: 12, padding: "14px 0", borderBottom: "1px solid var(--line-1)" }}>
              <div style={{ width: 30, height: 30, borderRadius: 10, background: `var(--${colorFor(n.kind)}-bg)`, color: `var(--${colorFor(n.kind)}-ink)`, display: "grid", placeItems: "center" }}>
                {iconFor(n.kind)}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{n.title}</div>
                <div style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 5 }}>{n.body}</div>
                <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{n.ts}</div>
              </div>
            </div>
          ))}
    </Drawer>
  );
}

export function TweaksPanel({ onClose, accent, setAccent, density, setDensity, theme, setTheme, layout, setLayout }) {
  const swatches = [
    { key: "teal", color: "#2f6f6a" },
    { key: "violet", color: "#755e9a" },
    { key: "amber", color: "#a4683c" },
    { key: "ink", color: "#34261a" },
  ];

  return (
    <div className="tweaks-panel">
      <div className="tweaks-head">
        <h4>Préférences</h4>
        <button className="icon-btn" onClick={onClose} style={{ width: 24, height: 24 }}><X size={13} /></button>
      </div>
      <div className="tweaks-body">
        <div className="tweak-row">
          <div className="tlabel">Accent</div>
          <div className="swatch-row">
            {swatches.map((s) => (
              <div key={s.key} className={`swatch${accent === s.key ? " active" : ""}`} onClick={() => setAccent(s.key)} style={{ background: s.color }} title={s.key} />
            ))}
          </div>
        </div>
        <div className="tweak-row">
          <div className="tlabel">Densité</div>
          <div className="segmented">
            {["compact", "balanced", "airy"].map((d) => (
              <button key={d} className={density === d ? "active" : ""} onClick={() => setDensity(d)}>
                {d === "compact" ? "Compact" : d === "balanced" ? "Équilibré" : "Aéré"}
              </button>
            ))}
          </div>
        </div>
        <div className="tweak-row">
          <div className="tlabel">Theme</div>
          <div className="segmented">
            <button className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")}>Clair</button>
            <button className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}>Sombre</button>
          </div>
        </div>
        <div className="tweak-row">
          <div className="tlabel">Ligne facture</div>
          <div className="segmented">
            <button className={layout === "table" ? "active" : ""} onClick={() => setLayout("table")}>Tableau</button>
            <button className={layout === "cards" ? "active" : ""} onClick={() => setLayout("cards")}>Cartes</button>
          </div>
        </div>
      </div>
    </div>
  );
}
