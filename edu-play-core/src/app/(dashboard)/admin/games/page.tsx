import { redirect } from 'next/navigation'
import { ROUTES } from '@/shared/lib/constants'

export default function AdminGamesPage() {
  redirect(ROUTES.ADMIN.ACTIVITIES)
}
