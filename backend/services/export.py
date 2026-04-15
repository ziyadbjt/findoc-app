import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import axios from "axios"

export default function Dashboard() {
  const { id } = useParams()
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()
  const [dossier, setDossier] = useState(null)
  const [activeModule, setActiveModule] = useState("factures")

  const headers = { Authorization: `Bearer ${token}` }

  useEffect(() => {
    axios.get(`http://127.0.0.1:8000/dossiers/${id}`, { headers })
      .then(res => setDossier(res.data))
  }, [id])

  const modules = [
    { key: "factures", label: "Mes factures" },
    { key: "reconciliation", label: "Réconciliation" },
    { key: "relances", label: "Relances" },
    { key: "parametres", label: "Paramètres" },
  ]

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ width: "200px", flexShrink: 0, background: "white", borderRight: "0.5px solid #e0dfd8", display: "flex", flexDirection: "column", padding: "20px 0" }}>
        <div style={{ padding: "0 18px 20px", borderBottom: "0.5px solid #e0dfd8" }}>
          <div style={{ fontSize: "15px", fontWeight: "500" }}>FinDoc AI</div>
          <div style={{ fontSize: "11px", color: "#aaa", marginTop: "3px" }}>
            {dossier?.raison_sociale || "..."}
          </div>
        </div>

        <div style={{ padding: "16px 8px", flex: 1 }}>
          {modules.map(m => (
            <button key={m.key} onClick={() => setActiveModule(m.key)}
              style={{
                display: "flex", alignItems: "center", gap: "10px",
                width: "100%", padding: "10px 12px",
                border: "none", background: activeModule === m.key ? "#f5f5f0" : "transparent",
                borderRadius: "8px", cursor: "pointer", textAlign: "left",
                fontFamily: "system-ui, sans-serif", fontSize: "13px",
                color: activeModule === m.key ? "#1a1a1a" : "#888",
                fontWeight: activeModule === m.key ? "500" : "400"
              }}>
              {m.label}
            </button>
          ))}
        </div>

        <div style={{ padding: "14px 18px", borderTop: "0.5px solid #e0dfd8" }}>
          <button onClick={() => navigate("/dossiers")}
            style={{ fontSize: "12px", color: "#aaa", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: "6px", display: "block" }}>
            ← Changer de dossier
          </button>
          <button onClick={() => { logout(); navigate("/login") }}
            style={{ fontSize: "12px", color: "#aaa", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            Déconnexion
          </button>
        </div>
      </div>

      <div style={{ flex: 1, padding: "32px", background: "#f5f5f0", overflowY: "auto" }}>
        {activeModule === "factures" && <FacturesModule dossierId={id} headers={headers} />}
        {activeModule === "reconciliation" && <ReconciliationModule dossierId={id} headers={headers} />}
        {activeModule === "relances" && <PlaceholderModule title="Relances" desc="Les relances générées automatiquement apparaîtront ici." />}
        {activeModule === "parametres" && <PlaceholderModule title="Paramètres" desc="Configuration du dossier, taux BAM, liste des tiers." />}
      </div>
    </div>
  )
}

function PlaceholderModule({ title, desc }) {
  return (
    <div>
      <h1 style={{ fontSize: "20px", fontWeight: "500", marginBottom: "4px" }}>{title}</h1>
      <p style={{ fontSize: "13px", color: "#888", marginBottom: "24px" }}>{desc}</p>
      <div style={{ background: "white", border: "0.5px solid #e0dfd8", borderRadius: "16px", padding: "40px", textAlign: "center" }}>
        <p style={{ fontSize: "13px", color: "#aaa", margin: 0 }}>Module en cours de développement.</p>
      </div>
    </div>
  )
}

