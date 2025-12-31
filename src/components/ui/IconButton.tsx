import React from 'react'
import Icon, { type IconName } from '../Icon'

type IconButtonVariant = 'solid' | 'plain'
type IconButtonTone = 'default' | 'danger'

type IconButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  icon: IconName
  iconKind?: 'img' | 'mask'
  iconClassName?: string
  iconAlt?: string
  iconTitle?: string
  iconStyle?: React.CSSProperties
  variant?: IconButtonVariant
  tone?: IconButtonTone
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({
    icon,
    iconKind,
    iconClassName,
    iconAlt = '',
    iconTitle,
    iconStyle,
    variant = 'solid',
    tone = 'default',
    className,
    type,
    ...props
  }, ref) => {
    const classes = [
      'icon-button',
      variant === 'plain' ? 'icon-button--plain' : '',
      tone === 'danger' ? 'icon-button--danger' : '',
      className ?? ''
    ].filter(Boolean).join(' ')

    return (
      <button ref={ref} type={type ?? 'button'} className={classes} {...props}>
        <Icon name={icon} size={16} kind={iconKind} className={iconClassName} alt={iconAlt} title={iconTitle} style={iconStyle} />
      </button>
    )
  }
)

IconButton.displayName = 'IconButton'

export default IconButton
