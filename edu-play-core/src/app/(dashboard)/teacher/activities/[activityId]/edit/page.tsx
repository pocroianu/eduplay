import { notFound } from 'next/navigation'

import { CreateActivityWizard } from '@/features/teacher-activities'
import { getEditableFreeResponseDraft } from '@/features/teacher-activities/server'

interface EditActivityPageProps {
  params: Promise<{ activityId: string }>
}

export default async function EditActivityPage({ params }: EditActivityPageProps) {
  const { activityId } = await params
  const draft = await getEditableFreeResponseDraft(activityId)

  if (!draft) {
    notFound()
  }

  return <CreateActivityWizard interactiveTypes={[]} initialDraft={draft} />
}
