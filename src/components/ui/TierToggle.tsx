import type { CSSProperties } from 'react'

type Tier = 't1' | 't2'

type TierToggleProps = {
  value: Tier | null
  onChange: (value: Tier) => void
  disabled?: boolean
  className?: string
  style?: CSSProperties
  t1Title?: string
  t2Title?: string
}

export default function TierToggle({
  value,
  onChange,
  disabled,
  className,
  style,
  t1Title = 'T1 (5:00 cycles)',
  t2Title = 'T2 (2:00 cycles)',
}: TierToggleProps) {
  return (
    <div className={className} style={{ display: 'inline-flex', gap: 6, ...(style ?? {}) }}>
      <button
        type="button"
        className={`button ${value === 't2' ? 'tier-ok' : 'tier-ghost-ok'}`}
        onClick={() => onChange('t2')}
        disabled={disabled}
        title={t2Title}
      >
        T2
      </button>
      <button
        type="button"
        className={`button ${value === 't1' ? 'tier-warn' : 'tier-ghost-warn'}`}
        onClick={() => onChange('t1')}
        disabled={disabled}
        title={t1Title}
      >
        T1
      </button>
    </div>
  )
}
