import { Link } from 'react-router-dom'
import AuthStatus from './AuthStatus'

export default function NavBar() {
  return (
    <nav role="navigation" aria-label="Primary" className="navbar">
      <div className="container nav-inner">
        <div className="brand-wrap">
          <Link to="/" className="brand" aria-label="SHRIMP home">
            <img src="/shrimp.svg" className="brand-logo" alt="" aria-hidden="true" />
            <span>SHRIMP</span>
          </Link>
        </div>
        <div className="nav-auth">
          <AuthStatus />
        </div>
      </div>
    </nav>
  )
}
