import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  getDossier, getFactures, getEcritures, exportJournal, MOCK_NOTIFICATIONS,
} from "../api";
import { enrichDossier, enrichFacture } from "../utils/format";
import { Sidebar, Topbar, CmdK, NotificationsPanel, TweaksPanel } from "../components/Shell";
import OverviewPage     from "./OverviewPage";
import FacturesPage     from "./FacturesPage";
import DelaiPaiementPage from "./DelaiPaiementPage";
import RelancesPage      from "./RelancesPage";
import JournalPage      from "./JournalPage";
import TiersPage        from "./TiersPage";
import SettingsPage     from "./SettingsPage";

const CRUMBS = {
  overview:        ["FINDOC", "Aperçu"],
  factures:        ["FINDOC", "Factures"],
  delai_paiement:  ["FINDOC", "Délai de paiement"],
  relances:        ["FINDOC", "Relances"],
  tiers:           ["FINDOC", "Tiers"],
  journal:         ["FINDOC", "Journal SAGE"],
  parametres:      ["FINDOC", "Paramètres"],
};

export default function Dashboard() {
  const { id } = useParams();
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [dossier,   setDossier]   = useState(null);
  const [factures,  setFactures]  = useState([]);
  const [ecritures, setEcritures] = useState([]);
  const [route,     setRoute]     = useState("overview");
  const [theme,     setTheme]     = useState(() => localStorage.getItem("theme") || "light");
  const [accent,    setAccent]    = useState(() => localStorage.getItem("accent") || "teal");
  const [density,   setDensity]   = useState(() => localStorage.getItem("density") || "balanced");
  const [layout,    setLayout]    = useState(() => localStorage.getItem("layout") || "table");
  const [showCmd,   setShowCmd]   = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showTweaks, setShowTweaks] = useState(false);
  const [tiersType,  setTiersType]  = useState("fournisseurs");

  // Apply theme / accent to <html>
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute("data-accent", accent);
    localStorage.setItem("accent", accent);
  }, [accent]);

  useEffect(() => {
    document.documentElement.setAttribute("data-density", density);
    localStorage.setItem("density", density);
  }, [density]);

  useEffect(() => {
    localStorage.setItem("layout", layout);
  }, [layout]);

  // Global ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setShowCmd(true); }
      if (e.key === "g" && !e.ctrlKey && !e.metaKey) {
        // g+o, g+f, g+r shortcuts
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const loadData = useCallback(async () => {
    if (!token || !id) return;
    try {
      const [dosRes, facRes, ecrRes] = await Promise.all([
        getDossier(token, id),
        getFactures(token, id),
        getEcritures(token, id),
      ]);
      setDossier(enrichDossier(dosRes.data));
      setFactures(facRes.data.map(enrichFacture));
      setEcritures(ecrRes.data || []);
    } catch {
      toast("Erreur lors du chargement des données", "neg");
    }
  }, [token, id]);

  useEffect(() => { loadData(); }, [loadData]);

  const counts = {
    factures:  factures.filter(f => f.statut === "à_valider").length,
    recon:     0,
    relances:  factures.filter(f => f.paiement === "en_retard").length,
  };

  const handleLogout = () => { logout(); navigate("/login"); };
  const handleSwitchDossier = () => navigate("/dossiers");

  const handleExport = async () => {
    try {
      const res = await exportJournal(token, id);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `journal_${id}.xlsx`;
      a.click();
      toast("Export SAGE 100 généré", "pos");
    } catch {
      toast("Erreur export", "neg");
    }
  };

  const handleUpload = () => {
    setRoute("factures");
    // FacturesPage will show upload when navigated
  };

  const crumbs = dossier
    ? [dossier.raison_sociale, ...(CRUMBS[route] || ["FINDOC"]).slice(1)]
    : CRUMBS[route] || ["FINDOC"];

  const pageProps = { dossierId: id, factures, ecritures, dossier, onRefresh: loadData };

  return (
    <div className="app" data-density={density}>
      <Sidebar
        route={route}
        setRoute={setRoute}
        dossier={dossier}
        onSwitchDossier={handleSwitchDossier}
        counts={counts}
        onLogout={handleLogout}
        tiersType={tiersType}
        setTiersType={setTiersType}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar
          crumbs={crumbs}
          onOpenCmd={() => setShowCmd(true)}
          onOpenNotifs={() => setShowNotifs(true)}
          onToggleTheme={() => setTheme(t => t === "light" ? "dark" : "light")}
          theme={theme}
          hasNotifs={MOCK_NOTIFICATIONS.length > 0}
        />

        <main style={{ flex: 1, overflowY: "auto", background: "var(--bg-0)" }}>
          {route === "overview"       && <OverviewPage {...pageProps} bankLines={[]} onNavigate={setRoute} />}
          {route === "factures"       && <FacturesPage {...pageProps} layout={layout} />}
          {route === "delai_paiement" && <DelaiPaiementPage factures={factures} />}
          {route === "relances"       && <RelancesPage {...pageProps} />}
          {route === "tiers"          && <TiersPage {...pageProps} tiersType={tiersType} />}
          {route === "journal"        && <JournalPage {...pageProps} />}
          {route === "parametres"     && <SettingsPage dossier={dossier} onUpdateDossier={() => {}} />}
        </main>
      </div>

      {showTweaks && (
        <TweaksPanel
          onClose={() => setShowTweaks(false)}
          accent={accent} setAccent={setAccent}
          density={density} setDensity={setDensity}
          theme={theme} setTheme={setTheme}
          layout={layout} setLayout={setLayout}
        />
      )}

      <CmdK
        open={showCmd}
        onClose={() => setShowCmd(false)}
        onNavigate={(r) => { setRoute(r); setShowCmd(false); }}
        onUpload={handleUpload}
        onExport={handleExport}
      />

      <NotificationsPanel
        open={showNotifs}
        onClose={() => setShowNotifs(false)}
        notifications={MOCK_NOTIFICATIONS}
      />
    </div>
  );
}
