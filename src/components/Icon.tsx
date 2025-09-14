type IconName = 'signOut' | 'sidebarRight' | 'rotate' | 'copy' | 'sword' | 'shield' | 'kick' | 'promote'

const ICONS: Record<IconName, { src?: string; mask?: string }> = {
  // Public assets mapped to semantic names
  signOut: { src: '/rectangle.portrait.and.arrow.right.svg' },
  sidebarRight: { mask: '/sidebar.right.svg' },
  rotate: { mask: '/arrow.trianglehead.2.clockwise.rotate.90.svg' },
  copy: { mask: '/square.on.square.svg' },
  sword: { src: '/sword.filled.png' },
  shield: { mask: '/shield.lefthalf.filled.svg' },
  kick: { mask: '/person.crop.circle.badge.minus.svg' },
  promote: { mask: '/arrow.up.circle.svg' },
}

type Props = {
  name: IconName
  size?: number
  className?: string
  title?: string
  alt?: string
  style?: React.CSSProperties
  kind?: 'img' | 'mask' // optional override; defaults by icon config
}

export default function Icon({ name, size = 16, className, title, alt = '', style, kind }: Props) {
  const cfg = ICONS[name]
  const useMask = kind ? kind === 'mask' : !!cfg.mask && !cfg.src
  if (useMask && cfg.mask) {
    const spanStyle: React.CSSProperties = {
      display: 'inline-block',
      width: size,
      height: size,
      backgroundColor: 'currentColor',
      WebkitMask: `url('${cfg.mask}') no-repeat center / contain`,
      mask: `url('${cfg.mask}') no-repeat center / contain`,
      ...style,
    }
    return (
      <span
        className={className}
        title={title}
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        style={spanStyle}
      />
    )
  }
  return (
    <img
      src={cfg.src}
      className={className}
      width={size}
      height={size}
      title={title}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      style={style}
    />
  )
}
