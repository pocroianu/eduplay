'use client'

import { StatBlock, type StatBlockVariant } from './kit/StatBlock'
import type { IconName } from './Icon.registry'

interface StatCardProps {
  label: string
  value: string | number
  icon: IconName
  variant: StatBlockVariant
}

/**
 * @deprecated Use `StatBlock` from `@/shared/components/ui/kit/StatBlock` instead.
 * This thin wrapper will be removed after consumers migrate off of it.
 */
export function StatCard({ label, value, icon, variant }: StatCardProps) {
  return <StatBlock label={label} value={value} icon={icon} variant={variant} />
}
