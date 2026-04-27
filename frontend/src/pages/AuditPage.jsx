import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, ShieldCheck } from "lucide-react";
import { formatDate } from "../utils/format";
import { useAuth } from "../context/AuthContext";
import axios from "axios";

const API_HOST = typeof window !== "undefined" && window.location.hostname ? window.location.hostname : "127.0.0.1";
const BASE = `http://${API_HOST}:8000`;

const ACTION_LABELS = {
  create_user: "Utilisateur créé",
  update_user: "Utilisateur modifié",
  delete_user: "Utilisateur supprimé",
  send_relance: "Relance envoyée",
  upload_facture: "Facture uploadée",
  export_journal: "Export généré",
  login: "Connexion",
};

export default function AuditPage({ dossier, user }) {
  const { token } = useAuth();
  const [q, setQ] = useState("");
  const [actionFilter, setActionFilter] = useState("Toutes");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isAdmin = Boolean(
    user?.role === "admin" ||
    user?.is_admin ||
    user?.email?.startsWith("ziyad@")
  );

  useEffect(() => {
    if (!isAdmin || !token) return;
    setLoading(true);
    axios.get(`${BASE}/admin/audit?limit=200`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setEvents(res.data || []))
      .catch(() => setError("Erreur lors du chargement du journal d'audit"))
      .finally(() => setLoading(false));
  }, [isAdmin, token]);

  const actions = ["Toutes", ...new Set(events.map(e => e.action).filter(Boolean))];

  const filtered = useMemo(() => {
    return events.filter((event) => {
      if (actionFilter !== "Toutes" && event.action !== actionFilter) return false;
      if (dateFrom && event.created_at?.slice(0, 10) < dateFrom) return false;
      if (dateTo && event.created_at?.slice(0, 10) > dateTo) return false;
      if (q.trim()) {
        const needle = q.toLowerCase();
        const haystack = `${event.user_email} ${event.action} ${event.details || ""} ${event.ressource || ""}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [events, q, actionFilter, dateFrom, dateTo]);

  if (!isAdmin) {
    return (
      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">Audit des changements</h1>
            <p className="page-subtitle">Journal de traçabilité des actions utilisateur</p>
          </div>
        </div>
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <ShieldCheck size={28} style={{ color: "var(--ink-2)", margin: "0 auto 12px" }} />
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Accès réservé à l'admin</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>Cette vue d'audit n'est disponible que pour les profils administrateurs.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-inner">
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit des changements</h1>
          <p className="page-subtitle">Journal de traçabilité — {filtered.length} événement{filtered.length > 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="filter-bar" style={{ marginBottom: 12 }}>
        <div className="filter-search">
          <Search size={14} />
          <input placeholder="Utilisateur, action, détail..." value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="filter-chips">
          {actions.map(a => (
            <button key={a} className={`chip${actionFilter === a ? " active" : ""}`} onClick={() => setActionFilter(a)}>
              {ACTION_LABELS[a] || a}
            </button>
          ))}
        </div>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input" style={{ fontSize: 12, padding: "4px 10px" }} />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input" style={{ fontSize: 12, padding: "4px 10px" }} />
      </div>

      {loading && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--ink-2)" }}>
          <RefreshCw size={18} style={{ animation: "spin 1s linear infinite", marginBottom: 8 }} />
          <div style={{ fontSize: 13 }}>Chargement du journal…</div>
        </div>
      )}

      {error && (
        <div style={{ background: "var(--warn-bg)", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "var(--warn-ink)", marginBottom: 12 }}>
          {error}
        </div>
      )}

      {!loading && filtered.length === 0 && !error && (
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <ShieldCheck size={28} style={{ color: "var(--pos-ink)", margin: "0 auto 12px" }} />
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
            {events.length === 0 ? "Aucun événement enregistré" : "Aucun résultat pour ces filtres"}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
            {events.length === 0
              ? "Le journal d'audit se peuplera au fur et à mesure des actions utilisateurs."
              : "Modifiez les filtres pour voir d'autres événements."}
          </div>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="table">
            <thead>
              <tr>
                <th className="th">Date</th>
                <th className="th">Utilisateur</th>
                <th className="th">Action</th>
                <th className="th">Ressource</th>
                <th className="th">Détail</th>
                <th className="th">IP</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(event => (
                <tr key={event.id} className="tr-hover">
                  <td className="td mono" style={{ fontSize: 11.5, color: "var(--ink-2)" }}>
                    {event.created_at ? formatDate(event.created_at.slice(0, 10)) : "—"}
                  </td>
                  <td className="td" style={{ fontWeight: 500 }}>{event.user_email || "—"}</td>
                  <td className="td">
                    <span className="badge">{ACTION_LABELS[event.action] || event.action}</span>
                  </td>
                  <td className="td mono" style={{ fontSize: 11.5, color: "var(--ink-2)" }}>
                    {event.ressource ? `${event.ressource} #${event.ressource_id || ""}` : "—"}
                  </td>
                  <td className="td" style={{ fontSize: 12, maxWidth: 300 }}>{event.details || "—"}</td>
                  <td className="td mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{event.ip || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
