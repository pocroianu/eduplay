import { createClient } from '@/lib/supabase/server'
import { getActivityType, getAssignmentActivityPlayHref } from '@/features/activities'
import { attachPinnedActivityIds, getStudentActivities } from '@/features/activities/server'
import type { IconName } from '@/shared/components/ui/Icon.registry'
import { getAgeBand } from '@/shared/lib/utils/age'
import { ROUTES } from '@/shared/lib/constants'
import type { PreschoolDashboardProps } from './components/PreschoolDashboard'
import type { SchoolAgeDashboardProps } from './components/SchoolAgeDashboard'
import type { StudentActivityCard } from './components/StudentActivitiesLane'
import { buildSchoolAgeDashboard } from './queries/build-school-age-dashboard'

const EMPTY_CLASS_ID = '00000000-0000-0000-0000-000000000000'

/** Daily star collection goal for preschool (3-6) — lower than school-age to match attention span */
const PRESCHOOL_DAILY_STAR_GOAL = 5

export type StudentDashboardData =
  | ({ variant: 'preschool' } & PreschoolDashboardProps)
  | ({ variant: 'school-age' } & SchoolAgeDashboardProps)

export async function getStudentDashboardData(): Promise<StudentDashboardData | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, date_of_birth, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'student') {
    return null
  }

  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('id', user.id)
    .single()

  const classId = student?.class_id ?? null

  const [{ data: assignments }, { data: progress }, { data: catalogActivities }, activities] =
    await Promise.all([
      supabase
        .from('assignments')
        .select(
          `*,
          version:activity_versions!assignments_version_id_fkey (activity_id),
          activities:activity_id (*)`,
        )
        .or(`student_id.eq.${user.id},class_id.eq.${classId || EMPTY_CLASS_ID}`),
      supabase
        .from('activity_progress')
        .select('*')
        .eq('student_id', user.id),
      supabase
        .from('activities')
        .select('*')
        .eq('is_published', true),
      getStudentActivities(supabase, user.id),
    ])

  const activityCatalog = (catalogActivities ?? []).map((activity) => ({
    id: activity.id,
    title: activity.title,
    category: activity.category,
    game_url: ROUTES.PLAY.ACTIVITY(activity.id),
    difficulty_level:
      activity.difficulty === 'easy'
        ? 1
        : activity.difficulty === 'medium'
          ? 3
          : 5,
    thumbnail_url: activity.thumbnail_url ?? null,
  }))

  const assignmentsWithActivityIds = (await attachPinnedActivityIds(assignments ?? [])).map(
    (assignment) => ({
      ...assignment,
      games: assignment.activities ?? null,
    }),
  )

  const legacyShapedProgress = (progress ?? []).map((entry) => ({
    ...entry,
    game_id: entry.activity_id,
  }))

  const completedCount = legacyShapedProgress.filter((entry) => entry.status === 'completed').length || 0
  const totalStars = legacyShapedProgress.reduce((acc, entry) => acc + Math.floor((entry.score || 0) / 20), 0) || 0

  const profileSummary = {
    full_name: profile.full_name,
    avatar_url: profile.avatar_url,
  }

  if (getAgeBand(profile.date_of_birth) === '3-6') {
    const progressMap = legacyShapedProgress.reduce((acc, entry) => {
      acc[entry.game_id] = {
        id: entry.id,
        game_id: entry.game_id,
        status: entry.status,
        score: entry.score,
        attempts: entry.attempts ?? 0,
      }
      return acc
    }, {} as Record<string, { id: string; game_id: string; status: string; score: number | null; attempts: number }>) || {}

    const inProgressGames = legacyShapedProgress.filter((entry) => entry.status === 'in_progress').map((entry) => ({
      id: entry.id,
      game_id: entry.game_id,
      status: entry.status,
      score: entry.score,
    }))

    return {
      variant: 'preschool',
      profile: profileSummary,
      totalStars,
      completedCount,
      dailyStarGoal: PRESCHOOL_DAILY_STAR_GOAL,
      inProgressGames,
      progressEntries: legacyShapedProgress as PreschoolDashboardProps['progressEntries'],
      assignments: assignmentsWithActivityIds.map((assignment) => ({
        id: assignment.id,
        launchHref: getAssignmentActivityPlayHref(assignment) ?? undefined,
        games: assignment.games as PreschoolDashboardProps['assignments'][number]['games'],
      })),
      activities: activities.map(toStudentActivityCard),
      allGames: activityCatalog.map((game) => ({
        id: game.id,
        title: game.title,
        category: game.category,
        difficulty_level: game.difficulty_level,
        thumbnail_url: game.thumbnail_url ?? null,
      })),
      progressMap,
    }
  }

  return buildSchoolAgeDashboard({
    profile: profileSummary,
    className: null,
    games: activityCatalog,
    progress: legacyShapedProgress,
    assignments: assignmentsWithActivityIds,
    activities: activities.map(toStudentActivityCard),
  })
}

function toStudentActivityCard(instance: {
  id: string
  typeId: string
  resultSummary: unknown | null
}): StudentActivityCard {
  const definition = getActivityType(instance.typeId)
  return {
    id: instance.id,
    typeId: instance.typeId,
    title: definition?.displayName ?? 'Activitate',
    description: instance.resultSummary
      ? 'Rezultat salvat'
      : 'Gata de început',
    icon: (definition?.icon ?? 'Sparkle') as IconName,
  }
}
