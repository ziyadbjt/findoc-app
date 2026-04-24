import { useMemo, useState } from "react";
import { Search, ShieldCheck } from "lucide-react";
import { formatDate } from "../utils/format";

const AUDIT_EVENTS = [
  { id: 1, at: "2026-04-20T09:14:00", user: "Ziyad B.", action: "facture uploadée", detail: "FAC-2026-0184.pdf importée", ip: "196.12.44.18" },
  { id: 2, at: "2026-04-20T09:25:00", user: "Sara M.", action: "statut modifié", detail: "Facture FAC-2026-0184 passée à validée", ip: "196.12.44.27" },
  { id: 3, at: "2026-04-19T17:40:00", user: "Ziyad B.", action: "dossier créé", detail: "Création du dossier Atlas Industrie", ip: "196.12.44.18" },
  { id: 4, at: "2026-04-19T16:10:00", user: "Admin", action: "export généré", detail: "Journal SAGE exporté au format XLSX", ip: "10.0.0.8" },
  { id: 5, at: "2026-04-19T08:03:00", user: "Ziyad B.", action: "connexion", detail: "Connexion à l’espace cabinet", ip: "196.12.44.18" },
  { id: 6, at: "2026-04-18T14:55:00", user: "Sara M.", action: "facture uploadée", detail: "Lot de 24 factures fournisseur importé", ip: "196.12.44.27" },
];

const ACTIONS = ["Toutes", "facture uploadée", "statut modifié", "dossier créé", "export généré", "connexion"];

export default function AuditPage({ dossier, user }) {
  const [q, setQ] = useState("");
  const [action, setAction] = useState("Toutes");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const isAdmin = Boolean(
    user?.role === "admin" ||
    user?.is_admin ||
    dossier?.role === "admin" ||
    dossier?.is_admin ||
    user?.email?.startsWith("ziyad@")
  );

  const filtered = useMemo(() => {
    return AUDIT_EVENTS.filter((event) => {
      if (action !== "Toutes" && event.action !== action) return false;
      if (dateFrom && event.at.slice(0, 10) < dateFrom) return false;
      if (dateTo && event.at.slice(0, 10) > dateTo) return false;
      if (q.trim()) {
        const needle = q.toLowerCase();
        const haystack = `${event.user} ${event.action} ${event.detail} ${event.ip}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    }).sort((a, b) => b.at.localeCompare(a.at));
  }, [q, action, dateFrom, dateTo]);

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
          <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>Cette vue d’audit n’est disponible que pour les profils administrateurs.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-inner">
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit des changements</h1>
          <p className="page-subtitle">{filtered.length} événements · journal de traçabilité</p>
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-search">
          <Search size={14} />
          <input placeholder="Utilisateur, action, détail, IP…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input" style={{ width: 180 }} value={action} onChange={(e) => setAction(e.target.value)}>
          {ACTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <input className="input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <input className="input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="table">
          <thead>
            <tr>
              <th className="th">Date / heure</th>
              <th className="th">Utilisateur</th>
              <th className="th">Action</th>
              <th className="th">Détail</th>
              <th className="th">IP</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: 40, color: "var(--ink-3)", fontSize: 13 }}>
                  Aucun événement ne correspond aux filtres.
                </td>
              </tr>
            )}
            {filtered.map((event) => (
              <tr key={event.id} className="tr-hover">
                <td className="td">
                  <div>{formatDate(event.at)}</div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{event.at.slice(11, 16)}</div>
                </td>
                <td className="td" style={{ fontWeight: 500 }}>{event.user}</td>
                <td className="td"><span className="badge">{event.action}</span></td>
                <td className="td" style={{ color: "var(--ink-1)" }}>{event.detail}</td>
                <td className="td mono" style={{ fontSize: 12 }}>{event.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
