import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { BADGES, type BadgeDefinition, type BadgeId } from '../badges'

export interface BadgeStatus {
  /** The badge catalog entry — safe to serialize. */
  badge: BadgeDefinition
  /** Whether the student has met the threshold. */
  earned: boolean
  /** Progress toward the threshold, clamped to [0, threshold.min]. */
  progress: number
}

export interface StudentBadgeAggregates {
  gamesPlayed: number
  completedGames: number
  totalScore: number
  streak: number
}

/**
 * Pure reducer: turn raw aggregates into BadgeStatus rows using the BADGES
 * catalog. Exported so it can be unit-tested without Supabase.
 */
export function computeBadgeStatuses(
  aggregates: StudentBadgeAggregates,
): BadgeStatus[] {
  return BADGES.map((badge) => {
    const value = aggregates[badge.threshold.metric]
    const progress = Math.min(value, badge.threshold.min)
    return {
      badge,
      earned: value >= badge.threshold.min,
      progress,
    }
  })
}

/**
 * Aggregate a student's Activity Progress rows into the counters used to decide
 * which badges are earned. Streak currently collapses to "has any activity in
 * the last N days" — a richer streak calculation can replace this later.
 */
export function aggregateFromProgressRows(
  rows: ReadonlyArray<{
    status: string | null
    score: number | null
    last_played_at: string | null
  }>,
): StudentBadgeAggregates {
  const gamesPlayed = rows.length
  const completedGames = rows.filter((r) => r.status === 'completed').length
  const totalScore = rows.reduce((sum, r) => sum + (r.score ?? 0), 0)

  const now = Date.now()
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
  const activeDays = new Set<string>()
  for (const row of rows) {
    if (!row.last_played_at) continue
    const ts = new Date(row.last_played_at).getTime()
    if (Number.isNaN(ts)) continue
    if (now - ts > sevenDaysMs) continue
    activeDays.add(new Date(row.last_played_at).toISOString().slice(0, 10))
  }

  return {
    gamesPlayed,
    completedGames,
    totalScore,
    streak: activeDays.size,
  }
}

/**
 * Fetch Activity Progress for a student and compute badge statuses.
 * Returns a row per entry in the BADGES catalog, so callers can always render
 * the same shape (earned + locked) without branching on length.
 */
export async function getStudentBadges(
  studentId: string,
): Promise<BadgeStatus[]> {
  const supabase = await createClient()

  const { data: progress, error } = await supabase
    .from('activity_progress')
    .select('status, score, last_played_at')
    .eq('student_id', studentId)

  if (error) {
    console.error('[rewards] getStudentBadges failed:', error)
    // Fail open: return locked catalog so UI still renders.
    return BADGES.map((badge) => ({ badge, earned: false, progress: 0 }))
  }

  const aggregates = aggregateFromProgressRows(progress ?? [])
  return computeBadgeStatuses(aggregates)
}

export type { BadgeDefinition, BadgeId }
