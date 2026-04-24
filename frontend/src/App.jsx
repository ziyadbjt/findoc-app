import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider, useAuth } from "./context/AuthContext"
import { ToastProvider } from "./context/ToastContext"
import Login from "./pages/Login"
import Dossiers from "./pages/Dossiers"
import Dashboard from "./pages/Dashboard"
import AdminPage from "./pages/AdminPage"

// Apply saved theme before first render to avoid flash
const savedTheme = localStorage.getItem("theme") || "dark";
document.documentElement.setAttribute("data-theme", savedTheme);

function PrivateRoute({ children }) {
  const { token, authReady } = useAuth()
  if (!authReady) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#060b0a", color: "#8fd4bc", fontFamily: "Inter, sans-serif", fontSize: 13 }}>
        Chargement…
      </div>
    )
  }
  return children
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/dossiers" element={<PrivateRoute><Dossiers /></PrivateRoute>} />
            <Route path="/admin" element={<PrivateRoute><AdminPage /></PrivateRoute>} />
            <Route path="/dashboard/:id" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="*" element={<Navigate to="/dossiers" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
