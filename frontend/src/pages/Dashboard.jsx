import { Suspense, lazy, useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw } from "lucide-react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  getDossier, getFactures, getEcritures, exportJournal, MOCK_NOTIFICATIONS, updateDossier,
} from "../api";
import { enrichDossier, enrichFacture } from "../utils/format";
import { Sidebar, Topbar, CmdK, NotificationsPanel } from "../components/Shell";

const ChatBot = lazy(() => import("../components/ChatBot"));
const OverviewPage = lazy(() => import("./OverviewPage"));
const FacturesPage = lazy(() => import("./FacturesPage"));
const DelaiPaiementPage = lazy(() => import("./DelaiPaiementPage"));
const RelancesPage = lazy(() => import("./RelancesPage"));
const JournalPage = lazy(() => import("./JournalPage"));
const TiersPage = lazy(() => import("./TiersPage"));
const SettingsPage = lazy(() => import("./SettingsPage"));
const TVAPage = lazy(() => import("./TVAPage"));
const AuditPage = lazy(() => import("./AuditPage"));
const AnomaliesPage = lazy(() => import("./AnomaliesPage"));
const TresoPage = lazy(() => import("./TresoPage"));
const ReconciliationPage = lazy(() => import("./ReconciliationPage"));
const RapportMensuelPage = lazy(() => import("./RapportMensuelPage"));

const CRUMBS = {
  overview: ["Dossier", "Apercu"],
  factures: ["Dossier", "Factures"],
  delai_paiement: ["Dossier", "Delai de paiement"],
  relances: ["Dossier", "Relances"],
  tiers: ["Dossier", "Tiers"],
  journal: ["Dossier", "Extraction"],
  tva: ["Dossier", "Declaration TVA"],
  audit: ["Dossier", "Audit"],
  anomalies: ["Dossier", "Anomalies"],
  treso: ["Dossier", "Tresorerie"],
  reconciliation: ["Dossier", "Réconciliation"],
  parametres: ["Dossier", "Parametres"],
  rapport_mensuel: ["Dossier", "Rapport mensuel IA"],
};

