// Rewards — Badge catalog
//
// Single source of truth for badge metadata + threshold rules used by the
// student dashboard and (later) the rewards page. Keep this file pure — no
// Supabase imports — so it can be consumed by both client and server code.

import type { IconName } from '@/shared/components/ui/Icon.registry'

export type BadgeId = 'explorer' | 'quick_thinker' | 'flame_leader' | 'master'

export type BadgeTone = 'primary' | 'secondary' | 'tertiary' | 'error'

export interface BadgeThreshold {
  /** Which aggregate the badge looks at. */
  metric: 'gamesPlayed' | 'completedGames' | 'totalScore' | 'streak'
  /** Inclusive minimum that unlocks the badge. */
  min: number
}

export interface BadgeDefinition {
  id: BadgeId
  /** Romanian label shown under the badge. */
  label: string
  /** Phosphor icon name. */
  icon: IconName
  /** Token-based gradient pair for the unlocked state. */
  gradient: readonly [string, string]
  tone: BadgeTone
  threshold: BadgeThreshold
}

export const BADGES: readonly BadgeDefinition[] = [
  {
    id: 'explorer',
    label: 'Explorator de Top',
    icon: 'Medal',
    gradient: ['from-secondary-fixed', 'to-secondary-container'],
    tone: 'secondary',
    threshold: { metric: 'gamesPlayed', min: 5 },
  },
  {
    id: 'quick_thinker',
    label: 'Gânditor Rapid',
    icon: 'Brain',
    gradient: ['from-tertiary-fixed', 'to-tertiary-container'],
    tone: 'tertiary',
    threshold: { metric: 'totalScore', min: 500 },
  },
  {
    id: 'flame_leader',
    label: 'Lider de Flacără',
    icon: 'Fire',
    gradient: ['from-secondary', 'to-error'],
    tone: 'error',
    threshold: { metric: 'streak', min: 7 },
  },
  {
    id: 'master',
    label: 'Maestru Magician',
    icon: 'Sparkle',
    gradient: ['from-primary-fixed', 'to-primary-container'],
    tone: 'primary',
    threshold: { metric: 'completedGames', min: 10 },
  },
] as const
