import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { preloadNamespaces } from '@/lib/i18n/server'
import { createClient } from '@/lib/supabase/server'
import { PreferencesProvider } from '@/features/student-profile'
import { getPreferences } from '@/features/student-profile/server'

export default async function PlayLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const resources = await preloadNamespaces('ro', ['common', 'player'])

  // Honour the signed-in student's own reduced-motion preference on the player
  // (the dashboard layout does the same). Anonymous visitors fall through to the
  // root MotionConfig, which follows the OS-level setting.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const preferences = user ? await getPreferences(user.id) : null

  const content = preferences ? (
    <PreferencesProvider initial={preferences}>{children}</PreferencesProvider>
  ) : (
    children
  )

  return (
    <I18nProvider lang="ro" resources={resources}>
      {content}
    </I18nProvider>
  )
}
