import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Clock3,
  FileText,
  Landmark,
  Plus,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  createAdminUser,
  deleteDossier,
  getAdminUsers,
  getDossiers,
  getFactures,
  updateAdminUser,
} from "../api";
import BrandLogo from "../components/BrandLogo";
import { DossierAvatar } from "../components/Shell";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { enrichDossier, enrichFacture, formatDate, formatMAD } from "../utils/format";

const ROLE_META = {
  admin: { label: "Admin", color: "var(--accent-ink)", bg: "var(--accent-bg)" },
  collab: { label: "Collab", color: "var(--pos-ink)", bg: "var(--pos-bg)" },
  invite: { label: "Invite", color: "var(--ink-1)", bg: "var(--bg-2)" },
};

function countAlerts(factures) {
  return factures.reduce((total, facture) => {
    const needsValidation = facture.statut === "a_valider" || facture.statut === "à_valider";
    const latePayment = facture.paiement === "en_retard";
    return total + (needsValidation ? 1 : 0) + (latePayment ? 1 : 0);
  }, 0);
}

function getTVAStatus(row) {
  const absoluteBalance = Math.abs(Number(row.tvaBalance || 0));
  if (row.pendingCount >= 3) {
    return {
      label: "A verifier",
      tone: "warn",
      reason: `${row.pendingCount} facture(s) non validee(s) impactent le calcul`,
    };
  }
  if (row.lateCount >= 2) {
    return {
      label: "Sous tension",
      tone: "warn",
      reason: `${row.lateCount} retard(s) sur des pieces a suivre`,
    };
  }
  if (absoluteBalance >= 20000) {
    return {
      label: "Prioritaire",
      tone: "accent",
      reason: `Solde estime eleve: ${formatMAD(row.tvaBalance)}`,
    };
  }
  return {
    label: "Stable",
    tone: "pos",
    reason: "Aucun signal fort sur la periode",
  };
}

