import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'

export const ProtectedRoute = ({ children }) => {
  const { session, isAdmin, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="admin-loading">Cargando…</div>
  }

  if (!session || !isAdmin) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }

  return children
}
