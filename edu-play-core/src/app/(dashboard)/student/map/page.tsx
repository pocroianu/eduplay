import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/shared/lib/constants/routes'
import { LearningMap } from '@/features/learning-map'
import { mapActivePathToLearningMap } from '@/features/learning-map/server'
import { getActivePathForStudent } from '@/features/learning-paths/server'

export default async function StudentMapPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect(ROUTES.AUTH.LOGIN)

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'student') redirect(ROUTES.AUTH.LOGIN)

  const activePath = await getActivePathForStudent(supabase, user.id)
  const learningMap = activePath ? mapActivePathToLearningMap(activePath) : null
  const completedCount =
    learningMap?.stages.filter((stage) => stage.status === 'completed').length ?? 0
  const currentLevel = Math.max(1, Math.floor(completedCount / 3) + 1)

  return (
    <LearningMap
      profile={{
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        totalStars: completedCount * 3,
        level: currentLevel,
        levelLabel: `Nivel ${currentLevel} Explorator`,
        xp: learningMap?.overallProgress ?? 0,
        maxXp: 100,
      }}
      stages={learningMap?.stages ?? []}
      overallProgress={learningMap?.overallProgress ?? 0}
      nextLesson={learningMap?.nextLesson}
    />
  )
}
