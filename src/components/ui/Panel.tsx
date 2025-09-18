import type { CSSProperties, ReactNode } from 'react'

type PanelProps = {
  title?: ReactNode
  controls?: ReactNode
  children?: ReactNode
  body?: ReactNode
  className?: string
  style?: CSSProperties
  bodyClassName?: string
  bodyStyle?: CSSProperties
  headerClassName?: string
  role?: string
  ariaLabel?: string
  ariaLabelledBy?: string
  ariaDescribedBy?: string
  noBody?: boolean
}

function joinClass(base: string, extra?: string) {
  return extra ? `${base} ${extra}` : base
}

export default function Panel({
  title,
  controls,
  children,
  body,
  className,
  style,
  bodyClassName,
  bodyStyle,
  headerClassName,
  role,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  noBody,
}: PanelProps) {
  const rootClass = joinClass('panel', className)
  const headerNeeded = title != null || controls != null
  const bodyContent = body ?? children
  const bodyShouldRender = !noBody && bodyContent != null

  return (
    <div
      className={rootClass}
      style={style}
      {...(role ? { role } : {})}
      {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}
      {...(ariaLabelledBy ? { 'aria-labelledby': ariaLabelledBy } : {})}
      {...(ariaDescribedBy ? { 'aria-describedby': ariaDescribedBy } : {})}
    >
      {headerNeeded ? (
        <div className={joinClass('panel-header', headerClassName)}>
          {title != null ? <div className="panel-title">{title}</div> : <span />}
          {controls != null ? <div className="controls">{controls}</div> : null}
        </div>
      ) : null}
      {bodyShouldRender ? (
        <div className={joinClass('panel-body', bodyClassName)} style={bodyStyle}>
          {bodyContent}
        </div>
      ) : (!noBody ? null : bodyContent)}
    </div>
  )
}
