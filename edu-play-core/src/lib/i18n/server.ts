import 'server-only'

import { readFile } from 'fs/promises'
import path from 'path'
import { cookies } from 'next/headers'

import { createClient } from '@/lib/supabase/server'

import {
  DEFAULT_LANGUAGE,
  LANGUAGE_COOKIE,
  type Language,
  type Namespace,
  normalizeLanguage,
} from './config'

/**
 * Resolve the active UI language for the current request.
 *
 * Priority:
 *   1. Authenticated user's `profiles.preferred_language`.
 *   2. `NEXT_LOCALE` cookie.
 *   3. `DEFAULT_LANGUAGE` ('ro').
 *
 * Safe to call in Server Components, Server Actions, and Route Handlers.
 */
export async function getServerLanguage(): Promise<Language> {
  const cookieStore = await cookies()
  const cookieLang = cookieStore.get(LANGUAGE_COOKIE)?.value

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { data } = await supabase
        .from('profiles')
        .select('preferred_language')
        .eq('id', user.id)
        .maybeSingle()

      if (data?.preferred_language) {
        return normalizeLanguage(data.preferred_language)
      }
    }
  } catch {
    // Auth lookup is best-effort — fall through to cookie / default.
  }

  if (cookieLang) {
    return normalizeLanguage(cookieLang)
  }

  return DEFAULT_LANGUAGE
}

type NamespaceResources = Record<string, Record<Namespace, unknown>>

/**
 * Load namespace JSON bundles from `public/locales/` on the server.
 *
 * Returns a nested map shaped like i18next's `resources` option so a layout can
 * hand it to `<I18nProvider>` for client hydration with no FOUC.
 */
export async function preloadNamespaces(
  lang: Language,
  namespaces: readonly Namespace[],
): Promise<NamespaceResources> {
  const resources: NamespaceResources = { [lang]: {} as Record<Namespace, unknown> }

  await Promise.all(
    namespaces.map(async (ns) => {
      const filePath = path.join(
        process.cwd(),
        'public',
        'locales',
        lang,
        `${ns}.json`,
      )
      try {
        const raw = await readFile(filePath, 'utf8')
        resources[lang][ns] = JSON.parse(raw)
      } catch {
        resources[lang][ns] = {}
      }
    }),
  )

  return resources
}

/**
 * Server-side translation helper for one-off lookups in `generateMetadata` and
 * other server boundaries that cannot use the React `useTranslation` hook.
 *
 * Resolves dot-paths against the preloaded namespace bundle. Falls back to the
 * RO bundle when a key is missing in the requested language and finally to the
 * key itself if no value is found, matching i18next's behaviour.
 */
export async function getServerTranslation(
  lang: Language,
  namespace: Namespace,
  key: string,
): Promise<string> {
  const resources = await preloadNamespaces(lang, [namespace])
  const direct = walkBundle(resources[lang]?.[namespace], key)
  if (direct !== undefined) return direct

  if (lang !== DEFAULT_LANGUAGE) {
    const fallback = await preloadNamespaces(DEFAULT_LANGUAGE, [namespace])
    const fallbackValue = walkBundle(fallback[DEFAULT_LANGUAGE]?.[namespace], key)
    if (fallbackValue !== undefined) return fallbackValue
  }

  return key
}

function walkBundle(bundle: unknown, key: string): string | undefined {
  if (!bundle || typeof bundle !== 'object') return undefined
  let cursor: unknown = bundle
  for (const segment of key.split('.')) {
    if (cursor && typeof cursor === 'object' && segment in cursor) {
      cursor = (cursor as Record<string, unknown>)[segment]
    } else {
      return undefined
    }
  }
  return typeof cursor === 'string' ? cursor : undefined
}
