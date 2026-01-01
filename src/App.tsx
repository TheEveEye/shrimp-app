import './App.css'
import SovCampaignsTable from './components/SovCampaignsTable'
import ActiveSessionsRail from './components/ActiveSessionsRail'
import { Routes, Route, useNavigate, useSearchParams, Navigate, useLocation } from 'react-router-dom'
import AuthCallback from './auth/AuthCallback'
import NavBar from './components/NavBar'
import JoinSessionModal from './components/JoinSessionModal'
import RequireAuth from './pages/RequireAuth'
import SessionsNew from './pages/SessionsNew'
import SessionDashboard from './pages/SessionDashboard'
import LoginPage from './pages/LoginPage'
import UiShowcase from './pages/UiShowcase'
import { useAuth } from './auth/AuthContext'
import { useEffect } from 'react'
import { useSessions } from './sessions/SessionsContext'

function Home() {
  const { isAuthenticated } = useAuth()
  const { fetchActiveSessions } = useSessions()
  useEffect(() => { if (isAuthenticated) fetchActiveSessions() }, [isAuthenticated, fetchActiveSessions])
  return (
    <>
      {isAuthenticated ? <ActiveSessionsRail /> : null}
      <header className="page-header">
        <div>
          <h1 className="title">Sovereignty Campaigns</h1>
          <p className="subtitle">Live Sovereignty Hub timers streamed from ESI</p>
        </div>
      </header>
      
      <SovCampaignsTable />
    </>
  )
}

function App() {
  const nav = useNavigate()
  const location = useLocation()
  const [search] = useSearchParams()
  const joinOpen = search.get('join') === '1'
  const { isAuthenticated } = useAuth()

  // If a user hits /?join=1 unauthenticated, redirect to /login and preserve returnTo
  useEffect(() => {
    if (joinOpen && !isAuthenticated) {
      const sp = new URLSearchParams(location.search)
      sp.set('join', '1')
      const returnTo = `${location.pathname}?${sp.toString()}`
      nav(`/login?returnTo=${encodeURIComponent(returnTo)}`, { replace: true })
    }
  }, [joinOpen, isAuthenticated, nav, location.pathname, location.search])

  const handleCloseJoin = () => {
    // Prefer popping history (preserves back button semantics)
    if (window.history.length > 1) { nav(-1); return }
    // Fallback: remove ?join=1 from current URL
    const sp = new URLSearchParams(location.search)
    sp.delete('join')
    const next = sp.toString()
    nav({ pathname: location.pathname, search: next ? `?${next}` : '' }, { replace: true })
  }

  return (
    <>
      <NavBar />
      <JoinSessionModal open={joinOpen} onClose={handleCloseJoin} />
      <main className="container main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/sessions/new" element={<RequireAuth><SessionsNew /></RequireAuth>} />
          {/* Legacy link support: redirect to modal state */}
          <Route path="/sessions/join" element={<Navigate to="/?join=1" replace />} />
          <Route path="/sessions/:id/dashboard" element={<RequireAuth><SessionDashboard /></RequireAuth>} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/ui" element={<UiShowcase />} />
        </Routes>
      </main>
    </>
  )
}

export default App