function FacturesModule({ dossierId, headers }) {
  const [factures, setFactures] = useState([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState("")

  useEffect(() => {
    axios.get(`http://127.0.0.1:8000/factures/${dossierId}`, { headers })
      .then(res => setFactures(res.data))
  }, [dossierId])

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return
    setUploading(true)
    setProgress(`Envoi de ${files.length} facture(s)...`)
    const formData = new FormData()
    files.forEach(f => formData.append("files", f))
    try {
      await axios.post(`http://127.0.0.1:8000/factures/${dossierId}/upload`, formData, {
        headers: { ...headers, "Content-Type": "multipart/form-data" }
      })
      setProgress("Upload terminé ✓")
      const res = await axios.get(`http://127.0.0.1:8000/factures/${dossierId}`, { headers })
      setFactures(res.data)
    } catch {
      setProgress("Erreur lors de l'upload")
    } finally {
      setUploading(false)
    }
  }

  const exportExcel = async () => {
    const res = await axios.get(
      `http://127.0.0.1:8000/factures/${dossierId}/export`,
      { headers, responseType: "blob" }
    )
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const a = document.createElement("a")
    a.href = url
    a.download = `journal_dossier_${dossierId}.xlsx`
    a.click()
  }

  return (
    <div>
      <h1 style={{ fontSize: "20px", fontWeight: "500", marginBottom: "4px" }}>Mes factures</h1>
      <p style={{ fontSize: "13px", color: "#888", marginBottom: "24px" }}>
        Déposez un dossier entier. Toutes les factures sont traitées d'un coup.
      </p>

      <label style={{
        display: "block", background: "white", border: "1.5px dashed #ccc",
        borderRadius: "16px", padding: "40px", textAlign: "center", cursor: "pointer",
        marginBottom: "20px"
      }}>
        <div style={{ fontSize: "13px", fontWeight: "500", marginBottom: "6px" }}>
          {uploading ? progress : "Sélectionner les factures PDF"}
        </div>
        <div style={{ fontSize: "12px", color: "#aaa" }}>
          {uploading ? "" : "Cliquez pour parcourir · PDF uniquement"}
        </div>
        <input type="file" multiple accept=".pdf" onChange={handleUpload}
          style={{ display: "none" }} disabled={uploading} />
      </label>

      {progress && !uploading && (
        <p style={{ fontSize: "12px", color: "#27500A", marginBottom: "16px" }}>{progress}</p>
      )}

      {factures.length > 0 && (
        <div style={{ background: "white", border: "0.5px solid #e0dfd8", borderRadius: "16px", overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "0.5px solid #e0dfd8", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "13px", fontWeight: "500" }}>{factures.length} facture(s) uploadée(s)</span>
            <button onClick={exportExcel}
              style={{ padding: "6px 14px", fontSize: "12px", background: "#1a1a1a", color: "white", borderRadius: "8px", border: "none", cursor: "pointer" }}>
              Exporter Excel
            </button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ background: "#f5f5f0" }}>
                <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: "500", color: "#888" }}>Fichier</th>
                <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: "500", color: "#888" }}>Fournisseur</th>
                <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: "500", color: "#888" }}>Code tiers</th>
                <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: "500", color: "#888" }}>Montant TTC</th>
                <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: "500", color: "#888" }}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {factures.map(f => (
                <tr key={f.id} style={{ borderTop: "0.5px solid #f0f0f0" }}>
                  <td style={{ padding: "9px 14px", color: "#aaa" }}>{f.nom_fichier}</td>
                  <td style={{ padding: "9px 14px" }}>{f.fournisseur || "—"}</td>
                  <td style={{ padding: "9px 14px", fontFamily: "monospace", fontSize: "11px" }}>{f.code_tiers || "—"}</td>
                  <td style={{ padding: "9px 14px" }}>{f.montant_ttc ? `${f.montant_ttc.toLocaleString()} MAD` : "—"}</td>
                  <td style={{ padding: "9px 14px" }}>
                    <span style={{
                      padding: "2px 9px", borderRadius: "12px", fontSize: "11px",
                      background: f.statut === "traité" ? "#EAF3DE" : "#FAEEDA",
                      color: f.statut === "traité" ? "#27500A" : "#633806"
                    }}>
                      {f.statut}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ReconciliationModule({ dossierId, headers }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [taux, setTaux] = useState(2.25)

  const lancer = async () => {
    setLoading(true)
    try {
      const res = await axios.get(
        `http://127.0.0.1:8000/reconciliation/${dossierId}?taux_bam=${taux}`,
        { headers }
      )
      setData(res.data)
    } catch {
      alert("Erreur lors de la réconciliation")
    } finally {
      setLoading(false)
    }
  }

  const statutStyle = (s) => {
    if (s === "payée") return { background: "#EAF3DE", color: "#27500A" }
    if (s === "en_retard") return { background: "#FCEBEB", color: "#791F1F" }
    return { background: "#FAEEDA", color: "#633806" }
  }

  return (
    <div>
      <h1 style={{ fontSize: "20px", fontWeight: "500", marginBottom: "4px" }}>Réconciliation</h1>
      <p style={{ fontSize: "13px", color: "#888", marginBottom: "24px" }}>
        Matching automatique des factures · Détection retards Loi 69-21
      </p>

      <div style={{ background: "white", border: "0.5px solid #e0dfd8", borderRadius: "16px", padding: "20px 24px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{ fontSize: "13px", color: "#555" }}>Taux directeur BAM :</div>
        <input type="number" value={taux} step="0.25"
          onChange={e => setTaux(parseFloat(e.target.value))}
          style={{ width: "80px", padding: "6px 10px", fontSize: "13px", border: "0.5px solid #ccc", borderRadius: "8px" }} />
        <div style={{ fontSize: "12px", color: "#aaa" }}>% · Pénalités = taux + 3% = {(taux + 3).toFixed(2)}%</div>
        <button onClick={lancer} disabled={loading}
          style={{ marginLeft: "auto", padding: "8px 18px", fontSize: "13px", background: "#1a1a1a", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}>
          {loading ? "Analyse..." : "Lancer la réconciliation"}
        </button>
      </div>

      {data && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "20px" }}>
            {[
              { label: "Factures analysées", val: data.total_factures },
              { label: "Retards Loi 69-21", val: data.retards_loi_6921, red: true },
              { label: "Pénalités estimées", val: `${data.total_penalites_mad.toLocaleString()} MAD`, red: data.total_penalites_mad > 0 }
            ].map((k, i) => (
              <div key={i} style={{ background: "white", border: "0.5px solid #e0dfd8", borderRadius: "12px", padding: "14px 16px" }}>
                <div style={{ fontSize: "11px", color: "#aaa" }}>{k.label}</div>
                <div style={{ fontSize: "22px", fontWeight: "500", marginTop: "4px", color: k.red ? "#A32D2D" : "#1a1a1a" }}>{k.val}</div>
              </div>
            ))}
          </div>

          <div style={{ background: "white", border: "0.5px solid #e0dfd8", borderRadius: "16px", overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "0.5px solid #e0dfd8", fontSize: "13px", fontWeight: "500" }}>
              Résultats détaillés
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: "#f5f5f0" }}>
                  <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: "500", color: "#888" }}>Fournisseur</th>
                  <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: "500", color: "#888" }}>Montant TTC</th>
                  <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: "500", color: "#888" }}>Délai</th>
                  <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: "500", color: "#888" }}>Retard</th>
                  <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: "500", color: "#888" }}>Pénalité</th>
                  <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: "500", color: "#888" }}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {data.resultats.map((r, i) => (
                  <tr key={i} style={{ borderTop: "0.5px solid #f0f0f0" }}>
                    <td style={{ padding: "9px 14px" }}>{r.fournisseur}</td>
                    <td style={{ padding: "9px 14px" }}>{r.montant_ttc?.toLocaleString()} MAD</td>
                    <td style={{ padding: "9px 14px" }}>{r.delai_contractuel} j</td>
                    <td style={{ padding: "9px 14px", color: r.retard_jours > 0 ? "#A32D2D" : "#27500A", fontWeight: "500" }}>
                      {r.retard_jours > 0 ? `+${r.retard_jours} j` : "—"}
                    </td>
                    <td style={{ padding: "9px 14px", color: r.penalite_mad > 0 ? "#A32D2D" : "#aaa" }}>
                      {r.penalite_mad > 0 ? `${r.penalite_mad.toLocaleString()} MAD` : "—"}
                    </td>
                    <td style={{ padding: "9px 14px" }}>
                      <span style={{ padding: "2px 9px", borderRadius: "12px", fontSize: "11px", ...statutStyle(r.statut_paiement) }}>
                        {r.statut_paiement}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}