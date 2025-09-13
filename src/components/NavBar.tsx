import { Link } from 'react-router-dom'
import AuthStatus from './AuthStatus'
import { useAuth } from '../auth/AuthContext'

export default function NavBar() {
  const { isAuthenticated } = useAuth()
  return (
    <nav role="navigation" aria-label="Primary" className="navbar">
      <div className="container nav-inner">
        <div className="brand-wrap">
          <Link to="/" className="brand" aria-label="SHRIMP home">
            <img src="/shrimp.svg" className="brand-logo" alt="" aria-hidden="true" />
            <span>SHRIMP</span>
          </Link>
        </div>
        {isAuthenticated ? (
          <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link to="/sessions/join" className="text-button">Join Session</Link>
            <Link to="/sessions/new" className="button">Create Session</Link>
          </div>
        ) : <span />}
        <div className="nav-auth">
          <AuthStatus />
        </div>
      </div>
    </nav>
  )
}
