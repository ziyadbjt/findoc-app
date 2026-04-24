import { useState, useEffect, useRef, useMemo } from "react";
import {
  Home, FileText, GitMerge, Mail, Building2, Database, Settings,
  ChevronsUpDown, LogOut, ChevronRight, Search, Bell, Sun, Moon,
  Sparkles, AlertTriangle, Download, X, Plus, Send,
  Receipt, ShieldCheck, MessageSquare, TrendingUp,
} from "lucide-react";

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

export function Sidebar() { return null; }

export function Topbar({ route, setRoute, dossier, onSwitchDossier, counts, onLogout, tiersType, setTiersType, onOpenCmd, onOpenNotifs, onOpenChat, onToggleTheme, theme, hasNotifs }) {
  const nav = [
    { key: "overview",       label: "Aperçu",          icon: <Home size={14} /> },
    { key: "factures",       label: "Factures",         icon: <FileText size={14} />, badge: counts?.factures },
    { key: "delai_paiement", label: "Délais",           icon: <GitMerge size={14} />, badge: counts?.relances },
    { key: "relances",       label: "Relances",         icon: <Mail size={14} /> },
    { key: "tiers",          label: "Tiers",            icon: <Building2 size={14} /> },
    { key: "tva",            label: "TVA",              icon: <Receipt size={14} /> },
    { key: "treso",          label: "Trésorerie",       icon: <TrendingUp size={14} /> },
    { key: "anomalies",      label: "Anomalies",        icon: <AlertTriangle size={14} /> },
    { key: "audit",          label: "Audit",            icon: <ShieldCheck size={14} /> },
    { key: "journal",        label: "Extraction",       icon: <Database size={14} /> },
    { key: "parametres",     label: "Paramètres",       icon: <Settings size={14} /> },
  ];

  return (
    <header className="topnav">
      {/* Brand */}
      <div className="topnav-brand">
        <div className="brand-mark" style={{ width: 30, height: 30, borderRadius: 8, fontSize: 13 }}>F</div>
        <span className="brand-name" style={{ fontSize: 15, letterSpacing: "0.12em" }}>Findoc</span>
      </div>

      {/* Dossier switcher */}
      <button className="topnav-dossier" onClick={onSwitchDossier}>
        <DossierAvatar dossier={dossier} size={24} />
        <span className="truncate" style={{ maxWidth: 160, fontSize: 12, fontWeight: 500 }}>
          {dossier?.raison_sociale || "Sélectionner un dossier"}
        </span>
        <ChevronsUpDown size={13} style={{ color: "var(--ink-3)", flexShrink: 0 }} />
      </button>

      {/* Nav links */}
      <nav className="topnav-links">
        {nav.filter(n => n.key !== "parametres").map((n) => (
          <button
            key={n.key}
            className={`topnav-item${route === n.key ? " active" : ""}`}
            onClick={() => setRoute(n.key)}
            title={n.label}
          >
            {n.icon}
            {route === n.key && <span>{n.label}</span>}
            {n.badge > 0 && <span className="topnav-badge">{n.badge}</span>}
          </button>
        ))}
        <button
          className={`topnav-item${route === "parametres" ? " active" : ""}`}
          onClick={() => setRoute("parametres")}
          title="Paramètres"
          style={{ marginLeft: "auto" }}
        >
          <Settings size={14} />
          {route === "parametres" && <span>Paramètres</span>}
        </button>
      </nav>

      {/* Right actions */}
      <div className="topnav-actions">
        <button className="topnav-search" onClick={onOpenCmd}>
          <Search size={13} />
          <span>Rechercher</span>
          <kbd>Ctrl K</kbd>
        </button>
        <button className="icon-btn" onClick={onToggleTheme} title="Thème">
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>
        <button className="icon-btn" onClick={onOpenChat} title="Assistant">
          <MessageSquare size={14} />
        </button>
        <button className={`icon-btn${hasNotifs ? " has-dot" : ""}`} onClick={onOpenNotifs} title="Notifications">
          <Bell size={14} />
        </button>
        <button className="icon-btn" onClick={onLogout} title="Déconnexion">
          <LogOut size={14} />
        </button>
      </div>
    </header>
  );
}

export function CmdK({ open, onClose, onNavigate, onUpload, onExport }) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);

  const items = useMemo(() => [
    { group: "Navigation", label: "Apercu", icon: <Home size={14} />, action: () => onNavigate("overview"), kbd: "G O" },
    { group: "Navigation", label: "Factures", icon: <FileText size={14} />, action: () => onNavigate("factures"), kbd: "G F" },
    { group: "Navigation", label: "Relances", icon: <Mail size={14} />, action: () => onNavigate("relances") },
    { group: "Navigation", label: "Tiers", icon: <Building2 size={14} />, action: () => onNavigate("tiers") },
    { group: "Navigation", label: "Declaration TVA", icon: <Receipt size={14} />, action: () => onNavigate("tva") },
    { group: "Navigation", label: "Audit", icon: <ShieldCheck size={14} />, action: () => onNavigate("audit") },
    { group: "Actions", label: "Importer", icon: <Plus size={14} />, action: onUpload, kbd: "U" },
    { group: "Actions", label: "Exporter", icon: <Download size={14} />, action: onExport },
    { group: "Actions", label: "Generer une relance", icon: <Send size={14} />, action: () => onNavigate("relances") },
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
    <>
      <div className="scrim" onClick={onClose} />
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
    </>
  );
}

export function NotificationsPanel({ open, onClose, notifications }) {
  if (!open) return null;
  const iconFor = (k) => k === "ai" ? <Sparkles size={14} /> : k === "warn" ? <AlertTriangle size={14} /> : k === "reconcile" ? <GitMerge size={14} /> : <Download size={14} />;
  const colorFor = (k) => k === "ai" ? "accent" : k === "warn" ? "warn" : k === "reconcile" ? "info" : "pos";

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="drawer" style={{ width: 420 }}>
        <div className="drawer-head">
          <Bell size={16} style={{ color: "var(--ink-1)" }} />
          <div style={{ fontWeight: 600, fontSize: 14 }}>Activite recente</div>
          <button className="icon-btn" style={{ marginLeft: "auto" }} onClick={onClose}><X size={15} /></button>
        </div>
        <div className="drawer-body" style={{ padding: 18 }}>
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
        </div>
      </div>
    </>
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
        <h4>Preferences</h4>
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
          <div className="tlabel">Densite</div>
          <div className="segmented">
            {["compact", "balanced", "airy"].map((d) => (
              <button key={d} className={density === d ? "active" : ""} onClick={() => setDensity(d)}>
                {d === "compact" ? "Compact" : d === "balanced" ? "Equilibre" : "Aere"}
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
