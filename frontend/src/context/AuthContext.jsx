import { createContext, useContext, useState, useEffect } from "react"
import { getMe, loginUser } from "../api"

const AuthContext = createContext()
const SKIP_LOGIN = import.meta.env.DEV || import.meta.env.VITE_SKIP_LOGIN === "true"
const DEV_USER = {
  id: 1,
  email: "ziyad@cabinetchami.ma",
  nom: "Ziyad",
  role: "admin",
  status: "active",
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [authReady, setAuthReady] = useState(false)

  const hydrateSession = async (sessionToken) => {
    const me = await getMe(sessionToken)
    localStorage.setItem("token", sessionToken)
    setToken(sessionToken)
    setUser(me.data)
    return me.data
  }

  const loginWithCredentials = async (email, password) => {
    const res = await loginUser(email, password)
    return hydrateSession(res.data.access_token)
  }

  useEffect(() => {
    const storedToken = localStorage.getItem("token")
    const bootstrap = async () => {
      try {
        if (storedToken) {
          await hydrateSession(storedToken)
        } else if (SKIP_LOGIN) {
          const res = await loginUser("ziyad@cabinetchami.ma", "password123")
          await hydrateSession(res.data.access_token)
        }
      } catch {
        if (SKIP_LOGIN) {
          setToken("dev-preview-token")
          setUser(DEV_USER)
        } else {
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
    window.location.href = "/login"
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, authReady }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
