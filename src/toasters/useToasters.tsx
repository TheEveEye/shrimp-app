import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { wsClient } from '../lib/ws'

export type Toaster = {
  character_id: number
  name?: string | null
  portrait_url?: string | null
  alliance_id?: number | null
  alliance_icon_url?: string | null
  owner_user: { id: number; display_name?: string | null }
  entosis_tier: 't1' | 't2'
  ship_type_id?: number | null
  ship_type_name?: string | null
  online?: boolean
  last_seen_at?: number
}

export function useToasters(sessionId: number) {
  const { accessToken } = useAuth()
  const [items, setItems] = useState<Toaster[]>([])
  const [loading, setLoading] = useState(false)
  const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

  const fetchAll = useCallback(async () => {
    if (!sessionId) return
    setLoading(true)
    try {
      const headers: Record<string, string> = {}
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
      const res = await fetch(`${API_BASE}/v1/sessions/${sessionId}/toasters`, { credentials: 'include', headers })
      if (!res.ok) { setItems([]); return }
      const json = await res.json()
      const rows = (json.toasters || []) as Toaster[]
      setItems(rows)
    } finally {
      setLoading(false)
    }
  }, [sessionId, API_BASE, accessToken])

  // WS integration
  useEffect(() => {
    const off = wsClient.addMessageHandler((msg) => {
      if ((msg as any).topic !== `session.${sessionId}`) return
      if (msg.type === 'toaster.attached') {
        const t = (msg as any).toaster as Toaster
        setItems((prev) => {
          if (prev.find((x) => x.character_id === t.character_id)) return prev
          return [...prev, t]
        })
      } else if (msg.type === 'toaster.detached') {
        const cid = (msg as any).character_id as number
        setItems((prev) => prev.filter((x) => x.character_id !== cid))
      } else if (msg.type === 'toaster.location_updated') {
        const { character_id, ship_type_id, ship_type_name, online, last_seen_at } = msg as any
        setItems((prev) => prev.map((x) => x.character_id === character_id ? ({ ...x, ship_type_id, ship_type_name, online, last_seen_at }) : x))
      } else if (msg.type === 'toaster.updated') {
        const { character_id, entosis_tier } = msg as any
        setItems((prev) => prev.map((x) => x.character_id === character_id ? ({ ...x, entosis_tier }) : x))
      }
    })
    return () => { off() }
  }, [sessionId])

  const attach = useCallback(async (character_id: number, entosis_tier: 't1'|'t2') => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
    const res = await fetch(`${API_BASE}/v1/sessions/${sessionId}/toasters`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ character_id, entosis_tier }),
      credentials: 'include',
    })
    if (res.status === 409) throw Object.assign(new Error('duplicate'), { code: 409 })
    if (!res.ok) throw new Error('failed')
    const json = await res.json()
    const t = (json.toaster || (json as any).toaster) as Toaster | undefined
    if (t) setItems((prev) => prev.find((x) => x.character_id === t.character_id) ? prev : [...prev, t])
  }, [API_BASE, sessionId, accessToken])

  const detach = useCallback(async (character_id: number) => {
    const headers: Record<string, string> = {}
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
    const res = await fetch(`${API_BASE}/v1/sessions/${sessionId}/toasters/${character_id}`, { method: 'DELETE', credentials: 'include', headers })
    if (!res.ok) throw new Error('failed')
    setItems((prev) => prev.filter((x) => x.character_id !== character_id))
  }, [API_BASE, sessionId, accessToken])

  const updateTier = useCallback(async (character_id: number, entosis_tier: 't1' | 't2') => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
    const res = await fetch(`${API_BASE}/v1/sessions/${sessionId}/toasters/${character_id}`, {
      method: 'PATCH', headers, credentials: 'include', body: JSON.stringify({ entosis_tier })
    })
    if (!res.ok) throw new Error('failed')
    const json = await res.json()
    const t = (json.toaster || (json as any).toaster) as Toaster | undefined
    if (t) setItems((prev) => prev.map((x) => x.character_id === character_id ? ({ ...x, entosis_tier: t.entosis_tier }) : x))
  }, [API_BASE, sessionId, accessToken])

  const sorted = useMemo(() => {
    const arr = [...items]
    arr.sort((a, b) => {
      const aOn = a.online ? 1 : 0
      const bOn = b.online ? 1 : 0
      if (aOn !== bOn) return bOn - aOn
      return (a.name || '').localeCompare(b.name || '')
    })
    return arr
  }, [items])

  return { items: sorted, raw: items, setItems, loading, fetchAll, attach, detach, updateTier }
}
