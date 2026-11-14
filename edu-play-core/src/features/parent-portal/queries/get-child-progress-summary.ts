import { createClient } from '@/lib/supabase/server';
import type { ProgressSummary } from './types';

/**
 * Fetch an aggregated progress summary for a specific student.
 *
 * Queries the activity_progress table and calculates:
 * - totalGamesPlayed: count of distinct activities the student has interacted with
 * - completedGames: count of activities with status = 'completed'
 * - inProgressGames: count of activities with status = 'in_progress'
 * - averageScore: average score across all scored entries
 * - totalPlayTime: sum of time_spent in minutes
 * - lastActivityAt: most recent last_played_at timestamp
 *
 * RLS: Runs as the authenticated parent. The caller must verify
 * the parent has access to the student before calling this function.
 *
 * @param studentId - The student's ID to fetch progress for
 * @returns Aggregated progress summary
 */
export async function getChildProgressSummary(
  studentId: string
): Promise<ProgressSummary> {
  const defaultSummary: ProgressSummary = {
    totalGamesPlayed: 0,
    completedGames: 0,
    inProgressGames: 0,
    averageScore: 0,
    totalPlayTime: 0,
    lastActivityAt: null,
  };

  try {
    const supabase = await createClient();

    // Fetch all canonical Activity Progress records for this student.
    const { data, error } = await supabase
      .from('activity_progress')
      .select('activity_id, status, score, time_spent, last_played_at')
      .eq('student_id', studentId);

    if (error) {
      console.error('Error fetching child progress summary:', error);
      return defaultSummary;
    }

    if (!data || data.length === 0) {
      return defaultSummary;
    }

    // Aggregate in application code from the single query result
    const uniqueGameIds = new Set(data.map((row) => row.activity_id));
    const completedGames = data.filter(
      (row) => row.status === 'completed'
    ).length;
    const inProgressGames = data.filter(
      (row) => row.status === 'in_progress'
    ).length;

    // Calculate average score (only from entries that have a score)
    const scoredEntries = data.filter(
      (row) => row.score !== null && row.score !== undefined
    );
    const averageScore =
      scoredEntries.length > 0
        ? scoredEntries.reduce((sum, row) => sum + (row.score ?? 0), 0) /
          scoredEntries.length
        : 0;

    // Sum time spent (in seconds from DB), convert to minutes
    const totalTimeSpentSeconds = data.reduce(
      (sum, row) => sum + (row.time_spent ?? 0),
      0
    );
    const totalPlayTime = Math.round(totalTimeSpentSeconds / 60);

    // Find the most recent activity timestamp
    const timestamps = data
      .map((row) => row.last_played_at)
      .filter((t): t is string => t !== null);
    const lastActivityAt =
      timestamps.length > 0
        ? timestamps.reduce((latest, current) =>
            current > latest ? current : latest
          )
        : null;

    return {
      totalGamesPlayed: uniqueGameIds.size,
      completedGames,
      inProgressGames,
      averageScore: Math.round(averageScore * 10) / 10, // Round to 1 decimal
      totalPlayTime,
      lastActivityAt,
    };
  } catch (error) {
    console.error('getChildProgressSummary error:', error);
    return defaultSummary;
  }
}
