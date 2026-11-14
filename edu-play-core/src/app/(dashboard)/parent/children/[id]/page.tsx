import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ROUTES } from '@/shared/lib/constants';
import {
  getChildProgressSummary,
  getChildConsents,
  getRecentActivity,
  type ProgressSummary,
} from '@/features/parent-portal/server';
import { ChildDetailContent } from '@/features/parent-portal';
import type { GameWithProgress } from '@/features/games';
import { getChildrenGamesProgress } from '@/features/games/server';
import type { ConsentMap } from '@/features/activities';
import { Button } from '@/shared/components/ui/kit';

interface ChildDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ChildDetailPage({ params }: ChildDetailPageProps) {
  const { id: childId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(ROUTES.AUTH.LOGIN);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'parent') {
    redirect(ROUTES.AUTH.LOGIN);
  }

  // Security check: verify parent-child link exists and is active
  const { data: parentChildLink } = await supabase
    .from('parent_children')
    .select('id')
    .eq('parent_id', user.id)
    .eq('student_id', childId)
    .eq('status', 'active')
    .single();

  if (!parentChildLink) {
    // Not authorized to view this child
    redirect(ROUTES.PARENT.DASHBOARD);
  }

  // Fetch child data from students table
  const { data: childData } = await supabase
    .from('students')
    .select('id, username, avatar_url, created_at')
    .eq('id', childId)
    .single();

  if (!childData) {
    redirect(ROUTES.PARENT.DASHBOARD);
  }

  // Fetch all data in parallel
  let progressSummary: ProgressSummary = {
    totalGamesPlayed: 0,
    completedGames: 0,
    inProgressGames: 0,
    averageScore: 0,
    totalPlayTime: 0,
    lastActivityAt: null,
  };
  let allChildrenProgress: Awaited<ReturnType<typeof getChildrenGamesProgress>> = [];
  let recentActivity: Awaited<ReturnType<typeof getRecentActivity>> = [];
  let consents: ConsentMap = {};

  try {
    [progressSummary, allChildrenProgress, recentActivity, consents] =
      await Promise.all([
        getChildProgressSummary(childId),
        getChildrenGamesProgress(user.id),
        getRecentActivity(user.id, 20),
        getChildConsents(supabase, childId),
      ]);
  } catch (error) {
    console.error('Error fetching child detail data:', error);
  }

  // Filter games for this specific child
  const childGamesEntry = allChildrenProgress.find(
    (entry) => entry.id === childId,
  );
  const gamesWithProgress: GameWithProgress[] =
    childGamesEntry?.gamesWithProgress ?? [];

  // Filter activity for this specific child
  const childActivity = recentActivity
    .filter((a) => a.studentId === childId)
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

  return (
    <main aria-label="Detalii copil">
      <ChildDetailContent
        profile={{
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          role: profile.role,
          avatar_url: profile.avatar_url,
        }}
        child={{
          id: childData.id,
          name: childData.username,
          avatarUrl: childData.avatar_url,
          createdAt: childData.created_at,
        }}
        stats={progressSummary}
        gamesWithProgress={gamesWithProgress}
        recentActivity={childActivity}
        consents={consents}
      />
      <div className="px-6 pb-10 lg:px-10">
        <Button
          href={ROUTES.PARENT.CHILD_PORTFOLIO(childId)}
          variant="primary"
          size="lg"
        >
          Vezi portofoliul
        </Button>
      </div>
    </main>
  );
}
