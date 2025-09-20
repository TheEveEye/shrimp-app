import { forwardRef, type CSSProperties, type ReactNode } from 'react'

type ModalFrameProps = {
  titleId: string
  title: ReactNode
  children: ReactNode
  role?: 'dialog' | 'alertdialog'
  ariaDescribedBy?: string
  panelStyle?: CSSProperties
  panelClassName?: string
}

function joinClass(base: string, extra?: string) {
  return extra ? `${base} ${extra}` : base
}

const ModalFrame = forwardRef<HTMLDivElement, ModalFrameProps>(function ModalFrame({
  titleId,
  title,
  children,
  role = 'dialog',
  ariaDescribedBy,
  panelStyle,
  panelClassName,
}, ref) {
  return (
    <div
      className="modal-backdrop"
      role={role}
      aria-modal="true"
      aria-labelledby={titleId}
      {...(ariaDescribedBy ? { 'aria-describedby': ariaDescribedBy } : {})}
    >
      <div ref={ref} className={joinClass('modal-panel', panelClassName)} style={panelStyle}>
        <div className="modal-header">
          <div id={titleId} className="modal-title">{title}</div>
        </div>
        {children}
      </div>
    </div>
  )
})

export default ModalFrame
