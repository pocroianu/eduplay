import type { SupabaseClient } from '@supabase/supabase-js'
import type { StudentRow, ProfileRow, ProgressRow, GameRow } from './types'

export interface ClassStudentsResult {
  studentCount: number
  studentRows: StudentRow[]
  profileMap: Map<string, ProfileRow>
  progressRows: ProgressRow[]
  gameMap: Map<string, GameRow>
}

export async function getClassStudents(
  supabase: SupabaseClient,
  scopedClassIds: string[],
): Promise<ClassStudentsResult> {
  const [studentCountResult, studentsResult] = await Promise.all([
    supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .in('class_id', scopedClassIds),
    supabase
      .from('students')
      .select('id, username, class_id')
      .in('class_id', scopedClassIds),
  ])

  const studentRows = (studentsResult.data || []) as StudentRow[]
  const studentIds = studentRows.map((student) => student.id)

  if (studentIds.length === 0) {
    return {
      studentCount: studentCountResult.count || 0,
      studentRows: [],
      profileMap: new Map(),
      progressRows: [],
      gameMap: new Map(),
    }
  }

  // Fetch profiles and canonical Activity Progress in parallel
  const [profilesResult, progressResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', studentIds),
    supabase
      .from('activity_progress')
      .select('id, student_id, status, score, attempts, last_played_at, activity_id, activities:activity_id (id, title, category, difficulty)')
      .in('student_id', studentIds)
      .order('last_played_at', { ascending: false }),
  ])

  const profileMap = new Map(
    ((profilesResult.data || []) as ProfileRow[]).map((p) => [p.id, p]),
  )

  const activityProgressRows = (progressResult.data || []) as unknown as Array<{
    id: string
    student_id: string
    status: string
    score: number | null
    attempts: number | null
    last_played_at: string | null
    activity_id: string
    activities:
      | {
          id: string
          title: string | null
          category: string | null
          difficulty: string | null
        }
      | Array<{
          id: string
          title: string | null
          category: string | null
          difficulty: string | null
        }>
      | null
  }>

  const progressRows = activityProgressRows.map((row) => ({
    id: row.id,
    student_id: row.student_id,
    status: row.status,
    score: row.score,
    attempts: row.attempts,
    last_played_at: row.last_played_at,
    game_id: row.activity_id,
  })) as ProgressRow[]

  const gameMap = new Map<string, GameRow>()
  for (const row of activityProgressRows) {
    const activity = Array.isArray(row.activities)
      ? row.activities[0]
      : row.activities
    gameMap.set(row.activity_id, {
      id: row.activity_id,
      title: activity?.title ?? null,
      category: activity?.category ?? null,
      difficulty_level: null,
    })
  }

  return {
    studentCount: studentCountResult.count || 0,
    studentRows,
    profileMap,
    progressRows,
    gameMap,
  }
}
