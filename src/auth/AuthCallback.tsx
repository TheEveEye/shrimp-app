import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { clearPkce, persistTokens, popPkceState } from './AuthContext'
import { API_BASE_URL } from '../lib/api'

type TokenResponse = {
  access_token: string
  expires_in: number
  id_token?: string
}

export default function AuthCallback() {
  const [search] = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      const code = search.get('code') || ''
      const state = search.get('state') || ''
      const err = search.get('error')
      const errDesc = search.get('error_description')
      if (err) {
        setError(errDesc || err || 'Login error from provider')
        clearPkce()
        return
      }

      // Link flow: if state begins with "link:", this callback is for popup character linking.
      // Hand off to server which holds PKCE verifier and stores refresh tokens server-side.
      if (state.startsWith('link:')) {
        const url = new URL(`${API_BASE_URL}/api/auth/link/callback`)
        if (code) url.searchParams.set('code', code)
        url.searchParams.set('state', state)
        window.location.replace(url.toString())
        return
      }

      const { verifier, state: expectedState } = popPkceState()
      if (!code || !verifier || !state || !expectedState || state !== expectedState) {
        setError('Invalid or missing state. Please try logging in again.')
        clearPkce()
        return
      }

      try {
        const REDIRECT_URI = import.meta.env.VITE_EVE_REDIRECT_URI
        const res = await fetch(`${API_BASE_URL}/api/auth/exchange`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({ code, code_verifier: verifier, redirect_uri: REDIRECT_URI }),
          credentials: 'include',
        })

        const contentType = res.headers.get('content-type') || ''
        const tryParseJson = async () => {
          try { return contentType.includes('application/json') ? await res.json() : JSON.parse(await res.text()) } catch { return null }
        }

        if (!res.ok) {
          const payload = await tryParseJson()
          const message = payload?.error_description || payload?.error || `Token exchange failed (${res.status})`
          if (import.meta.env.DEV) console.error('EVE SSO token error:', payload || message)
          throw new Error(message)
        }

        const json = (await tryParseJson()) as TokenResponse | null
        if (!json || !json.access_token || !json.expires_in) {
          const message = 'Token response incomplete: missing access_token or expires_in'
          if (import.meta.env.DEV) console.error('EVE SSO token response:', json)
          throw new Error(message)
        }
        if (import.meta.env.DEV) console.log('Auth exchange response:', json)

        // Store tokens (sessionStorage) and redirect. id_token may be absent if 'openid' was not included.
        persistTokens(json.access_token, json.id_token, json.expires_in)
        clearPkce()
        // Full reload to let AuthProvider bootstrap from sessionStorage
        const returnTo = sessionStorage.getItem('shrimp.returnTo') || '/'
        sessionStorage.removeItem('shrimp.returnTo')
        window.location.replace(returnTo)
      } catch (e: any) {
        setError(e?.message || 'Token exchange failed')
        // Keep PKCE cleared to force a fresh login
        clearPkce()
      }
    }
    run()
  }, [search])

  return (
    <div style={{ padding: 12 }}>
      {!error ? (
        <p>Completing sign-in…</p>
      ) : (
        <div>
          <p style={{ color: 'var(--danger, #b00020)' }}>Sign-in failed: {error}</p>
          <a href="/">Return to home</a>
        </div>
      )}
    </div>
  )
}
