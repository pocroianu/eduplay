import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ROUTES } from '@/shared/lib/constants'
import { getGamesWithProgress } from '@/features/games/server'
import { getAgeBand } from '@/shared/lib/utils/age'
import { StudentProgressContent } from './StudentProgressContent'

export default async function StudentProgressPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(ROUTES.AUTH.LOGIN)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, date_of_birth, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'student') {
    redirect(ROUTES.AUTH.LOGIN)
  }

  const games = await getGamesWithProgress(user.id)

  return (
    <StudentProgressContent
      profile={{
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
      }}
      ageBand={getAgeBand(profile.date_of_birth)}
      games={games}
    />
  )
}
