import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useToast } from './ToastProvider'
import Popover from './Popover'
import { useAuth } from '../auth/AuthContext'
import ModalFrame from './ui/ModalFrame'
import CharacterAvatar from './ui/CharacterAvatar'
import CharacterRow from './ui/CharacterRow'
import TierToggle from './ui/TierToggle'
import { API_BASE_URL } from '../lib/api'

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
  online?: boolean | null
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
  const [mainAllyIcon, setMainAllyIcon] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    const headers: Record<string, string> = {}
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
    fetch(`${API_BASE_URL}/api/characters/linked`, { credentials: 'include', headers })
      .then(async (res) => res.ok ? (await res.json()).characters as LinkedItem[] : [])
      .then((arr) => setRows(arr))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [open, accessToken])

  // Fetch affiliation for main if needed
  useEffect(() => {
    if (!open || !me) return
    const headers: Record<string, string> = {}
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
    fetch(`${API_BASE_URL}/api/characters/${me.id}/affiliation`, { credentials: 'include', headers })
      .then(res => res.ok ? (res.json() as Promise<{ alliance_icon_url?: string | null }>) : Promise.resolve({} as { alliance_icon_url?: string | null }))
      .then((json) => setMainAllyIcon(json?.alliance_icon_url ?? null))
      .catch(() => setMainAllyIcon(null))
  }, [open, me?.id, accessToken])

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
          online: true,
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
    <ModalFrame
      ref={panelRef}
      titleId="addtoaster-title"
      title="Add Toaster"
      panelClassName="modal-animate-in"
      panelStyle={{ maxWidth: 560 }}
    >
      <div className="modal-body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="form-label">Character</label>
              <button
                ref={selectBtnRef}
                type="button"
                className="input"
                style={{ display: 'flex', alignItems: 'center', gap: 12, height: 52, width: '100%', padding: '0 12px', cursor: 'pointer' }}
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
                            <CharacterAvatar
                              characterId={sel.character_id}
                              portraitUrl={sel.portrait_url}
                              size={36}
                              online={sel.online}
                              imageProps={{ alt: '', 'aria-hidden': true, style: { borderRadius: '50%' } }}
                            />
                    <span>{sel.name || `#${sel.character_id}`}</span>
                    <span style={{ flex: 1 }} />
                      <span style={{ width: 12 }} />
                  </>
                )
                return (
                  <>
                    <span className="muted">Select a character…</span>
                    <span style={{ flex: 1 }} />
                      <span style={{ width: 12 }} />
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
                    <CharacterRow
                      characterId={r.character_id}
                      portraitUrl={r.portrait_url}
                      name={r.name}
                      online={r.online}
                      className="left"
                      nameClassName="name"
                      title={r.name || undefined}
                    />
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
            <TierToggle value={tier} onChange={setTier} />
          </div>
        </div>
      </div>
      <div className="modal-actions">
        <button type="button" className="button" onClick={onClose}>Cancel</button>
        <button type="button" className="button primary" onClick={() => void submit()} disabled={!selectedId}>Add</button>
      </div>
    </ModalFrame>
  )

  return createPortal(node, document.body)
}
