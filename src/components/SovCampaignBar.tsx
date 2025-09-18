import React, { useMemo } from 'react'
import Icon from './Icon'
import type { EnrichedCampaign } from './SovCampaignsTable'

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

export default React.memo(function SovCampaignBar({ row, now, isStale, completedWinner, onClose }: { row: EnrichedCampaign; now: number; isStale: boolean; completedWinner?: 'defense' | 'offense'; onClose?: () => void }) {
  const defPct = row.def_pct ?? Math.round((row.defender_score ?? 0) * 100)
  const defSegments = useMemo(() => Math.round((row.defender_score ?? 0) * 15), [row.defender_score])
  const attSegments = 15 - defSegments

  // Mirror SovCampaignsTable remaining node logic
  const ATTACKERS_TOTAL = 9
  const DEFENDERS_TOTAL = 6
  const NODE_PCT = 100 / 15 // 6.6667%
  const above = Math.max(defPct - 60, 0)
  const below = Math.max(60 - defPct, 0)
  const incAbove = Math.round(above / NODE_PCT - 1e-9)
  const incBelow = Math.round(below / NODE_PCT - 1e-9)
  const attacker_remaining = defPct >= 60
    ? ATTACKERS_TOTAL + incAbove
    : Math.max(ATTACKERS_TOTAL - incBelow, 0)
  const defender_remaining = defPct <= 60
    ? DEFENDERS_TOTAL + incBelow
    : Math.max(DEFENDERS_TOTAL - incAbove, 0)

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

  const ariaLabel = `Sovereignty campaign for ${sys}${reg ? ' in ' + reg : ''}. ETA ${eta}. Score ${defender_remaining} defender / ${attacker_remaining} attacker remaining.`

  const segs = useMemo(() => {
    const arr: Array<'def' | 'att'> = []
    if (completedWinner) {
      for (let i = 0; i < 15; i++) arr.push(completedWinner === 'defense' ? 'def' : 'att')
      return arr
    }
    for (let i = 0; i < defSegments; i++) arr.push('def')
    for (let i = 0; i < attSegments; i++) arr.push('att')
    return arr
  }, [defSegments, attSegments, completedWinner])

  const dotlanUrl = reg && sys ? `https://evemaps.dotlan.net/map/${toUnderscores(reg)}/${toUnderscores(sys)}` : undefined

  return (
    <section className={`camp-card${isStale ? ' stale' : ''}`} aria-label={ariaLabel}>
      <div className="camp-strip-wrap">
        <div className="camp-strip" aria-hidden="true">
          {segs.map((t, idx) => (
            <div key={idx} className={`camp-seg ${t}`} />
          ))}
        </div>
        {completedWinner && onClose ? (
          <button className="camp-close" aria-label="Dismiss completed campaign" title="Dismiss" onClick={onClose}>
            <Icon name="close" size={14} alt="" />
          </button>
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
          {ownerIcon ? (
            <img className="camp-icon" src={ownerIcon} width={32} height={32} alt="owner icon" />
          ) : null}
          <div className="camp-center mono">
            <span className="camp-eta">{eta}</span>
            <span className="camp-score"><span className="score-def">{defender_remaining}</span>/<span className="score-att">{attacker_remaining}</span></span>
            {isStale ? <span className="badge warn stale-badge">STALE</span> : null}
          </div>
        </div>
      </div>
      <div className="sr-only">
        {`ETA ${eta}. Defender remaining ${defender_remaining}, attacker remaining ${attacker_remaining}.`}
        {dotlanUrl ? ` Link to system ${sys} in region ${reg}.` : ''}
      </div>
    </section>
  )
})
