import { Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'

export function RequireAuth({ children }) {
  const { currentUser, bootstrap } = useAuth()
  const location = useLocation()
  const [bootstrapped, setBootstrapped] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await bootstrap()
      } finally {
        if (!cancelled) setBootstrapped(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bootstrap])

  if (!bootstrapped) return null
  if (!currentUser) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (currentUser?.mustChangePassword && location.pathname !== '/seguranca') {
    return <Navigate to="/seguranca" replace state={{ from: location.pathname }} />
  }
  return children
}
