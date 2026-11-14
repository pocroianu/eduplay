import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ROUTES } from '@/shared/lib/constants';
import type { ProgressSummary } from '@/features/parent-portal/server';
import {
  getLinkedChildren,
  getChildProgressSummary,
  getRecentActivity,
} from '@/features/parent-portal/server';
import {
  getFamilyFeed,
  enrichFeedItemsWithSignedUrls,
} from '@/features/family-feed/server';
import { ParentDashboardContent } from '@/features/parent-portal';
import { I18nProvider } from '@/lib/i18n/I18nProvider';
import { getServerLanguage, preloadNamespaces } from '@/lib/i18n/server';

const FEED_PAGE_SIZE = 20;

interface ParentDashboardPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstString(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function ParentDashboard({
  searchParams,
}: ParentDashboardPageProps) {
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

  const params = await searchParams;
  const lang = await getServerLanguage();
  const resources = await preloadNamespaces(lang, ['parent']);

  const childParam = firstString(params.child);

  // Fetch children and recent activity in parallel.
  let linkedChildren: Awaited<ReturnType<typeof getLinkedChildren>> = [];
  let recentActivity: Awaited<ReturnType<typeof getRecentActivity>> = [];

  try {
    const [children, activity] = await Promise.all([
      getLinkedChildren(user.id),
      getRecentActivity(user.id, 10),
    ]);
    linkedChildren = children;
    recentActivity = activity;
  } catch (error) {
    console.error('Error fetching parent dashboard data:', error);
  }

  // Fetch progress summaries for each child in parallel
  let childProgressMap: Map<string, ProgressSummary> = new Map();
  if (linkedChildren.length > 0) {
    try {
      const progressPromises = linkedChildren.map((child) =>
        getChildProgressSummary(child.id).then(
          (summary) => [child.id, summary] as const,
        ),
      );
      const progressResults = await Promise.all(progressPromises);
      childProgressMap = new Map(progressResults);
    } catch (error) {
      console.error('Error fetching child progress summaries:', error);
    }
  }

  const childrenWithStats = linkedChildren.map((child) => {
    const stats = childProgressMap.get(child.id) ?? {
      totalGamesPlayed: 0,
      completedGames: 0,
      inProgressGames: 0,
      averageScore: 0,
      totalPlayTime: 0,
      lastActivityAt: null,
    };
    return {
      ...child,
      stats,
    };
  });

  // The selector applies a filter only when the supplied id maps to a linked
  // child. Anything else (stale param, un-linked id) silently degrades to
  // "all children" so a stray query string can't surface another parent's
  // feed.
  const validChildIds = new Set(linkedChildren.map((c) => c.id));
  const activeChildId =
    childParam && validChildIds.has(childParam) ? childParam : null;

  let enrichedFeedItems: Awaited<ReturnType<typeof enrichFeedItemsWithSignedUrls>> =
    [];
  let feedNextCursor: string | null = null;
  if (linkedChildren.length > 0) {
    try {
      const feedPage = await getFamilyFeed(supabase, user.id, {
        limit: FEED_PAGE_SIZE,
        ...(activeChildId ? { childId: activeChildId } : {}),
      });
      feedNextCursor = feedPage.nextCursor;
      enrichedFeedItems = await enrichFeedItemsWithSignedUrls(
        supabase,
        feedPage.items,
      );
    } catch (error) {
      console.error('Error fetching family feed:', error);
    }
  }

  const aggregateStats = {
    totalChildren: linkedChildren.length,
    totalGamesPlayed: childrenWithStats.reduce(
      (sum, c) => sum + c.stats.totalGamesPlayed,
      0,
    ),
    averageScore:
      childrenWithStats.length > 0
        ? Math.round(
            (childrenWithStats.reduce(
              (sum, c) => sum + c.stats.averageScore,
              0,
            ) /
              childrenWithStats.filter((c) => c.stats.totalGamesPlayed > 0)
                .length) *
              10,
          ) / 10 || 0
        : 0,
    totalPlayTime: childrenWithStats.reduce(
      (sum, c) => sum + c.stats.totalPlayTime,
      0,
    ),
  };

  return (
    <I18nProvider lang={lang} resources={resources}>
      <ParentDashboardContent
        profile={{
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          role: profile.role,
          avatar_url: profile.avatar_url,
        }}
        linkedChildren={childrenWithStats}
        recentActivity={recentActivity.map((a, idx) =>
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
        )}
        aggregateStats={aggregateStats}
        feedItems={enrichedFeedItems}
        feedNextCursor={feedNextCursor}
        activeChildId={activeChildId}
      />
    </I18nProvider>
  );
}
