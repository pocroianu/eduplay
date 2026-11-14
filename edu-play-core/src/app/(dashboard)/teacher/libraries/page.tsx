import { redirect } from 'next/navigation'
import { ROUTES } from '@/shared/lib/constants'

export default function TeacherLibrariesPage() {
  redirect(ROUTES.TEACHER.LIBRARIES_EXPLORE)
}