function PageFallback() {
  return (
    <div style={{ padding: "40px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
      {[1, 2, 3].map((i) => (
        <div key={i} className="skeleton" style={{ height: i === 1 ? 120 : 60, borderRadius: 12, width: i === 3 ? "60%" : "100%" }} />
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token, logout, user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [dossier, setDossier] = useState(null);
  const [currentExercise, setCurrentExercise] = useState(() => Number(localStorage.getItem(`findoc:exercise:${id}`)) || new Date().getFullYear());
  const [factures, setFactures] = useState([]);
  const [ecritures, setEcritures] = useState([]);
  const [route, setRoute] = useState(() => searchParams.get("tab") || "overview");
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");
  const [accent] = useState(() => localStorage.getItem("accent") || "amber");
  const [density] = useState(() => localStorage.getItem("density") || "balanced");
  const [layout] = useState(() => localStorage.getItem("layout") || "table");
  const [showCmd, setShowCmd] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const pageRef = useRef(null);
  const pullRef = useRef({ startY: 0, active: false, engaged: false, distance: 0, refreshing: false });

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
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowCmd(true);
      }
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        setShowCmd(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const [loadingData, setLoadingData] = useState(true);

  const loadData = useCallback(async () => {
    if (!token || !id) return;
    try {
      const [dosRes, facRes, ecrRes] = await Promise.all([
        getDossier(token, id),
        getFactures(token, id),
        getEcritures(token, id),
      ]);
      setDossier(enrichDossier(dosRes.data));
      const dossierExercise = dosRes.data.exercice_courant || Number(localStorage.getItem(`findoc:exercise:${id}`)) || new Date().getFullYear();
      setCurrentExercise(dossierExercise);
      setFactures(facRes.data.map(enrichFacture));
      setEcritures(ecrRes.data || []);
    } catch {
      toast("Erreur lors du chargement des donnees", "neg");
    } finally {
      setLoadingData(false);
    }
  }, [token, id, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && tab !== route) setRoute(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const currentTab = searchParams.get("tab");
    if (route === "overview") {
      if (currentTab) setSearchParams({}, { replace: true });
      return;
    }
    if (currentTab !== route) {
      setSearchParams({ tab: route }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  const runPullRefresh = useCallback(async () => {
    pullRef.current.refreshing = true;
    setPullRefreshing(true);
    setPullDistance(56);
    try {
      await loadData();
      toast("Page actualisee", "pos");
    } catch {
      toast("Erreur lors de l'actualisation", "neg");
    } finally {
      pullRef.current.refreshing = false;
      setPullRefreshing(false);
      setPullDistance(0);
      pullRef.current.distance = 0;
    }
  }, [loadData, toast]);

  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;

    const threshold = 84;
    const maxPull = 120;

    const onTouchStart = (event) => {
      if (page.scrollTop > 0 || pullRef.current.refreshing) return;
      pullRef.current = {
        startY: event.touches[0]?.clientY || 0,
        active: true,
        engaged: false,
        distance: 0,
        refreshing: false,
      };
    };

    const onTouchMove = (event) => {
      const state = pullRef.current;
      if (!state.active || state.refreshing) return;
      if (page.scrollTop > 0) {
        pullRef.current.active = false;
        pullRef.current.distance = 0;
        setPullDistance(0);
        return;
      }

      const currentY = event.touches[0]?.clientY || 0;
      const delta = currentY - state.startY;
      if (delta <= 0) {
        setPullDistance(0);
        return;
      }

      const nextDistance = Math.min(maxPull, delta * 0.45);
      if (nextDistance > 4) {
        pullRef.current.engaged = true;
        event.preventDefault();
      }
      pullRef.current.distance = nextDistance;
      setPullDistance(nextDistance);
    };

    const onTouchEnd = async () => {
      const state = pullRef.current;
      pullRef.current = { ...pullRef.current, startY: 0, active: false, engaged: false };

      if (!state.engaged) {
        pullRef.current.distance = 0;
        setPullDistance(0);
        return;
      }

      if (state.distance >= threshold) {
        await runPullRefresh();
        return;
      }

      pullRef.current.distance = 0;
      setPullDistance(0);
    };

    page.addEventListener("touchstart", onTouchStart, { passive: true });
    page.addEventListener("touchmove", onTouchMove, { passive: false });
    page.addEventListener("touchend", onTouchEnd);
    page.addEventListener("touchcancel", onTouchEnd);

    return () => {
      page.removeEventListener("touchstart", onTouchStart);
      page.removeEventListener("touchmove", onTouchMove);
      page.removeEventListener("touchend", onTouchEnd);
      page.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [runPullRefresh]);

  const counts = {
    factures: factures.filter((f) => f.statut === "a_valider" || f.statut === "à_valider").length,
    recon: 0,
    relances: factures.filter((f) => f.paiement === "en_retard").length,
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleSwitchDossier = () => navigate("/dossiers");

  const handleChangeExercise = async (year) => {
    setCurrentExercise(year);
    localStorage.setItem(`findoc:exercise:${id}`, String(year));
    try {
      const response = await updateDossier(token, id, { exercice_courant: year });
      setDossier(enrichDossier(response.data));
      toast(`Exercice ${year} sélectionné`, "pos");
    } catch {
      toast("Exercice non sauvegardé", "neg");
    }
  };

  const handleExport = async () => {
    try {
      const res = await exportJournal(token, id);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `journal_${id}.xlsx`;
      a.click();
      toast("Export SAGE 100 genere", "pos");
    } catch {
      toast("Erreur export", "neg");
    }
  };

  const handleUpload = () => {
    setRoute("factures");
  };

  const handleUpdateDossier = (changes) => {
    setDossier((prev) => prev ? enrichDossier({ ...prev, ...changes }) : prev);
  };

  const pageProps = { dossierId: id, factures, ecritures, dossier, onRefresh: loadData, user, currentExercise };
  const renderPage = () => {
    if (route === "overview") return <OverviewPage {...pageProps} bankLines={[]} onNavigate={setRoute} />;
    if (route === "factures") return <FacturesPage {...pageProps} layout={layout} />;
    if (route === "delai_paiement") return <DelaiPaiementPage factures={factures} />;
    if (route === "relances") return <RelancesPage {...pageProps} />;
    if (route === "tiers") return <TiersPage factures={factures} dossierId={id} />;
    if (route === "journal") return <JournalPage ecritures={ecritures} factures={factures} dossierId={id} onRefresh={loadData} />;
    if (route === "tva") return <TVAPage factures={factures} dossier={dossier} currentExercise={currentExercise} />;
    if (route === "audit") return <AuditPage dossier={dossier} user={user} />;
    if (route === "anomalies") return <AnomaliesPage factures={factures} />;
    if (route === "treso") return <TresoPage factures={factures} dossier={dossier} />;
    if (route === "reconciliation") return <ReconciliationPage factures={factures} dossierId={id} />;
    if (route === "parametres") return <SettingsPage dossier={dossier} onUpdateDossier={handleUpdateDossier} />;
    if (route === "rapport_mensuel") return <RapportMensuelPage dossierId={id} dossier={dossier} />;
    return null;
  };

  return (
    <div className="app-shell" data-density={density}>
      <Sidebar
        route={route}
        setRoute={setRoute}
        dossier={dossier}
        onSwitchDossier={handleSwitchDossier}
        counts={counts}
        onLogout={handleLogout}
        onToggleTheme={() => setTheme((t) => t === "light" ? "dark" : "light")}
        theme={theme}
      />

      <div className="app-shell-content">
        <Topbar
          route={route}
          dossier={dossier}
          onOpenCmd={() => setShowCmd(true)}
          onOpenNotifs={() => setShowNotifs(true)}
          onOpenChat={() => setShowChat(true)}
          hasNotifs={MOCK_NOTIFICATIONS.length > 0}
          currentExercise={currentExercise}
          onChangeExercise={handleChangeExercise}
        />

        <main
          ref={pageRef}
          className="page"
          style={{
            background: "transparent",
            transform: pullDistance ? `translateY(${pullDistance}px)` : undefined,
            transition: pullRefreshing || pullDistance === 0 ? "transform 180ms ease" : "none",
          }}
        >
          <div
            className={`pull-refresh-indicator ${pullDistance > 6 ? "visible" : ""} ${pullRefreshing ? "refreshing" : ""}`}
            style={{
              opacity: pullDistance ? 1 : 0,
              transform: `translate(-50%, ${Math.max(-10, pullDistance - 56)}px)`,
            }}
          >
            <RefreshCw size={14} />
            <span>{pullRefreshing ? "Actualisation..." : pullDistance >= 84 ? "Relacher pour actualiser" : "Tirer pour actualiser"}</span>
          </div>
          <div key={route} className="page-transition" data-page-content-transition>
            {loadingData && (
              <PageFallback />
            )}
            {!loadingData && (
              <Suspense fallback={<PageFallback />}>
                {renderPage()}
              </Suspense>
            )}
          </div>
        </main>
      </div>

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

      <Suspense fallback={null}>
        <ChatBot
          dossierId={id}
          open={showChat}
          onOpen={() => setShowChat(true)}
          onClose={() => setShowChat(false)}
        />
      </Suspense>
    </div>
  );
}
