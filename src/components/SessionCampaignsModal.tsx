import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import ModalFrame from './ui/ModalFrame'
import SovCampaignsTable from './SovCampaignsTable'
import type { EnrichedCampaign } from './SovCampaignsTable'
import Icon from './Icon'
import { useSessions } from '../sessions/SessionsContext'
import { useToast } from './ToastProvider'

type SessionCampaign = { campaign_id: number; side: 'offense' | 'defense' }

type Props = {
  open: boolean
  onClose: () => void
  sessionId: number
  campaigns: SessionCampaign[]
  snapshot?: { timestamp: number; isStale: boolean; campaigns: EnrichedCampaign[] }
  connected?: boolean
}

export default function SessionCampaignsModal({ open, onClose, sessionId, campaigns, snapshot, connected }: Props) {
  const { updateSessionCampaigns } = useSessions()
  const { toast } = useToast()
  const [selected, setSelected] = useState<Map<number, 'offense' | 'defense'>>(new Map())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const next = new Map<number, 'offense' | 'defense'>()
    for (const c of campaigns || []) next.set(c.campaign_id, c.side)
    setSelected(next)
  }, [open, campaigns])

  const setSide = (id: number, side: 'offense' | 'defense') => {
    setSelected(prev => {
      const next = new Map(prev)
      const cur = next.get(id)
      if (cur === side) {
        next.delete(id)
      } else {
        next.set(id, side)
      }
      return next
    })
  }

  const { add, remove } = useMemo(() => {
    const initial = new Map<number, 'offense' | 'defense'>()
    for (const c of campaigns || []) initial.set(c.campaign_id, c.side)
    const nextAdd: Array<{ campaign_id: number; side: 'offense' | 'defense' }> = []
    const nextRemove: number[] = []
    for (const [id, side] of selected.entries()) {
      const prev = initial.get(id)
      if (!prev || prev !== side) nextAdd.push({ campaign_id: id, side })
    }
    for (const id of initial.keys()) {
      if (!selected.has(id)) nextRemove.push(id)
    }
    return { add: nextAdd, remove: nextRemove }
  }, [selected, campaigns])

  const counts = useMemo(() => {
    let off = 0
    let def = 0
    for (const side of selected.values()) {
      if (side === 'offense') off += 1
      else def += 1
    }
    return { total: off + def, off, def }
  }, [selected])

  const hasChanges = add.length > 0 || remove.length > 0

  const onSave = async () => {
    if (!hasChanges || saving) return
    setSaving(true)
    try {
      await updateSessionCampaigns(sessionId, {
        add: add.length ? add : undefined,
        remove: remove.length ? remove : undefined,
      })
      toast('Campaigns updated', 'success')
      onClose()
    } catch (err: any) {
      const code = err?.message || ''
      if (code === 'forbidden') toast("You don't have permission to update campaigns.", 'error')
      else if (code === 'ended') toast('Session has ended.', 'warn')
      else toast('Failed to update campaigns.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const node = (
    <ModalFrame
      titleId="manage-campaigns-title"
      title="Manage campaigns"
      panelClassName="modal-animate-in"
      panelStyle={{ maxWidth: 1100, width: 'min(1100px, 92vw)' }}
    >
      <div className="modal-body">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <span className="pill">Selected: {counts.total} (Off: {counts.off} / Def: {counts.def})</span>
          <span className="muted" style={{ fontSize: 12 }}>Click a side to toggle. Click again to remove.</span>
        </div>
        <SovCampaignsTable
          snapshotOverride={snapshot}
          connectedOverride={connected}
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
                  className="action-btn offense"
                  aria-label="Select Offensive"
                  aria-pressed={picked === 'offense'}
                  onClick={() => setSide(row.campaign_id, 'offense')}
                >
                  <Icon name="sword" size={20} className="glyph sword" alt="" />
                </button>
                <button
                  type="button"
                  className="action-btn defense"
                  aria-label="Select Defensive"
                  aria-pressed={picked === 'defense'}
                  onClick={() => setSide(row.campaign_id, 'defense')}
                >
                  <Icon name="shield" kind="mask" size={20} className="glyph shield" alt="" />
                </button>
              </>
            )
          }}
        />
      </div>
      <div className="modal-actions">
        <button type="button" className="button" onClick={onClose}>Cancel</button>
        <button type="button" className="button primary" disabled={!hasChanges || saving} onClick={() => void onSave()}>
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </ModalFrame>
  )

  return createPortal(node, document.body)
}
