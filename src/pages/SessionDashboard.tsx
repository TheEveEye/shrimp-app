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
import Icon from '../components/Icon'

type Snapshot = {
  timestamp: number
  isStale: boolean
  byId: Map<number, EnrichedCampaign>
}

export default function SessionDashboard() {
  const { id } = useParams()
  const nav = useNavigate()
  const { lobby, openLobby } = useSessions()
  const { isReady, isAuthenticated } = useAuth()

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
      if (msg?.type === 'session.forced_leave') {
        nav('/')
      }
    })
    return () => { remove() }
  }, [nav])

  const selectedIds = useMemo(() => (lobby.campaigns || []).map((c) => c.campaign_id), [lobby.campaigns])
  const [dismissed, setDismissed] = useState<Set<number>>(new Set())
  const dismiss = useCallback((id: number) => {
    setDismissed(prev => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])
  const [showCompleted, setShowCompleted] = useState(false)
  const selectedRows = useMemo(() => selectedIds.map((id) => snapshot.byId.get(id)), [selectedIds, snapshot])
  const completedRows = useMemo(() => selectedIds.map((id) => completedByIdRef.current.get(id)), [selectedIds, snapshot])

  const showSkeletons = useMemo(() => !connected && selectedIds.length > 0 && snapshot.byId.size === 0, [connected, selectedIds.length, snapshot.byId.size])

  const activeCards = useMemo(() => {
    const cards: ReactNode[] = []
    selectedIds.forEach((_, idx) => {
      const row = selectedRows[idx]
      if (row) {
        cards.push(
          <SovCampaignBar
            key={row.campaign_id}
            row={row}
            now={now}
            isStale={snapshot.isStale}
          />
        )
      }
    })
    return cards
  }, [selectedIds, selectedRows, now, snapshot.isStale])

  const completedCards = useMemo(() => {
    const cards: ReactNode[] = []
    selectedIds.forEach((idNum, idx) => {
      const fallback = completedRows[idx]
      if (fallback && !dismissed.has(idNum)) {
        const defPct = fallback.defender_score != null ? Math.round(fallback.defender_score * 100) : (fallback.def_pct ?? null)
        let status: 'defense' | 'offense' | 'unknown'
        if (defPct == null) status = 'unknown'
        else status = defPct >= 60 ? 'defense' : 'offense'
        cards.push(
          <SovCampaignBar
            key={`completed-${idNum}`}
            row={fallback}
            now={now}
            isStale={snapshot.isStale}
            completedStatus={status}
            onClose={() => dismiss(idNum)}
          />
        )
      }
    })
    return cards
  }, [selectedIds, completedRows, dismissed, now, snapshot.isStale, dismiss])

  const hasCompleted = completedCards.length > 0

  useEffect(() => {
    if (!hasCompleted) setShowCompleted(false)
  }, [hasCompleted])

  const showCampaignSection = showSkeletons || activeCards.length > 0 || (showCompleted && completedCards.length > 0)

  const sessionLabel = lobby.slug || (lobby.sessionId ? `#${lobby.sessionId}` : 'Session');

  return (
    <div className="dashboard">
      <div className="dashboard-heading">
        <h1 className="dashboard-title">Session {sessionLabel}</h1>
        {hasCompleted && !showCompleted ? (
          <button
            type="button"
            className="icon-btn"
            aria-label="Show completed campaigns"
            onClick={() => setShowCompleted(true)}
          >
            <Icon name="ellipsis" size={16} alt="" />
          </button>
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
            {activeCards}
            {showCompleted && completedCards.length > 0 ? (
              <>
                <div className="camp-collapse-wrapper" key="collapse-toggle">
                  <button
                    type="button"
                    className="icon-btn camp-collapse-btn"
                    aria-label="Hide completed campaigns"
                    onClick={() => setShowCompleted(false)}
                  >
                    <Icon name="chevronCompactUp" size={16} alt="" />
                  </button>
                </div>
                {completedCards}
              </>
            ) : null}
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
    </div>
  )
}
