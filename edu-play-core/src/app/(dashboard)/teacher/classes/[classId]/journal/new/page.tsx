import { notFound, redirect } from 'next/navigation'
import { getClassDetailData } from '@/features/teacher-dashboard/server'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { getServerLanguage, preloadNamespaces } from '@/lib/i18n/server'
import { ROUTES } from '@/shared/lib/constants'
import { getJournalFlowCopy, JournalToolPickerContent } from './JournalPostFlows'

export default async function NewJournalPostPage({
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
  const copy = await getJournalFlowCopy(lang)

  return (
    <I18nProvider lang={lang} resources={resources}>
      <JournalToolPickerContent data={data} copy={copy} />
    </I18nProvider>
  )
}
