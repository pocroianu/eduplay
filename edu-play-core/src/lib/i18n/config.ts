/**
 * Shared i18n configuration (server + client safe).
 *
 * Romanian is the canonical default per REQUIREMENTS F12.
 * English may be partial; missing keys fall back to RO via i18next's fallbackLng.
 */

export const SUPPORTED_LANGUAGES = ['ro', 'en'] as const

export type Language = (typeof SUPPORTED_LANGUAGES)[number]

export const DEFAULT_LANGUAGE: Language = 'ro'

export const FALLBACK_LANGUAGE: Language = 'ro'

export const LANGUAGE_COOKIE = 'NEXT_LOCALE'

export const LANGUAGE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

/**
 * Available translation namespaces. Each namespace maps to a single JSON file
 * under `public/locales/{lang}/{namespace}.json`. Non-engineering contributors
 * edit those JSON files directly.
 */
export const NAMESPACES = [
  'common',
  'auth',
  'landing',
  'student',
  'teacher',
  'parent',
  'player',
  'activities',
] as const

export type Namespace = (typeof NAMESPACES)[number]

export function isSupportedLanguage(value: unknown): value is Language {
  return (
    typeof value === 'string' &&
    (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
  )
}

export function normalizeLanguage(value: string | null | undefined): Language {
  return isSupportedLanguage(value) ? value : DEFAULT_LANGUAGE
}

export const LANGUAGE_LABELS: Record<Language, string> = {
  ro: 'Română',
  en: 'English',
}
