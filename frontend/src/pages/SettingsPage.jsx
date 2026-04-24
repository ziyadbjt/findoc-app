import { useEffect, useRef, useState } from "react";
import { Check, RefreshCw, Sparkles, Database, Building2, Upload, Plus, Trash2, Pencil, X, Search, Brain, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "../context/ToastContext";
import { createAdminUser, getAdminUsers, getCorrections, getRagStatus, updateAdminUser } from "../api";
import { useAuth } from "../context/AuthContext";

const INTEGRATIONS = [
  { key: "sage", label: "SAGE 100", desc: "Export journal comptable", icon: <Database size={16} />, status: "connected" },
  { key: "dgi", label: "DGI · Portail fiscal", desc: "Déclaration TVA automatisée", icon: <Building2 size={16} />, status: "disconnected" },
  { key: "claude", label: "Claude AI", desc: "Extraction factures et génération relances", icon: <Sparkles size={16} />, status: "connected" },
];

const DEFAULT_PCM = [
  { compte: "101000", libelle: "Capital social", classe: "1" },
  { compte: "111000", libelle: "Réserve légale", classe: "1" },
  { compte: "141000", libelle: "Emprunts obligataires", classe: "1" },
  { compte: "161000", libelle: "Emprunts auprès des établissements de crédit", classe: "1" },
  { compte: "211000", libelle: "Terrains", classe: "2" },
  { compte: "232000", libelle: "Constructions", classe: "2" },
  { compte: "241000", libelle: "Matériel et outillage", classe: "2" },
  { compte: "251000", libelle: "Matériel de transport", classe: "2" },
  { compte: "261000", libelle: "Titres de participation", classe: "2" },
  { compte: "311000", libelle: "Marchandises", classe: "3" },
  { compte: "321000", libelle: "Matières premières", classe: "3" },
  { compte: "341000", libelle: "Produits finis", classe: "3" },
  { compte: "342100", libelle: "Clients", classe: "3" },
  { compte: "342200", libelle: "TVA collectée", classe: "3" },
  { compte: "344100", libelle: "TVA déductible", classe: "3" },
  { compte: "401100", libelle: "Fournisseurs", classe: "4" },
  { compte: "4455",   libelle: "RAS à reverser DGI", classe: "4" },
  { compte: "512100", libelle: "Banque", classe: "5" },
  { compte: "516000", libelle: "Caisse", classe: "5" },
  { compte: "6111000", libelle: "Achats de marchandises", classe: "6" },
  { compte: "6135000", libelle: "Services extérieurs", classe: "6" },
  { compte: "6141000", libelle: "Loyers et charges locatives", classe: "6" },
  { compte: "6161000", libelle: "Primes d'assurance", classe: "6" },
  { compte: "6171000", libelle: "Frais de personnel", classe: "6" },
  { compte: "6311000", libelle: "Impôts sur les bénéfices", classe: "6" },
  { compte: "7111000", libelle: "Ventes de produits finis", classe: "7" },
  { compte: "7121000", libelle: "Ventes de marchandises", classe: "7" },
  { compte: "7141000", libelle: "Travaux et services vendus", classe: "7" },
  { compte: "7311000", libelle: "Produits financiers", classe: "7" },
];

const PCM_KEY = "pcm-comptes";

function loadPCM() {
  try { return JSON.parse(localStorage.getItem(PCM_KEY)) || DEFAULT_PCM; }
  catch { return DEFAULT_PCM; }
}

function savePCM(data) {
  localStorage.setItem(PCM_KEY, JSON.stringify(data));
}

const CLASSES = ["Toutes", "1", "2", "3", "4", "5", "6", "7"];
const CLASS_LABELS = { "1": "Comptes de financement permanent", "2": "Comptes d'actif immobilisé", "3": "Comptes d'actif circulant", "4": "Comptes de passif circulant", "5": "Comptes de trésorerie", "6": "Comptes de charges", "7": "Comptes de produits" };

function PCMSection({ toast }) {
  const [comptes, setComptes] = useState(loadPCM);
  const [q, setQ] = useState("");
  const [classeFilter, setClasseFilter] = useState("Toutes");
  const [editing, setEditing] = useState(null); // { index, compte, libelle, classe } or "new"
  const [form, setForm] = useState({ compte: "", libelle: "", classe: "4" });
  const importRef = useRef(null);

  const filtered = comptes.filter(c => {
    if (classeFilter !== "Toutes" && c.classe !== classeFilter) return false;
    if (q.trim()) {
      const qq = q.toLowerCase();
      return c.compte.includes(qq) || c.libelle.toLowerCase().includes(qq);
    }
    return true;
  }).sort((a, b) => a.compte.localeCompare(b.compte));

  const persist = (next) => { setComptes(next); savePCM(next); };

  const startNew = () => {
    setForm({ compte: "", libelle: "", classe: "4" });
    setEditing("new");
  };

  const startEdit = (c, idx) => {
    setForm({ compte: c.compte, libelle: c.libelle, classe: c.classe });
    setEditing(idx);
  };

  const cancelEdit = () => setEditing(null);

  const saveEdit = () => {
    if (!form.compte.trim() || !form.libelle.trim()) {
      toast("Compte et libellé requis", "neg"); return;
    }
    if (editing === "new") {
      if (comptes.find(c => c.compte === form.compte.trim())) {
        toast("Ce numéro de compte existe déjà", "neg"); return;
      }
      persist([...comptes, { ...form, compte: form.compte.trim(), libelle: form.libelle.trim() }]);
      toast("Compte ajouté", "pos");
    } else {
      const next = comptes.map((c, i) => i === editing ? { ...form, compte: form.compte.trim(), libelle: form.libelle.trim() } : c);
      persist(next);
      toast("Compte modifié", "pos");
    }
    setEditing(null);
  };

  const deleteCompte = (idx) => {
    persist(comptes.filter((_, i) => i !== idx));
    toast("Compte supprimé", "pos");
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        let parsed;
        if (file.name.endsWith(".json")) {
          parsed = JSON.parse(text);
        } else {
          // CSV: compte;libelle;classe or compte,libelle,classe
          const sep = text.includes(";") ? ";" : ",";
          parsed = text.trim().split("\n").slice(1).map(line => {
            const [compte, libelle, classe] = line.split(sep);
            return { compte: (compte || "").trim(), libelle: (libelle || "").trim(), classe: (classe || "").trim() };
          }).filter(c => c.compte && c.libelle);
        }
        if (!Array.isArray(parsed) || !parsed[0]?.compte) throw new Error();
        const merged = [...comptes];
        parsed.forEach(c => {
          const idx = merged.findIndex(x => x.compte === c.compte);
          if (idx >= 0) merged[idx] = c; else merged.push(c);
        });
        persist(merged);
        toast(`${parsed.length} comptes importés`, "pos");
      } catch {
        toast("Format invalide. Attendu: JSON ou CSV (compte;libelle;classe)", "neg");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleReset = () => {
    persist(DEFAULT_PCM);
    toast("PCM réinitialisé", "pos");
  };

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div className="card-title">Plan Comptable Marocain</div>
          <div style={{ fontSize: 11.5, color: "var(--ink-2)", marginTop: 2 }}>{comptes.length} comptes · modifiable directement</div>
        </div>
        <button className="btn" onClick={handleReset} style={{ fontSize: 12 }}>Réinitialiser</button>
        <button className="btn" onClick={() => importRef.current?.click()}>
          <Upload size={13} /> Importer CSV / JSON
        </button>
        <input ref={importRef} type="file" accept=".csv,.json" hidden onChange={handleImport} />
        <button className="btn btn-primary" onClick={startNew}>
          <Plus size={13} /> Ajouter un compte
        </button>
      </div>

      {/* Formulaire ajout / édition */}
      {editing !== null && (
        <div style={{ background: "var(--bg-inset)", border: "1px solid var(--line-1)", borderRadius: 12, padding: 16, marginBottom: 16, display: "grid", gridTemplateColumns: "1fr 2fr 120px auto", gap: 10, alignItems: "end" }}>
          <div>
            <label className="label">N° compte</label>
            <input className="input" placeholder="401100" value={form.compte} onChange={e => setForm(f => ({ ...f, compte: e.target.value }))} />
          </div>
          <div>
            <label className="label">Libellé</label>
            <input className="input" placeholder="Fournisseurs" value={form.libelle} onChange={e => setForm(f => ({ ...f, libelle: e.target.value }))} />
          </div>
          <div>
            <label className="label">Classe</label>
            <select className="input" value={form.classe} onChange={e => setForm(f => ({ ...f, classe: e.target.value }))}>
              {["1","2","3","4","5","6","7"].map(c => <option key={c} value={c}>Classe {c}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={saveEdit}><Check size={13} /></button>
            <button className="btn" onClick={cancelEdit}><X size={13} /></button>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <div className="filter-search" style={{ flex: 1 }}>
          <Search size={13} />
          <input placeholder="Numéro ou libellé…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="filter-chips">
          {CLASSES.map(c => (
            <button key={c} className={`chip${classeFilter === c ? " active" : ""}`} onClick={() => setClasseFilter(c)}>
              {c === "Toutes" ? "Toutes" : `Cl. ${c}`}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden", maxHeight: 420, overflowY: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th className="th" style={{ width: 120 }}>N° Compte</th>
              <th className="th">Libellé</th>
              <th className="th" style={{ width: 200 }}>Classe</th>
              <th className="th" style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: "center", padding: 32, color: "var(--ink-3)", fontSize: 13 }}>Aucun compte.</td></tr>
            )}
            {filtered.map((c, i) => {
              const realIdx = comptes.indexOf(c);
              return (
                <tr key={c.compte} className="tr-hover">
                  <td className="td mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-ink)" }}>{c.compte}</td>
                  <td className="td">{c.libelle}</td>
                  <td className="td" style={{ fontSize: 11.5, color: "var(--ink-2)" }}>
                    {CLASS_LABELS[c.classe] ? `${c.classe} — ${CLASS_LABELS[c.classe]}` : c.classe}
                  </td>
                  <td className="td" style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                      <button className="icon-btn" onClick={() => startEdit(c, realIdx)} title="Modifier"><Pencil size={12} /></button>
                      <button className="icon-btn" onClick={() => deleteCompte(realIdx)} title="Supprimer" style={{ color: "var(--neg-ink)" }}><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const readTVAConfig = (dossier) => {
  const key = `tva-config:${dossier?.id || "default"}`;
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "{}");
    return { regime_tva: dossier?.regime_tva || "debits", default_rate: 20, enable_tpe: true, enable_bank: true, cmi_base_ht: 12500, cmi_rate: 20, bank_base_ht: 6400, bank_rate: 10, ...saved };
  } catch {
    return { regime_tva: dossier?.regime_tva || "debits", default_rate: 20, enable_tpe: true, enable_bank: true, cmi_base_ht: 12500, cmi_rate: 20, bank_base_ht: 6400, bank_rate: 10 };
  }
};

const TABS = [
  { key: "dossier",       label: "Dossier" },
  { key: "acces",         label: "Accès" },
  { key: "pcm",           label: "Plan Comptable" },
  { key: "finai",         label: "FinAI · Apprentissage" },
  { key: "integrations",  label: "Intégrations" },
];

const ROLE_META = {
  admin: { label: "Admin", color: "var(--accent-ink)", bg: "var(--accent-bg)" },
  collab: { label: "Collab", color: "var(--pos-ink)", bg: "var(--pos-bg)" },
  invite: { label: "Invité", color: "var(--ink-1)", bg: "var(--bg-2)" },
};

function AccessTab() {
  const toast = useToast();
  const { token, user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState({ nom: "", email: "", role: "collab", password: "" });

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

  useEffect(() => { loadUsers(); }, [token, isAdmin]);

  const createUser = async () => {
    if (!draft.nom.trim() || !draft.email.trim()) {
      toast("Nom et email requis", "neg");
      return;
    }
    try {
      const res = await createAdminUser(token, draft);
      setUsers((prev) => [...prev, res.data].sort((a, b) => (a.nom || a.email).localeCompare(b.nom || b.email)));
      setDraft({ nom: "", email: "", role: "collab", password: "" });
      toast("Utilisateur créé", "pos");
    } catch {
      toast("Création impossible", "neg");
    }
  };

  const patchUser = async (row, payload) => {
    try {
      const res = await updateAdminUser(token, row.id, payload);
      setUsers((prev) => prev.map((item) => (item.id === row.id ? res.data : item)));
      toast("Utilisateur mis à jour", "pos");
    } catch {
      toast("Mise à jour impossible", "neg");
    }
  };

  if (!isAdmin) {
    return (
      <div className="card" style={{ padding: 20, maxWidth: 560 }}>
        <div className="card-title" style={{ marginBottom: 8 }}>Accès</div>
        <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
          Cette console est réservée au rôle admin.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <div>
            <div className="card-title">Organisation · Utilisateurs</div>
            <div style={{ fontSize: 11.5, color: "var(--ink-2)", marginTop: 2 }}>
              Rôles disponibles : admin, collab, invité
            </div>
          </div>
          <button className="btn" onClick={loadUsers} disabled={loading}>
            <RefreshCw size={13} /> Rafraîchir
          </button>
        </div>

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
            <label className="label">Rôle</label>
            <select className="input" value={draft.role} onChange={(e) => setDraft((prev) => ({ ...prev, role: e.target.value }))}>
              <option value="admin">Admin</option>
              <option value="collab">Collab</option>
              <option value="invite">Invité</option>
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
              <th className="th">Rôle</th>
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
                      <option value="invite">Invité</option>
                    </select>
                  </td>
                  <td className="td">
                    <span className={`badge ${row.status === "disabled" ? "neg" : "pos"}`}>
                      {row.status === "disabled" ? "Désactivé" : "Actif"}
                    </span>
                  </td>
                  <td className="td">
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-secondary sm" onClick={() => patchUser(row, { status: row.status === "disabled" ? "active" : "disabled" })}>
                        {row.status === "disabled" ? "Activer" : "Désactiver"}
                      </button>
                      <button className="btn sm" onClick={() => patchUser(row, { password: "password123" })}>
                        Reset mdp
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td className="td" colSpan={5} style={{ textAlign: "center", padding: 28, color: "var(--ink-3)" }}>
                  Aucun utilisateur.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FinAITab({ dossier }) {
  const { token } = useAuth();
  const toast = useToast();
  const [corrections, setCorrections] = useState([]);
  const [ragStatus, setRagStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [statusRes, corrRes] = await Promise.all([
        getRagStatus(token),
        dossier?.id ? getCorrections(token, dossier.id) : Promise.resolve({ data: [] }),
      ]);
      setRagStatus(statusRes.data);
      setCorrections(corrRes.data || []);
    } catch {
      toast("Impossible de charger les données FinAI", "neg");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [dossier?.id]);

  const CHAMP_LABELS = { compte_pcm: "Compte PCM", fournisseur: "Fournisseur", code_tiers: "Code tiers", type: "Type" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 760 }}>
      {/* Statut RAG */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--accent-bg)", color: "var(--accent-ink)", display: "grid", placeItems: "center" }}>
            <Brain size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="card-title">FinAI — Moteur d'apprentissage</div>
            <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>RAG · ChromaDB · sentence-transformers (multilingue)</div>
          </div>
          <button className="btn" onClick={load} disabled={loading}><RefreshCw size={13} /></button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ padding: "14px 16px", borderRadius: 10, background: "var(--bg-inset)", display: "flex", alignItems: "center", gap: 10 }}>
            {ragStatus?.rag_available
              ? <CheckCircle size={16} style={{ color: "var(--pos-ink)" }} />
              : <AlertCircle size={16} style={{ color: "var(--warn-ink)" }} />}
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Moteur vectoriel</div>
              <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>
                {ragStatus?.rag_available ? "ChromaDB opérationnel" : "Non installé"}
              </div>
            </div>
          </div>
          <div style={{ padding: "14px 16px", borderRadius: 10, background: "var(--bg-inset)", display: "flex", alignItems: "center", gap: 10 }}>
            <Sparkles size={16} style={{ color: "var(--accent-ink)" }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{corrections.length} corrections apprises</div>
              <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>Pour ce dossier</div>
            </div>
          </div>
        </div>

        {ragStatus && !ragStatus.rag_available && (
          <div style={{ marginTop: 12, padding: "12px 14px", background: "var(--warn-bg)", borderRadius: 10, fontSize: 12, color: "var(--warn-ink)" }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Pour activer le vrai ML :</div>
            <code style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}>pip install chromadb sentence-transformers</code>
            <div style={{ fontSize: 11, marginTop: 4, color: "var(--ink-2)" }}>Puis redémarrer le backend.</div>
          </div>
        )}
      </div>

      {/* Comment ça marche */}
      <div className="card" style={{ padding: 20 }}>
        <div className="card-title" style={{ marginBottom: 12 }}>Comment FinAI apprend</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { step: "1", title: "Extraction initiale", desc: "FinAI extrait les données de vos factures via Claude." },
            { step: "2", title: "Vous corrigez", desc: "Dans l'onglet Extraction, cliquez sur ✏️ pour corriger un compte PCM ou un fournisseur mal détecté." },
            { step: "3", title: "Vectorisation", desc: "La correction est encodée en vecteur (embedding multilingue) et stockée dans ChromaDB." },
            { step: "4", title: "Injection RAG", desc: "Lors des prochaines extractions similaires, les corrections pertinentes sont injectées dans le prompt Claude." },
            { step: "5", title: "Amélioration continue", desc: "Plus vous corrigez, plus FinAI est précis sur vos fournisseurs et votre plan comptable." },
          ].map(s => (
            <div key={s.step} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 24, height: 24, borderRadius: 999, background: "var(--accent-bg)", color: "var(--accent-ink)", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{s.step}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: "var(--ink-2)" }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Historique corrections */}
      {corrections.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-1)", fontSize: 12, fontWeight: 600 }}>
            Historique des corrections
          </div>
          <table className="table">
            <thead>
              <tr>
                <th className="th">Fournisseur</th>
                <th className="th">Champ corrigé</th>
                <th className="th">Avant</th>
                <th className="th">Après</th>
                <th className="th">Date</th>
              </tr>
            </thead>
            <tbody>
              {corrections.map(c => (
                <tr key={c.id} className="tr-hover">
                  <td className="td" style={{ fontWeight: 500 }}>{c.fournisseur}</td>
                  <td className="td"><span className="badge">{CHAMP_LABELS[c.champ] || c.champ}</span></td>
                  <td className="td" style={{ color: "var(--neg-ink)", fontSize: 12 }}>{c.valeur_originale}</td>
                  <td className="td" style={{ color: "var(--pos-ink)", fontSize: 12, fontWeight: 600 }}>{c.valeur_corrigee}</td>
                  <td className="td" style={{ fontSize: 11, color: "var(--ink-3)" }}>{c.created_at ? new Date(c.created_at).toLocaleDateString("fr-FR") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage({ dossier, onUpdateDossier }) {
  const toast = useToast();
  const { user } = useAuth();
  const [tab, setTab] = useState("dossier");
  const [form, setForm] = useState({
    raison_sociale: dossier?.raison_sociale || "",
    ice: dossier?.ice || "",
    forme_juridique: dossier?.forme_juridique || "SARL",
    ville: dossier?.ville || "",
    secteur: dossier?.secteur || "",
    regime_tva: dossier?.regime_tva || "debits",
  });
  const [tvaConfig, setTvaConfig] = useState(() => readTVAConfig(dossier));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm({
      raison_sociale: dossier?.raison_sociale || "",
      ice: dossier?.ice || "",
      forme_juridique: dossier?.forme_juridique || "SARL",
      ville: dossier?.ville || "",
      secteur: dossier?.secteur || "",
      regime_tva: dossier?.regime_tva || "debits",
    });
    setTvaConfig(readTVAConfig(dossier));
  }, [dossier]);

  const handleSave = () => {
    onUpdateDossier?.({ ...form });
    setSaved(true);
    toast("Paramètres sauvegardés", "pos");
    setTimeout(() => setSaved(false), 2500);
  };

  const handleSaveTVA = () => {
    const key = `tva-config:${dossier?.id || "default"}`;
    const next = { ...tvaConfig, regime_tva: form.regime_tva };
    localStorage.setItem(key, JSON.stringify(next));
    setTvaConfig(next);
    toast("Configuration TVA sauvegardée", "pos");
  };

  const field = (key, label, placeholder, opts) => (
    <div key={key}>
      <label className="label">{label}</label>
      {opts ? (
        <select className="input" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}>
          {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      ) : (
        <input className="input" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={placeholder} />
      )}
    </div>
  );

  const visibleTabs = TABS.filter((item) => item.key !== "acces" || user?.role === "admin");

  return (
    <div className="page-inner">
      <div className="page-header">
        <div>
          <h1 className="page-title">Paramètres</h1>
          <p className="page-subtitle">Dossier · Plan comptable · Intégrations</p>
        </div>
      </div>

      <div className="filter-chips" style={{ marginBottom: 16 }}>
        {visibleTabs.map(t => (
          <button key={t.key} className={`chip${tab === t.key ? " active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "dossier" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 12, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title" style={{ marginBottom: 16 }}>Informations du dossier</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                {field("raison_sociale", "Raison sociale", "ATLAS INDUSTRIES SA")}
                {field("ice", "ICE", "000000000000000")}
                {field("ville", "Ville", "Casablanca")}
                {field("secteur", "Secteur", "Industrie")}
                {field("forme_juridique", "Forme juridique", null, [
                  ["SARL", "SARL"], ["SA", "SA"], ["SARL-AU", "SARL-AU"], ["SNC", "SNC"], ["Auto-entrepreneur", "Auto-entrepreneur"],
                ])}
                {field("regime_tva", "Régime TVA", null, [
                  ["debits", "Régime des débits"], ["encaissements", "Régime des encaissements"],
                ])}
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-primary" onClick={handleSave}>
                  {saved ? <><Check size={13} /> Sauvegardé</> : "Sauvegarder"}
                </button>
              </div>
            </div>

            <div className="card" style={{ padding: 20 }}>
              <div className="card-title" style={{ marginBottom: 4 }}>Déclaration TVA · Configuration</div>
              <div style={{ fontSize: 11.5, color: "var(--ink-2)", marginBottom: 16 }}>
                Paramètres utilisés dans l'onglet déclaration et pour les sources complémentaires.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="label">Taux TVA par défaut (%)</label>
                  <input className="input" type="number" value={tvaConfig.default_rate} step={0.5}
                    onChange={(e) => setTvaConfig((prev) => ({ ...prev, default_rate: Number(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="label">Régime actif</label>
                  <input className="input" value={form.regime_tva === "encaissements" ? "Encaissements" : "Débits"} readOnly />
                </div>
                <label className="card" style={{ padding: 14, display: "flex", alignItems: "center", gap: 10, borderStyle: "dashed" }}>
                  <input type="checkbox" checked={tvaConfig.enable_tpe}
                    onChange={(e) => setTvaConfig((prev) => ({ ...prev, enable_tpe: e.target.checked }))} />
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 500 }}>Source CMI / TPE</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>Inclure les encaissements carte</div>
                  </div>
                </label>
                <label className="card" style={{ padding: 14, display: "flex", alignItems: "center", gap: 10, borderStyle: "dashed" }}>
                  <input type="checkbox" checked={tvaConfig.enable_bank}
                    onChange={(e) => setTvaConfig((prev) => ({ ...prev, enable_bank: e.target.checked }))} />
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 500 }}>Relevés bancaires</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>Ajouter la TVA pour contrôle</div>
                  </div>
                </label>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                <button className="btn btn-primary" onClick={handleSaveTVA}>Sauvegarder</button>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div className="card-title" style={{ marginBottom: 16 }}>Plan actuel</div>
            <div style={{ padding: "12px 14px", background: "var(--accent-bg)", borderRadius: 10, fontSize: 12, color: "var(--accent-ink)", marginBottom: 16 }}>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>Pro</div>
              <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>3 dossiers actifs · 500 factures/mois · export SAGE inclus</div>
            </div>
          </div>
        </div>
      )}

      {tab === "acces" && <AccessTab />}

      {tab === "pcm" && <PCMSection toast={toast} />}

      {tab === "finai" && <FinAITab dossier={dossier} />}

      {tab === "integrations" && (
        <div style={{ maxWidth: 520 }}>
          <div className="card" style={{ padding: 20 }}>
            <div className="card-title" style={{ marginBottom: 16 }}>Intégrations</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {INTEGRATIONS.map((integ) => (
                <div key={integ.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--bg-inset)", borderRadius: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--bg-1)", border: "1px solid var(--line-1)", display: "grid", placeItems: "center", color: "var(--ink-2)", flexShrink: 0 }}>
                    {integ.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{integ.label}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{integ.desc}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 99,
                      background: integ.status === "connected" ? "var(--pos-bg)" : "var(--bg-2)",
                      color: integ.status === "connected" ? "var(--pos-ink)" : "var(--ink-3)",
                    }}>
                      {integ.status === "connected" ? "Connecté" : "Déconnecté"}
                    </span>
                    <button className="icon-btn" title="Rafraîchir"><RefreshCw size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
