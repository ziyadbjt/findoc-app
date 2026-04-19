import { createContext, useContext, useState, useEffect } from "react"
import axios from "axios"

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem("token"))

  useEffect(() => {
    const storedToken = localStorage.getItem("token")
    if (storedToken) {
      axios.get("http://127.0.0.1:8000/auth/me", {
        headers: { Authorization: `Bearer ${storedToken}` }
      }).then(res => {
        setUser(res.data)
        setToken(storedToken)
      }).catch(() => {
        localStorage.removeItem("token")
        setToken(null)
      })
    }
  }, [])

  const login = async (email, password) => {
    const form = new URLSearchParams({ username: email, password })
    const res = await axios.post("http://127.0.0.1:8000/auth/login", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    })
    const t = res.data.access_token
    localStorage.setItem("token", t)
    setToken(t)
    const me = await axios.get("http://127.0.0.1:8000/auth/me", {
      headers: { Authorization: `Bearer ${t}` }
    })
    setUser(me.data)
    return me.data
  }

  const logout = () => {
    localStorage.removeItem("token")
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)