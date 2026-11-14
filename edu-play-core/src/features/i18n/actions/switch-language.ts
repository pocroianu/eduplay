'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

import {
  LANGUAGE_COOKIE,
  LANGUAGE_COOKIE_MAX_AGE_SECONDS,
  type Language,
  isSupportedLanguage,
} from '@/lib/i18n/config'
import { createClient } from '@/lib/supabase/server'

type SwitchLanguageResult =
  | { ok: true; lang: Language }
  | { ok: false; error: 'unsupported-language' }

/**
 * Persist the UI language preference for the current request.
 *
 * 1. Validates the requested language against `SUPPORTED_LANGUAGES`.
 * 2. Writes `NEXT_LOCALE` cookie (readable from the client so i18next can
 *    sync on hard reloads — the value is not sensitive).
 * 3. If the caller is authenticated, updates `profiles.preferred_language`.
 * 4. Revalidates the layout so server components re-render with the new
 *    `<html lang>` and preloaded namespaces.
 */
export async function switchLanguage(lang: string): Promise<SwitchLanguageResult> {
  if (!isSupportedLanguage(lang)) {
    return { ok: false, error: 'unsupported-language' }
  }

  const cookieStore = await cookies()
  cookieStore.set(LANGUAGE_COOKIE, lang, {
    maxAge: LANGUAGE_COOKIE_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
  })

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      await supabase
        .from('profiles')
        .update({ preferred_language: lang })
        .eq('id', user.id)
    }
  } catch {
    // Anonymous visitors or Supabase hiccups shouldn't block the cookie
    // change. Cookie is authoritative for unauthenticated users.
  }

  revalidatePath('/', 'layout')

  return { ok: true, lang }
}
