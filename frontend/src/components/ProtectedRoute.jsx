import { Navigate, Outlet } from "react-router-dom"

import { LoadingScreen } from "@/components/loading-screen.jsx"
import { useAuth } from "@/context/auth-context.jsx"

function ProtectedRoute({ allowedRoles }) {
  const { user, status } = useAuth()

  if (status === "loading") {
    return <LoadingScreen />
  }

  if (status !== "authenticated") {
    return <Navigate to="/login" replace />
  }

  const role = (user?.role ?? "LEARNER").toUpperCase()
  if (!allowedRoles.includes(role)) {
    return <Navigate to="/403" replace />
  }

  return <Outlet />
}

export default ProtectedRoute
