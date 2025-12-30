import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  open: boolean
  anchorRect?: DOMRect | null
  onClose: () => void
  children: React.ReactNode
  align?: 'left' | 'right'
  offset?: number
  className?: string
}

export default function Popover({ open, anchorRect, onClose, children, align = 'right', offset = 8, className }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let attached = false
    let timer: number | undefined
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node
      if (ref.current && !ref.current.contains(t)) onClose()
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    if (open) {
      // Defer attaching the outside click handler to avoid closing from the trigger click
      timer = window.setTimeout(() => { document.addEventListener('click', onDocClick); attached = true }, 0)
      window.addEventListener('resize', onClose)
      window.addEventListener('scroll', onClose, true)
      document.addEventListener('keydown', onKey)
    }
    return () => {
      if (timer) window.clearTimeout(timer)
      if (attached) document.removeEventListener('click', onDocClick)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('scroll', onClose, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open || !anchorRect) return null
  const base: React.CSSProperties = { position: 'fixed', top: Math.round(anchorRect.bottom + offset), zIndex: 1000 }
  const style: React.CSSProperties = align === 'right'
    ? { ...base, right: Math.max(8, Math.round(window.innerWidth - anchorRect.right)) }
    : { ...base, left: Math.max(8, Math.round(anchorRect.left)) }
  const rootClass = className ? `menu-popover ${className}` : 'menu-popover'

  return createPortal(
    <div ref={ref} className={rootClass} style={style} role="menu">
      {children}
    </div>,
    document.body,
  )
}
