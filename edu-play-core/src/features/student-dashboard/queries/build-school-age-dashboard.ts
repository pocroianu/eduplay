import { isGameVisibleToStudents } from '@/lib/feature-flags'
import { getAssignmentActivityPlayHref } from '@/features/activities'
import { ROUTES } from '@/shared/lib/constants/routes'
import type {
  QuestLesson,
  QuestNodeState,
  QuestSubjectTone,
  QuestUnit,
} from '../components/quest-map'
import type { StudentActivityCard } from '../components/StudentActivitiesLane'

const SCHOOL_AGE_DEFAULT_LIVES = 5
const TODAYS_LESSONS_TARGET = 3

interface SubjectMeta {
  category: string
  catalogCategories: readonly string[]
  label: string
  tone: QuestSubjectTone
  nodeColor: string
  total: number
}

const SUBJECT_META: readonly SubjectMeta[] = [
  {
    category: 'math',
    catalogCategories: ['math'],
    label: 'Matematică',
    tone: 'math',
    nodeColor: 'var(--color-blue)',
    total: 20,
  },
  {
    category: 'romanian',
    catalogCategories: ['romanian', 'literacy', 'phonics', 'vocabulary'],
    label: 'Română',
    tone: 'romana',
    nodeColor: 'var(--color-coral)',
    total: 20,
  },
  {
    category: 'science',
    catalogCategories: ['science'],
    label: 'Științe',
    tone: 'stiinte',
    nodeColor: 'var(--color-primary)',
    total: 15,
  },
  {
    category: 'art',
    catalogCategories: ['art', 'shapes', 'colors'],
    label: 'Arte',
    tone: 'arte',
    nodeColor: 'var(--color-pink)',
    total: 12,
  },
  {
    category: 'english',
    catalogCategories: ['english'],
    label: 'Engleză',
    tone: 'gold',
    nodeColor: 'var(--color-gold)',
    total: 15,
  },
] as const

const CATEGORY_DURATION_MIN: Record<string, number> = {
  math: 10,
  romanian: 15,
  literacy: 15,
  phonics: 10,
  science: 8,
  art: 12,
  shapes: 8,
  colors: 8,
  english: 10,
  vocabulary: 10,
}

const CATEGORY_TONE: Record<string, QuestSubjectTone> = {
  math: 'math',
  romanian: 'romana',
  literacy: 'romana',
  phonics: 'romana',
  science: 'stiinte',
  english: 'gold',
  art: 'arte',
  shapes: 'arte',
  colors: 'arte',
  music: 'muzica',
  sport: 'sport',
  vocabulary: 'romana',
}

const CATEGORY_LABEL: Record<string, string> = {
  math: 'Matematică',
  romanian: 'Română',
  literacy: 'Litere',
  phonics: 'Sunete',
  science: 'Științe',
  english: 'Engleză',
  art: 'Arte',
  shapes: 'Forme',
  colors: 'Culori',
  music: 'Muzică',
  sport: 'Sport',
  vocabulary: 'Cuvinte',
}

export interface SchoolAgeGameRow {
  id: string
  title?: string | null
  category: string | null
  game_url?: string | null
}

export interface SchoolAgeProgressRow {
  game_id: string
  status: string
  score: number | null
  last_played_at?: string | null
  completed_at?: string | null
}

export interface SchoolAgeAssignmentRow {
  id: string
  activity_id?: string | null
  version_id?: string | null
  version?: {
    activity_id?: string | null
  } | null
  due_date?: string | null
  created_at?: string | null
  games?: SchoolAgeGameRow | null
}

interface BuildSchoolAgeDashboardInput {
  profile: {
    full_name: string
    avatar_url: string | null
  }
  className: string | null
  games: SchoolAgeGameRow[]
  progress: SchoolAgeProgressRow[]
  assignments: SchoolAgeAssignmentRow[]
  activities?: StudentActivityCard[]
  today?: Date
}

export function buildQuestUnits({
  games,
  progress,
}: {
  games: SchoolAgeGameRow[]
  progress: SchoolAgeProgressRow[]
}): QuestUnit[] {
  const completedGameIds = new Set(
    progress.filter((entry) => entry.status === 'completed').map((entry) => entry.game_id),
  )
  const inProgressGameIds = new Set(
    progress.filter((entry) => entry.status === 'in_progress').map((entry) => entry.game_id),
  )

  const subjectEntries = SUBJECT_META.map((meta) => {
    const subjectGames = games.filter((game) =>
      game.category ? meta.catalogCategories.includes(game.category) : false,
    )
    const completed = subjectGames.filter((game) => completedGameIds.has(game.id)).length
    const allDone = subjectGames.length > 0 && completed === subjectGames.length
    const hasProgress =
      completed > 0 || subjectGames.some((game) => inProgressGameIds.has(game.id))

    return {
      meta,
      subjectGames,
      completed,
      total: Math.max(subjectGames.length, meta.total, 1),
      allDone,
      hasProgress,
    }
  })
  const hasOpenProgress = subjectEntries.some(
    (entry) => !entry.allDone && entry.hasProgress,
  )
  const units: QuestUnit[] = []
  let firstActiveAssigned = false

  for (const { meta, subjectGames, completed, total, allDone, hasProgress } of subjectEntries) {
    let state: QuestNodeState

    if (allDone) {
      state = 'done'
    } else if (!firstActiveAssigned && hasProgress) {
      state = 'active'
      firstActiveAssigned = true
    } else if (!firstActiveAssigned && !hasOpenProgress && subjectGames.length > 0) {
      state = 'upcoming'
      firstActiveAssigned = true
    } else {
      state = 'locked'
    }

    units.push({
      id: meta.category,
      label: meta.label,
      state,
      tone: meta.tone,
      nodeColor: meta.nodeColor,
      href: ROUTES.STUDENT.ACTIVITIES,
      progress: completed,
      total,
    })
  }

  if (!units.some((unit) => unit.state === 'active')) {
    const firstNonDone = units.find(
      (unit) => unit.state !== 'done' && unit.state !== 'locked',
    )

    if (firstNonDone) {
      firstNonDone.state = 'active'
    }
  }

  return units
}

