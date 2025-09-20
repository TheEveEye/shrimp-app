import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../auth/AuthContext'
import { useToast } from './ToastProvider'
import Icon from './Icon'
import ConfirmModal from './ConfirmModal'
import ModalFrame from './ui/ModalFrame'
import CharacterAvatar from './ui/CharacterAvatar'
import Badge from './ui/Badge'
type Props = { open: boolean; onClose: () => void }

type Linked = {
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

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export default function ManageCharactersModal({ open, onClose }: Props) {
  const { accessToken, character } = useAuth()
  const { toast } = useToast()
  const [rows, setRows] = useState<Linked[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [mainAllyIcon, setMainAllyIcon] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [unlinkTarget, setUnlinkTarget] = useState<Linked | null>(null)
  const prevBodyOverflow = useRef<string | null>(null)

  const authedFetch = async (url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers as any)
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
    return await fetch(url, { ...init, headers, credentials: 'include' })
  }

  const load = async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const res = await authedFetch(`${API_BASE}/api/characters/linked`)
      if (!res.ok) throw new Error('failed')
      const json = await res.json()
      setRows(json.characters || [])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  // Fetch on open
  useEffect(() => { if (open) void load() }, [open])
  // Fetch affiliation for main when modal opens
  useEffect(() => {
    if (!open || !character) return
    const headers = new Headers()
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
    fetch(`${API_BASE}/api/characters/${character.id}/affiliation`, { headers, credentials: 'include' })
      .then(res => res.ok ? (res.json() as Promise<{ alliance_icon_url?: string | null }>) : Promise.resolve({} as { alliance_icon_url?: string | null }))
      .then(json => setMainAllyIcon(json?.alliance_icon_url ?? null))
      .catch(() => setMainAllyIcon(null))
  }, [open, character?.id, accessToken])

  // No session attachment tracking

  // Scroll lock + focus trap
  useEffect(() => {
    if (!open) return
    prevBodyOverflow.current = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { if (prevBodyOverflow.current !== null) document.body.style.overflow = prevBodyOverflow.current }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      if (e.key === 'Tab') {
        const root = panelRef.current
        if (!root) return
        const focusables = Array.from(root.querySelectorAll<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])')).filter(el => !el.hasAttribute('disabled'))
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const active = document.activeElement as HTMLElement | null
        if (e.shiftKey) {
          if (active === first || !root.contains(active)) { e.preventDefault(); last.focus() }
        } else {
          if (active === last) { e.preventDefault(); first.focus() }
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const openPopup = (url: string) => {
    const w = window.open(url, 'sso_link', 'width=520,height=650')
    if (!w) return
    const onMsg = (ev: MessageEvent) => {
      const data = (ev && ev.data) || {}
      if (data && typeof data === 'object' && ('ok' in data)) {
        window.removeEventListener('message', onMsg)
        if (data.ok) { toast('Character linked', 'success'); void load() }
        else {
          const code = typeof data.error === 'string' ? data.error : 'link_failed'
          const detail = typeof data.detail === 'string' ? `: ${data.detail}` : ''
          toast(`${code}${detail}`, 'error')
        }
      }
    }
    window.addEventListener('message', onMsg)
  }

  const onLinkNew = () => openPopup(`${API_BASE}/api/auth/link/start`)
  const onReconsent = (id: number) => openPopup(`${API_BASE}/api/auth/link/start?character_id=${id}`)

  const doUnlink = async (id: number) => {
    if (!accessToken) return
    setBusyId(id)
    try {
      const res = await authedFetch(`${API_BASE}/api/characters/${id}/unlink`, { method: 'POST' })
      if (res.ok) { toast('Unlinked', 'success'); void load() }
      else toast('Failed to unlink', 'error')
    } finally { setBusyId(null) }
  }

  // Attachment removed.

  if (!open) return null

  const displayRows = (() => {
    const arr = rows.slice()
    if (character && !arr.some(r => r.character_id === character.id)) {
      arr.unshift({
        character_id: character.id,
        name: character.name || null,
        portrait_url: character.portrait,
        scopes: '',
        has_location: true,
        has_ship: true,
        has_waypoint: true,
        has_online: true,
        alliance_icon_url: mainAllyIcon,
      })
    }
    return arr
  })()

  const node = (
    <ModalFrame
      ref={panelRef}
      titleId="chars-title"
      title="Manage Characters"
      panelClassName="modal-animate-in"
      panelStyle={{ maxWidth: 640 }}
      ariaDescribedBy="chars-desc"
    >
      <div className="modal-body">
          <p id="chars-desc" className="muted" style={{ marginTop: 0 }}>Link EVE characters and manage scopes.</p>
          {loading ? <div className="muted">Loading…</div> : null}
          <ul className="mc-list" aria-label="Linked characters">
            {displayRows.map((r) => {
              const isMain = !!character && r.character_id === character.id
              const okLoc = isMain ? true : r.has_location
              const okShip = isMain ? true : r.has_ship
              const okWp = isMain ? true : r.has_waypoint
              const okOn = isMain ? true : r.has_online
              return (
                <li key={r.character_id} className="mc-row">
                  <div className="mc-info">
                    <div className="mc-avatars">
                      <CharacterAvatar
                        characterId={r.character_id}
                        portraitUrl={r.portrait_url}
                        size={36}
                        showStatus={false}
                        imageProps={{ alt: '', 'aria-hidden': true, style: { borderRadius: '50%' } }}
                      />
                    {r.alliance_icon_url ? (
                      <img src={r.alliance_icon_url} width={36} height={36} alt="" aria-hidden="true" style={{ borderRadius: 4, marginTop: 6 }} />
                    ) : null}
                    </div>
                    <div className="mc-meta">
                      <div className="mc-name" title={r.name || undefined}>{r.name ?? `#${r.character_id}`}</div>
                      <div className="mc-scopes">
                        <Badge variant={okLoc ? 'ok' : 'warn'}>Location</Badge>
                        <Badge variant={okShip ? 'ok' : 'warn'}>Ship</Badge>
                        <Badge variant={okWp ? 'ok' : 'warn'}>Waypoint</Badge>
                        <Badge variant={okOn ? 'ok' : 'warn'}>Online</Badge>
                      </div>
                    </div>
                  </div>
                  {!isMain ? (
                    <div className="mc-actions">
                      <button className="icon-plain" aria-label="Re-consent scopes" title="Re-consent" disabled={busyId === r.character_id} onClick={() => onReconsent(r.character_id)}>
                        <Icon name="rotate" kind="mask" size={20} alt="" />
                      </button>
                      <button className="icon-plain danger" aria-label="Unlink character" title="Unlink" disabled={busyId === r.character_id} onClick={() => { setUnlinkTarget(r); setConfirmOpen(true) }}>
                        <Icon name="unlink" kind="mask" size={20} alt="" />
                      </button>
                    </div>
                  ) : <span />}
                </li>
              )
            })}
            {rows.length === 0 && !loading ? (<li className="muted">No linked characters yet.</li>) : null}
          </ul>
      </div>
      <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>Close</button>
          <button type="button" className="button primary" onClick={onLinkNew}>Link new character</button>
      </div>
    </ModalFrame>
  )

  return (
    <>
      {createPortal(node, document.body)}
      <ConfirmModal
        open={confirmOpen}
        title="Unlink this character?"
        message={unlinkTarget ? <div>Unlink <strong>{unlinkTarget.name ?? `#${unlinkTarget.character_id}`}</strong> from your account?</div> : null}
        confirmText="Unlink"
        cancelText="Cancel"
        variant="danger"
        onCancel={() => { setConfirmOpen(false); setUnlinkTarget(null) }}
        onConfirm={async () => { if (unlinkTarget) await doUnlink(unlinkTarget.character_id); setConfirmOpen(false); setUnlinkTarget(null) }}
      />
    </>
  )
}
