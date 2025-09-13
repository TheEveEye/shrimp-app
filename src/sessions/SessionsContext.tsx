import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { wsClient } from '../lib/ws'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../components/ToastProvider'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

type Role = 'coordinator' | 'line'

type Member = { character_id: number; name?: string; role: Role; online: boolean }

type Lobby = {
  sessionId?: number
  members: Member[]
  myRole?: Role
  created_at?: number
  owner_id?: number
  campaigns?: Array<{ campaign_id: number; side: 'offense' | 'defense' }>
  coordinator_code?: string
  line_code?: string
  connected: boolean
}

type ActiveSessionTile = { id: number; created_at: number; owner_id: number; role?: Role }

type Ctx = {
  lobby: Lobby
  activeSessions: ActiveSessionTile[]
  fetchActiveSessions: () => Promise<void>
  openLobby: (id: number) => Promise<void>
  closeLobby: () => void
  createSession: (items: Array<{ campaign_id: number; side: 'offense' | 'defense' }>) => Promise<{ id: number; coordinator_code: string; line_code: string }>
  joinWithCode: (code: string) => Promise<{ id: number; role: Role }>
  rotateCode: (role: Role) => Promise<string>
  kick: (character_id: number) => Promise<void>
  endSession: () => Promise<void>
}

const SessionsContext = createContext<Ctx | undefined>(undefined)

