import { useEffect, useMemo, useState } from 'react'
import { useSessions } from '../sessions/SessionsContext'
import Icon from './Icon'
import ConfirmModal from './ConfirmModal'
import Popover from './Popover'
import { useAuth } from '../auth/AuthContext'
import CharacterAvatar from './ui/CharacterAvatar'
import IconButton from './ui/IconButton'

type Role = 'coordinator' | 'line'

type Member = {
  character_id: number
  name?: string
  role: Role
  online: boolean
  portrait_url?: string | null
  alliance_id?: number | null
  alliance_name?: string | null
  alliance_icon_url?: string | null
}

const LS_KEY = 'shrimp.membersSidebar.state'

export default function MembersSidebar() {
  const { lobby } = useSessions()
  const [collapsed, setCollapsed] = useState<boolean>(false)

  useEffect(() => {
    const raw = localStorage.getItem(LS_KEY)
    if (raw === 'collapsed') setCollapsed(true)
  }, [])

  useEffect(() => {
    localStorage.setItem(LS_KEY, collapsed ? 'collapsed' : 'expanded')
  }, [collapsed])

  const { coords, line } = useMemo(() => {
    const m = (lobby.members || []) as Member[]
    const coords = m.filter(x => x.role === 'coordinator').slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    const line = m.filter(x => x.role === 'line').slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    return { coords, line }
  }, [lobby.members])

  return (
    <aside className={`members-sidebar ${collapsed ? 'collapsed' : 'expanded'}`} aria-label="Session members">
      <div className="members-header">
        <div className="members-title">
          <div className="title-text">Members</div>
        </div>
        <IconButton
          icon="sidebarRight"
          iconKind="mask"
          iconClassName="collapse-glyph"
          aria-pressed={collapsed}
          aria-label={collapsed ? 'Expand members panel' : 'Collapse members panel'}
          onClick={() => setCollapsed(v => !v)}
        />
      </div>

      {!collapsed ? (
        <div className="members-sections">
          <Section
            title={`Coordinators (${coords.length})`}
            role="coordinator"
            members={coords}
            code={lobby.coordinator_code}
            canManage={lobby.myRole === 'coordinator'}
          />
          <Section
            title={`Line Members (${line.length})`}
            role="line"
            members={line}
            code={lobby.line_code}
            canManage={lobby.myRole === 'coordinator'}
          />
        </div>
      ) : (
        <div className="members-rail" aria-label="Members avatars">
          {coords.concat(line).map((m) => (
            <Avatar key={m.character_id} member={m} size={36} ariaLabel={`${m.name || 'Unknown'} (${m.role})`} />
          ))}
        </div>
      )}
    </aside>
  )
}

