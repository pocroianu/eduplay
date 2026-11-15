import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ROUTES } from '@/shared/lib/constants';
import { getChildDetailData } from '@/features/parent-portal/server';
import { ChildDetailContent } from '@/features/parent-portal';
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

  const detail = await getChildDetailData(supabase, user.id, childId);
  if (!detail) redirect(ROUTES.PARENT.DASHBOARD);
  const { childData, streakDays, progressSummary, gamesWithProgress, childActivity, consents } = detail;

  return (
    <main aria-label="Detalii copil">
      <ChildDetailContent
        streakDays={streakDays}
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
          createdAt: childData.created_at ?? '',
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
