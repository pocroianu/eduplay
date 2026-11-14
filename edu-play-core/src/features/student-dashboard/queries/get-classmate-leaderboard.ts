import 'server-only'

import { createClient } from '@/lib/supabase/server'

export interface LeaderboardEntry {
  /** Display name — first word of `profiles.full_name` only (no surnames). */
  firstName: string
  /** Aggregate XP (sum of Activity Progress score) for the classmate. */
  xp: number
}

/**
 * Fetch the classmate leaderboard for a student.
 *
 * Returns:
 *   - `null` if the student has no class_id (caller renders a "join a class"
 *     empty state rather than an empty leaderboard).
 *   - `LeaderboardEntry[]` otherwise, sorted by XP desc. Never includes the
 *     requesting student (the helper filters them out on the SQL side).
 *
 * RLS: relies on the `get_student_classmates` SECURITY DEFINER helper
 * (migration 20260419232837) which returns only IDs that share a class with
 * the requested student — no teacher-scoped policy needed.
 *
 * PII: returns `{ firstName, xp }` only. No surnames, emails, or avatars.
 */
export async function getClassmateLeaderboard(
  studentId: string,
  classId: string | null,
  options: { limit?: number } = {},
): Promise<LeaderboardEntry[] | null> {
  if (!classId) return null

  const limit = options.limit ?? 4
  const supabase = await createClient()

  const { data: classmateRows, error: classmateError } = await supabase.rpc(
    'get_student_classmates',
    { p_student_id: studentId },
  )

  if (classmateError) {
    console.error('[student-dashboard] get_student_classmates failed:', classmateError)
    return []
  }

  const classmateIds = ((classmateRows ?? []) as Array<{ id: string }>).map(
    (row) => row.id,
  )
  if (classmateIds.length === 0) return []

  const [{ data: progressRows, error: progressError }, { data: profileRows, error: profileError }] =
    await Promise.all([
      supabase
        .from('activity_progress')
        .select('student_id, score')
        .in('student_id', classmateIds),
      supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', classmateIds),
    ])

  if (progressError) {
    console.error('[student-dashboard] leaderboard progress query failed:', progressError)
    return []
  }
  if (profileError) {
    console.error('[student-dashboard] leaderboard profiles query failed:', profileError)
    return []
  }

  const xpById = new Map<string, number>()
  for (const row of progressRows ?? []) {
    xpById.set(row.student_id, (xpById.get(row.student_id) ?? 0) + (row.score ?? 0))
  }

  const leaderboard: LeaderboardEntry[] = (profileRows ?? [])
    .map((profile) => ({
      firstName: (profile.full_name ?? '').trim().split(/\s+/)[0] || 'Coleg',
      xp: xpById.get(profile.id) ?? 0,
    }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, limit)

  return leaderboard
}