export function buildTodaysLessons({
  assignments,
  games,
  completedGameIds,
  today = new Date(),
}: {
  assignments: SchoolAgeAssignmentRow[]
  games: SchoolAgeGameRow[]
  completedGameIds: Set<string>
  today?: Date
}): QuestLesson[] {
  const eligibleAssignments = assignments.filter(
    (assignment): assignment is SchoolAgeAssignmentRow & { games: SchoolAgeGameRow } => {
      const game = assignment.games
      if (!game) return false
      if (completedGameIds.has(game.id)) return false
      return isVisibleSchoolAgeGame(game)
    },
  )

  const lessons: QuestLesson[] = orderAssignmentsForToday(eligibleAssignments, today)
    .slice(0, TODAYS_LESSONS_TARGET)
    .map((assignment) =>
      lessonFromGame(
        assignment.id,
        assignment.games,
        completedGameIds,
        getAssignmentActivityPlayHref(assignment),
      ),
    )

  if (lessons.length < TODAYS_LESSONS_TARGET) {
    const usedGameIds = new Set(
      assignments.map((assignment) => assignment.games?.id).filter((id): id is string => Boolean(id)),
    )

    for (const game of games.filter(isVisibleSchoolAgeGame)) {
      if (lessons.length >= TODAYS_LESSONS_TARGET) break
      if (usedGameIds.has(game.id)) continue
      if (completedGameIds.has(game.id)) continue

      lessons.push(lessonFromGame(game.id, game, completedGameIds))
    }
  }

  return lessons
}

export function buildSchoolAgeDashboard({
  profile,
  className,
  games,
  progress,
  assignments,
  activities = [],
  today = new Date(),
}: BuildSchoolAgeDashboardInput) {
  const completedGameIds = new Set(
    progress.filter((entry) => entry.status === 'completed').map((entry) => entry.game_id),
  )
  const visibleGames = games.filter(isVisibleSchoolAgeGame)
  const weeklyScore = progress
    .filter((entry) => isProgressInCurrentWeek(entry, today))
    .reduce((acc, entry) => acc + (entry.score || 0), 0)
  const units = buildQuestUnits({ games: visibleGames, progress })
  const primarySubject =
    units.find((unit) => unit.state === 'active')?.label ??
    units.find((unit) => unit.state === 'upcoming')?.label ??
    units[0]?.label ??
    null

  return {
    variant: 'school-age' as const,
    profile,
    className,
    primarySubject,
    stats: {
      lives: SCHOOL_AGE_DEFAULT_LIVES,
      weeklyXp: weeklyScore,
      streak: progress.filter((entry) => entry.last_played_at).length ? 1 : 0,
    },
    units,
    lessons: buildTodaysLessons({
      assignments,
      games: visibleGames,
      completedGameIds,
      today,
    }),
    activities,
  }
}

function orderAssignmentsForToday(
  assignments: Array<SchoolAgeAssignmentRow & { games: SchoolAgeGameRow }>,
  today: Date,
) {
  const todayKey = today.toISOString().slice(0, 10)
  const dueToday: Array<SchoolAgeAssignmentRow & { games: SchoolAgeGameRow }> = []
  const fallback: Array<SchoolAgeAssignmentRow & { games: SchoolAgeGameRow }> = []

  for (const assignment of assignments) {
    if (assignment.due_date?.slice(0, 10) === todayKey) {
      dueToday.push(assignment)
    } else {
      fallback.push(assignment)
    }
  }

  return [
    ...dueToday,
    ...fallback.sort((a, b) => {
      const ta = a.created_at ? Date.parse(a.created_at) : 0
      const tb = b.created_at ? Date.parse(b.created_at) : 0
      return ta - tb
    }),
  ]
}

function isProgressInCurrentWeek(entry: SchoolAgeProgressRow, today: Date) {
  const playedAt = entry.last_played_at ?? entry.completed_at
  if (!playedAt) return false

  const timestamp = Date.parse(playedAt)
  if (Number.isNaN(timestamp)) return false

  const start = startOfUtcWeek(today).getTime()
  const end = start + 7 * 24 * 60 * 60 * 1000

  return timestamp >= start && timestamp < end
}

function startOfUtcWeek(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = start.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  start.setUTCDate(start.getUTCDate() + diff)
  return start
}

function isVisibleSchoolAgeGame(game: SchoolAgeGameRow) {
  if (!game.game_url) return true
  return isGameVisibleToStudents({ game_url: game.game_url })
}

function lessonFromGame(
  id: string,
  game: SchoolAgeGameRow,
  completedGameIds: Set<string>,
  href?: string | null,
): QuestLesson {
  const category = game.category ?? 'math'

  return {
    id,
    title: game.title ?? CATEGORY_LABEL[category] ?? 'Lecție',
    subjectTone: CATEGORY_TONE[category] ?? 'neutral',
    subjectLabel: CATEGORY_LABEL[category] ?? game.title ?? 'Lecție',
    durationMinutes: CATEGORY_DURATION_MIN[category] ?? 10,
    done: completedGameIds.has(game.id),
    href: href ?? ROUTES.PLAY.ACTIVITY(game.id),
  }
}
