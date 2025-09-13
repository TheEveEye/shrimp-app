import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessions } from '../sessions/SessionsContext'
import { useToast } from '../components/ToastProvider'
import SovCampaignsTable from '../components/SovCampaignsTable'
import type { EnrichedCampaign } from '../components/SovCampaignsTable'

export default function SessionsNew() {
  const [selected, setSelected] = useState<Map<number, 'offense' | 'defense'>>(new Map())
  const [creating, setCreating] = useState(false)
  const { createSession } = useSessions()
  const { toast } = useToast()
  const nav = useNavigate()

  const setSide = (id: number, side: 'offense' | 'defense') => {
    setSelected(prev => {
      const next = new Map(prev)
      const cur = next.get(id)
      if (cur === side) {
        next.delete(id) // toggle off
      } else {
        next.set(id, side) // set or switch side
      }
      return next
    })
  }

  const counts = useMemo(() => {
    let off = 0, def = 0
    for (const s of selected.values()) { if (s === 'offense') off++; else def++; }
    return { total: off + def, off, def }
  }, [selected])

  const onSubmit = async () => {
    try {
      setCreating(true)
      const items = Array.from(selected.entries()).map(([campaign_id, side]) => ({ campaign_id, side }))
      const created = await createSession(items)
      nav(`/sessions/${created.id}/lobby`, { state: { codes: { coordinator: created.coordinator_code, line: created.line_code } } })
      toast(`Session created with ${counts.off} offensive / ${counts.def} defensive campaigns`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <header className="page-header" style={{ marginBottom: 8 }}>
        <div>
          <h1 className="title">Create Session</h1>
        </div>
        <div className="controls">
          <span className="pill">Selected: {counts.total} (Off: {counts.off} / Def: {counts.def})</span>
          <button className="button primary" onClick={onSubmit} disabled={creating || counts.total === 0}>{creating ? 'Creating…' : 'Create Session'}</button>
        </div>
      </header>
      <div className="panel">
        <div className="panel-body">
          <SovCampaignsTable
            rowClassName={(row: EnrichedCampaign) => {
              const picked = selected.get(row.campaign_id)
              return picked ? (picked === 'offense' ? 'row-selected offense' : 'row-selected defense') : ''
            }}
            rowOverlay={(row: EnrichedCampaign) => {
              const picked = selected.get(row.campaign_id)
              return (
                <>
                  <button
                    type="button"
                    className={`action-btn offense`}
                    aria-label="Select Offensive"
                    aria-pressed={picked === 'offense'}
                    onClick={() => setSide(row.campaign_id, 'offense')}
                  >
                    <img src="/sword.filled.png" alt="" className="glyph sword" />
                  </button>
                  <button
                    type="button"
                    className={`action-btn defense`}
                    aria-label="Select Defensive"
                    aria-pressed={picked === 'defense'}
                    onClick={() => setSide(row.campaign_id, 'defense')}
                  >
                    <span className="glyph shield" aria-hidden="true" />
                  </button>
                </>
              )
            }}
          />
        </div>
      </div>
    </>
  )
}
