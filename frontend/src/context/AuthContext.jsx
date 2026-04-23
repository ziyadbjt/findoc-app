import { createContext, useContext, useState, useEffect } from "react"
import axios from "axios"

const AuthContext = createContext()
const API_BASE = "http://localhost:8000"

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
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
          await loginWithCredentials("ziyad@cabinetchami.ma", "password123")
        }
      } catch {
        try {
          await loginWithCredentials("ziyad@cabinetchami.ma", "password123")
        } catch {
          localStorage.removeItem("token")
          setToken(null)
          setUser(null)
        }
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
    localStorage.removeItem("token")
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, authReady }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
