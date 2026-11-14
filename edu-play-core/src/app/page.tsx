import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { HomePage } from '@/components/home/HomePage'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { getServerLanguage, preloadNamespaces } from '@/lib/i18n/server'
import { ROUTES } from '@/shared/lib/constants'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'teacher') {
      redirect(ROUTES.TEACHER.DASHBOARD)
    } else if (profile?.role === 'student') {
      redirect(ROUTES.STUDENT.DASHBOARD)
    } else if (profile?.role === 'parent') {
      redirect(ROUTES.PARENT.DASHBOARD)
    } else if (profile?.role === 'admin') {
      redirect(ROUTES.ADMIN.DASHBOARD)
    }
  }

  const lang = await getServerLanguage()
  const resources = await preloadNamespaces(lang, ['landing'])

  return (
    <I18nProvider lang={lang} resources={resources}>
      <HomePage />
    </I18nProvider>
  )
}
