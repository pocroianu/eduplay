import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/shared/types/database';
import { getActivityStreak } from '@/features/activities/server';
import { getGamesWithProgress } from '@/features/games/server';
import type { GameWithProgress } from '@/features/games';
import type { ConsentMap } from '@/features/activities';
import { getChildProgressSummary } from './get-child-progress-summary';
import { getChildConsents } from './get-child-consents';
import { getRecentActivity } from './get-recent-activity';
import type { ProgressSummary } from './types';

// Scope once at the read interface, before any feed limit is applied.
export async function getChildDetailData(supabase: SupabaseClient<Database>, parentId: string, childId: string) {
  // Security check: verify parent-child link exists and is active
  const { data: parentChildLink } = await supabase
    .from('parent_children')
    .select('id')
    .eq('parent_id', parentId)
    .eq('student_id', childId)
    .eq('status', 'active')
    .single();

  if (!parentChildLink) {
    // Not authorized to view this child
    return null;
  }

  // Fetch child data from students table
  const { data: childData } = await supabase
    .from('students')
    .select('id, username, avatar_url, created_at')
    .eq('id', childId)
    .single();

  if (!childData) {
    return null;
  }

  const streakDays = await getActivityStreak(supabase, childId);

  // Fetch all data in parallel
  let progressSummary: ProgressSummary = {
    totalGamesPlayed: 0,
    completedGames: 0,
    inProgressGames: 0,
    averageScore: 0,
    totalPlayTime: 0,
    lastActivityAt: null,
  };
  let gamesWithProgress: GameWithProgress[] = [];
  let recentActivity: Awaited<ReturnType<typeof getRecentActivity>> = [];
  let consents: ConsentMap = {};

  try {
    [progressSummary, gamesWithProgress, recentActivity, consents] =
      await Promise.all([
        getChildProgressSummary(childId),
        getGamesWithProgress(childId),
        getRecentActivity(parentId, 20, childId),
        getChildConsents(supabase, childId),
      ]);
  } catch (error) {
    console.error('Error fetching child detail data:', error);
  }

  // Adapt the already-scoped feed for the child-detail presentation.
  const childActivity = recentActivity
    .map((a, idx) =>
      a.kind === 'artifact'
        ? {
            kind: 'artifact' as const,
            id: `artifact-${a.artifactId}-${idx}`,
            studentName: a.studentName,
            studentAvatar: a.studentAvatar,
            artifactId: a.artifactId,
            artifactTitle: a.artifactTitle,
            artifactType: a.artifactType,
            thumbnailUrl: a.thumbnailUrl,
            timestamp: a.timestamp,
          }
        : {
            kind: 'activity_progress' as const,
            id: `game-${a.studentId}-${a.gameId}-${idx}`,
            studentName: a.studentName,
            studentAvatar: a.studentAvatar,
            gameTitle: a.gameTitle,
            timestamp: a.timestamp,
            score: a.score,
            status: a.status as 'completed' | 'in_progress' | 'not_started',
          },
    );


  return { childData, streakDays, progressSummary, gamesWithProgress, childActivity, consents };
}
