import { redirect } from 'next/navigation'
import { AssignmentComposer } from '@/features/teacher-dashboard'
import { getAssignmentsPageData } from '@/features/teacher-dashboard/server'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { getServerLanguage, preloadNamespaces } from '@/lib/i18n/server'
import { ROUTES } from '@/shared/lib/constants'

export default async function NewAssignmentPage() {
  const data = await getAssignmentsPageData()

  if (!data) {
    redirect(ROUTES.AUTH.LOGIN)
  }

  const lang = await getServerLanguage()
  const resources = await preloadNamespaces(lang, ['teacher'])

  return (
    <I18nProvider lang={lang} resources={resources}>
      <AssignmentComposer
        profile={{
          id: data.profile.id,
          full_name: data.profile.full_name,
          avatar_url: data.profile.avatar_url,
        }}
        classes={data.classes}
        activities={data.activities}
      />
    </I18nProvider>
  )
}
