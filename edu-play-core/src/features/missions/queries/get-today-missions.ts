import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { IconName } from '@/shared/components/ui/Icon.registry'

export type MissionTone = 'primary' | 'secondary' | 'tertiary'

export interface Mission {
  /** Assignment id — stable for keys. */
  id: string
  activityId: string
  title: string
  description: string
  /** Completed steps — currently 1 if Activity Progress has a completed row, else 0. */
  progress: number
  /** Steps required to complete — currently always 1 per assignment. */
  total: number
  /** XP reward computed from Activity difficulty (falls back to 50). */
  xp: number
  /** Phosphor icon name derived from the Activity category. */
  icon: IconName
  /** Visual tone for the left border + chip. */
  tone: MissionTone
}

const CATEGORY_VISUALS: Record<string, { icon: IconName; tone: MissionTone }> = {
  math: { icon: 'Calculator', tone: 'tertiary' },
  romanian: { icon: 'BookOpen', tone: 'primary' },
  science: { icon: 'Atom', tone: 'tertiary' },
  english: { icon: 'BookOpen', tone: 'secondary' },
  art: { icon: 'Palette', tone: 'secondary' },
}

const DEFAULT_VISUAL: { icon: IconName; tone: MissionTone } = { icon: 'RocketLaunch', tone: 'primary' }

const XP_BY_DIFFICULTY: Record<number, number> = {
  1: 30,
  2: 50,
  3: 80,
  4: 100,
  5: 120,
}

const MAX_MISSIONS = 3
const EMPTY_CLASS_ID = '00000000-0000-0000-0000-000000000000'

function difficultyToLevel(difficulty: string | null): number {
  if (difficulty === 'easy') return 1
  if (difficulty === 'medium') return 3
  if (difficulty === 'hard') return 5
  return 2
}

type AssignmentRow = {
  id: string
  activity_id: string
  due_date: string | null
  class_id: string | null
  student_id: string | null
  created_at: string | null
  activities: {
    id: string
    title: string
    description: string | null
    category: string | null
    difficulty: string | null
  } | null
}

type ProgressRow = {
  activity_id: string
  status: string | null
}

function toMission(
  assignment: AssignmentRow,
  completedTargetIds: Set<string>,
): Mission | null {
  const activity = assignment.activities
  const targetId = assignment.activity_id
  if (!targetId || !activity) return null

  const category = activity.category
  const visual = category ? CATEGORY_VISUALS[category] : undefined
  const { icon, tone } = visual ?? DEFAULT_VISUAL
  const xp = XP_BY_DIFFICULTY[difficultyToLevel(activity.difficulty)] ?? 50

  return {
    id: assignment.id,
    activityId: targetId,
    title: activity.title,
    description:
      activity.description?.trim() ||
      'Misiune de la profesorul tău — intră în activitate pentru detalii.',
    progress: completedTargetIds.has(targetId) ? 1 : 0,
    total: 1,
    xp,
    icon,
    tone,
  }
}

/**
 * Pick up to {@link MAX_MISSIONS} missions for today. The caller passes rows;
 * the filtering + fallback logic is pure so it is unit-testable.
 *
 *   1. Prefer assignments whose `due_date::date` matches today (UTC).
 *   2. Fallback to the oldest uncompleted assignments.
 *
 * Invariant: returned assignments are unique by `id` and each has an Activity target.
 */
export function pickTodayMissions(
  assignments: ReadonlyArray<AssignmentRow>,
  completedTargetIds: Set<string>,
  today: Date = new Date(),
): Mission[] {
  const todayKey = today.toISOString().slice(0, 10)

  const scheduledForToday: AssignmentRow[] = []
  const fallbackQueue: AssignmentRow[] = []

  for (const assignment of assignments) {
    const targetId = assignment.activity_id
    if (!assignment.activities || !targetId) continue
    if (completedTargetIds.has(targetId)) continue

    if (
      assignment.due_date &&
      assignment.due_date.slice(0, 10) === todayKey
    ) {
      scheduledForToday.push(assignment)
    } else {
      fallbackQueue.push(assignment)
    }
  }

  const ordered =
    scheduledForToday.length > 0
      ? scheduledForToday.slice(0, MAX_MISSIONS)
      : fallbackQueue
          .sort((a, b) => {
            const ta = a.created_at ? Date.parse(a.created_at) : 0
            const tb = b.created_at ? Date.parse(b.created_at) : 0
            return ta - tb
          })
          .slice(0, MAX_MISSIONS)

  return ordered
    .map((assignment) => toMission(assignment, completedTargetIds))
    .filter((mission): mission is Mission => mission !== null)
}

/**
 * Fetch today's missions for the current student. Returns up to 3 items or
 * `[]` if there are no assignments to surface. Accepts an explicit
 * `studentId` + `classId` so it can be called from loaders that already
 * fetched that profile info.
 */
export async function getTodayMissions(
  studentId: string,
  classId: string | null,
): Promise<Mission[]> {
  const supabase = await createClient()

  const classFilter = classId ?? EMPTY_CLASS_ID

  const [assignmentsResult, progressResult] = await Promise.all([
    supabase
      .from('assignments')
      .select(
        `
        id,
        activity_id,
        due_date,
        class_id,
        student_id,
        created_at,
        activities:activity_id (
          id,
          title,
          description,
          category,
          difficulty
        )
      `,
      )
      .or(`student_id.eq.${studentId},class_id.eq.${classFilter}`),
    supabase
      .from('activity_progress')
      .select('activity_id, status')
      .eq('student_id', studentId),
  ])

  if (assignmentsResult.error) {
    console.error('[missions] getTodayMissions assignments failed:', assignmentsResult.error)
    return []
  }

  const completedTargetIds = new Set<string>()
  for (const row of (progressResult.data ?? []) as ProgressRow[]) {
    if (row.status !== 'completed') continue
    completedTargetIds.add(row.activity_id)
  }

  const assignments = (assignmentsResult.data ?? []) as unknown as AssignmentRow[]
  return pickTodayMissions(assignments, completedTargetIds)
}
