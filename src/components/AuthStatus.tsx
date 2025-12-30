// React import not required with the automatic JSX transform
import { useEffect, useRef, useState } from 'react'
import { useTheme } from '../theme/ThemeProvider'
import { useAuth } from '../auth/AuthContext'
import Icon from './Icon'
import Popover from './Popover'
import ManageCharactersModal from './ManageCharactersModal'

export default function AuthStatus() {
  const { effective } = useTheme()
  const { isAuthenticated, character, login, logout, error, clearError } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)

  // Theme-aware SSO button asset:
  // Per request: use WHITE on dark theme, BLACK on light theme.
  const loginAsset = effective === 'light'
    ? '/eve-sso-login-white-large.png'
    : '/eve-sso-login-black-large.png'

  useEffect(() => {
    if (menuOpen && btnRef.current) setAnchor(btnRef.current.getBoundingClientRect())
  }, [menuOpen])

  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {error ? (
          <div style={{ fontSize: 12, color: 'var(--danger, #b00020)' }} role="alert">
            {error}
            <button onClick={clearError} style={{ marginLeft: 8, fontSize: 12 }}>Dismiss</button>
          </div>
        ) : null}
        <button
          onClick={login}
          style={{
            padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', lineHeight: 0,
          }}
          aria-label="Log in with EVE Online (SSO)"
        >
          <img src={loginAsset} alt="Log in with EVE Online (SSO)" style={{ height: 32, width: 'auto' }} />
        </button>
      </div>
    )
  }

  // Account display: name on left, avatar on right (avatar toggles menu)
  return (
    <div className="nav-auth-status">
      {character ? (
        <>
          <span className="nav-auth-name">
            {character.name ?? `Character #${character.id}`}
          </span>
          <button
            ref={btnRef}
            onClick={() => setMenuOpen(o => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title={character.name ? `${character.name} account menu` : 'Account menu'}
            className={`nav-avatar-btn${menuOpen ? ' open' : ''}`}
          >
            <img
              src={character.portrait}
              width={36}
              height={36}
              alt={character.name ? `${character.name} portrait` : 'Character portrait'}
              className="nav-avatar"
            />
          </button>
        </>
      ) : null}
      <Popover open={menuOpen} anchorRect={anchor || undefined} onClose={() => setMenuOpen(false)} align="right" offset={10} className="account-menu-popover">
        <button role="menuitem" onClick={() => { setManageOpen(true); setMenuOpen(false) }} className="menu-item">
          <Icon name="manageCharacters" size={16} alt="" />
          <span>Manage Characters</span>
        </button>
        <button role="menuitem" onClick={logout} className="menu-item">
          <Icon name="signOut" size={16} alt="" />
          <span>Sign out</span>
        </button>
      </Popover>
      <ManageCharactersModal open={manageOpen} onClose={() => setManageOpen(false)} />
    </div>
  )
}
