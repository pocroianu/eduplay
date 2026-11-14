import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ROUTES } from '@/shared/lib/constants/routes';
import { ApiError, assertTeacherOwnsStudent } from '@/lib/api';
import { EmptyState, SectionHeader } from '@/shared/components/ui/kit';
import { Icon } from '@/shared/components/ui/Icon';
import {
  getArtifactsForChild,
  groupArtifactsByMonth,
} from '@/features/portfolio/server';
import { TeacherPortfolioCard } from '@/features/portfolio';

export const metadata = {
  title: 'Portofoliu elev · EduPlay',
};

interface TeacherStudentPortfolioPageProps {
  params: Promise<{ studentId: string }>;
}

interface OwnedStudentRow {
  id: string;
  username: string;
  class_id: string | null;
}

export default async function TeacherStudentPortfolioPage({
  params,
}: TeacherStudentPortfolioPageProps) {
  const { studentId } = await params;
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
  if (!profile || profile.role !== 'teacher') {
    redirect(ROUTES.AUTH.LOGIN);
  }

  let student: OwnedStudentRow;
  try {
    student = await assertTeacherOwnsStudent<OwnedStudentRow>(
      supabase,
      user.id,
      studentId,
      { select: 'id, username, class_id' },
    );
  } catch (error) {
    if (error instanceof ApiError && error.code === 'NOT_FOUND') {
      notFound();
    }
    throw error;
  }

  const [artifacts, classRow] = await Promise.all([
    getArtifactsForChild(supabase, { childId: studentId, role: 'teacher' }),
    student.class_id
      ? supabase
          .from('classes')
          .select('id, name')
          .eq('id', student.class_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null } as const),
  ]);

  const className = classRow.data?.name ?? null;
  const monthGroups = groupArtifactsByMonth(artifacts);

  return (
    <div className="flex h-full min-h-screen flex-col bg-surface text-on-surface">
      <div className="p-6 lg:p-10">
        <div className="mx-auto max-w-[1100px] space-y-8">
          <Link
            href={ROUTES.TEACHER.STUDENT(studentId)}
            className="inline-flex items-center gap-2 text-sm font-bold text-on-surface-variant hover:text-primary transition-colors"
          >
            <Icon name="ArrowLeft" size={16} />
            Înapoi la profilul elevului
          </Link>

          <SectionHeader
            eyebrow="Portofoliu"
            title={`Portofoliul lui ${student.username}`}
            subtitle="Toate artefactele copilului — verifică ce este publicat sau încă în revizuire."
            icon="ClipboardText"
            iconTone="primary"
          />

          {monthGroups.length === 0 ? (
            <EmptyState
              icon="Confetti"
              title="Nu există încă artefacte pentru acest elev."
              description="Pe măsură ce copilul încarcă lucrări noi, vor apărea aici."
            />
          ) : (
            <div
              data-testid="teacher-portfolio-timeline"
              className="flex flex-col gap-10"
            >
              {monthGroups.map((group) => (
                <section
                  key={group.key}
                  aria-labelledby={`teacher-portfolio-month-${group.key}`}
                  className="flex flex-col gap-4"
                >
                  <h2
                    id={`teacher-portfolio-month-${group.key}`}
                    className="text-sm font-bold uppercase tracking-widest text-on-surface-variant"
                  >
                    {group.label}
                  </h2>
                  <ul
                    aria-label={`Artefacte din ${group.label}`}
                    className="grid grid-cols-1 gap-4 lg:grid-cols-2"
                  >
                    {group.artifacts.map((artifact) => (
                      <li key={artifact.id}>
                        <TeacherPortfolioCard
                          artifact={artifact}
                          studentUsername={student.username}
                          className={className}
                          showVisibility
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
