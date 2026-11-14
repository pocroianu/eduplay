import { redirect } from 'next/navigation'
import { ROUTES } from '@/shared/lib/constants'

export default function ParentGamesPage() {
  redirect(ROUTES.PARENT.ACTIVITIES)
}
