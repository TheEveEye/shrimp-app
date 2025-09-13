import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { clearPkce, persistTokens, popPkceState } from './AuthContext'

type TokenResponse = {
  access_token: string
  token_type: string
  expires_in: number
  id_token?: string
  refresh_token?: string
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

      const { verifier, state: expectedState } = popPkceState()
      if (!code || !verifier || !state || !expectedState || state !== expectedState) {
        setError('Invalid or missing state. Please try logging in again.')
        clearPkce()
        return
      }

      const ISSUER = import.meta.env.VITE_EVE_SSO_ISSUER || 'https://login.eveonline.com/v2'
      const CLIENT_ID = import.meta.env.VITE_EVE_CLIENT_ID
      if (!CLIENT_ID) {
        setError('EVE SSO is not configured. Missing client id.')
        clearPkce()
        return
      }

      try {
        const body = new URLSearchParams()
        body.set('grant_type', 'authorization_code')
        body.set('client_id', CLIENT_ID)
        body.set('code', code)
        body.set('code_verifier', verifier)
        const REDIRECT_URI = import.meta.env.VITE_EVE_REDIRECT_URI
        if (REDIRECT_URI) body.set('redirect_uri', REDIRECT_URI)

        const res = await fetch(`${ISSUER}/oauth/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          },
          body: body.toString(),
          // Note: Assuming CORS is permitted. If blocked, add a minimal server proxy later.
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
        if (import.meta.env.DEV) console.log('EVE SSO token response:', json)

        // Store tokens (sessionStorage) and redirect. id_token may be absent if 'openid' was not included.
        persistTokens(json.access_token, json.id_token, json.expires_in)
        clearPkce()
        // Full reload to let AuthProvider bootstrap from sessionStorage
        window.location.replace('/')
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