export function SessionsProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, accessToken, character } = useAuth()
  const [lobby, setLobby] = useState<Lobby>({ members: [], connected: false })
  const [activeSessions, setActiveSessions] = useState<ActiveSessionTile[]>([])
  const topicRef = useRef<string | null>(null)
  // no-op placeholder for future cleanup
  const { toast } = useToast()

  // Wire auth token to WS when available
  useEffect(() => {
    if (accessToken) wsClient.auth(accessToken)
  }, [accessToken])

  const membersRef = useRef<Member[]>([])
  useEffect(() => { membersRef.current = lobby.members }, [lobby.members])

  // Basic message handler for session topics
  useEffect(() => {
    const off = wsClient.addMessageHandler((raw: any) => {
      if (raw?.type === 'session.snapshot') {
        setLobby((l) => ({
          ...l,
          sessionId: raw.meta?.id,
          members: raw.members || [],
          created_at: raw.meta?.created_at,
          owner_id: raw.meta?.owner_id,
          campaigns: raw.meta?.campaigns,
          connected: true,
        }))
      } else if (raw?.type === 'presence.joined') {
        setLobby((l) => ({ ...l, members: l.members.map(m => m.character_id === raw.character_id ? { ...m, online: true } : m) }))
        const u = membersRef.current.find(m => m.character_id === raw.character_id)
        if (u) toast(`${u.name || 'Member'} joined`)
        else {
          // unknown member joined; refetch snapshot
          const sid = topicRef.current ? Number.parseInt(topicRef.current.split('.')[1] || '', 10) : undefined
          if (sid && accessToken) {
            fetch(`${API_BASE}/v1/sessions/${sid}`, { headers: { Authorization: `Bearer ${accessToken}` } })
              .then(r => r.ok ? r.json() : null)
              .then(json => { if (json) setLobby((l) => ({ ...l, members: json.members || [] })) })
              .catch(() => {})
          }
        }
      } else if (raw?.type === 'presence.left') {
        setLobby((l) => ({ ...l, members: l.members.map(m => m.character_id === raw.character_id ? { ...m, online: false } : m) }))
        const u = membersRef.current.find(m => m.character_id === raw.character_id)
        if (u) toast(`${u.name || 'Member'} left`)
      } else if (raw?.type === 'codes.rotated') {
        // Informational; show to coordinators
        const me = membersRef.current.find(m => m.character_id === character?.id)
        if (me?.role === 'coordinator') toast(`Code rotated for ${raw.role}`)
      } else if (raw?.type === 'member.kicked') {
        if (character && raw.character_id === character.id) {
          // I was kicked
          // caller page should handle navigation on session.forced_leave
          toast('You were kicked from the session', 'warn')
        } else {
          const u = membersRef.current.find(m => m.character_id === raw.character_id)
          if (u) toast(`${u.name || 'Member'} was kicked`, 'warn')
          setLobby((l) => ({ ...l, members: l.members.filter(m => m.character_id !== raw.character_id) }))
        }
      } else if (raw?.type === 'session.ended') {
        toast('Session ended', 'warn')
        if (topicRef.current) wsClient.unsubscribe(topicRef.current)
        topicRef.current = null
        setLobby({ members: [], connected: false })
      } else if (raw?.type === 'session.forced_leave') {
        // Tear down subscription
        if (topicRef.current) wsClient.unsubscribe(topicRef.current)
        topicRef.current = null
        setLobby({ members: [], connected: false })
        toast('You left the previous session', 'info')
      }
    })
    return () => { off() }
  }, [character])

  const fetchActiveSessions = useCallback(async () => {
    if (!isAuthenticated || !accessToken) return setActiveSessions([])
    const res = await fetch(`${API_BASE}/v1/me/sessions?status=active`, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!res.ok) return setActiveSessions([])
    const json = await res.json()
    const rows = (json.sessions || []) as Array<{ id: number; created_at: number; owner_id: number }>
    // We don't know role from this endpoint; fetch later via lobby open
    setActiveSessions(rows)
  }, [isAuthenticated, accessToken])

  const openLobby = useCallback(async (id: number) => {
    if (!isAuthenticated || !accessToken) throw new Error('unauthenticated')
    // Fetch snapshot first
    const res = await fetch(`${API_BASE}/v1/sessions/${id}`, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (res.status === 410) throw new Error('ended')
    if (res.status === 403) throw new Error('forbidden')
    if (!res.ok) throw new Error('failed')
    const json = await res.json()
    setLobby((l) => ({ ...l, sessionId: id, members: json.members || [], created_at: json.session?.created_at, owner_id: json.session?.owner_id, campaigns: json.session?.campaigns }))
    // Subscribe WS
    const topic = `session.${id}`
    topicRef.current = topic
    wsClient.subscribe(topic)
  }, [isAuthenticated, accessToken])

  const closeLobby = useCallback(() => {
    if (topicRef.current) wsClient.unsubscribe(topicRef.current)
    topicRef.current = null
    setLobby({ members: [], connected: false })
  }, [])

  const createSession = useCallback(async (items: Array<{ campaign_id: number; side: 'offense' | 'defense' }>) => {
    if (!accessToken) throw new Error('unauthenticated')
    const res = await fetch(`${API_BASE}/v1/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ campaigns: items }),
    })
    if (!res.ok) throw new Error('create_failed')
    const json = await res.json()
    setLobby((l) => ({ ...l, sessionId: json.session?.id, created_at: json.session?.created_at, owner_id: json.session?.owner_id, campaigns: json.session?.campaigns, coordinator_code: json.coordinator_code, line_code: json.line_code }))
    return { id: json.session.id as number, coordinator_code: json.coordinator_code as string, line_code: json.line_code as string }
  }, [accessToken])

  const joinWithCode = useCallback(async (code: string) => {
    if (!accessToken) throw new Error('unauthenticated')
    // Parse id from code: expect "<id>-XXXX"
    const m = code.trim().match(/^(\d+)-/)
    let id: number | null = m ? Number.parseInt(m[1], 10) : null
    let res: Response
    if (id) {
      res = await fetch(`${API_BASE}/v1/sessions/${id}/join`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ code })
      })
    } else {
      res = await fetch(`${API_BASE}/v1/sessions/join`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ code })
      })
    }
    if (res.status === 400) throw new Error('invalid')
    if (res.status === 410) throw new Error('ended')
    if (res.status === 403) throw new Error('forbidden')
    if (!res.ok) throw new Error('failed')
    const json = await res.json()
    id = json.session?.id
    const role: Role = json.role
    setLobby((l) => ({ ...l, sessionId: id || undefined }))
    return { id: id!, role }
  }, [accessToken])

  const rotateCode = useCallback(async (role: Role) => {
    if (!accessToken || !lobby.sessionId) throw new Error('unauthenticated')
    const res = await fetch(`${API_BASE}/v1/sessions/${lobby.sessionId}/codes/rotate`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ role }) })
    if (res.status === 403) throw new Error('forbidden')
    if (res.status === 410) throw new Error('ended')
    if (!res.ok) throw new Error('failed')
    const json = await res.json()
    setLobby((l) => ({ ...l, coordinator_code: role === 'coordinator' ? json.code : l.coordinator_code, line_code: role === 'line' ? json.code : l.line_code }))
    return json.code as string
  }, [accessToken, lobby.sessionId])

  const kick = useCallback(async (character_id: number) => {
    if (!accessToken || !lobby.sessionId) throw new Error('unauthenticated')
    const res = await fetch(`${API_BASE}/v1/sessions/${lobby.sessionId}/kick`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ character_id }) })
    if (res.status === 403) throw new Error('forbidden')
    if (!res.ok) throw new Error('failed')
  }, [accessToken, lobby.sessionId])

  const endSession = useCallback(async () => {
    if (!accessToken || !lobby.sessionId) throw new Error('unauthenticated')
    const res = await fetch(`${API_BASE}/v1/sessions/${lobby.sessionId}/end`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } })
    if (res.status === 403) throw new Error('forbidden')
    if (!res.ok) throw new Error('failed')
  }, [accessToken, lobby.sessionId])

  const value = useMemo<Ctx>(() => ({
    lobby,
    activeSessions,
    fetchActiveSessions,
    openLobby,
    closeLobby,
    createSession,
    joinWithCode,
    rotateCode,
    kick,
    endSession,
  }), [lobby, activeSessions, fetchActiveSessions, openLobby, closeLobby, createSession, joinWithCode, rotateCode, kick, endSession])

  return (
    <SessionsContext.Provider value={value}>{children}</SessionsContext.Provider>
  )
}

export function useSessions() {
  const ctx = useContext(SessionsContext)
  if (!ctx) throw new Error('useSessions must be used within SessionsProvider')
  return ctx
}
