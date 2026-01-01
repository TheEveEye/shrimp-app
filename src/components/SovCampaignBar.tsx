import React, { useEffect, useMemo, useRef, useState } from 'react'
import Badge from './ui/Badge'
import IconButton from './ui/IconButton'
import type { EnrichedCampaign } from './SovCampaignsTable'
import Icon from './Icon'

function formatT(ms: number) {
  const sign = ms > 0 ? '-' : '+'
  const absMs = Math.abs(ms)
  const totalSeconds = Math.floor(absMs / 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (totalSeconds < 86400) {
    const hh = Math.floor(totalSeconds / 3600)
    return `T${sign}${pad(hh)}:${pad(minutes)}:${pad(seconds)}`
  } else {
    return `T${sign}${days}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  }
}

function toUnderscores(name?: string) {
  return (name ?? '').replace(/\s+/g, '_')
}

type CompletedStatus = 'defense' | 'offense' | 'unknown'

export default React.memo(function SovCampaignBar({ row, now, isStale, completedStatus, onClose, side }: { row: EnrichedCampaign; now: number; isStale: boolean; completedStatus?: CompletedStatus; onClose?: () => void; side?: 'offense' | 'defense' }) {
  const normalizedDefScore = row.defender_score ?? (completedStatus === 'defense' ? 1 : completedStatus === 'offense' ? 0 : 0)
  let defSegmentsBase = Math.round(normalizedDefScore * 15)
  if (completedStatus === 'defense') defSegmentsBase = 15
  if (completedStatus === 'offense') defSegmentsBase = 0
  const defSegments = defSegmentsBase
  const attSegments = 15 - defSegments

  const etaMs = new Date(row.out_time_raw).getTime() - now
  const eta = formatT(etaMs)
  const sys = row.system_name ?? String(row.solar_system_id)
  const con = row.constellation_name
  const reg = row.region_name
  const ownerIcon = row.defender_icon
  const regSlug = reg ? toUnderscores(reg) : undefined
  const sysSlug = sys ? toUnderscores(sys) : undefined
  const conSlug = con ? toUnderscores(con) : undefined
  const sysUrl = regSlug && sysSlug ? `https://evemaps.dotlan.net/map/${regSlug}/${sysSlug}` : undefined
  const conUrl = regSlug && conSlug ? `https://evemaps.dotlan.net/map/${regSlug}/${conSlug}` : undefined
  const regUrl = regSlug ? `https://evemaps.dotlan.net/map/${regSlug}` : undefined

  const ariaLabel = completedStatus
    ? completedStatus === 'unknown'
      ? `Completed campaign for ${sys}${reg ? ' in ' + reg : ''}. Status unknown.`
      : `Completed campaign for ${sys}${reg ? ' in ' + reg : ''}. ${completedStatus === 'defense' ? 'Defenders' : 'Attackers'} secured the objective.`
    : `Sovereignty campaign for ${sys}${reg ? ' in ' + reg : ''}. ETA ${eta}. Score ${defSegments} defender / ${attSegments} attacker.`

  const segs = useMemo(() => {
    if (completedStatus === 'unknown') {
      return Array(15).fill('completed')
    }
    if (completedStatus === 'defense') return Array(15).fill('def')
    if (completedStatus === 'offense') return Array(15).fill('att')
    const arr: Array<'def' | 'att'> = []
    for (let i = 0; i < defSegments; i++) arr.push('def')
    for (let i = 0; i < attSegments; i++) arr.push('att')
    return arr
  }, [completedStatus, defSegments, attSegments])

  const dotlanUrl = reg && sys ? `https://evemaps.dotlan.net/map/${toUnderscores(reg)}/${toUnderscores(sys)}` : undefined

  const isPending = !completedStatus && etaMs > 0
  const isStartingSoon = !completedStatus && etaMs > 0 && etaMs <= 5 * 60 * 1000
  const cardClass = ['camp-card']
  if (isStale) cardClass.push('stale')
  if (isPending) cardClass.push('pending')
  if (isStartingSoon) cardClass.push('starting-soon')
  if (completedStatus === 'unknown') cardClass.push('completed-unknown')
  const showCompletedLabel = completedStatus === 'unknown'
  const displayDefenderRemaining = showCompletedLabel ? 0 : defSegments
  const displayAttackerRemaining = showCompletedLabel ? 0 : attSegments
  const sideIcon = side === 'offense' ? 'sword' : side === 'defense' ? 'shield' : null
  const prevDefSegmentsRef = useRef<number | null>(null)
  const pulseTimerRef = useRef<number | null>(null)
  const [scorePulse, setScorePulse] = useState(false)
  const [changedSegments, setChangedSegments] = useState<number[]>([])
  const [changeDirection, setChangeDirection] = useState<'up' | 'down' | null>(null)
  const changedSet = useMemo(() => new Set(changedSegments), [changedSegments])

  useEffect(() => {
    if (completedStatus) return
    const prev = prevDefSegmentsRef.current
    prevDefSegmentsRef.current = defSegments
    if (prev == null || prev === defSegments) return
    const indices: number[] = []
    if (defSegments > prev) {
      setChangeDirection('up')
      for (let i = prev; i < defSegments; i++) indices.push(i)
    } else {
      setChangeDirection('down')
      for (let i = defSegments; i < prev; i++) indices.push(i)
    }
    setChangedSegments(indices)
    setScorePulse(true)
    if (pulseTimerRef.current) window.clearTimeout(pulseTimerRef.current)
    pulseTimerRef.current = window.setTimeout(() => {
      setScorePulse(false)
      setChangedSegments([])
      setChangeDirection(null)
      pulseTimerRef.current = null
    }, 1200)
    return () => {
      if (pulseTimerRef.current) {
        window.clearTimeout(pulseTimerRef.current)
        pulseTimerRef.current = null
      }
    }
  }, [defSegments, completedStatus])
  return (
    <section className={cardClass.join(' ')} aria-label={ariaLabel}>
      <div className="camp-strip-wrap">
        <div className={`camp-strip${scorePulse ? ' score-pulse' : ''}`} aria-hidden="true">
          {segs.map((t, idx) => (
            <div key={idx} className={`camp-seg ${t}${scorePulse && changedSet.has(idx) ? ` score-change${changeDirection ? ` ${changeDirection}` : ''}` : ''}`} />
          ))}
        </div>
        {completedStatus && onClose ? (
          <IconButton icon="close" className="camp-close" aria-label="Dismiss completed campaign" title="Dismiss" onClick={onClose} />
        ) : null}
        <div className="camp-meta">
          {sys && sysUrl ? (
            <a className="name-link" href={sysUrl} target="_blank" rel="noreferrer">{sys}</a>
          ) : null}
          {con && conUrl ? (
            <>
              <span className="muted"> | </span>
              <a className="name-link" href={conUrl} target="_blank" rel="noreferrer">{con}</a>
            </>
          ) : null}
          {reg && regUrl ? (
            <>
              <span className="muted"> | </span>
              <a className="name-link" href={regUrl} target="_blank" rel="noreferrer">{reg}</a>
            </>
          ) : null}
        </div>
        <div className="camp-overlay">
          {sideIcon ? (
            <span className={`camp-side ${side}`} title={side === 'offense' ? 'Offense campaign' : 'Defense campaign'}>
              <Icon name={sideIcon} size={18} className="camp-side-glyph" alt="" />
            </span>
          ) : null}
          {ownerIcon ? (
            <img className="camp-icon" src={ownerIcon} width={32} height={32} alt="owner icon" title={row.defender_name || ''} />
          ) : null}
          <div className="camp-center mono">
            {!showCompletedLabel ? <span className="camp-eta">{eta}</span> : null}
            {showCompletedLabel ? (
              <span className="camp-completed-label">COMPLETED</span>
            ) : (
              <span className="camp-score"><span className="score-def">{displayDefenderRemaining}</span>/<span className="score-att">{displayAttackerRemaining}</span></span>
            )}
            {isStale ? <Badge className="stale-badge" variant="warn">STALE</Badge> : null}
          </div>
        </div>
      </div>
      <div className="sr-only">
        {`ETA ${eta}. Defender segments ${defSegments}, attacker segments ${attSegments}.`}
        {dotlanUrl ? ` Link to system ${sys} in region ${reg}.` : ''}
      </div>
    </section>
  )
})
