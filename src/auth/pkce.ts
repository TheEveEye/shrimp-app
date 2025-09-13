// PKCE utilities for EVE SSO (public client)
// Security notes:
// - Public client using PKCE. No client secret embedded.
// - Tokens should be moved to secure HTTP-only cookies when migrating to a backend.

function base64UrlEncode(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data)
  let str = ''
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i])
  return btoa(str).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

export function randomString(length = 64): string {
  const arr = new Uint8Array(length)
  crypto.getRandomValues(arr)
  const chars = Array.from(arr, b => b % 62)
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return chars.map(i => alphabet[i]).join('')
}

export async function sha256Base64Url(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(digest)
}

export async function createPkcePair() {
  // RFC 7636: code_verifier length 43–128 chars
  const code_verifier = randomString(64)
  const code_challenge = await sha256Base64Url(code_verifier)
  return { code_verifier, code_challenge }
}

