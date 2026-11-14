import { redirect } from 'next/navigation'

import { CreateActivityWizard } from '@/features/teacher-activities'
import { getCreateActivityWizardData } from '@/features/teacher-activities/server'
import { ROUTES } from '@/shared/lib/constants'

export default async function CreateActivityPage() {
  const data = await getCreateActivityWizardData()

  if (!data) {
    redirect(ROUTES.AUTH.LOGIN)
  }

  return <CreateActivityWizard interactiveTypes={data.interactiveTypes} />
}
