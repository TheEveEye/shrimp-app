import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPkcePair } from './pkce'

type Character = {
  id: number
  name?: string
  portrait: string
}

type AuthContextType = {
  isAuthenticated: boolean
  accessToken?: string
  idToken?: string
  expiresAt?: number
  character?: Character
  error?: string | null
  clearError: () => void
  login: () => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const SS_PREFIX = 'shrimp.auth'
const SS_KEYS = {
  pkceVerifier: `${SS_PREFIX}.pkce.code_verifier`,
  pkceState: `${SS_PREFIX}.pkce.state`,
  tokens: `${SS_PREFIX}.tokens`,
}

type StoredTokens = {
  access_token: string
  id_token?: string
  expires_at: number
}

function decodeJwtPayload(jwt: string): any | null {
  try {
    const payload = jwt.split('.')[1]
    const pad = payload.length % 4 === 0 ? '' : '='.repeat(4 - (payload.length % 4))
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/') + pad)
    return JSON.parse(json)
  } catch {
    return null
  }
}

function characterFromTokens(idToken?: string, accessToken?: string): Character | undefined {
  const tryClaims = (jwt?: string) => (jwt ? decodeJwtPayload(jwt) : null)
  let claims = tryClaims(idToken)
  if (!claims) claims = tryClaims(accessToken)
  if (!claims || typeof claims.sub !== 'string') return undefined
  const sub: string = claims.sub
  const parts = sub.split(':')
  const idStr = parts[parts.length - 1]
  const id = Number.parseInt(idStr, 10)
  if (!Number.isFinite(id)) return undefined
  const name = typeof claims.name === 'string' ? claims.name : undefined
  const portrait = `https://images.evetech.net/characters/${id}/portrait?size=64`
  return { id, name, portrait }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | undefined>()
  const [idToken, setIdToken] = useState<string | undefined>()
  const [expiresAt, setExpiresAt] = useState<number | undefined>()
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)

  const character = useMemo(() => characterFromTokens(idToken, accessToken), [idToken, accessToken])
  const isAuthenticated = !!accessToken && !!expiresAt && Date.now() < expiresAt

  const clearSession = useCallback(() => {
    setAccessToken(undefined)
    setIdToken(undefined)
    setExpiresAt(undefined)
    sessionStorage.removeItem(SS_KEYS.tokens)
    sessionStorage.removeItem(SS_KEYS.pkceVerifier)
    sessionStorage.removeItem(SS_KEYS.pkceState)
  }, [])

  const scheduleExpiryWatcher = useCallback((expiry: number) => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    const ms = Math.max(0, expiry - Date.now())
    timerRef.current = window.setTimeout(() => {
      // Token expired; clear and surface a friendly message.
      clearSession()
      setError('Your session expired. Please log in again.')
    }, ms)
  }, [clearSession])

  // Bootstrap from sessionStorage on mount
  useEffect(() => {
    const raw = sessionStorage.getItem(SS_KEYS.tokens)
    if (!raw) return
    try {
      const stored = JSON.parse(raw) as StoredTokens
      if (stored && stored.access_token && stored.expires_at && Date.now() < stored.expires_at) {
        setAccessToken(stored.access_token)
        setIdToken(stored.id_token)
        setExpiresAt(stored.expires_at)
        scheduleExpiryWatcher(stored.expires_at)
      } else {
        // Expired or invalid
        clearSession()
      }
    } catch {
      clearSession()
    }
  }, [clearSession, scheduleExpiryWatcher])

  const login = useCallback(async () => {
    const ISSUER = import.meta.env.VITE_EVE_SSO_ISSUER || 'https://login.eveonline.com/v2'
    const CLIENT_ID = import.meta.env.VITE_EVE_CLIENT_ID
    const REDIRECT_URI = import.meta.env.VITE_EVE_REDIRECT_URI
    const SCOPES = import.meta.env.VITE_EVE_SCOPES || ''


    if (!CLIENT_ID || !REDIRECT_URI) {
      setError('EVE SSO is not configured. Please set VITE_EVE_CLIENT_ID and VITE_EVE_REDIRECT_URI in .env.')
      return
    }

    const { code_verifier, code_challenge } = await createPkcePair()
    const state = crypto.randomUUID()
    sessionStorage.setItem(SS_KEYS.pkceVerifier, code_verifier)
    sessionStorage.setItem(SS_KEYS.pkceState, state)

    const authUrl = new URL(`${ISSUER}/oauth/authorize`)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', CLIENT_ID)
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
    if (SCOPES) authUrl.searchParams.set('scope', SCOPES)
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('code_challenge', code_challenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')

    window.location.assign(authUrl.toString())
  }, [])

  const logout = useCallback(() => {
    clearSession()
    // Redirect back to landing page
    window.location.assign('/')
  }, [clearSession])

  const clearError = useCallback(() => setError(null), [])

  const value = useMemo<AuthContextType>(() => ({
    isAuthenticated,
    accessToken,
    idToken,
    expiresAt,
    character,
    error,
    clearError,
    login,
    logout,
  }), [isAuthenticated, accessToken, idToken, expiresAt, character, error, clearError, login, logout])

  // Keep expiry watcher in sync when tokens change
  useEffect(() => {
    if (expiresAt) scheduleExpiryWatcher(expiresAt)
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current) }
  }, [expiresAt, scheduleExpiryWatcher])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

// Utility used by callback component to store tokens
export function persistTokens(access_token: string, id_token: string | undefined, expires_in: number) {
  const expires_at = Date.now() + Math.max(0, expires_in) * 1000
  const payload: StoredTokens = { access_token, expires_at }
  if (id_token) (payload as any).id_token = id_token
  sessionStorage.setItem(SS_KEYS.tokens, JSON.stringify(payload))
}

export function popPkceState(): { verifier?: string, state?: string } {
  const verifier = sessionStorage.getItem(SS_KEYS.pkceVerifier) || undefined
  const state = sessionStorage.getItem(SS_KEYS.pkceState) || undefined
  // Keep until we successfully exchange or invalidate
  return { verifier, state }
}

export function clearPkce() {
  sessionStorage.removeItem(SS_KEYS.pkceVerifier)
  sessionStorage.removeItem(SS_KEYS.pkceState)
}
