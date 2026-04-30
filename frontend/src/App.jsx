import { Suspense, lazy } from "react"
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom"
import { AuthProvider, useAuth } from "./context/AuthContext"
import { ToastProvider } from "./context/ToastContext"

const Home = lazy(() => import("./pages/Home"))
const Login = lazy(() => import("./pages/Login"))
const Dossiers = lazy(() => import("./pages/Dossiers"))
const Dashboard = lazy(() => import("./pages/Dashboard"))
const AdminPage = lazy(() => import("./pages/AdminPage"))

// Apply saved theme before first render to avoid flash
const savedTheme = localStorage.getItem("theme") || "dark";
document.documentElement.setAttribute("data-theme", savedTheme);

function RouteFallback() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#060b0a", color: "#8fd4bc", fontFamily: "Inter, sans-serif", fontSize: 13 }}>
      Chargement…
    </div>
  )
}

function PrivateRoute({ children }) {
  const { token, authReady } = useAuth()
  const location = useLocation()
  if (!authReady) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#060b0a", color: "#8fd4bc", fontFamily: "Inter, sans-serif", fontSize: 13 }}>
        Chargement…
      </div>
    )
  }
  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return children
}

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <div key={location.pathname} className="app-route-shell">
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dossiers" element={<PrivateRoute><Dossiers /></PrivateRoute>} />
          <Route path="/admin" element={<PrivateRoute><AdminPage /></PrivateRoute>} />
          <Route path="/dashboard/:id" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <AnimatedRoutes />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
