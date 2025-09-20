import type { CSSProperties, HTMLAttributes, ImgHTMLAttributes } from 'react'

type CharacterAvatarProps = {
  characterId?: number
  portraitUrl?: string | null
  size: number
  online?: boolean | null
  showStatus?: boolean
  className?: string
  style?: CSSProperties
  imageProps?: ImgHTMLAttributes<HTMLImageElement>
  wrapProps?: HTMLAttributes<HTMLDivElement>
}

function joinClass(base: string, extra?: string) {
  return extra ? `${base} ${extra}` : base
}

export default function CharacterAvatar({
  characterId,
  portraitUrl,
  size,
  online,
  showStatus = true,
  className,
  style,
  imageProps,
  wrapProps,
}: CharacterAvatarProps) {
  const { className: wrapExtraClass, style: wrapExtraStyle, ...restWrap } = wrapProps ?? {}
  const wrapClass = joinClass(joinClass('avatar-wrap', className), wrapExtraClass as string | undefined)
  const imageClass = joinClass('avatar', imageProps?.className)
  const imgStyle: CSSProperties = { width: size, height: size, ...(imageProps?.style ?? {}) }
  const src = portraitUrl ?? (characterId != null ? `https://images.evetech.net/characters/${characterId}/portrait?size=64` : undefined)
  const { className: _ignoredClassName, style: _ignoredStyle, ...restImgProps } = imageProps ?? {}
  const statusClass = online === true ? 'on' : online === false ? 'off' : ''

  return (
    <div
      className={wrapClass}
      style={{ ...(wrapExtraStyle ?? {}), ...(style ?? {}) }}
      {...restWrap}
    >
      <img
        {...restImgProps}
        src={src}
        className={imageClass}
        style={imgStyle}
      />
      {showStatus ? <span className={`online-dot${statusClass ? ` ${statusClass}` : ''}`} aria-hidden="true" /> : null}
    </div>
  )
}
