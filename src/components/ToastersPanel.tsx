import { useMemo, useState } from 'react'
import { useToasters } from '../toasters/useToasters'
import { useToast } from './ToastProvider'
import ConfirmModal from './ConfirmModal'
import AddToasterModal from './AddToasterModal'
import ToasterSettingsModal from './ToasterSettingsModal'
import Panel from './ui/Panel'
import CharacterAvatar from './ui/CharacterAvatar'
import Badge from './ui/Badge'
import IconButton from './ui/IconButton'

export default function ToastersPanel({ sessionId }: { sessionId: number }) {
  const { items, loading, fetchAll, attach, detach, updateTier } = useToasters(sessionId)
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState<{ open: boolean; character_id?: number }>({ open: false })
  const [editing, setEditing] = useState<number | null>(null)

  // initial fetch
  useMemo(() => { void fetchAll() }, [fetchAll])

  const attachedIds = useMemo(() => items.map(i => i.character_id), [items])

  return (
    <>
      <Panel
        title="Toasters"
        controls={<button className="button" onClick={() => setOpen(true)}>Add Toaster</button>}
        style={{ marginTop: 16 }}
        bodyStyle={{ padding: 16 }}
      >
        {items.length === 0 && !loading ? (
          <div className="muted">No toasters yet.</div>
        ) : null}
        <div className="grid" style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {items.map((t) => (
            <div key={t.character_id} className="panel" style={{ padding: 12, position: 'relative', borderRadius: 12 }} aria-label={`Toaster: ${t.name || t.character_id}, ${t.ship_type_name || '—'}, ${t.entosis_tier.toUpperCase()}`}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CharacterAvatar
                    characterId={t.character_id}
                    portraitUrl={t.portrait_url}
                    size={44}
                    online={t.online}
                    imageProps={{ alt: '', 'aria-hidden': true }}
                  />
                  <div>
                    <div style={{ fontWeight: 600 }}>{t.name || `#${t.character_id}`}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{t.ship_type_name || '—'}</div>
                  </div>
                </div>
                {t.alliance_icon_url ? (
                  <img src={t.alliance_icon_url} width={44} height={44} alt="" aria-hidden style={{ borderRadius: 4 }} />
                ) : <span />}
              </div>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Badge variant={t.entosis_tier === 't2' ? 'ok' : 'warn'} title={t.entosis_tier === 't2' ? '2:00 cycles' : '5:00 cycles'}>
                  {t.entosis_tier.toUpperCase()}
                </Badge>
                <span className="muted" style={{ fontSize: 12 }}>{t.entosis_tier === 't2' ? '2:00 cycles' : '5:00 cycles'}</span>
              </div>
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <IconButton icon="gear" variant="plain" aria-label="Toaster settings" title="Settings" onClick={() => setEditing(t.character_id)} />
                <span className="muted" style={{ fontSize: 12 }}>{t.owner_user?.display_name || ''}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <AddToasterModal open={open} onClose={() => setOpen(false)} onAdd={attach} attachedIds={attachedIds} />
      {(() => {
        const cur = items.find(i => i.character_id === editing)
        if (!cur) return null
        return (
          <ToasterSettingsModal
            open={editing != null}
            currentTier={cur.entosis_tier}
            onClose={() => setEditing(null)}
            onSave={async (tier) => { await updateTier(cur.character_id, tier); setEditing(null); toast('Updated') }}
            onRemove={async () => { await detach(cur.character_id); setEditing(null); toast('Detached') }}
          />
        )
      })()}
      <ConfirmModal
        open={confirm.open}
        title="Detach toaster?"
        message={<div>Remove this toaster from the session?</div>}
        onCancel={() => setConfirm({ open: false })}
        onConfirm={async () => {
          if (!confirm.character_id) return
          try { await detach(confirm.character_id); toast('Detached') } catch { toast('Failed to detach', 'error') }
          finally { setConfirm({ open: false }) }
        }}
      />
    </>
  )
}
