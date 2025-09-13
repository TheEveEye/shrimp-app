import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSessions } from '../sessions/SessionsContext'
import { useAuth } from '../auth/AuthContext'

function RoleBadge({ role }: { role: 'coordinator' | 'line' }) {
  return <span className={`badge ${role === 'coordinator' ? 'ok' : ''}`}>{role}</span>
}

export default function SessionLobby() {
  const { id } = useParams()
  const { lobby, openLobby, rotateCode, kick, endSession } = useSessions()
  const { character } = useAuth()
  const nav = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const isCoordinator = useMemo(() => lobby.members.find(m => m.character_id === character?.id)?.role === 'coordinator', [lobby.members, character])

  useEffect(() => {
    const sid = Number(id)
    if (!Number.isFinite(sid)) return
    openLobby(sid).catch((e) => {
      const msg = e?.message
      if (msg === 'ended') setError('This session has ended.')
      else if (msg === 'forbidden') setError('You are not a member of this session.')
      else setError('Failed to open session lobby.')
    })
  }, [id, openLobby])

  // Handle forced leave and ended via WebSocket events handled in context; for UX, navigate out on error string changes
  useEffect(() => {
    // Poll for forced leave indirectly: if sessionId cleared, navigate home
    if (!lobby.sessionId && (error || true)) {
      // navigate to home after a small delay so a toast/message could be shown if desired
      const t = setTimeout(() => nav('/'), 300)
      return () => clearTimeout(t)
    }
  }, [lobby.sessionId, error, nav])

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">Session Lobby #{id}</div>
        <div className="controls">
          {isCoordinator ? (
            <button className="button danger" onClick={() => endSession().then(() => nav('/'))}>End Session</button>
          ) : null}
        </div>
      </div>
      <div className="panel-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <h3 style={{ marginTop: 0 }}>Members</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {lobby.members.map(m => (
              <li key={m.character_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--hairline)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span aria-label={m.online ? 'online' : 'offline'} title={m.online ? 'Online' : 'Offline'} style={{ width: 8, height: 8, borderRadius: 9999, background: m.online ? 'var(--ok)' : 'var(--muted2)' }} />
                  <span>{m.name ?? `#${m.character_id}`}</span>
                  <RoleBadge role={m.role} />
                </div>
                {isCoordinator && character?.id !== m.character_id ? (
                  <button className="text-button danger" onClick={() => kick(m.character_id)}>Kick</button>
                ) : <span />}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 style={{ marginTop: 0 }}>Session Info</h3>
          <div className="panel" style={{ padding: 12 }}>
            <div>Created: {lobby.created_at ? new Date(lobby.created_at).toLocaleString() : '-'}</div>
            <div>Owner: {lobby.owner_id}</div>
            <div>Campaigns: {lobby.campaigns?.length ?? 0}</div>
          </div>
          {isCoordinator ? (
            <div className="panel" style={{ padding: 12, marginTop: 12 }}>
              <h4 style={{ marginTop: 0 }}>Join Codes</h4>
              <CodeRow label="Coordinator" code={lobby.coordinator_code} onRotate={() => rotateCode('coordinator')} />
              <CodeRow label="Line" code={lobby.line_code} onRotate={() => rotateCode('line')} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function CodeRow({ label, code, onRotate }: { label: string; code?: string; onRotate: () => Promise<string> }) {
  const [rotating, setRotating] = useState(false)
  const [cur, setCur] = useState(code || '')
  useEffect(() => { if (code) setCur(code) }, [code])
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <strong style={{ width: 120 }}>{label}:</strong>
      <code style={{ background: 'var(--chip-bg)', padding: '4px 8px', borderRadius: 8 }}>{cur || '—'}</code>
      <button className="text-button" onClick={() => navigator.clipboard.writeText(cur)} disabled={!cur}>Copy</button>
      <button className="text-button" onClick={async () => { setRotating(true); const n = await onRotate(); setCur(n); setRotating(false) }} disabled={rotating}>{rotating ? 'Rotating…' : 'Rotate'}</button>
    </div>
  )
}
