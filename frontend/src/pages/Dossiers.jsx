import { useAuth } from "../context/AuthContext"
import { useNavigate } from "react-router-dom"

export default function Dossiers() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f5f5f0",
      fontFamily: "system-ui, sans-serif",
      padding: "32px"
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "32px"
      }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: "500", margin: "0 0 4px" }}>
            FinDoc AI
          </h1>
          <p style={{ fontSize: "13px", color: "#888", margin: 0 }}>
            "DEMO MFE"
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "13px", color: "#555" }}>
            {user?.nom} · {user?.role}
          </span>
          <button
            onClick={() => { logout(); navigate("/login") }}
            style={{
              padding: "6px 14px",
              fontSize: "12px",
              border: "0.5px solid #ccc",
              borderRadius: "8px",
              background: "transparent",
              cursor: "pointer"
            }}
          >
            Déconnexion
          </button>
        </div>
      </div>

      <div style={{
        background: "white",
        border: "0.5px solid #e0dfd8",
        borderRadius: "16px",
        padding: "40px",
        textAlign: "center"
      }}>
        <h2 style={{ fontSize: "16px", fontWeight: "500", marginBottom: "8px" }}>
          Sélectionnez un dossier client
        </h2>
        <p style={{ fontSize: "13px", color: "#888" }}>
          Les dossiers apparaîtront ici une fois créés.
        </p>
      </div>
    </div>
  )
}