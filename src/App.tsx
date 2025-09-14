import './App.css'
import SovCampaignsTable from './components/SovCampaignsTable'
import { Routes, Route, useNavigate } from 'react-router-dom'
import AuthCallback from './auth/AuthCallback'
import NavBar from './components/NavBar'
import RequireAuth from './pages/RequireAuth'
import SessionsNew from './pages/SessionsNew'
import SessionsJoin from './pages/SessionsJoin'
import SessionDashboard from './pages/SessionDashboard'
import LoginPage from './pages/LoginPage'
import { useAuth } from './auth/AuthContext'
import { useEffect } from 'react'
import { useSessions } from './sessions/SessionsContext'

function Home() {
  const { isAuthenticated } = useAuth()
  const { activeSessions, fetchActiveSessions } = useSessions()
  const nav = useNavigate()
  useEffect(() => { if (isAuthenticated) fetchActiveSessions() }, [isAuthenticated, fetchActiveSessions])
  return (
    <>
    {isAuthenticated && activeSessions.length > 0 ? (
        <div className="panel" role="region" aria-label="Active Sessions" style={{ marginBottom: 16 }}>
          <div className="panel-header"><div className="panel-title">Active Sessions</div></div>
          <div className="panel-body" style={{ overflowX: 'auto' }}>
            <div style={{ display: 'flex', gap: 12 }}>
              {activeSessions.map(s => (
                <button key={s.id} className="chip" onClick={() => nav(`/sessions/${s.id}/dashboard`)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontWeight: 600 }}>Session #{s.id}</div>
                    {s.role ? <span className={`badge ${s.role === 'coordinator' ? 'ok' : ''}`}>{s.role}</span> : null}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>{new Date(s.created_at).toLocaleString()}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
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
  return (
    <>
      <NavBar />
      <main className="container main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/sessions/new" element={<RequireAuth><SessionsNew /></RequireAuth>} />
          <Route path="/sessions/join" element={<RequireAuth><SessionsJoin /></RequireAuth>} />
          <Route path="/sessions/:id/dashboard" element={<RequireAuth><SessionDashboard /></RequireAuth>} />
          <Route path="/auth/callback" element={<AuthCallback />} />
        </Routes>
      </main>
    </>
  )
}

export default App
