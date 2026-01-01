import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSessions } from '../sessions/SessionsContext'
import { wsClient } from '../lib/ws'
import SovCampaignBar from '../components/SovCampaignBar'
import MembersSidebar from '../components/MembersSidebar'
import type { EnrichedCampaign } from '../components/SovCampaignsTable'
import { useAuth } from '../auth/AuthContext'
import ToastersPanel from '../components/ToastersPanel'
import Panel from '../components/ui/Panel'
import IconButton from '../components/ui/IconButton'
import ConfirmModal from '../components/ConfirmModal'
import { useToast } from '../components/ToastProvider'
import SessionCampaignsModal from '../components/SessionCampaignsModal'
import { API_BASE_URL } from '../lib/api'

type Snapshot = {
  timestamp: number
  isStale: boolean
  byId: Map<number, EnrichedCampaign>
}

type SessionEvent = {
  id: number
  event_type: string
  actor_character_id?: number | null
  actor_name?: string | null
  campaign_id?: number | null
  created_at: number
  payload?: any
}

export default function SessionDashboard() {
  const { id } = useParams()
  const nav = useNavigate()
  const { lobby, openLobby, endSession, leaveSession, fetchActiveSessions } = useSessions()
  const { isReady, isAuthenticated, character, accessToken } = useAuth()
  const { toast } = useToast()
  const [confirmEndOpen, setConfirmEndOpen] = useState(false)
  const [ending, setEnding] = useState(false)
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [events, setEvents] = useState<SessionEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)

  // Open the session WS (presence + metadata)
  useEffect(() => {
    const sid = Number(id)
    if (!Number.isFinite(sid)) return
    if (!isReady || !isAuthenticated) return
    let retryTimer: number | null = null
    const tryOpen = () => {
      openLobby(sid).catch((err: any) => {
        const code = err?.message || ''
        if (code === 'forbidden' || code === 'ended' || code === 'not_found') {
          nav('/')
        } else {
          // transient failure; retry shortly
          retryTimer = window.setTimeout(tryOpen, 800)
        }
      })
    }
    tryOpen()
    return () => { if (retryTimer) window.clearTimeout(retryTimer) }
  }, [id, openLobby, nav, isReady, isAuthenticated])

  // Public campaigns subscription (shared WS client)
  const [snapshot, setSnapshot] = useState<Snapshot>({ timestamp: 0, isStale: false, byId: new Map() })
  const [connected, setConnected] = useState(false)
  const [now, setNow] = useState<number>(Date.now())
  const localVersionRef = useRef<number>(0)
  const rowsByIdRef = useRef<Map<number, EnrichedCampaign>>(new Map())
  const completedByIdRef = useRef<Map<number, EnrichedCampaign>>(new Map())
  const pendingCatchupRef = useRef<boolean>(false)
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    const off = wsClient.addMessageHandler((msg) => {
      if (msg.type === 'campaigns.snapshot') {
        localVersionRef.current = msg.version
        const map = new Map<number, EnrichedCampaign>()
        for (const row of (msg.data as any[])) map.set((row as any).campaign_id, row as any)
        rowsByIdRef.current = map
        setSnapshot({ timestamp: new Date(msg.ts).getTime(), isStale: msg.isStale, byId: map })
        setConnected(true)
        pendingCatchupRef.current = false
      } else if (msg.type === 'campaigns.diff') {
        const local = localVersionRef.current
        if (msg.since !== local) {
          if (!pendingCatchupRef.current) {
            pendingCatchupRef.current = true
            wsClient.catchupCampaigns(local)
          }
          return
        }
        const byId = rowsByIdRef.current
        for (const id of msg.removed) {
          const old = byId.get(id)
          if (old) completedByIdRef.current.set(id, old)
          byId.delete(id)
        }
        for (const row of msg.added as any[]) byId.set((row as any).campaign_id, row as any)
        for (const upd of msg.updated) {
          const cur = byId.get(upd.campaign_id)
          if (cur) Object.assign(cur, upd.changes)
        }
        localVersionRef.current = msg.version
        setSnapshot({ timestamp: new Date(msg.ts).getTime(), isStale: msg.isStale, byId })
      } else if (msg.type === 'campaigns.resync') {
        pendingCatchupRef.current = false
      }
    })
    wsClient.ensure()
    wsClient.subscribe('public.campaigns', { lastVersion: localVersionRef.current })
    intervalRef.current = window.setInterval(() => setNow(Date.now()), 1000)
    return () => {
      wsClient.unsubscribe('public.campaigns')
      off()
      if (intervalRef.current) window.clearInterval(intervalRef.current)
    }
  }, [])

  // Redirect to home if I am forced to leave (e.g., kicked)
  useEffect(() => {
    const remove = wsClient.addMessageHandler((msg: any) => {
      if (msg?.type === 'session.forced_leave' || msg?.type === 'session.ended') {
        nav('/')
      }
    })
    return () => { remove() }
  }, [nav])

  useEffect(() => {
    if (!lobby.sessionId || !accessToken) {
      setEvents([])
      return
    }
    let cancelled = false
    const fetchEvents = async () => {
      if (!lobby.sessionId || !accessToken) return
      setEventsLoading(true)
      try {
        const res = await fetch(`${API_BASE_URL}/v1/sessions/${lobby.sessionId}/events?limit=200`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled) setEvents(Array.isArray(json.events) ? json.events : [])
      } catch {
        // ignore
      } finally {
        if (!cancelled) setEventsLoading(false)
      }
    }
    fetchEvents()
    const timer = window.setInterval(fetchEvents, 15000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [lobby.sessionId, accessToken])

  const selectedIds = useMemo(() => (lobby.campaigns || []).map((c) => c.campaign_id), [lobby.campaigns])
  const hasCampaigns = selectedIds.length > 0
  const startMs = useCallback((row: EnrichedCampaign) => {
    const start = Date.parse(row.start_time || '')
    if (Number.isFinite(start)) return start
    const fallback = Date.parse(row.out_time_raw || row.out_time_utc || '')
    return Number.isFinite(fallback) ? fallback : 0
  }, [])
  const [showCompleted, setShowCompleted] = useState(false)
  const storedSnapshotById = useMemo(() => {
    const map = new Map<number, EnrichedCampaign>()
    for (const entry of lobby.campaignSnapshots || []) {
      if (!entry?.campaign_id || !entry.snapshot) continue
      map.set(entry.campaign_id, entry.snapshot as EnrichedCampaign)
    }
    return map
  }, [lobby.campaignSnapshots])
  const selectedRows = useMemo(() => selectedIds.map((id) => snapshot.byId.get(id)).filter(Boolean) as EnrichedCampaign[], [selectedIds, snapshot])
  const completedRows = useMemo(() => {
    if (!connected && snapshot.byId.size === 0) return []
    return selectedIds
      .filter((id) => !snapshot.byId.has(id))
      .map((id) => completedByIdRef.current.get(id) || storedSnapshotById.get(id))
      .filter(Boolean) as EnrichedCampaign[]
  }, [selectedIds, snapshot, storedSnapshotById, connected])
  const sortedSelectedRows = useMemo(() => {
    const rows = selectedRows.slice()
    rows.sort((a, b) => startMs(a) - startMs(b))
    return rows
  }, [selectedRows, startMs])
  const sortedCompletedRows = useMemo(() => {
    const rows = completedRows.slice()
    rows.sort((a, b) => startMs(a) - startMs(b))
    return rows
  }, [completedRows, startMs])

  const showSkeletons = useMemo(() => !connected && selectedIds.length > 0 && snapshot.byId.size === 0, [connected, selectedIds.length, snapshot.byId.size])
  const modalCampaigns = useMemo(() => lobby.campaigns || [], [lobby.campaigns])
  const availableSnapshot = useMemo(() => {
    const merged = new Map(snapshot.byId)
    for (const [id, row] of storedSnapshotById.entries()) {
      if (!merged.has(id)) merged.set(id, row)
    }
    return {
      timestamp: snapshot.timestamp,
      isStale: snapshot.isStale,
      campaigns: Array.from(merged.values()),
    }
  }, [snapshot, storedSnapshotById])

  const sideById = useMemo(() => {
    const map = new Map<number, 'offense' | 'defense'>()
    for (const c of modalCampaigns) map.set(c.campaign_id, c.side)
    return map
  }, [modalCampaigns])

  const activeCards = useMemo(() => {
    const cards: ReactNode[] = []
    sortedSelectedRows.forEach((row) => {
      cards.push(
        <SovCampaignBar
          key={row.campaign_id}
          row={row}
          now={now}
          isStale={snapshot.isStale}
          side={sideById.get(row.campaign_id)}
        />
      )
    })
    return cards
  }, [sortedSelectedRows, now, snapshot.isStale, sideById])

  type CompletedStatus = 'defense' | 'offense' | 'unknown'

  const combinedCards = useMemo(() => {
    if (!showCompleted) return []
    const rows: Array<{ row: EnrichedCampaign; completedStatus?: CompletedStatus }> = []
    selectedIds.forEach((id) => {
      const active = snapshot.byId.get(id)
      if (active) {
        rows.push({ row: active })
        return
      }
      const fallback = completedByIdRef.current.get(id) || storedSnapshotById.get(id)
      if (!fallback) return
      const defPct = fallback.defender_score != null ? Math.round(fallback.defender_score * 100) : (fallback.def_pct ?? null)
      let status: CompletedStatus
      if (defPct == null) status = 'unknown'
      else status = defPct >= 60 ? 'defense' : 'offense'
      rows.push({ row: fallback, completedStatus: status })
    })
    rows.sort((a, b) => startMs(a.row) - startMs(b.row))
    return rows.map(({ row, completedStatus }) => (
      <SovCampaignBar
        key={`${completedStatus ? 'completed' : 'active'}-${row.campaign_id}`}
        row={row}
        now={now}
        isStale={snapshot.isStale}
        completedStatus={completedStatus}
        side={sideById.get(row.campaign_id)}
      />
    ))
  }, [showCompleted, selectedIds, snapshot.byId, storedSnapshotById, startMs, now, snapshot.isStale, sideById])

  const hasCompleted = sortedCompletedRows.length > 0

  useEffect(() => {
    if (!hasCompleted) setShowCompleted(false)
  }, [hasCompleted])

  const displayCards = showCompleted ? combinedCards : activeCards
  const showCampaignSection = showSkeletons || displayCards.length > 0

  const formatEventTime = (ts: number) => {
    const d = new Date(ts)
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    const ss = String(d.getSeconds()).padStart(2, '0')
    return `${hh}:${mm}:${ss}`
  }

  const formatEventLabel = (evt: SessionEvent) => {
    const map: Record<string, string> = {
      'session.created': 'Session created',
      'session.ended': 'Session ended',
      'member.joined': 'Member joined',
      'member.left': 'Member left',
      'member.kicked': 'Member kicked',
      'member.role_updated': 'Role updated',
      'codes.rotated': 'Join code rotated',
      'campaign.added': 'Campaign added',
      'campaign.started': 'Campaign started',
      'campaign.removed': 'Campaign removed',
      'campaign.side_changed': 'Campaign side changed',
      'campaign.updated': 'Campaign updated',
      'campaign.ended': 'Campaign completed',
    }
    return map[evt.event_type] || evt.event_type.replace(/[._]/g, ' ')
  }

  const formatEventDetails = (evt: SessionEvent) => {
    const details: string[] = []
    const actorLabel = evt.actor_name || (evt.actor_character_id ? `#${evt.actor_character_id}` : null)
    if (actorLabel) details.push(actorLabel)
    if (evt.payload?.role) details.push(`role ${evt.payload.role}`)
    if (evt.payload?.target_character_id) details.push(`target #${evt.payload.target_character_id}`)
    if (evt.payload?.from && evt.payload?.to) details.push(`${evt.payload.from} → ${evt.payload.to}`)
    else if (evt.payload?.side) details.push(`${evt.payload.side}`)
    const campaignLabel = evt.payload?.snapshot?.system_name || evt.payload?.campaign_id || evt.campaign_id
    if (campaignLabel) details.push(`campaign ${campaignLabel}`)
    return details
  }

  const sessionLabel = lobby.sessionId ? `#${lobby.sessionId}` : 'Session';
  const isOwner = !!character && lobby.owner_id === character.id
  const canManageCampaigns = lobby.myRole === 'coordinator' || isOwner
  const canLeave = !!lobby.sessionId && !isOwner
  const showActions = canLeave || isOwner || hasCompleted || canManageCampaigns

  return (
    <div className={`dashboard-shell${leftCollapsed ? ' left-collapsed' : ''}`}>
      <aside className={`session-left-sidebar ${leftCollapsed ? 'collapsed' : 'expanded'}`} aria-label="Session sidebar">
        <div className="sidebar-header">
          <IconButton
            icon="sidebarLeft"
            iconKind="mask"
            iconClassName="collapse-glyph"
            aria-pressed={leftCollapsed}
            aria-label={leftCollapsed ? 'Expand session sidebar' : 'Collapse session sidebar'}
            onClick={() => setLeftCollapsed((v) => !v)}
          />
          <div className="sidebar-title">Session Events</div>
        </div>
        <div className="sidebar-body">
          <div className="session-events" aria-live="polite">
            {eventsLoading && events.length === 0 ? (
              <div className="muted">Loading events…</div>
            ) : null}
            {!eventsLoading && events.length === 0 ? (
              <div className="muted">No events yet.</div>
            ) : null}
            {events.length > 0 ? (
              <ul className="event-items">
                {events.map((evt) => {
                  const details = formatEventDetails(evt)
                  return (
                    <li key={evt.id} className="event-item">
                      <div className="event-title">{formatEventLabel(evt)}</div>
                      <div className="event-meta">
                        <span className="mono">{formatEventTime(evt.created_at)}</span>
                        {details.map((detail) => (
                          <span key={`${evt.id}-${detail}`} className="event-detail">{detail}</span>
                        ))}
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </div>
        </div>
      </aside>
      <div className="dashboard">
      <div className="dashboard-heading">
        <h1 className="dashboard-title">Session {sessionLabel}</h1>
        {showActions ? (
          <div className="dashboard-actions">
            <button
              type="button"
              className="button"
              aria-pressed={showCompleted}
              disabled={!hasCampaigns}
              title={!hasCampaigns ? 'No campaigns in this session' : (!hasCompleted ? 'No completed campaigns yet' : undefined)}
              onClick={() => setShowCompleted((prev) => !prev)}
            >
              {showCompleted ? 'Hide completed' : 'Show completed'}
            </button>
            {canManageCampaigns ? (
              <button type="button" className="button" onClick={() => setManageOpen(true)}>
                Manage campaigns
              </button>
            ) : null}
            {isOwner ? (
              <button type="button" className="button danger" onClick={() => setConfirmEndOpen(true)}>
                End session
              </button>
            ) : null}
            {canLeave ? (
              <button type="button" className="button" onClick={() => setConfirmLeaveOpen(true)}>
                Leave session
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
        {/* CampaignBars section */}
        {showCampaignSection ? (
          <div className="camp-list">
            {showSkeletons ? (
              Array.from({ length: Math.min(selectedIds.length || 1, 3) }).map((_, i) => (
                <div key={`sk-${i}`} className="camp-card skeleton" aria-hidden="true" style={{ height: 56 }} />
              ))
            ) : null}
            {displayCards}
          </div>
        ) : null}

        {/* Placeholders for future sections */}
      <Panel title="Active Nodes" style={{ marginTop: 16 }} bodyStyle={{ padding: 20 }}>
        <div className="muted">Coming soon</div>
      </Panel>
      <Panel title="Event Feed" style={{ marginTop: 16 }} bodyStyle={{ padding: 20 }}>
        <div className="muted">Coming soon</div>
      </Panel>
      {/* Toasters section */}
      {id ? (
        <ToastersPanel sessionId={Number(id)} />
      ) : null}
      <MembersSidebar />
      <ConfirmModal
        open={confirmEndOpen}
        title="End this session?"
        message="This ends the session for everyone and removes it from active lists. This can't be undone."
        confirmText={ending ? 'Ending...' : 'End session'}
        cancelText="Cancel"
        variant="danger"
        onCancel={() => { if (!ending) setConfirmEndOpen(false) }}
        onConfirm={async () => {
          if (ending) return
          setEnding(true)
          try {
            await endSession()
            await fetchActiveSessions()
            setConfirmEndOpen(false)
            nav('/')
          } catch (err: any) {
            const code = err?.message || ''
            if (code === 'forbidden') toast('Only the host can end this session.', 'error')
            else toast('Failed to end session.', 'error')
          } finally {
            setEnding(false)
          }
        }}
      />
      <ConfirmModal
        open={confirmLeaveOpen}
        title="Leave this session?"
        message="You'll be removed from the session and returned to home."
        confirmText={leaving ? 'Leaving...' : 'Leave session'}
        cancelText="Stay"
        onCancel={() => { if (!leaving) setConfirmLeaveOpen(false) }}
        onConfirm={async () => {
          if (leaving) return
          setLeaving(true)
          try {
            await leaveSession()
            await fetchActiveSessions()
            setConfirmLeaveOpen(false)
            nav('/')
          } catch (err: any) {
            const code = err?.message || ''
            if (code === 'owner_must_end') toast('Hosts must end the session instead.', 'error')
            else if (code === 'forbidden') toast("You can't leave this session.", 'error')
            else toast('Failed to leave session.', 'error')
          } finally {
            setLeaving(false)
          }
        }}
      />
      {lobby.sessionId ? (
        <SessionCampaignsModal
          open={manageOpen}
          onClose={() => setManageOpen(false)}
          sessionId={lobby.sessionId}
          campaigns={modalCampaigns}
          snapshot={availableSnapshot}
          connected={connected}
        />
      ) : null}
      </div>
    </div>
  )
}
