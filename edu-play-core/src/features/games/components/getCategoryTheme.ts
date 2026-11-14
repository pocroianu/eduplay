'use client'

import { useTranslation } from 'react-i18next'
import type { IconName } from '@/shared/components/ui/Icon.registry'

export type CategoryKey =
  | 'default'
  | 'math'
  | 'literacy'
  | 'phonics'
  | 'shapes'
  | 'colors'
  | 'vocabulary'

export interface CategoryVisuals {
  /** Solid accent color (CSS var) for progress bars and glows */
  accentColor: string
  /** Soft accent (12% mix with white) for empty-state blob */
  accentSoft: string
  /** Phosphor glyph shown in the Duo icon badge */
  icon: IconName
  /** Stable theme key — used to look up RO/EN copy in the `player` namespace */
  themeKey: CategoryKey
}

export interface CategoryTheme extends CategoryVisuals {
  /** "Misiune: …" badge */
  badge: string
  /** Lesson title */
  title: string
  /** Lesson subtitle */
  subtitle: string
  /** Coach quote */
  quote: string
  /** 3 lesson steps */
  steps: [string, string, string]
  /** Coach byline (e.g. "Sfat de la Vulpița:") */
  coach: string
}

const DEFAULT_VISUALS: CategoryVisuals = {
  accentColor: 'var(--color-primary)',
  accentSoft: 'var(--color-primary-wash)',
  icon: 'Sparkle',
  themeKey: 'default',
}

const VISUALS: Record<CategoryKey, CategoryVisuals> = {
  default: DEFAULT_VISUALS,
  math: {
    accentColor: 'var(--color-blue)',
    accentSoft: 'var(--color-blue-wash)',
    icon: 'Calculator',
    themeKey: 'math',
  },
  literacy: {
    accentColor: 'var(--color-coral)',
    accentSoft: 'var(--color-coral-wash)',
    icon: 'BookOpen',
    themeKey: 'literacy',
  },
  phonics: {
    accentColor: 'var(--color-purple)',
    accentSoft: 'var(--color-purple-wash)',
    icon: 'SpeakerSimpleHigh',
    themeKey: 'phonics',
  },
  shapes: {
    accentColor: 'var(--color-gold)',
    accentSoft: 'var(--color-gold-wash)',
    icon: 'Shapes',
    themeKey: 'shapes',
  },
  colors: {
    accentColor: 'var(--color-pink)',
    accentSoft: 'var(--color-pink-wash)',
    icon: 'Palette',
    themeKey: 'colors',
  },
  vocabulary: {
    accentColor: 'var(--color-gold)',
    accentSoft: 'var(--color-gold-wash)',
    icon: 'TextAa',
    themeKey: 'vocabulary',
  },
}

export function getCategoryVisuals(category: string | null): CategoryVisuals {
  if (!category) return DEFAULT_VISUALS
  return VISUALS[category as CategoryKey] ?? DEFAULT_VISUALS
}

/**
 * Hook returning the merged visual + RO/EN themed content for a game category.
 * Must be used inside an `<I18nProvider>` that has the `player` namespace.
 */
export function useCategoryTheme(category: string | null): CategoryTheme {
  const visuals = getCategoryVisuals(category)
  const { t } = useTranslation('player')
  const key = `themes.${visuals.themeKey}` as const

  return {
    ...visuals,
    badge: t(`${key}.badge`),
    title: t(`${key}.title`),
    subtitle: t(`${key}.subtitle`),
    quote: t(`${key}.quote`),
    steps: [
      t(`${key}.step1`),
      t(`${key}.step2`),
      t(`${key}.step3`),
    ],
    coach: t('coach.byline'),
  }
}
