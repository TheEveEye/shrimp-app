import type { HTMLAttributes, ReactNode } from 'react'

type BadgeVariant = 'default' | 'ok' | 'warn' | 'danger'

type BadgeProps = {
  children: ReactNode
  variant?: BadgeVariant
} & HTMLAttributes<HTMLSpanElement>

function joinClass(base: string, extra?: string) {
  return extra ? `${base} ${extra}` : base
}

export default function Badge({ children, variant = 'default', className, ...rest }: BadgeProps) {
  const variantClass = variant !== 'default' ? variant : ''
  const rootClass = variantClass ? `${joinClass('badge', className)} ${variantClass}`.trim() : joinClass('badge', className)
  return (
    <span className={rootClass} {...rest}>
      {children}
    </span>
  )
}
