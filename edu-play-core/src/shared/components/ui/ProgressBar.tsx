'use client'

import { DuoProgress } from './kit'

type DuoProgressTone = 'green' | 'blue' | 'coral' | 'gold' | 'purple'

interface ProgressBarProps {
  value: number
  max?: number
  color?: string
  bgColor?: string
  height?: string
  label?: string
  showPercent?: boolean
  className?: string
}

const HEIGHT_MAP: Record<string, number> = {
  'h-1.5': 6,
  'h-2': 8,
  'h-3': 12,
  'h-4': 16,
}

function toneFromLegacyColor(color: string): DuoProgressTone {
  if (color.includes('gold') || color.includes('secondary')) return 'gold'
  if (color.includes('blue')) return 'blue'
  if (color.includes('coral') || color.includes('error')) return 'coral'
  if (color.includes('purple') || color.includes('tertiary')) return 'purple'
  return 'green'
}

/**
 * @deprecated Use `DuoProgress` from `@/shared/components/ui/kit` directly.
 * This adapter keeps legacy callers on the current Duo progress primitive.
 */
export function ProgressBar({
  value,
  max = 100,
  color = 'bg-primary',
  height = 'h-2',
  label,
  showPercent = false,
  className = '',
}: ProgressBarProps) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0

  return (
    <div className={className}>
      <DuoProgress
        value={percent}
        tone={toneFromLegacyColor(color)}
        height={HEIGHT_MAP[height] ?? 10}
        label={label}
        showPercent={showPercent}
      />
    </div>
  )
}
