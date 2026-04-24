import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import { createAdminUser, getAdminUsers, updateAdminUser } from "../api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

const ROLE_META = {
  admin: { label: "Admin", color: "var(--accent-ink)", bg: "var(--accent-bg)" },
  collab: { label: "Collab", color: "var(--pos-ink)", bg: "var(--pos-bg)" },
  invite: { label: "Invite", color: "var(--ink-1)", bg: "var(--bg-2)" },
};

export default function AdminPage() {
  const { token, user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState({ nom: "", email: "", role: "collab", password: "" });

  const isAdmin = user?.role === "admin";

  const loadUsers = async () => {
    if (!token || !isAdmin) return;
    setLoading(true);
    try {
      const res = await getAdminUsers(token);
      setUsers(res.data || []);
    } catch {
      toast("Impossible de charger les utilisateurs", "neg");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
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

  if (!isAdmin) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-0)", color: "var(--ink-0)" }}>
        <header style={{ padding: "18px 32px", borderBottom: "1px solid var(--line-0)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="brand-mark">F</div>
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
          <div style={{ fontSize: 14, fontWeight: 700 }}>Administration</div>
          <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>Gestion globale des acces de l'organisation</div>
        </div>
        <Link to="/dossiers" className="btn btn-ghost">
          <ArrowLeft size={14} /> Dossiers
        </Link>
      </header>

      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">Utilisateurs</h1>
            <p className="page-subtitle">Roles disponibles : admin, collab, invite</p>
          </div>
          <button className="btn" onClick={loadUsers} disabled={loading}>
            <RefreshCw size={13} /> Rafraichir
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr 0.9fr", gap: 14, marginBottom: 18 }}>
          <div className="kpi">
            <div className="kpi-label"><ShieldCheck size={14} /> Comptes</div>
            <div className="kpi-value">{users.length}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Admins</div>
            <div className="kpi-value">{users.filter((item) => item.role === "admin").length}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Invites</div>
            <div className="kpi-value">{users.filter((item) => item.role === "invite").length}</div>
          </div>
        </div>

        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
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

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
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
                      <div style={{ display: "flex", gap: 8 }}>
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
  );
}
