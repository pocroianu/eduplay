import { redirect } from 'next/navigation'
import { AssignmentsPageContent } from '@/features/teacher-dashboard'
import { getAssignmentsPageData } from '@/features/teacher-dashboard/server'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { getServerLanguage, preloadNamespaces } from '@/lib/i18n/server'
import { ROUTES } from '@/shared/lib/constants'

export default async function AssignmentsPage() {
  const data = await getAssignmentsPageData()

  if (!data) {
    redirect(ROUTES.AUTH.LOGIN)
  }

  const lang = await getServerLanguage()
  const resources = await preloadNamespaces(lang, ['teacher'])

  return (
    <I18nProvider lang={lang} resources={resources}>
      <AssignmentsPageContent
        profile={data.profile}
        assignments={data.assignments}
        totalCount={data.totalCount}
        classes={data.classes}
      />
    </I18nProvider>
  )
}
