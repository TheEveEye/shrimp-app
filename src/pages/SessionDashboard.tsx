import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSessions } from '../sessions/SessionsContext'
import { wsClient } from '../lib/ws'
import SovCampaignBar from '../components/SovCampaignBar'
import type { EnrichedCampaign } from '../components/SovCampaignsTable'

type Snapshot = {
  timestamp: number
  isStale: boolean
  byId: Map<number, EnrichedCampaign>
}

export default function SessionDashboard() {
  const { id } = useParams()
  const nav = useNavigate()
  const { lobby, openLobby } = useSessions()

  // Open the session WS (presence + metadata)
  useEffect(() => {
    const sid = Number(id)
    if (!Number.isFinite(sid)) return
    openLobby(sid).catch(() => {
      const t = setTimeout(() => nav('/'), 300)
      return () => clearTimeout(t)
    })
  }, [id, openLobby, nav])

  // Public campaigns subscription (shared WS client)
  const [snapshot, setSnapshot] = useState<Snapshot>({ timestamp: 0, isStale: false, byId: new Map() })
  const [connected, setConnected] = useState(false)
  const [now, setNow] = useState<number>(Date.now())
  const localVersionRef = useRef<number>(0)
  const rowsByIdRef = useRef<Map<number, EnrichedCampaign>>(new Map())
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
        for (const id of msg.removed) byId.delete(id)
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

  const selectedIds = useMemo(() => (lobby.campaigns || []).map((c) => c.campaign_id), [lobby.campaigns])
  const selectedRows = useMemo(() => selectedIds.map((id) => snapshot.byId.get(id)), [selectedIds, snapshot])

  return (
    <div className="dashboard">
      {/* CampaignBars section */}
      {selectedIds.length > 0 ? (
          // <div className="panel-body" style={{ padding: 12 }}>
            <div className="camp-list">
              {/* Skeletons while waiting for first snapshot */}
              {(!connected && selectedIds.length > 0 && snapshot.byId.size === 0) ? (
                Array.from({ length: Math.min(selectedIds.length, 3) }).map((_, i) => (
                  <div key={`sk-${i}`} className="camp-card skeleton" aria-hidden="true" style={{ height: 56 }} />
                ))
              ) : null}
              {selectedRows.map((row, i) => (
                row ? (
                  <SovCampaignBar key={row.campaign_id} row={row} now={now} isStale={snapshot.isStale} />
                ) : (
                  <div key={`missing-${selectedIds[i]}`} className="camp-card skeleton" aria-hidden="true" style={{ height: 56 }} />
                )
              ))}
            </div>
          // </div>
      ) : null}

      {/* Placeholders for future sections */}
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header"><div className="panel-title">Active Nodes</div></div>
        <div className="panel-body" style={{ padding: 20 }}>
          <div className="muted">Coming soon</div>
        </div>
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header"><div className="panel-title">Members</div></div>
        <div className="panel-body" style={{ padding: 20 }}>
          <div className="muted">Coming soon</div>
        </div>
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header"><div className="panel-title">Event Feed</div></div>
        <div className="panel-body" style={{ padding: 20 }}>
          <div className="muted">Coming soon</div>
        </div>
      </div>
    </div>
  )
}

