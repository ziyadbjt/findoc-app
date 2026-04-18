import { useState, useMemo } from "react";
import { Search, Building2, User } from "lucide-react";
import { formatMAD, formatDate } from "../utils/format";

export default function TiersPage({ factures, tiersType = "fournisseurs" }) {
  const [q, setQ]             = useState("");
  const [selected, setSelected] = useState(null);

  // Reset selection when type changes
  const tiers = useMemo(() => {
    const map = new Map();
    factures
      .filter(f => {
        if (tiersType === "fournisseurs") return (f.type || "achat") === "achat";
        return f.type === "vente";
      })
      .forEach(f => {
        const key  = f.fournisseur || f.client || "—";
        const prev = map.get(key) || { nom: key, code_tiers: f.code_tiers || "", factures: [], total_ttc: 0, total_tva: 0, en_retard: 0, derniere_facture: null };
        prev.factures.push(f);
        prev.total_ttc += f.montant_ttc || 0;
        prev.total_tva += f.tva || 0;
        if (f.paiement === "en_retard") prev.en_retard += f.montant_ttc || 0;
        if (!prev.derniere_facture || f.date_facture > prev.derniere_facture) prev.derniere_facture = f.date_facture;
        map.set(key, prev);
      });

    // If no typed data, fall back to all factures for fournisseurs view
    if (map.size === 0 && tiersType === "fournisseurs") {
      factures.forEach(f => {
        const key  = f.fournisseur || "—";
        const prev = map.get(key) || { nom: key, code_tiers: f.code_tiers || "", factures: [], total_ttc: 0, total_tva: 0, en_retard: 0, derniere_facture: null };
        prev.factures.push(f);
        prev.total_ttc += f.montant_ttc || 0;
        prev.total_tva += f.tva || 0;
        if (f.paiement === "en_retard") prev.en_retard += f.montant_ttc || 0;
        if (!prev.derniere_facture || f.date_facture > prev.derniere_facture) prev.derniere_facture = f.date_facture;
        map.set(key, prev);
      });
    }

    return [...map.values()].sort((a, b) => b.total_ttc - a.total_ttc);
  }, [factures, tiersType]);

  const filtered = tiers.filter(t =>
    !q.trim() ||
    t.nom.toLowerCase().includes(q.toLowerCase()) ||
    t.code_tiers.toLowerCase().includes(q.toLowerCase())
  );

  const Icon = tiersType === "fournisseurs" ? Building2 : User;
  const totalTTC = tiers.reduce((s,t) => s + t.total_ttc, 0);

  return (
    <div className="page-inner">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tiers · {tiersType === "fournisseurs" ? "Fournisseurs" : "Clients"}</h1>
          <p className="page-subtitle">{tiers.length} tiers · {formatMAD(totalTTC).split(",")[0]} MAD TTC cumulé</p>
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-search">
          <Search size={14}/>
          <input placeholder={`Chercher un ${tiersType === "fournisseurs" ? "fournisseur" : "client"}…`} value={q} onChange={e=>setQ(e.target.value)} />
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns: selected ? "1fr 360px" : "1fr", gap:12 }}>
        <div className="card" style={{ padding:0, overflow:"hidden" }}>
          <table className="table">
            <thead>
              <tr>
                <th className="th">{tiersType === "fournisseurs" ? "Fournisseur" : "Client"}</th>
                <th className="th">Code tiers</th>
                <th className="th right">Factures</th>
                <th className="th right">Total TTC</th>
                <th className="th right">TVA</th>
                <th className="th right">Retards</th>
                <th className="th">Dernière facture</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign:"center", padding:40, color:"var(--ink-3)", fontSize:13 }}>
                  Aucun {tiersType === "fournisseurs" ? "fournisseur" : "client"} trouvé
                </td></tr>
              )}
              {filtered.map(t => (
                <tr key={t.nom} className="tr-hover"
                  style={{ cursor:"pointer", background: selected?.nom===t.nom ? "var(--accent-bg)" : undefined }}
                  onClick={() => setSelected(s => s?.nom===t.nom ? null : t)}>
                  <td className="td" style={{ fontWeight:500 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ width:28, height:28, borderRadius:7, background:"var(--bg-2)", display:"grid", placeItems:"center" }}>
                        <Icon size={13} style={{ color:"var(--ink-2)" }} />
                      </div>
                      {t.nom}
                    </div>
                  </td>
                  <td className="td mono" style={{ fontSize:11.5, color:"var(--ink-2)" }}>{t.code_tiers||"—"}</td>
                  <td className="td right tabular">{t.factures.length}</td>
                  <td className="td right tabular" style={{ fontWeight:500 }}>{formatMAD(t.total_ttc).split(",")[0]}</td>
                  <td className="td right tabular" style={{ color:"var(--ink-2)" }}>{formatMAD(t.total_tva).split(",")[0]}</td>
                  <td className="td right tabular" style={{ color:t.en_retard>0?"var(--neg-ink)":"var(--ink-3)" }}>
                    {t.en_retard>0 ? formatMAD(t.en_retard).split(",")[0] : "—"}
                  </td>
                  <td className="td" style={{ color:"var(--ink-2)" }}>{formatDate(t.derniere_facture)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected && (
          <div className="card" style={{ padding:0, overflow:"hidden" }}>
            <div style={{ padding:"15px 18px", borderBottom:"1px solid var(--line-1)" }}>
              <div style={{ fontSize:14, fontWeight:500, marginBottom:2 }}>{selected.nom}</div>
              <div className="mono" style={{ fontSize:11.5, color:"var(--ink-2)" }}>{selected.code_tiers||"Code non renseigné"}</div>
            </div>
            <div style={{ padding:"12px 18px", borderBottom:"1px solid var(--line-1)", display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              {[
                { label:"Total TTC",         val:`${formatMAD(selected.total_ttc).split(",")[0]} MAD` },
                { label:"TVA récupérable",   val:`${formatMAD(selected.total_tva).split(",")[0]} MAD` },
                { label:"Factures",          val:selected.factures.length },
                { label:"En retard",         val:selected.en_retard>0?`${formatMAD(selected.en_retard).split(",")[0]} MAD`:"—" },
              ].map(({label,val}) => (
                <div key={label}>
                  <div style={{ fontSize:11, color:"var(--ink-3)", marginBottom:2 }}>{label}</div>
                  <div style={{ fontSize:14, fontWeight:500 }}>{val}</div>
                </div>
              ))}
            </div>
            <div style={{ overflowY:"auto", maxHeight:360 }}>
              <div style={{ padding:"10px 18px", fontSize:12, fontWeight:500, color:"var(--ink-2)" }}>Historique</div>
              {selected.factures
                .sort((a,b) => (b.date_facture||"").localeCompare(a.date_facture||""))
                .map(f => (
                  <div key={f.id} style={{ padding:"10px 18px", borderBottom:"1px solid var(--line-1)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ fontSize:12.5, fontWeight:500, marginBottom:1 }}>{f.num_facture||f.nom_fichier}</div>
                      <div style={{ fontSize:11.5, color:"var(--ink-2)" }}>{formatDate(f.date_facture)}</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div className="mono tabular" style={{ fontSize:13, fontWeight:500 }}>{formatMAD(f.montant_ttc).split(",")[0]}</div>
                      <div style={{ fontSize:11, color:f.paiement==="en_retard"?"var(--neg-ink)":"var(--ink-3)" }}>{f.paiement||"en attente"}</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
