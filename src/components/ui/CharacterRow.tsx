import type { CSSProperties, ReactNode } from 'react'
import CharacterAvatar from './CharacterAvatar'

type CharacterRowProps = {
  characterId: number
  portraitUrl?: string | null
  name?: string | null
  subtitle?: ReactNode
  online?: boolean | null
  size?: number
  className?: string
  nameClassName?: string
  style?: CSSProperties
  nameStyle?: CSSProperties
  title?: string
  showStatus?: boolean
  rightAccessory?: ReactNode
}

export default function CharacterRow({
  characterId,
  portraitUrl,
  name,
  subtitle,
  online,
  size = 36,
  className = 'character-row',
  nameClassName = 'character-name',
  style,
  nameStyle,
  title,
  showStatus = true,
  rightAccessory,
}: CharacterRowProps) {
  const displayName = name ?? `#${characterId}`
  return (
    <div className={className} style={style}>
      <CharacterAvatar
        characterId={characterId}
        portraitUrl={portraitUrl}
        size={size}
        online={online}
        showStatus={showStatus}
        imageProps={{ alt: '', 'aria-hidden': true }}
      />
      <div className={nameClassName} style={nameStyle} title={title ?? name ?? undefined}>
        {displayName}
        {subtitle ? (
          <div className="muted" style={{ fontSize: 12 }}>
            {subtitle}
          </div>
        ) : null}
      </div>
      {rightAccessory}
    </div>
  )
}
