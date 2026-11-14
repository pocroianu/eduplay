import { redirect } from 'next/navigation'
import { ROUTES } from '@/shared/lib/constants'

export default function StudentGamesPage() {
  redirect(ROUTES.STUDENT.ACTIVITIES)
}
