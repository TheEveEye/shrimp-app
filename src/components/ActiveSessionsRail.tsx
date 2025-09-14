import type { KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessions } from '../sessions/SessionsContext'

function formatUtc(dt: number | string): string {
  const d = typeof dt === 'number' ? new Date(dt) : new Date(dt)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    d.getUTCFullYear() +
    '-' + pad(d.getUTCMonth() + 1) +
    '-' + pad(d.getUTCDate()) +
    ' ' + pad(d.getUTCHours()) +
    ':' + pad(d.getUTCMinutes()) +
    ':' + pad(d.getUTCSeconds()) +
    ' UTC'
  )
}

function relativeTime(ts: number): string {
  const now = Date.now()
  const diff = Math.max(0, now - ts)
  const sec = Math.floor(diff / 1000)
  if (sec < 45) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}min ago`
  const hr = Math.floor(min / 60)
  if (hr < 48) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  return `${day}d ago`
}

function CreatorChip({ name, portrait }: { name?: string; portrait?: string | null }) {
  return (
    <span className="creator-chip" title={name || ''}>
      {portrait ? <img className="avatar" src={portrait} width={24} height={24} alt="" /> : <span className="avatar" style={{ width: 24, height: 24 }} />}
      <span className="creator-name" aria-hidden>{name || 'Unknown'}</span>
    </span>
  )
}

export default function ActiveSessionsRail() {
  const nav = useNavigate()
  const { activeSessions, activeSessionsLoading } = useSessions()

  const hasSessions = activeSessions.length > 0
  const show = hasSessions || activeSessionsLoading

  if (!show) return null

  return (
    <section aria-label="Active Sessions" style={{ marginBottom: 16 }}>
      <header className="page-header">
        <div>
          <h1 className="title">Active Sessions</h1>
        </div>
      </header>
      <div className="rail-wrap">
        <div className="session-rail" role="list">
          {activeSessionsLoading && activeSessions.length === 0 ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="session-card skeleton-card" aria-hidden>
                <div className="row top">
                  <div className="sk sk-sm" />
                  <div className="sk sk-chip" />
                </div>
                <div className="row mid"><div className="sk sk-md" /></div>
                <div className="row bot">
                  <div className="sk sk-chip" />
                  <div className="sk sk-chip" />
                  <div className="sk sk-chip" />
                </div>
              </div>
            ))
          ) : (
            activeSessions.map((s) => {
              const created = s.created_at
              const creator = s.creator
              const role = s.role
              const chips = (s.campaigns || [])
              function computeCounts(): { offensive: number; defensive: number; constellations: number } | null {
                if (s.summary) return s.summary
                if (!chips.length) return null
                let offensive = 0, defensive = 0
                const constKeys = new Set<string>()
                for (const c of chips) {
                  if (c.side === 'offense') offensive++
                  else if (c.side === 'defense') defensive++
                  const key = (c.constellation_id != null) ? String(c.constellation_id) : (c.constellation_name || '')
                  if (key) constKeys.add(key)
                }
                return { offensive, defensive, constellations: constKeys.size }
              }
              const counts = computeCounts()
              const go = () => nav(`/sessions/${s.id}/dashboard`)
              const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go() } }
              return (
                <div
                  key={s.id}
                  className="session-card"
                  role="button"
                  tabIndex={0}
                  onClick={go}
                  onKeyDown={onKey}
                  aria-label={`Open Session #${s.id} dashboard`}
                >
                  <div className="row top">
                    <div className="left">
                      <div className="session-label">Session #{s.id}</div>
                      {role ? (
                        <span className={`badge ${role === 'coordinator' ? 'ok' : ''}`}>{role}</span>
                      ) : null}
                    </div>
                    <div className="right">
                      <CreatorChip name={creator?.name} portrait={creator?.portrait_url || undefined} />
                    </div>
                  </div>
                  <div className="row mid mono">
                    {formatUtc(created)} • {relativeTime(typeof created === 'number' ? created : Date.parse(String(created)))}
                  </div>
                  {counts && (counts.offensive + counts.defensive) > 0 ? (
                    <div className="row bot">
                      <div className="summary-text mono" title={`${counts.offensive} offensive${counts.defensive ? ` • ${counts.defensive} defensive` : ''} • ${counts.constellations} ${counts.constellations === 1 ? 'constellation' : 'constellations'}`}>
                        {counts.offensive > 0 && (<>
                          <span className="summary-off">{counts.offensive}</span> offensive
                        </>)}
                        {counts.defensive > 0 && counts.offensive > 0 && <span className="summary-dot"> • </span>}
                        {counts.defensive > 0 && (<>
                          <span className="summary-def">{counts.defensive}</span> defensive
                        </>)}
                        {(counts.offensive > 0 || counts.defensive > 0) && <span className="summary-dot"> • </span>}
                        {counts.constellations} {counts.constellations === 1 ? 'constellation' : 'constellations'}
                      </div>
                    </div>
                  ) : null}
                  <div className="row foot">
                    <div className="conn-text" title={`${s.connected ?? 0} connected`}>
                      {s.connected ?? 0} connected <span className="conn-dot" aria-hidden />
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </section>
  )
}
