import { createContext, useContext, useState, useEffect } from "react"
import { getMe, loginUser } from "../api"

const AuthContext = createContext()

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
