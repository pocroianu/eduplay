import { redirect } from 'next/navigation'
import { TeacherDashboardContent } from '@/features/teacher-dashboard'
import { getTeacherDashboardData } from '@/features/teacher-dashboard/server'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { getServerLanguage, preloadNamespaces } from '@/lib/i18n/server'
import { ROUTES } from '@/shared/lib/constants'

export default async function TeacherDashboard() {
  const dashboardData = await getTeacherDashboardData()

  if (!dashboardData) {
    redirect(ROUTES.AUTH.LOGIN)
  }

  const lang = await getServerLanguage()
  const resources = await preloadNamespaces(lang, ['teacher'])

  return (
    <I18nProvider lang={lang} resources={resources}>
      <TeacherDashboardContent {...dashboardData} />
    </I18nProvider>
  )
}
