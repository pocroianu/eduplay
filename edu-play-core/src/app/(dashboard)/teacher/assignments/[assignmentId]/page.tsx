import { redirect, notFound } from 'next/navigation'
import { AssignmentComposer } from '@/features/teacher-dashboard'
import { getAssignmentEditData } from '@/features/teacher-dashboard/server'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { getServerLanguage, preloadNamespaces } from '@/lib/i18n/server'
import { ROUTES } from '@/shared/lib/constants'

interface AssignmentEditPageProps {
  params: Promise<{ assignmentId: string }>
}

export default async function AssignmentEditPage({ params }: AssignmentEditPageProps) {
  const { assignmentId } = await params
  const data = await getAssignmentEditData(assignmentId)

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
      <AssignmentComposer
        profile={{
          id: data.profile.id,
          full_name: data.profile.full_name,
          avatar_url: data.profile.avatar_url,
        }}
        classes={data.classes}
        activities={data.activities}
        editMode={{
          assignmentId: data.assignment.id,
          activityId: data.assignment.activity_id,
          classId: data.assignment.class_id,
          studentId: data.assignment.student_id,
          dueDate: data.assignment.due_date,
          isMandatory: data.assignment.is_mandatory,
        }}
      />
    </I18nProvider>
  )
}
