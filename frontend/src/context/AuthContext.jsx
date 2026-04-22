import { createContext, useContext, useState, useEffect } from "react"
import axios from "axios"

const AuthContext = createContext()
const API_BASE = "http://localhost:8000"
const DEV_DEMO_EMAIL = "ziyad@cabinetchami.ma"
const DEV_DEMO_PASSWORD = "password123"

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem("token"))
  const [authReady, setAuthReady] = useState(false)

  const hydrateSession = async (sessionToken) => {
    const me = await axios.get(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${sessionToken}` }
    })
    localStorage.setItem("token", sessionToken)
    setToken(sessionToken)
    setUser(me.data)
    return me.data
  }

  const loginWithCredentials = async (email, password) => {
    const form = new URLSearchParams({ username: email, password })
    const res = await axios.post(`${API_BASE}/auth/login`, form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    })
    return hydrateSession(res.data.access_token)
  }

  useEffect(() => {
    const storedToken = localStorage.getItem("token")
    const bootstrap = async () => {
      try {
        if (storedToken) {
          await hydrateSession(storedToken)
        } else {
          await loginWithCredentials(DEV_DEMO_EMAIL, DEV_DEMO_PASSWORD)
        }
      } catch {
        localStorage.removeItem("token")
        setToken(null)
        setUser(null)
      } finally {
        setAuthReady(true)
      }
    }
    bootstrap()
  }, [])

  const login = async (email, password) => {
    return loginWithCredentials(email, password)
  }

  const logout = () => {
    loginWithCredentials(DEV_DEMO_EMAIL, DEV_DEMO_PASSWORD)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, authReady }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