export default function AdminPage() {
  const { token, user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const theme = document.documentElement.getAttribute("data-theme") || "dark";
  const [users, setUsers] = useState([]);
  const [cabinetRows, setCabinetRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState({ nom: "", email: "", role: "collab", password: "" });
  const [search, setSearch] = useState("");
  const [alertFilter, setAlertFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");

  const isAdmin = user?.role === "admin";

  const loadAdminData = async () => {
    if (!token || !isAdmin) return;
    setLoading(true);
    try {
      const [usersRes, dossiersRes] = await Promise.all([
        getAdminUsers(token),
        getDossiers(token),
      ]);

      const enrichedDossiers = (dossiersRes.data || []).map(enrichDossier);
      const facturesByDossier = await Promise.all(
        enrichedDossiers.map(async (dossier) => {
          try {
            const facturesRes = await getFactures(token, dossier.id);
            return {
              dossier,
              factures: (facturesRes.data || []).map(enrichFacture),
            };
          } catch {
            return { dossier, factures: [] };
          }
        })
      );

      const rows = facturesByDossier.map(({ dossier, factures }) => {
        const achats = factures.filter((facture) => (facture.type || "achat") !== "vente");
        const ventes = factures.filter((facture) => facture.type === "vente");
        const lateCount = factures.filter((facture) => facture.paiement === "en_retard").length;
        const pendingCount = factures.filter(
          (facture) => facture.statut === "a_valider" || facture.statut === "à_valider"
        ).length;
        const totalTtc = factures.reduce((sum, facture) => sum + Number(facture.montant_ttc || 0), 0);
        const tvaCollectee = ventes.reduce((sum, facture) => sum + Number(facture.tva || 0), 0);
        const tvaDeductible = achats.reduce((sum, facture) => sum + Number(facture.tva || 0), 0);
        const latestFacture = [...factures]
          .sort((a, b) => String(b.date_facture || b.created_at || "").localeCompare(String(a.date_facture || a.created_at || "")))[0];

        return {
          dossier,
          factures,
          lateCount,
          pendingCount,
          alertCount: countAlerts(factures),
          totalTtc,
          tvaBalance: tvaCollectee - tvaDeductible,
          latestFacture,
        };
      });

      setUsers(usersRes.data || []);
      setCabinetRows(rows);
    } catch {
      toast("Impossible de charger le tableau admin", "neg");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, [token, isAdmin]);

  const createUser = async () => {
    if (!draft.nom.trim() || !draft.email.trim()) {
      toast("Nom et email requis", "neg");
      return;
    }
    try {
      const res = await createAdminUser(token, draft);
      setUsers((prev) => [...prev, res.data].sort((a, b) => (a.nom || a.email).localeCompare(b.nom || b.email)));
      setDraft({ nom: "", email: "", role: "collab", password: "" });
      toast("Utilisateur cree", "pos");
    } catch {
      toast("Creation impossible", "neg");
    }
  };

  const patchUser = async (row, payload) => {
    try {
      const res = await updateAdminUser(token, row.id, payload);
      setUsers((prev) => prev.map((item) => (item.id === row.id ? res.data : item)));
      toast("Utilisateur mis a jour", "pos");
    } catch {
      toast("Mise a jour impossible", "neg");
    }
  };

  const removeDossier = async (row) => {
    const confirmed = window.confirm(`Supprimer le dossier ${row.dossier.raison_sociale} ?`);
    if (!confirmed) return;
    try {
      await deleteDossier(token, row.dossier.id);
      setCabinetRows((prev) => prev.filter((item) => item.dossier.id !== row.dossier.id));
      toast("Dossier supprime", "pos");
    } catch {
      toast("Suppression impossible", "neg");
    }
  };

  const cabinetStats = useMemo(() => {
    const allFactures = cabinetRows.flatMap((row) => row.factures);
    const lateFactures = allFactures.filter((facture) => facture.paiement === "en_retard").length;
    const pendingFactures = allFactures.filter(
      (facture) => facture.statut === "a_valider" || facture.statut === "à_valider"
    ).length;
    const totalVolume = allFactures.reduce((sum, facture) => sum + Number(facture.montant_ttc || 0), 0);
    const tvaBalance = cabinetRows.reduce((sum, row) => sum + row.tvaBalance, 0);

    return {
      dossiers: cabinetRows.length,
      factures: allFactures.length,
      lateFactures,
      pendingFactures,
      totalVolume,
      tvaBalance,
    };
  }, [cabinetRows]);

  const spotlightRows = useMemo(
    () =>
      [...cabinetRows]
        .sort((a, b) => {
          if (b.alertCount !== a.alertCount) return b.alertCount - a.alertCount;
          return Number(b.totalTtc || 0) - Number(a.totalTtc || 0);
        })
        .slice(0, 5),
    [cabinetRows]
  );

  const recentRows = useMemo(
    () =>
      [...cabinetRows]
        .filter((row) => row.latestFacture)
        .sort((a, b) =>
          String(b.latestFacture?.date_facture || b.latestFacture?.created_at || "").localeCompare(
            String(a.latestFacture?.date_facture || a.latestFacture?.created_at || "")
          )
        )
        .slice(0, 6),
    [cabinetRows]
  );

  const tvaRows = useMemo(
    () =>
      [...cabinetRows]
        .map((row) => ({ ...row, tvaStatus: getTVAStatus(row) }))
        .sort((a, b) => {
          const score = (item) =>
            (item.pendingCount * 4) +
            (item.lateCount * 3) +
            Math.min(3, Math.floor(Math.abs(Number(item.tvaBalance || 0)) / 10000));
          return score(b) - score(a);
        })
        .slice(0, 6),
    [cabinetRows]
  );

  const cityOptions = useMemo(
    () =>
      [...new Set(cabinetRows.map((row) => row.dossier.ville).filter(Boolean))]
        .sort((a, b) => String(a).localeCompare(String(b))),
    [cabinetRows]
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return cabinetRows.filter((row) => {
      const matchesSearch =
        !query ||
        row.dossier.raison_sociale.toLowerCase().includes(query) ||
        String(row.dossier.ville || "").toLowerCase().includes(query) ||
        String(row.dossier.ice || "").includes(query);
      const matchesAlert =
        alertFilter === "all" ||
        (alertFilter === "attention" && row.alertCount > 0) ||
        (alertFilter === "stable" && row.alertCount === 0) ||
        (alertFilter === "late" && row.lateCount > 0);
      const matchesCity = cityFilter === "all" || row.dossier.ville === cityFilter;
      return matchesSearch && matchesAlert && matchesCity;
    });
  }, [cabinetRows, search, alertFilter, cityFilter]);

  if (!isAdmin) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-0)", color: "var(--ink-0)" }}>
        <header style={{ padding: "18px 32px", borderBottom: "1px solid var(--line-0)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <BrandLogo surface="app" theme={theme} className="admin-brand-logo" />
            <span style={{ fontWeight: 600, fontSize: 14 }}>Administration</span>
          </div>
          <button className="icon-btn" onClick={() => { logout(); navigate("/login"); }} title="Deconnexion">↗</button>
        </header>
        <div className="page-inner">
          <div className="card" style={{ padding: 24, maxWidth: 560 }}>
            <div className="card-title" style={{ marginBottom: 10 }}>Acces reserve</div>
            <div style={{ fontSize: 13, color: "var(--ink-2)" }}>
              Cette page est accessible uniquement au role admin.
            </div>
            <Link to="/dossiers" className="btn btn-primary" style={{ marginTop: 16 }}>
              <ArrowLeft size={14} /> Retour aux dossiers
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-0)" }}>
      <header style={{ padding: "18px 32px", borderBottom: "1px solid var(--line-0)", display: "flex", alignItems: "center", gap: 12, background: "var(--bg-1)" }}>
        <div className="brand-mark">F</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Administration cabinet</div>
          <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>Pilotage des dossiers, alertes et acces de l'organisation</div>
        </div>
        <Link to="/dossiers" className="btn btn-ghost">
          <ArrowLeft size={14} /> Dossiers
        </Link>
      </header>

      <div className="page-inner" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div className="page-header">
          <div>
            <h1 className="page-title">Vue cabinet</h1>
            <p className="page-subtitle">Lecture rapide des priorites avant d'entrer dans un dossier</p>
          </div>
          <button className="btn" onClick={loadAdminData} disabled={loading}>
            <RefreshCw size={13} /> Rafraichir
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
          <div className="kpi">
            <div className="kpi-label"><Building2 size={14} /> Dossiers actifs</div>
            <div className="kpi-value">{cabinetStats.dossiers}</div>
            <div style={{ fontSize: 12, color: "var(--ink-2)" }}>{cabinetStats.factures} factures suivies</div>
          </div>
          <div className="kpi">
            <div className="kpi-label"><AlertTriangle size={14} /> Factures en retard</div>
            <div className="kpi-value">{cabinetStats.lateFactures}</div>
            <div style={{ fontSize: 12, color: "var(--ink-2)" }}>{cabinetStats.pendingFactures} a valider</div>
          </div>
          <div className="kpi">
            <div className="kpi-label"><FileText size={14} /> Volume TTC</div>
            <div className="kpi-value">{formatMAD(cabinetStats.totalVolume)}</div>
            <div style={{ fontSize: 12, color: "var(--ink-2)" }}>vision globale portefeuille</div>
          </div>
          <div className="kpi">
            <div className="kpi-label"><ShieldCheck size={14} /> Solde TVA estime</div>
            <div className="kpi-value">{formatMAD(cabinetStats.tvaBalance)}</div>
            <div style={{ fontSize: 12, color: "var(--ink-2)" }}>collectee moins deductible</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, alignItems: "start" }}>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div className="card-title">Dossiers sous surveillance</div>
              <div style={{ fontSize: 12, color: "var(--ink-2)" }}>Classes par niveau d'alerte</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {spotlightRows.map((row) => (
                <button
                  key={row.dossier.id}
                  className="card"
                  onClick={() => navigate(`/dashboard/${row.dossier.id}`)}
                  style={{
                    padding: 14,
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto",
                    gap: 12,
                    alignItems: "center",
                    textAlign: "left",
                    borderColor: row.alertCount > 0 ? "var(--warn-line)" : "var(--line-0)",
                    boxShadow: "none",
                    cursor: "pointer",
                  }}
                >
                  <DossierAvatar dossier={row.dossier} size={40} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{row.dossier.raison_sociale}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-2)", display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <span>{row.dossier.ville || "Ville non renseignee"}</span>
                      <span>{row.factures.length} factures</span>
                      <span>{formatMAD(row.totalTtc)} TTC</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: row.alertCount > 0 ? "var(--warn-ink)" : "var(--pos-ink)" }}>
                        {row.alertCount > 0 ? `${row.alertCount} alertes` : "Stable"}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--ink-3)" }}>
                        {row.lateCount} retard · {row.pendingCount} validation
                      </div>
                    </div>
                    <ArrowRight size={14} style={{ color: "var(--ink-3)" }} />
                  </div>
                </button>
              ))}
              {spotlightRows.length === 0 && (
                <div style={{ padding: 18, fontSize: 13, color: "var(--ink-2)", border: "1px dashed var(--line-1)", borderRadius: 14 }}>
                  Aucun dossier charge pour le moment. Cree un dossier pour alimenter la vue cabinet.
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div className="card-title">Activite recente</div>
              <Clock3 size={14} style={{ color: "var(--ink-3)" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {recentRows.map((row) => (
                <div key={row.dossier.id} style={{ padding: 12, border: "1px solid var(--line-0)", borderRadius: 14, background: "var(--bg-1)" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{row.dossier.raison_sociale}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 6 }}>
                    Derniere facture {row.latestFacture?.num_facture || row.latestFacture?.nom_fichier || "sans numero"}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11.5, color: "var(--ink-3)" }}>
                    <span>{formatDate(row.latestFacture?.date_facture || row.latestFacture?.created_at)}</span>
                    <span>{formatMAD(row.latestFacture?.montant_ttc || 0)} TTC</span>
                  </div>
                </div>
              ))}
              {recentRows.length === 0 && (
                <div style={{ fontSize: 13, color: "var(--ink-2)" }}>Pas encore d'activite facture a afficher.</div>
              )}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
            <div>
              <div className="card-title">Pilotage TVA</div>
              <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 4 }}>
                Les dossiers a traiter avant declaration ou verification
              </div>
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--ink-2)" }}>
              <Landmark size={14} />
              <span>{tvaRows.filter((row) => row.tvaStatus.label !== "Stable").length} dossier(s) a surveiller</span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
            {tvaRows.map((row) => (
              <div key={row.dossier.id} className="card" style={{ padding: 16, boxShadow: "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <DossierAvatar dossier={row.dossier} size={36} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{row.dossier.raison_sociale}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{row.dossier.regime_tva === "encaissements" ? "Regime encaissements" : "Regime debits"}</div>
                  </div>
                  <span className={`badge ${row.tvaStatus.tone}`}>
                    {row.tvaStatus.label}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 12 }}>
                  <div style={{ padding: 10, borderRadius: 12, background: "var(--bg-inset)" }}>
                    <div style={{ fontSize: 10.5, color: "var(--ink-3)", marginBottom: 5 }}>Solde TVA</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{formatMAD(row.tvaBalance)}</div>
                  </div>
                  <div style={{ padding: 10, borderRadius: 12, background: "var(--bg-inset)" }}>
                    <div style={{ fontSize: 10.5, color: "var(--ink-3)", marginBottom: 5 }}>À valider</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{row.pendingCount}</div>
                  </div>
                  <div style={{ padding: 10, borderRadius: 12, background: "var(--bg-inset)" }}>
                    <div style={{ fontSize: 10.5, color: "var(--ink-3)", marginBottom: 5 }}>Retards</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{row.lateCount}</div>
                  </div>
                </div>

                <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5, marginBottom: 12 }}>
                  {row.tvaStatus.reason}
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-secondary sm" onClick={() => navigate(`/dashboard/${row.dossier.id}?tab=tva`)}>
                    TVA
                  </button>
                  <button className="btn sm" onClick={() => navigate(`/dashboard/${row.dossier.id}?tab=factures`)}>
                    Verifier factures
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
            <div className="card-title">Portefeuille dossiers</div>
            <div style={{ fontSize: 12, color: "var(--ink-2)" }}>{filteredRows.length} dossier(s) affiches</div>
          </div>

          <div className="filter-bar" style={{ marginBottom: 16 }}>
            <div className="filter-search" style={{ minWidth: 260 }}>
              <Building2 size={14} style={{ color: "var(--ink-3)" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par raison sociale, ville ou ICE"
              />
            </div>
            <select className="input" value={alertFilter} onChange={(e) => setAlertFilter(e.target.value)} style={{ width: 180 }}>
              <option value="all">Toutes alertes</option>
              <option value="attention">Avec alertes</option>
              <option value="late">Avec retard</option>
              <option value="stable">Stables</option>
            </select>
            <select className="input" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} style={{ width: 180 }}>
              <option value="all">Toutes les villes</option>
              {cityOptions.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>

          <div className="card" style={{ padding: 0, overflow: "hidden", boxShadow: "none" }}>
            <table className="table">
              <thead>
                <tr>
                  <th className="th">Dossier</th>
                  <th className="th">Ville</th>
                  <th className="th">Factures</th>
                  <th className="th">Alertes</th>
                  <th className="th">TTC</th>
                  <th className="th">Derniere activite</th>
                  <th className="th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.dossier.id} className="tr-hover">
                    <td className="td">
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <DossierAvatar dossier={row.dossier} size={34} />
                        <div>
                          <div style={{ fontWeight: 600 }}>{row.dossier.raison_sociale}</div>
                          <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{row.dossier.forme_juridique || "Structure non renseignee"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="td">{row.dossier.ville || "Non renseignee"}</td>
                    <td className="td">{row.factures.length}</td>
                    <td className="td">
                      <span className={`badge ${row.alertCount > 0 ? "warn" : "pos"}`}>
                        {row.alertCount > 0 ? `${row.alertCount} alertes` : "Stable"}
                      </span>
                    </td>
                    <td className="td">{formatMAD(row.totalTtc)}</td>
                    <td className="td">{formatDate(row.latestFacture?.date_facture || row.latestFacture?.created_at)}</td>
                    <td className="td">
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button className="btn btn-secondary sm" onClick={() => navigate(`/dashboard/${row.dossier.id}`)}>
                          Ouvrir
                        </button>
                        <button className="btn sm" onClick={() => navigate(`/dashboard/${row.dossier.id}?tab=factures`)}>
                          Factures
                        </button>
                        <button className="btn btn-danger sm" onClick={() => removeDossier(row)}>
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr>
                    <td className="td" colSpan="7" style={{ padding: 24, textAlign: "center", color: "var(--ink-2)" }}>
                      Aucun dossier ne correspond aux filtres actuels.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div className="card-title">Comptes utilisateurs</div>
            <div style={{ fontSize: 12, color: "var(--ink-2)" }}>
              {users.filter((item) => item.status !== "disabled").length} actifs · {users.filter((item) => item.role === "admin").length} admins
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 18 }}>
            <div className="kpi">
              <div className="kpi-label"><Users size={14} /> Comptes</div>
              <div className="kpi-value">{users.length}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Admins</div>
              <div className="kpi-value">{users.filter((item) => item.role === "admin").length}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Collabs</div>
              <div className="kpi-value">{users.filter((item) => item.role === "collab").length}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Invites</div>
              <div className="kpi-value">{users.filter((item) => item.role === "invite").length}</div>
            </div>
          </div>

          <div className="card" style={{ padding: 20, marginBottom: 16, boxShadow: "none" }}>
            <div className="card-title" style={{ marginBottom: 14 }}>Ajouter un utilisateur</div>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.2fr 140px 1fr auto", gap: 10, alignItems: "end" }}>
              <div>
                <label className="label">Nom</label>
                <input className="input" value={draft.nom} onChange={(e) => setDraft((prev) => ({ ...prev, nom: e.target.value }))} placeholder="Sarah" />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" value={draft.email} onChange={(e) => setDraft((prev) => ({ ...prev, email: e.target.value }))} placeholder="sarah@cabinet.ma" />
              </div>
              <div>
                <label className="label">Role</label>
                <select className="input" value={draft.role} onChange={(e) => setDraft((prev) => ({ ...prev, role: e.target.value }))}>
                  <option value="admin">Admin</option>
                  <option value="collab">Collab</option>
                  <option value="invite">Invite</option>
                </select>
              </div>
              <div>
                <label className="label">Mot de passe</label>
                <input className="input" value={draft.password} onChange={(e) => setDraft((prev) => ({ ...prev, password: e.target.value }))} placeholder="password123" />
              </div>
              <button className="btn btn-primary" onClick={createUser}>
                <Plus size={13} /> Ajouter
              </button>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: "hidden", boxShadow: "none" }}>
            <table className="table">
              <thead>
                <tr>
                  <th className="th">Utilisateur</th>
                  <th className="th">Email</th>
                  <th className="th">Role</th>
                  <th className="th">Statut</th>
                  <th className="th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((row) => {
                  const meta = ROLE_META[row.role] || ROLE_META.collab;
                  return (
                    <tr key={row.id} className="tr-hover">
                      <td className="td" style={{ fontWeight: 600 }}>{row.nom || "Sans nom"}</td>
                      <td className="td">{row.email}</td>
                      <td className="td">
                        <select
                          className="input"
                          style={{ minWidth: 110, padding: "8px 10px", background: meta.bg, color: meta.color }}
                          value={row.role}
                          onChange={(e) => patchUser(row, { role: e.target.value })}
                        >
                          <option value="admin">Admin</option>
                          <option value="collab">Collab</option>
                          <option value="invite">Invite</option>
                        </select>
                      </td>
                      <td className="td">
                        <span className={`badge ${row.status === "disabled" ? "neg" : "pos"}`}>
                          {row.status === "disabled" ? "Desactive" : "Actif"}
                        </span>
                      </td>
                      <td className="td">
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button className="btn btn-secondary sm" onClick={() => patchUser(row, { status: row.status === "disabled" ? "active" : "disabled" })}>
                            {row.status === "disabled" ? "Activer" : "Desactiver"}
                          </button>
                          <button className="btn sm" onClick={() => patchUser(row, { password: "password123" })}>
                            Reset mdp
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
