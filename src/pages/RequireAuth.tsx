import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import React from 'react'

export default function RequireAuth({ children }: { children: React.ReactElement }) {
  const { isAuthenticated, isReady } = useAuth()
  const loc = useLocation()
  if (!isReady) return <div style={{ padding: 12 }}>Loading…</div>
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: loc }} replace />
  return children
}
