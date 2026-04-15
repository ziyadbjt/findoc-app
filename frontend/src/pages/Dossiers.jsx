import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import axios from "axios"

export default function Dossiers() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()
  const [dossiers, setDossiers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    raison_sociale: "", ice: "", forme_juridique: "SARL", ville: "", secteur: ""
  })

  const headers = { Authorization: `Bearer ${token}` }

  useEffect(() => {
    axios.get("http://127.0.0.1:8000/dossiers/", { headers })
      .then(res => setDossiers(res.data))
  }, [])

  const createDossier = async () => {
    const params = new URLSearchParams(form)
    await axios.post(`http://127.0.0.1:8000/dossiers/?${params}`, {}, { headers })
    const res = await axios.get("http://127.0.0.1:8000/dossiers/", { headers })
    setDossiers(res.data)
    setShowForm(false)
    setForm({ raison_sociale: "", ice: "", forme_juridique: "SARL", ville: "", secteur: "" })
  }

  const colors = ["#E6F1FB", "#EAF3DE", "#FAEEDA", "#EEEDFE", "#FAECE7"]
  const textColors = ["#0C447C", "#27500A", "#633806", "#3C3489", "#712B13"]

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f0", fontFamily: "system-ui, sans-serif", padding: "32px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "32px" }}>
        <h1 style={{ fontSize: "20px", fontWeight: "500", margin: 0 }}>FinDoc AI</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "13px", color: "#555" }}>{user?.nom} · {user?.role}</span>
          <button onClick={() => { logout(); navigate("/login") }}
            style={{ padding: "6px 14px", fontSize: "12px", border: "0.5px solid #ccc", borderRadius: "8px", background: "transparent", cursor: "pointer" }}>
            Déconnexion
          </button>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <h2 style={{ fontSize: "16px", fontWeight: "500", margin: "0 0 4px" }}>Sur quel dossier travaillez-vous ?</h2>
          <p style={{ fontSize: "13px", color: "#888", margin: 0 }}>Sélectionnez un client pour charger son environnement.</p>
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ padding: "8px 16px", fontSize: "13px", background: "#1a1a1a", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}>
          + Nouveau dossier
        </button>
      </div>

      {showForm && (
        <div style={{ background: "white", border: "0.5px solid #e0dfd8", borderRadius: "16px", padding: "24px", marginBottom: "20px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: "500", marginBottom: "16px" }}>Nouveau dossier client</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
            {[
              { key: "raison_sociale", label: "Raison sociale", placeholder: "ATLAS INDUSTRIES SA" },
              { key: "ice", label: "ICE", placeholder: "000000000000000" },
              { key: "ville", label: "Ville", placeholder: "Tanger" },
              { key: "secteur", label: "Secteur", placeholder: "Industrie" }
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: "12px", fontWeight: "500", color: "#555", display: "block", marginBottom: "4px" }}>{f.label}</label>
                <input value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  style={{ width: "100%", padding: "8px 10px", fontSize: "13px", border: "0.5px solid #ccc", borderRadius: "8px", boxSizing: "border-box" }} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <button onClick={() => setShowForm(false)}
              style={{ padding: "7px 14px", fontSize: "12px", border: "0.5px solid #ccc", borderRadius: "8px", background: "transparent", cursor: "pointer" }}>
              Annuler
            </button>
            <button onClick={createDossier}
              style={{ padding: "7px 14px", fontSize: "12px", background: "#1a1a1a", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}>
              Créer le dossier
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
        {dossiers.map((d, i) => (
          <div key={d.id} onClick={() => navigate(`/dashboard/${d.id}`)}
            style={{ background: "white", border: "0.5px solid #e0dfd8", borderRadius: "16px", padding: "16px 18px", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: colors[i % colors.length], display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "500", color: textColors[i % textColors.length] }}>
                {d.raison_sociale.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: "500" }}>{d.raison_sociale}</div>
                <div style={{ fontSize: "11px", color: "#888" }}>{d.forme_juridique} · {d.ville}</div>
              </div>
            </div>
            <div style={{ fontSize: "11px", color: "#aaa", borderTop: "0.5px solid #f0f0f0", paddingTop: "8px" }}>
              ICE : {d.ice || "—"} · {d.regime_tva === "debits" ? "Régime débits" : "Régime encaissements"}
            </div>
          </div>
        ))}

        {dossiers.length === 0 && !showForm && (
          <div style={{ gridColumn: "1 / -1", background: "white", border: "0.5px solid #e0dfd8", borderRadius: "16px", padding: "40px", textAlign: "center" }}>
            <p style={{ fontSize: "13px", color: "#888", margin: 0 }}>Aucun dossier. Cliquez sur "+ Nouveau dossier" pour commencer.</p>
          </div>
        )}
      </div>
    </div>
  )
}