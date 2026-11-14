import { redirect } from 'next/navigation'
import { ROUTES } from '@/shared/lib/constants'

export default function TeacherGamesPage() {
  redirect(ROUTES.TEACHER.ACTIVITIES)
}
