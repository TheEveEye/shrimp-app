type IconName = 'signOut'

const ICONS: Record<IconName, string> = {
  // Public asset mapped to name for reuse
  signOut: '/rectangle.portrait.and.arrow.right.svg',
}

type Props = {
  name: IconName
  size?: number
  className?: string
  title?: string
  alt?: string
  style?: React.CSSProperties
}

export default function Icon({ name, size = 16, className, title, alt = '', style }: Props) {
  const src = ICONS[name]
  return (
    <img
      src={src}
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

