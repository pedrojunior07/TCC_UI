import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

export function RequireRole({ role, roles, children }) {
  const { currentUser } = useAuth()
  const location = useLocation()

  if (!currentUser) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  const allowed = Array.isArray(roles) ? roles : role ? [role] : []
  if (allowed.length > 0 && !allowed.includes(currentUser.role)) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />
  }
  return children
}
