import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ROUTES } from '@/shared/lib/constants/routes';
import { EmptyState, SectionHeader } from '@/shared/components/ui/kit';
import { Icon } from '@/shared/components/ui/Icon';
import {
  getArtifactsForChild,
  withArtifactMedia,
  groupArtifactsByMonth,
} from '@/features/portfolio/server';
import { TeacherPortfolioCard } from '@/features/portfolio';

const SIGNED_URL_TTL_SECONDS = 60 * 5;

interface ParentChildPortfolioPageProps {
  params: Promise<{ id: string }>;
}

export default async function ParentChildPortfolioPage({
  params,
}: ParentChildPortfolioPageProps) {
  const { id: childId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.AUTH.LOGIN);

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single();
  if (!profile || profile.role !== 'parent') {
    redirect(ROUTES.AUTH.LOGIN);
  }

  // Verify the parent-child link is active. Mirrors the existing parent
  // child-detail page guard (`src/app/(dashboard)/parent/children/[id]/page.tsx`).
  const { data: parentChildLink } = await supabase
    .from('parent_children')
    .select('id')
    .eq('parent_id', user.id)
    .eq('student_id', childId)
    .eq('status', 'active')
    .single();

  if (!parentChildLink) {
    redirect(ROUTES.PARENT.DASHBOARD);
  }

  const { data: childData } = await supabase
    .from('students')
    .select('id, username')
    .eq('id', childId)
    .single();

  if (!childData) {
    redirect(ROUTES.PARENT.DASHBOARD);
  }

  const artifacts = await getArtifactsForChild(supabase, {
    childId,
    role: 'parent',
  });
  const artifactsWithUrls = await withArtifactMedia(supabase, artifacts, SIGNED_URL_TTL_SECONDS);
  const mediaById = new Map(artifactsWithUrls.map(row => [row.id, row.mediaUrl]));
  const monthGroups = groupArtifactsByMonth(artifactsWithUrls);

  return (
    <div className="flex h-full min-h-screen flex-col bg-surface text-on-surface">
      <div className="p-6 lg:p-10">
        <div className="mx-auto max-w-[1100px] space-y-8">
          <Link
            href={ROUTES.PARENT.CHILD(childId)}
            className="inline-flex items-center gap-2 text-sm font-bold text-on-surface-variant hover:text-primary transition-colors"
          >
            <Icon name="ArrowLeft" size={16} />
            Înapoi la copil
          </Link>

          <SectionHeader
            eyebrow="Portofoliu"
            title={`Lucrările lui ${childData.username}`}
            subtitle="Toate creațiile partajate cu familia, ordonate de la cea mai recentă."
            icon="Heart"
            iconTone="primary"
          />

          {monthGroups.length === 0 ? (
            <EmptyState
              icon="Confetti"
              title="Încă nu există lucrări de privit."
              description="Pe măsură ce profesorul publică lucrări, vor apărea aici."
            />
          ) : (
            <div
              data-testid="parent-portfolio-timeline"
              className="flex flex-col gap-10"
            >
              {monthGroups.map((group) => (
                <section
                  key={group.key}
                  aria-labelledby={`parent-portfolio-month-${group.key}`}
                  className="flex flex-col gap-4"
                >
                  <h2
                    id={`parent-portfolio-month-${group.key}`}
                    className="text-sm font-bold uppercase tracking-widest text-on-surface-variant"
                  >
                    {group.label}
                  </h2>
                  <ul
                    aria-label={`Lucrări din ${group.label}`}
                    className="grid grid-cols-1 gap-4 lg:grid-cols-2"
                  >
                    {group.artifacts.map((artifact) => (
                      <li key={artifact.id}>
                        <TeacherPortfolioCard
                          artifact={artifact}
                          studentUsername={childData.username}
                          className={null}
                          mediaUrl={mediaById.get(artifact.id) ?? null}
                          readOnly
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
