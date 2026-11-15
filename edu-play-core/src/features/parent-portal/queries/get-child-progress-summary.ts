import { createClient } from '@/lib/supabase/server';
import { getActivityProgress, summarizeActivityProgress } from '@/features/activities/server';
import type { ProgressSummary } from './types';

/** The caller verifies the active parent-child link; reads also retain RLS. */
export async function getChildProgressSummary(studentId: string): Promise<ProgressSummary> {
  try {
    const supabase = await createClient();
    const summary = summarizeActivityProgress(await getActivityProgress(supabase, studentId));
    return {
      totalGamesPlayed: summary.activityCount,
      completedGames: summary.completedCount,
      inProgressGames: summary.inProgressCount,
      averageScore: summary.averageScore,
      totalPlayTime: summary.totalMinutes,
      lastActivityAt: summary.lastActivityAt,
    };
  } catch (error) {
    console.error('Error fetching child progress summary:', error);
    return { totalGamesPlayed: 0, completedGames: 0, inProgressGames: 0, averageScore: 0, totalPlayTime: 0, lastActivityAt: null };
  }
}
