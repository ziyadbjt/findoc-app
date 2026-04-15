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
        {activeModule === "reconciliation" && <PlaceholderModule title="Réconciliation" desc="Upload relevé bancaire + factures pour lancer le matching." />}
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
              style={{
                padding: "6px 14px", fontSize: "12px",
                background: "#1a1a1a", color: "white",
                borderRadius: "8px", border: "none", cursor: "pointer"
              }}>
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