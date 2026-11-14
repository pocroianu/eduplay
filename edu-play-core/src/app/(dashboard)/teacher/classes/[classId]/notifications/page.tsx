import { notFound, redirect } from 'next/navigation'
import { getClassDetailData } from '@/features/teacher-dashboard/server'
import { ClassTabContent } from '@/features/teacher-dashboard'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { getServerLanguage, preloadNamespaces } from '@/lib/i18n/server'
import { ROUTES } from '@/shared/lib/constants'

export default async function ClassNotificationsPage({
  params,
}: {
  params: Promise<{ classId: string }>
}) {
  const { classId } = await params
  const data = await getClassDetailData(classId)

  if (!data) {
    redirect(ROUTES.AUTH.LOGIN)
  }

  if (data === 'not-found') {
    notFound()
  }

  const lang = await getServerLanguage()
  const resources = await preloadNamespaces(lang, ['teacher'])

  return (
    <I18nProvider lang={lang} resources={resources}>
      <ClassTabContent data={data} activeTab="notifications" />
    </I18nProvider>
  )
}
