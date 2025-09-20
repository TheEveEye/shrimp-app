import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import ModalFrame from './ui/ModalFrame'

type Props = {
  open: boolean
  title: string
  message?: React.ReactNode
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({ open, title, message, confirmText = 'Confirm', cancelText = 'Cancel', variant = 'default', onConfirm, onCancel }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onCancel() }
    if (open) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  const node = (
    <ModalFrame titleId="confirm-title" title={title}>
      <div className="modal-body">{message}</div>
      <div className="modal-actions">
        <button type="button" className="button" onClick={onCancel}>{cancelText}</button>
        <button type="button" className={`button ${variant === 'danger' ? 'danger' : 'primary'}`} onClick={onConfirm}>{confirmText}</button>
      </div>
    </ModalFrame>
  )
  return createPortal(node, document.body)
}
