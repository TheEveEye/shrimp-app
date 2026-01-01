export type IconName = 'signOut' | 'sidebarRight' | 'sidebarLeft' | 'rotate' | 'copy' | 'sword' | 'shield' | 'kick' | 'promote' | 'manageCharacters' | 'unlink' | 'close' | 'chevronDown' | 'gear' | 'ellipsis' | 'chevronCompactUp'

const ICONS: Record<IconName, { src?: string; mask?: string }> = {
  // Public assets mapped to semantic names
  signOut: { src: '/rectangle.portrait.and.arrow.right.svg' },
  sidebarRight: { mask: '/sidebar.right.svg' },
  sidebarLeft: { mask: '/sidebar.left.svg' },
  rotate: { mask: '/arrow.trianglehead.2.clockwise.rotate.90.svg' },
  copy: { mask: '/square.on.square.svg' },
  sword: { src: '/sword.filled.png' },
  shield: { mask: '/shield.lefthalf.filled.svg' },
  kick: { mask: '/person.fill.badge.minus.svg' },
  promote: { mask: '/arrow.up.circle.svg' },
  manageCharacters: { mask: '/person.2.badge.gearshape.fill.svg' },
  unlink: { mask: '/minus.circle.fill.svg' },
  close: { mask: '/xmark.circle.svg' },
  chevronDown: { src: '/arrowtriangle.down.fill.svg' },
  gear: { src: '/gear.svg' },
  ellipsis: { src: '/ellipsis.svg' },
  chevronCompactUp: { src: '/chevron.compact.up.svg' },
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
  const baseClass = useMask ? 'icon-mask' : 'icon-img'
  const classes = className ? `${baseClass} ${className}` : baseClass
  if (useMask && cfg.mask) {
    const spanStyle: React.CSSProperties = {
      display: 'inline-block',
      width: size,
      height: size,
      backgroundColor: 'currentColor',
      color: 'var(--icon-color, #fff)',
      WebkitMask: `url('${cfg.mask}') no-repeat center / contain`,
      mask: `url('${cfg.mask}') no-repeat center / contain`,
      ...style,
    }
    return (
      <span
        className={classes}
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
      className={classes}
      width={size}
      height={size}
      title={title}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      style={style}
    />
  )
}