function Section({ title, role, code, canManage, members }: { title: string; role: Role; code?: string; canManage?: boolean; members: Member[] }) {
  const { rotateCode, kickMember, setMemberRole, lobby } = useSessions()
  const { character } = useAuth()
  const [copyOk, setCopyOk] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [promoteTarget, setPromoteTarget] = useState<Member | null>(null)
  const [busy, setBusy] = useState<null | 'kicking' | 'promoting'>(null)

  // No extra outside-click handler here; Popover handles closing and we mirror navbar behavior

  const onCopy = async () => {
    if (!code) return
    try { await navigator.clipboard.writeText(code); setCopyOk(true); setTimeout(() => setCopyOk(false), 1000) } catch {}
  }

  const onRotate = async () => {
    try { await rotateCode(role) } catch {}
  }
  return (
    <section className="members-section" aria-label={title}>
      <div className="section-header">
        <div className="section-title">{title}</div>
        {canManage && code ? (
          <div className="section-actions">
            <span className="code-chip mono" aria-label={`${role} code`}>{code}</span>
            <IconButton icon="rotate" iconKind="mask" aria-label={`Regenerate ${role} code`} onClick={onRotate} />
            <IconButton icon="copy" iconKind="mask" aria-label={`Copy ${role} code`} onClick={onCopy} aria-pressed={copyOk} />
          </div>
        ) : null}
      </div>
      <ul className="members-list">
        {members.map((m) => {
          const isSelf = character?.id === m.character_id
          const isOwner = lobby.owner_id != null && m.character_id === lobby.owner_id
          return (
            <li
              key={m.character_id}
              className="member-row"
              aria-label={`${m.name || 'Unknown'}, ${m.role}`}
              onClick={(e) => {
                if (isSelf || !canManage) return
                const next = selectedId === m.character_id ? null : m.character_id
                setSelectedId(next)
                if (next) {
                  const row = e.currentTarget as HTMLElement
                  const avatar = row.querySelector('.avatar-wrap') as HTMLElement | null
                  const rect = (avatar ?? row).getBoundingClientRect()
                  setAnchor(rect)
                } else {
                  setAnchor(null)
                }
              }}
            >
              <div className="left">
                <Avatar member={m} size={36} />
                <div className="name" title={m.name || undefined}>
                  {m.name || 'Unknown'}
                  {isOwner ? (
                    <span className="crown-wrap crown-yellow" aria-label="Session owner" title="Session owner">
                      <span className="crown-mask" aria-hidden="true" />
                    </span>
                  ) : null}
                </div>
              </div>
              {m.alliance_icon_url ? (
                <img src={m.alliance_icon_url} alt="" aria-hidden="true" className="ally-icon" />
              ) : <span />}
            </li>
          )
        })}
      </ul>

      <Popover open={!!selectedId && !!anchor} anchorRect={anchor} onClose={() => { setSelectedId(null); setAnchor(null) }} align="left">
        {/* Note: Use selectedId to find current member for conditional actions */}
        {(() => {
          const cur = members.find(x => x.character_id === selectedId)
          if (!cur) return null
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                role="menuitem"
                className="menu-item danger"
                disabled={busy === 'kicking'}
                onClick={async () => {
                  if (!lobby.sessionId) return
                  try { setBusy('kicking'); await kickMember(lobby.sessionId, cur.character_id) } finally { setBusy(null); setSelectedId(null); setAnchor(null) }
                }}
              >
                <Icon name="kick" kind="mask" size={16} alt="" />
                <span>Kick</span>
              </button>
              {cur.role !== 'coordinator' ? (
                <button
                  role="menuitem"
                  className="menu-item"
                  disabled={busy === 'promoting'}
                  onClick={() => { setSelectedId(null); setAnchor(null); setPromoteTarget(cur); setConfirmOpen(true) }}
                >
                  <Icon name="promote" kind="mask" size={16} alt="" />
                  <span>Make coordinator</span>
                </button>
              ) : null}
            </div>
          )
        })()}
      </Popover>

      <ConfirmModal
        open={confirmOpen}
        title="Promote to coordinator?"
        message={promoteTarget ? <div>Make <strong>{promoteTarget.name ?? `#${promoteTarget.character_id}`}</strong> a coordinator for this session?</div> : null}
        confirmText="Promote"
        cancelText="Cancel"
        onCancel={() => { setConfirmOpen(false); setPromoteTarget(null) }}
        onConfirm={async () => {
          if (!promoteTarget || !lobby.sessionId) { setConfirmOpen(false); setPromoteTarget(null); return }
          try { setBusy('promoting'); await setMemberRole(lobby.sessionId, promoteTarget.character_id, 'coordinator') }
          finally { setBusy(null); setConfirmOpen(false); setPromoteTarget(null); setSelectedId(null) }
        }}
      />
    </section>
  )
}

function Avatar({ member, size, ariaLabel }: { member: Member; size: number; ariaLabel?: string }) {
  return (
    <CharacterAvatar
      characterId={member.character_id}
      portraitUrl={member.portrait_url || undefined}
      size={size}
      showStatus={false}
      imageProps={{ alt: '', 'aria-hidden': true }}
      wrapProps={ariaLabel ? { 'aria-label': ariaLabel } : undefined}
    />
  )
}
