import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ROUTES } from '@/shared/lib/constants'
import { ParentGamesPageContent } from '@/features/games'
import { getChildrenGamesProgress, getPublishedGames } from '@/features/games/server'

export default async function ParentActivitiesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(ROUTES.AUTH.LOGIN)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'parent') {
    redirect(ROUTES.AUTH.LOGIN)
  }

  let childrenProgress: Awaited<ReturnType<typeof getChildrenGamesProgress>> = []
  let catalogGames: Awaited<ReturnType<typeof getPublishedGames>> = []

  try {
    catalogGames = await getPublishedGames()
  } catch (error) {
    console.error('Error fetching parent activity catalog:', error)
  }

  try {
    childrenProgress = await getChildrenGamesProgress(user.id)
  } catch (error) {
    console.error('Error fetching children activity progress:', error)
  }

  return (
    <div className="p-6 lg:p-10">
      <ParentGamesPageContent childProgress={childrenProgress} catalogGames={catalogGames} />
    </div>
  )
}
