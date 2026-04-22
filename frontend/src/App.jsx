import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider, useAuth } from "./context/AuthContext"
import { ToastProvider } from "./context/ToastContext"
import Dossiers from "./pages/Dossiers"
import Dashboard from "./pages/Dashboard"

function PrivateRoute({ children }) {
  const { token, authReady } = useAuth()
  if (!authReady) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>Chargement...</div>
  }
  return token ? children : <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>Connexion indisponible</div>
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Navigate to="/dossiers" replace />} />
          <Route path="/dossiers" element={<PrivateRoute><Dossiers /></PrivateRoute>} />
          <Route path="/dashboard/:id" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/dossiers" replace />} />
        </Routes>
      </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
