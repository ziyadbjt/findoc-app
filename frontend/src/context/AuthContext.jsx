import { createContext, useContext, useState, useEffect } from "react"
import { getMe, loginUser } from "../api"

const AuthContext = createContext()
const HOSTNAME = typeof window !== "undefined" ? window.location.hostname : ""
const IS_VERCEL_PREVIEW = HOSTNAME.endsWith(".vercel.app")
const SKIP_LOGIN =
  import.meta.env.DEV ||
  import.meta.env.VITE_SKIP_LOGIN === "true" ||
  IS_VERCEL_PREVIEW
const DEV_USER = {
  id: 1,
  email: "ziyad@findoc.local",
  username: "ziyad",
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

  const loginWithCredentials = async (identifier, password) => {
    const res = await loginUser(identifier, password)
    return hydrateSession(res.data.access_token)
  }

  const loginDemoSession = async () => {
    const res = await loginUser("ziyad", "ziyad123")
    return hydrateSession(res.data.access_token)
  }

  useEffect(() => {
    const storedToken = localStorage.getItem("token")
    const bootstrap = async () => {
      try {
        if (storedToken) {
          await hydrateSession(storedToken)
        } else if (SKIP_LOGIN) {
          await loginDemoSession()
        }
      } catch {
        localStorage.removeItem("token")
        if (SKIP_LOGIN) {
          try {
            await loginDemoSession()
          } catch {
            if (import.meta.env.DEV) {
              setToken("dev-preview-token")
              setUser(DEV_USER)
            } else {
              setToken(null)
              setUser(null)
            }
          }
        } else {
          setToken(null)
          setUser(null)
        }
      } finally {
        setAuthReady(true)
      }
    }
    bootstrap()
  }, [])

  const login = async (identifier, password) => {
    return loginWithCredentials(identifier, password)
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

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
