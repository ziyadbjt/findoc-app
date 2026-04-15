import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      await login(email, password)
      navigate("/dossiers")
    } catch {
      setError("Email ou mot de passe incorrect")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f5f5f0",
      fontFamily: "system-ui, sans-serif"
    }}>
      <div style={{
        background: "white",
        border: "0.5px solid #e0dfd8",
        borderRadius: "16px",
        padding: "40px",
        width: "100%",
        maxWidth: "400px"
      }}>
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "20px", fontWeight: "500", margin: "0 0 4px" }}>
            FinDoc AI
          </h1>
          <p style={{ fontSize: "13px", color: "#888", margin: 0 }}>
            Connectez-vous à votre espace cabinet
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "14px" }}>
            <label style={{ fontSize: "12px", fontWeight: "500", color: "#555", display: "block", marginBottom: "6px" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="vous@cabinet.ma"
              required
              style={{
                width: "100%",
                padding: "9px 12px",
                fontSize: "13px",
                border: "0.5px solid #ccc",
                borderRadius: "8px",
                outline: "none",
                boxSizing: "border-box"
              }}
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ fontSize: "12px", fontWeight: "500", color: "#555", display: "block", marginBottom: "6px" }}>
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: "100%",
                padding: "9px 12px",
                fontSize: "13px",
                border: "0.5px solid #ccc",
                borderRadius: "8px",
                outline: "none",
                boxSizing: "border-box"
              }}
            />
          </div>

          {error && (
            <p style={{ fontSize: "12px", color: "#c0392b", marginBottom: "14px" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "10px",
              background: loading ? "#ccc" : "#1a1a1a",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "13px",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: "500"
            }}
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <p style={{ fontSize: "11px", color: "#aaa", marginTop: "20px", textAlign: "center" }}>
          "DEMO MFE ZIYAD BOUJETTOU"
        </p>
      </div>
    </div>
  )
}