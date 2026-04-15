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
  return (
    <div>
      <h1 style={{ fontSize: "20px", fontWeight: "500", marginBottom: "4px" }}>Mes factures</h1>
      <p style={{ fontSize: "13px", color: "#888", marginBottom: "24px" }}>
        Déposez un dossier entier. Toutes les factures sont traitées d'un coup.
      </p>
      <div style={{ background: "white", border: "0.5px solid #e0dfd8", borderRadius: "16px", padding: "40px", textAlign: "center", cursor: "pointer" }}
        onClick={() => alert("Upload batch — à implémenter")}>
        <div style={{ fontSize: "13px", fontWeight: "500", marginBottom: "6px" }}>Sélectionner un dossier de factures</div>
        <div style={{ fontSize: "12px", color: "#aaa" }}>PDF uniquement · tous les fichiers d'un coup</div>
      </div>
    </div>
  )
}