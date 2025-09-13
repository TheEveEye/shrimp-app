// React import not required with the automatic JSX transform
import { useEffect, useRef, useState } from 'react'
import { useTheme } from '../theme/ThemeProvider'
import { useAuth } from '../auth/AuthContext'
import Icon from './Icon'

export default function AuthStatus() {
  const { effective } = useTheme()
  const { isAuthenticated, character, login, logout, error, clearError } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const btnRef = useRef<HTMLButtonElement | null>(null)

  // Theme-aware SSO button asset:
  // Per request: use WHITE on dark theme, BLACK on light theme.
  const loginAsset = effective === 'light'
    ? '/eve-sso-login-white-large.png'
    : '/eve-sso-login-black-large.png'

  useEffect(() => {
    function handleDocClick(e: MouseEvent) {
      if (!menuOpen) return
      const t = e.target as Node
      if (menuRef.current && !menuRef.current.contains(t) && btnRef.current && !btnRef.current.contains(t)) {
        setMenuOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', handleDocClick)
      document.removeEventListener('keydown', onKey)
    }
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
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
      {character ? (
        <>
          <span style={{ fontSize: 14, fontWeight: 500 }}>
            {character.name ?? `Character #${character.id}`}
          </span>
          <button
            ref={btnRef}
            onClick={() => setMenuOpen(o => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title={character.name ? `${character.name} account menu` : 'Account menu'}
            style={{ padding: 0, margin: 0, border: 'none', background: 'transparent', cursor: 'pointer', lineHeight: 0 }}
          >
            <img
              src={character.portrait}
              width={36}
              height={36}
              alt={character.name ? `${character.name} portrait` : 'Character portrait'}
              style={{ borderRadius: '50%' }}
            />
          </button>
        </>
      ) : null}
      {menuOpen ? (
        <div ref={menuRef} role="menu" style={{ position: 'absolute', right: 0, top: 'calc(100% + 10px)', zIndex: 1000 }}>
          <button
            role="menuitem"
            onClick={logout}
            className="signout-btn"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: 10,
              background: 'var(--panel)', border: 'none', color: 'inherit', cursor: 'pointer',
              boxShadow: 'var(--shadow-panel)'
            }}
          >
            <Icon name="signOut" size={16} alt="" />
            <span>Sign out</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}
