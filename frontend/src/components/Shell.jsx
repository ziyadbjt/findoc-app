import { useState, useEffect, useRef, useMemo } from "react";
import {
  Home, FileText, GitMerge, Mail, Building2, Database, Settings,
  ChevronsUpDown, LogOut, ChevronRight, Search, Bell, Sun, Moon,
  Sparkles, AlertTriangle, Download, X, Plus, Send, RefreshCw,
} from "lucide-react";

export function DossierAvatar({ dossier, size = 28 }) {
  const hue = dossier?.hue ?? 220;
  return (
    <div className="dossier-avatar" style={{
      width: size, height: size,
      background: `oklch(0.94 0.04 ${hue})`,
      color: `oklch(0.32 0.10 ${hue})`,
      fontSize: size < 30 ? 11 : 13,
    }}>
      {dossier?.initials || "—"}
    </div>
  );
}

export function Sidebar({ route, setRoute, dossier, onSwitchDossier, counts, onLogout, tiersType, setTiersType }) {
  const nav = [
    { key: "overview",        label: "Aperçu",             icon: <Home size={15} /> },
    { key: "factures",        label: "Factures",           icon: <FileText size={15} />, badge: counts?.factures },
    { key: "delai_paiement",  label: "Délai de paiement",  icon: <GitMerge size={15} />, badge: counts?.relances },
    { key: "relances",        label: "Relances",           icon: <Mail size={15} /> },
    { key: "tiers",           label: "Tiers",              icon: <Building2 size={15} /> },
    { key: "journal",         label: "Journal SAGE",       icon: <Database size={15} /> },
  ];
  const sub = [{ key: "parametres", label: "Paramètres", icon: <Settings size={15} /> }];

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <div className="sidebar-brand">
          <div className="brand-mark">F</div>
          <span>FINDOC</span>
          <span style={{ fontSize: 10, color: "var(--ink-3)", fontWeight: 400, marginLeft: "auto", fontFamily: "var(--font-mono)" }}>v2.4</span>
        </div>
      </div>

      <button className="dossier-switcher" onClick={onSwitchDossier}>
        <DossierAvatar dossier={dossier} />
        <div className="dossier-info">
          <div className="name truncate">{dossier?.raison_sociale}</div>
          <div className="meta">{dossier?.forme_juridique} · {dossier?.ville}</div>
        </div>
        <ChevronsUpDown size={14} className="chev" />
      </button>

      <nav className="nav">
        <div className="nav-section-title">Workspace</div>
        {nav.map(n => (
          <div key={n.key}>
            <button className={`nav-item${route === n.key ? " active" : ""}`} onClick={() => setRoute(n.key)}>
              <span className="icon">{n.icon}</span>
              <span>{n.label}</span>
              {n.badge > 0 && <span className="badge-count">{n.badge}</span>}
            </button>
            {n.key === "tiers" && route === "tiers" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2, marginLeft: 14, marginBottom: 2 }}>
                {["fournisseurs", "clients"].map(t => (
                  <button key={t} onClick={() => setTiersType(t)}
                    className={`nav-item${tiersType === t ? " active" : ""}`}
                    style={{ fontSize: 12, padding: "5px 10px" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: tiersType === t ? "var(--accent)" : "var(--line-strong)", flexShrink: 0 }} />
                    <span style={{ textTransform: "capitalize" }}>{t}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        <div className="nav-section-title" style={{ marginTop: 12 }}>Compte</div>
        {sub.map(n => (
          <button key={n.key} className={`nav-item${route === n.key ? " active" : ""}`} onClick={() => setRoute(n.key)}>
            <span className="icon">{n.icon}</span>
            <span>{n.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="user-row" onClick={onLogout} title="Déconnexion">
          <div className="avatar">ZB</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink-0)" }}>Ziyad B.</div>
            <div style={{ fontSize: 10.5, color: "var(--ink-2)" }}>Expert-comptable · Senior</div>
          </div>
          <LogOut size={14} style={{ color: "var(--ink-3)" }} />
        </div>
      </div>
    </aside>
  );
}

export function Topbar({ crumbs, onOpenCmd, onOpenNotifs, onToggleTheme, theme, hasNotifs }) {
  return (
    <header className="topbar">
      <div className="breadcrumbs">
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {i > 0 && <span className="sep"><ChevronRight size={13} /></span>}
            <span className={i === crumbs.length - 1 ? "current" : ""}>{c}</span>
          </span>
        ))}
      </div>

      <button className="topbar-search" onClick={onOpenCmd}>
        <Search size={14} />
        <span>Rechercher factures, tiers, écritures…</span>
        <kbd>⌘K</kbd>
      </button>

      <button className="icon-btn" onClick={onToggleTheme} title="Thème">
        {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
      </button>
      <button className={`icon-btn${hasNotifs ? " has-dot" : ""}`} onClick={onOpenNotifs} title="Notifications">
        <Bell size={15} />
      </button>
    </header>
  );
}

export function CmdK({ open, onClose, onNavigate, onUpload, onExport }) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);

  const items = useMemo(() => [
    { group: "Navigation", label: "Aperçu",          icon: <Home size={14} />,      action: () => onNavigate("overview"),       kbd: "G O" },
    { group: "Navigation", label: "Factures",       icon: <FileText size={14} />,  action: () => onNavigate("factures"),       kbd: "G F" },
    { group: "Navigation", label: "Réconciliation", icon: <GitMerge size={14} />,  action: () => onNavigate("reconciliation"), kbd: "G R" },
    { group: "Navigation", label: "Relances",       icon: <Mail size={14} />,      action: () => onNavigate("relances") },
    { group: "Navigation", label: "Tiers",          icon: <Building2 size={14} />, action: () => onNavigate("tiers") },
    { group: "Actions",    label: "Uploader factures", icon: <Plus size={14} />,   action: onUpload, kbd: "U" },
    { group: "Actions",    label: "Exporter journal SAGE 100", icon: <Download size={14} />, action: onExport },
    { group: "Actions",    label: "Générer relance", icon: <Send size={14} />,     action: () => onNavigate("relances") },
  ], [onNavigate, onUpload, onExport]);

  const filtered = useMemo(() => {
    if (!q.trim()) return items;
    const qq = q.toLowerCase();
    return items.filter(it => it.label.toLowerCase().includes(qq) || it.group.toLowerCase().includes(qq));
  }, [items, q]);

  useEffect(() => {
    if (open) { setQ(""); setIdx(0); setTimeout(() => inputRef.current?.focus(), 20); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowDown") { e.preventDefault(); setIdx(i => Math.min(filtered.length - 1, i + 1)); }
      else if (e.key === "ArrowUp")   { e.preventDefault(); setIdx(i => Math.max(0, i - 1)); }
      else if (e.key === "Enter")     { e.preventDefault(); filtered[idx]?.action(); onClose(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, idx, onClose]);

  if (!open) return null;

  const groups = {};
  filtered.forEach(it => { (groups[it.group] ||= []).push(it); });
  let runIdx = -1;

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="cmdk">
        <div className="cmdk-input-wrap">
          <Search size={15} style={{ color: "var(--ink-2)" }} />
          <input ref={inputRef} className="cmdk-input"
            placeholder="Tapez une action ou une page…"
            value={q} onChange={e => { setQ(e.target.value); setIdx(0); }} />
          <kbd style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--ink-3)", background: "var(--bg-2)", border: "1px solid var(--line-1)", borderRadius: 4, padding: "1px 5px" }}>esc</kbd>
        </div>
        <div className="cmdk-list">
          {Object.entries(groups).map(([g, list]) => (
            <div key={g}>
              <div className="cmdk-group-label">{g}</div>
              {list.map(it => {
                runIdx++;
                const active = runIdx === idx;
                return (
                  <div key={it.label} className={`cmdk-item${active ? " active" : ""}`}
                    onMouseEnter={() => setIdx(runIdx)}
                    onClick={() => { it.action(); onClose(); }}>
                    <span className="icon">{it.icon}</span>
                    <span>{it.label}</span>
                    {it.kbd && <span className="kbd">{it.kbd}</span>}
                  </div>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>Aucun résultat.</div>
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
      <div className="drawer" style={{ width: 400 }}>
        <div className="drawer-head">
          <Bell size={16} style={{ color: "var(--ink-1)" }} />
          <div style={{ fontWeight: 500, fontSize: 14 }}>Activité</div>
          <button className="icon-btn" style={{ marginLeft: "auto" }} onClick={onClose}><X size={15} /></button>
        </div>
        <div className="drawer-body" style={{ padding: 16 }}>
          {notifications.map(n => (
            <div key={n.id} style={{ display: "grid", gridTemplateColumns: "28px 1fr", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--line-1)" }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: `var(--${colorFor(n.kind)}-bg)`, color: `var(--${colorFor(n.kind)}-ink)`, display: "grid", placeItems: "center" }}>
                {iconFor(n.kind)}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{n.title}</div>
                <div style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 4 }}>{n.body}</div>
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
    { key: "teal",   color: "oklch(0.68 0.13 195)" },
    { key: "violet", color: "oklch(0.62 0.16 290)" },
    { key: "amber",  color: "oklch(0.72 0.14 65)" },
    { key: "ink",    color: "oklch(0.22 0.012 250)" },
  ];
  return (
    <div className="tweaks-panel">
      <div className="tweaks-head">
        <h4>Tweaks</h4>
        <button className="icon-btn" onClick={onClose} style={{ width: 24, height: 24 }}><X size={13} /></button>
      </div>
      <div className="tweaks-body">
        <div className="tweak-row">
          <div className="tlabel">Accent</div>
          <div className="swatch-row">
            {swatches.map(s => (
              <div key={s.key} className={`swatch${accent === s.key ? " active" : ""}`}
                onClick={() => setAccent(s.key)} style={{ background: s.color }} title={s.key} />
            ))}
          </div>
        </div>
        <div className="tweak-row">
          <div className="tlabel">Densité</div>
          <div className="segmented">
            {["compact", "balanced", "airy"].map(d => (
              <button key={d} className={density === d ? "active" : ""} onClick={() => setDensity(d)}>
                {d === "compact" ? "Compact" : d === "balanced" ? "Équilibré" : "Aéré"}
              </button>
            ))}
          </div>
        </div>
        <div className="tweak-row">
          <div className="tlabel">Thème</div>
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
