import { useState } from 'react'
import { createPortal } from 'react-dom'

export default function ToasterSettingsModal({ open, onClose, currentTier, onSave, onRemove }: { open: boolean; onClose: () => void; currentTier: 't1' | 't2'; onSave: (tier: 't1' | 't2') => Promise<void>; onRemove: () => Promise<void> }) {
  const [tier, setTier] = useState<'t1'|'t2'>(currentTier)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  if (!open) return null
  const node = (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="toaster-settings-title">
      <div className="modal-panel" style={{ maxWidth: 420 }}>
        <div className="modal-header"><div id="toaster-settings-title" className="modal-title">Toaster Settings</div></div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="form-label">Entosis Link Tier</label>
            <div style={{ display: 'inline-flex', gap: 6 }}>
              <button type="button" className={`button ${tier==='t2' ? 'primary' : ''}`} onClick={() => setTier('t2')}>T2</button>
              <button type="button" className={`button ${tier==='t1' ? 'danger' : ''}`} onClick={() => setTier('t1')}>T1</button>
            </div>
          </div>
        </div>
        <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="button danger" onClick={async () => { setRemoving(true); try { await onRemove() } finally { setRemoving(false) } }} disabled={saving || removing}>{removing ? 'Removing…' : 'Remove'}</button>
          <div style={{ display: 'inline-flex', gap: 8 }}>
            <button type="button" className="button" onClick={onClose} disabled={saving || removing}>Cancel</button>
            <button type="button" className="button primary" onClick={async () => { setSaving(true); try { await onSave(tier) } finally { setSaving(false) } }} disabled={saving || removing}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  )
  return createPortal(node, document.body)
}
