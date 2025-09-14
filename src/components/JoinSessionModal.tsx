import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSessions } from '../sessions/SessionsContext'
import { useToast } from './ToastProvider'
import { useNavigate } from 'react-router-dom'

type Props = {
  open: boolean
  onClose: () => void
}

export default function JoinSessionModal({ open, onClose }: Props) {
  const { joinWithCode } = useSessions()
  const { toast } = useToast()
  const nav = useNavigate()
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const prevBodyOverflow = useRef<string | null>(null)

  // Derived: is form valid
  const isValid = useMemo(() => code.trim().length > 0, [code])

  // Focus input and lock background scroll while open
  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => inputRef.current?.focus(), 0)
    // Prevent background scroll
    prevBodyOverflow.current = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      if (t) window.clearTimeout(t)
      if (prevBodyOverflow.current !== null) document.body.style.overflow = prevBodyOverflow.current
      prevBodyOverflow.current = null
    }
  }, [open])

  // Handle Escape and focus trap
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      if (e.key === 'Tab') {
        const root = panelRef.current
        if (!root) return
        const focusables = Array.from(root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )).filter(el => !el.hasAttribute('disabled'))
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

  // Submit handler
  const onSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!isValid || submitting) return
    setSubmitting(true)
    try {
      const normalized = code.trim().toUpperCase().replace(/\s+/g, '')
      const { id } = await joinWithCode(normalized)
      toast('Joined session', 'success')
      // Navigate straight to dashboard; URL change will also close the modal.
      nav(`/sessions/${id}/dashboard`)
    } catch (err: any) {
      const msg = err?.message || ''
      if (msg === 'ended') toast('Session has ended.', 'warn')
      else if (msg === 'forbidden') toast("You don't have access to this session.", 'error')
      else toast("Couldn't join. Check the code and try again.", 'error')
      // Keep focus for quick retry
      inputRef.current?.focus()
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  const node = (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="join-modal-title" aria-describedby="join-modal-desc">
      <div ref={panelRef} className="modal-panel modal-animate-in">
        <div className="modal-header"><div id="join-modal-title" className="modal-title">Join Session</div></div>
        <form onSubmit={onSubmit}>
          <div className="modal-body">
            <p id="join-modal-desc" className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
              Enter a join code provided by a coordinator.
            </p>
            <label className="form-label" htmlFor="join-code-input">Join Code</label>
            <input
              id="join-code-input"
              ref={inputRef}
              className="input"
              placeholder="e.g., 12-ABCDEF"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onPaste={(e) => {
                const t = e.clipboardData?.getData('text') ?? ''
                const next = t.trim()
                if (next) { e.preventDefault(); setCode(next) }
              }}
              autoComplete="off"
              required
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="button" onClick={onClose} disabled={submitting}>Cancel</button>
            <button type="submit" className="button primary" disabled={!isValid || submitting}>
              {submitting ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span className="spinner sm" aria-hidden="true" />
                  Joining…
                </span>
              ) : 'Join'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
