import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ROUTES } from '@/shared/lib/constants/routes';
import { EmptyState } from '@/shared/components/ui/kit';
import { Icon } from '@/shared/components/ui/Icon';
import {
  filtersToQueryOptions,
  getDraftArtifactsForTeacher,
  getSignedUrlsForArtifacts,
  parseTeacherPortfolioFilters,
} from '@/features/portfolio/server';
import {
  TeacherPortfolioFilters,
  TeacherPortfolioQueue,
  TeacherPortfolioUploadLauncher,
} from '@/features/portfolio';

export const metadata = {
  title: 'Răspunsuri de revizuit · EduPlay',
};

// Phase 1D ships without pagination — bump the cap from the query default (50)
// to 100 so realistic teacher class loads (≤6 classes × ~15 drafts) all land
// in one fetch. Cursor pagination is tracked in the F6 Phase 1E follow-up.
const TEACHER_QUEUE_LIMIT = 100;

interface TeacherPortfolioPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstString(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function initialsForClass(name: string | undefined): string {
  if (!name) return 'JR';
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]).join('');
  return (initials || name.slice(0, 2)).toUpperCase();
}

export default async function TeacherPortfolioPage({
  searchParams,
}: TeacherPortfolioPageProps) {
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

  const params = await searchParams;
  const filters = parseTeacherPortfolioFilters({
    classId: firstString(params.classId),
    studentId: firstString(params.studentId),
    from: firstString(params.from),
    to: firstString(params.to),
  });

  const { data: classesData } = await supabase
    .from('classes')
    .select('id, name')
    .eq('teacher_id', user.id)
    .order('name', { ascending: true });
  const classes = classesData ?? [];
  const teacherClassIds = classes.map((c) => c.id);

  const [studentsResult, draftsPage] = await Promise.all([
    teacherClassIds.length > 0
      ? supabase
          .from('students')
          .select('id, username, class_id')
          .in('class_id', teacherClassIds)
          .order('username', { ascending: true })
      : Promise.resolve({ data: [] }),
    getDraftArtifactsForTeacher(supabase, {
      ...filtersToQueryOptions(filters),
      limit: TEACHER_QUEUE_LIMIT,
    }),
  ]);

  const students = studentsResult.data ?? [];

  const drafts = draftsPage.items;
  const mediaUrls = await getSignedUrlsForArtifacts(supabase, drafts);
  const activeStudent =
    filters.studentId !== null
      ? students.find((student) => student.id === filters.studentId)
      : undefined;
  const activeClass =
    filters.classId !== null
      ? classes.find((cls) => cls.id === filters.classId)
      : activeStudent
        ? classes.find((cls) => cls.id === activeStudent.class_id)
        : classes.length === 1
          ? classes[0]
          : undefined;
  const visibleStudents = activeClass
    ? students.filter((student) => student.class_id === activeClass.id)
    : students;
  const uploadStudents = visibleStudents.map((student) => {
    const displayName = student.username;
    const [firstName = displayName, ...rest] = displayName.trim().split(/\s+/);
    return {
      id: student.id,
      firstName,
      lastName: rest.join(' '),
    };
  });
  const classLabel = activeClass?.name ?? 'Toate clasele';
  const classInitials = activeClass ? initialsForClass(classLabel) : 'TC';
  const journalLabel = activeClass
    ? 'Jurnalul clasei'
    : 'Jurnalul tuturor claselor';

  return (
    <div className="flex min-h-screen flex-col bg-surface text-on-surface">
      <header className="bg-class-header text-on-primary">
        <div className="mx-auto max-w-[1280px] px-5 pt-5 md:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-lg border border-on-primary/30 bg-on-primary/10 font-headline text-xl font-bold text-on-primary">
                {classInitials}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-on-primary/70">
                  Portofoliu profesor
                </p>
                <h1 className="truncate font-headline text-2xl font-bold tracking-tight md:text-3xl">
                  {classLabel}
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-on-primary/75">
              <span>{visibleStudents.length} elevi</span>
              <span>{drafts.length} de revizuit</span>
              <TeacherPortfolioUploadLauncher classStudents={uploadStudents} />
            </div>
          </div>

          <nav
            aria-label="Secțiuni portofoliu"
            className="mt-4 flex overflow-x-auto pl-0 md:pl-[72px]"
          >
            {([
              { label: 'Jurnal', icon: 'BookOpen' },
              { label: 'Activități', icon: 'ClipboardText' },
              { label: 'Catalog', icon: 'GraduationCap' },
              { label: 'Notificări', icon: 'Bell' },
            ] as const).map((tab, index) => (
              <span
                key={tab.label}
                aria-current={index === 0 ? 'page' : undefined}
                className={
                  index === 0
                    ? 'inline-flex items-center gap-2 border-b-2 border-on-primary bg-on-primary/10 px-5 py-3 text-sm font-bold text-on-primary'
                    : 'inline-flex items-center gap-2 border-b-2 border-transparent px-5 py-3 text-sm font-semibold text-on-primary/70'
                }
              >
                <Icon name={tab.icon} size={20} weight="bold" />
                {tab.label}
              </span>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 bg-surface-container">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-5 px-5 py-5 md:px-8 lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
          <TeacherPortfolioFilters
            classes={classes}
            students={students.map((s) => ({
              id: s.id,
              username: s.username,
              classId: s.class_id,
            }))}
            filters={filters}
          />

          <section className="min-w-0 space-y-4" aria-label={journalLabel}>
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 shadow-soft-sm">
              <div className="flex size-7 items-center justify-center rounded-sm bg-primary text-xs font-bold text-on-primary">
                {classInitials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-on-surface">
                  {journalLabel}
                </p>
                <p className="text-xs font-semibold text-on-surface-muted">
                  Revizuiește lucrările înainte să fie aprobate sau publicate.
                </p>
              </div>
              <span className="rounded-full bg-gold-soft px-3 py-1 text-xs font-bold text-gold-deep">
                {drafts.length} în coadă
              </span>
            </div>

            {drafts.length === 0 ? (
              <EmptyState
                icon="Confetti"
                title="Nu ai răspunsuri de revizuit. Bună treabă!"
                description="Când elevii trimit lucrări noi, apar aici pentru aprobare sau refacere."
              />
            ) : (
              <TeacherPortfolioQueue
                initialArtifacts={drafts}
                initialNextCursor={draftsPage.nextCursor}
                initialMediaUrls={mediaUrls}
                filters={{
                  classId: filters.classId ?? undefined,
                  studentId: filters.studentId ?? undefined,
                  from: filters.from ?? undefined,
                  to: filters.to ?? undefined,
                }}
                classes={classes}
                students={students.map((s) => ({
                  id: s.id,
                  username: s.username,
                }))}
                pageSize={TEACHER_QUEUE_LIMIT}
              />
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
