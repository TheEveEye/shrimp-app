import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useToast } from './ToastProvider'
import Icon from './Icon'
import Popover from './Popover'
import { useAuth } from '../auth/AuthContext'

type LinkedItem = {
  character_id: number
  name?: string | null
  portrait_url: string
  scopes: string
  has_location: boolean
  has_ship: boolean
  has_waypoint: boolean
  has_online: boolean
  alliance_icon_url?: string | null
}

export default function AddToasterModal({ open, onClose, onAdd, attachedIds }: { open: boolean; onClose: () => void; onAdd: (character_id: number, tier: 't1'|'t2') => Promise<void>; attachedIds: number[] }) {
  const { toast } = useToast()
  const { accessToken, character: me } = useAuth()
  const [rows, setRows] = useState<LinkedItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [tier, setTier] = useState<'t1'|'t2'>('t2')
  const panelRef = useRef<HTMLDivElement | null>(null)
  const selectBtnRef = useRef<HTMLButtonElement | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
  const [mainAllyIcon, setMainAllyIcon] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    const headers: Record<string, string> = {}
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
    fetch(`${API_BASE}/api/characters/linked`, { credentials: 'include', headers })
      .then(async (res) => res.ok ? (await res.json()).characters as LinkedItem[] : [])
      .then((arr) => setRows(arr))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [open, API_BASE, accessToken])

  // Fetch affiliation for main if needed
  useEffect(() => {
    if (!open || !me) return
    const headers: Record<string, string> = {}
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
    fetch(`${API_BASE}/api/characters/${me.id}/affiliation`, { credentials: 'include', headers })
      .then(res => res.ok ? res.json() as Promise<{ alliance_icon_url?: string | null }> : Promise.resolve({}))
      .then((json) => setMainAllyIcon(json?.alliance_icon_url ?? null))
      .catch(() => setMainAllyIcon(null))
  }, [open, me?.id, API_BASE, accessToken])

  const available = useMemo(() => {
    let list = rows.slice()
    if (me) {
      const present = list.some((r) => r.character_id === me.id)
      if (!present) {
        const mainItem: LinkedItem = {
          character_id: me.id,
          name: me.name,
          portrait_url: me.portrait,
          scopes: '',
          has_location: true,
          has_ship: true,
          has_waypoint: true,
          has_online: true,
          alliance_icon_url: mainAllyIcon || undefined,
        }
        list = [mainItem, ...list]
      }
    }
    return list.filter(r => !attachedIds.includes(r.character_id))
  }, [rows, attachedIds, me, mainAllyIcon])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Enter') {
        if (selectedId) { e.preventDefault(); void submit() }
      }
      if (e.key === 'Tab') {
        const root = panelRef.current
        if (!root) return
        const focusables = Array.from(root.querySelectorAll<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])')).filter(el => !el.hasAttribute('disabled'))
        if (focusables.length === 0) return
        const first = focusables[0], last = focusables[focusables.length - 1]
        const active = document.activeElement as HTMLElement | null
        if (e.shiftKey) { if (active === first || !root.contains(active)) { e.preventDefault(); last.focus() } }
        else { if (active === last) { e.preventDefault(); first.focus() } }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, selectedId, onClose])

  if (!open) return null

  const submit = async () => {
    if (!selectedId) return
    try {
      await onAdd(selectedId, tier)
      toast('Toaster added', 'success')
      onClose()
    } catch (e: any) {
      if (e?.code === 409 || e?.message === 'duplicate') toast('That character is already attached', 'warn')
      else toast('Failed to add toaster', 'error')
    }
  }

  const node = (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="addtoaster-title">
      <div ref={panelRef} className="modal-panel modal-animate-in" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <div id="addtoaster-title" className="modal-title">Add Toaster</div>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="form-label">Character</label>
              <button
                ref={selectBtnRef}
                type="button"
                className="input"
                style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, cursor: 'pointer' }}
                onClick={() => {
                  setMenuOpen((o) => !o)
                  const el = selectBtnRef.current
                  if (el) setAnchor(el.getBoundingClientRect())
                }}
                aria-haspopup="listbox"
                aria-expanded={menuOpen}
              >
                {(() => {
                  const sel = available.find(a => a.character_id === selectedId)
                  if (sel) return (
                    <>
                      <img src={sel.portrait_url} className="avatar" alt="" aria-hidden style={{ width: 24, height: 24, borderRadius: '50%' }} />
                      <span>{sel.name || `#${sel.character_id}`}</span>
                      <span style={{ flex: 1 }} />
                      <Icon name="chevronDown" size={14} alt="" style={{ opacity: 0.9, transform: menuOpen ? 'rotate(180deg)' : 'none', filter: 'brightness(0) invert(1)' }} />
                    </>
                  )
                  return (
                    <>
                      <span className="muted">Select a character…</span>
                      <span style={{ flex: 1 }} />
                      <Icon name="chevronDown" size={14} alt="" style={{ opacity: 0.9, filter: 'brightness(0) invert(1)' }} />
                    </>
                  )
                })()}
              </button>
              <Popover open={menuOpen} anchorRect={anchor || undefined} onClose={() => setMenuOpen(false)} align="left">
                <ul role="listbox" aria-label="Characters" className="members-list" style={{ maxHeight: 260, overflow: 'auto', minWidth: 280 }}>
                  {loading ? <li className="muted" style={{ padding: 12 }}>Loading…</li> : null}
                  {available.map((r) => (
                    <li
                      key={r.character_id}
                      className={`member-row ${selectedId === r.character_id ? 'row-selected' : ''}`}
                      role="option"
                      aria-selected={selectedId === r.character_id}
                      onClick={() => { setSelectedId(r.character_id); setMenuOpen(false) }}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="left">
                        <div className="avatar-wrap"><img src={r.portrait_url} className="avatar" style={{ width: 36, height: 36 }} alt="" aria-hidden /></div>
                        <div className="name" title={r.name || undefined}>{r.name || `#${r.character_id}`}</div>
                      </div>
                      {r.alliance_icon_url ? (
                        <img src={r.alliance_icon_url} alt="" aria-hidden className="ally-icon" style={{ width: 36, height: 36, borderRadius: 4 }} />
                      ) : <span />}
                    </li>
                  ))}
                  {available.length === 0 && !loading ? (<li className="muted" style={{ padding: 12 }}>No available characters</li>) : null}
                </ul>
              </Popover>
            </div>
            
            <div>
              <label className="form-label">Entosis Link Tier</label>
              <div style={{ display: 'inline-flex', gap: 6 }}>
                <button type="button" className={`button ${tier==='t2' ? 'primary' : ''}`} onClick={() => setTier('t2')} title="T2 (2:00 cycles)">T2</button>
                <button type="button" className={`button ${tier==='t1' ? 'danger' : ''}`} onClick={() => setTier('t1')} title="T1 (5:00 cycles)">T1</button>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>Cancel</button>
          <button type="button" className="button primary" onClick={() => void submit()} disabled={!selectedId}>Add</button>
        </div>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
