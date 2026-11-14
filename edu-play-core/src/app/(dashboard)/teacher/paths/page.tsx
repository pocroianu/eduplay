import Link from 'next/link';
import { formatRelativeTime } from '@/lib/i18n/formatters';
import { getPathsForTeacher } from '@/features/learning-paths/server';
import { PathAssignmentDialog } from '@/features/learning-paths';
import { ROUTES } from '@/shared/lib/constants/routes';
import {
  Button,
  Card,
  EmptyState,
  Pill,
} from '@/shared/components/ui/kit';
import {
  getStepCountByPath,
  getTeacherPathAssignmentOptions,
} from './teacher-path-page-data';
import { requireTeacherPathPageContext } from './teacher-path-page-auth';

export const metadata = {
  title: 'Parcursuri · EduPlay',
};

function statusLabel(status: string) {
  if (status === 'published') return 'Publicat';
  if (status === 'archived') return 'Arhivat';
  return 'Ciornă';
}

function statusTone(status: string) {
  if (status === 'published') return 'lime';
  if (status === 'archived') return 'neutral';
  return 'sun';
}

export default async function TeacherPathsPage() {
  const { supabase, user } = await requireTeacherPathPageContext();

  const paths = await getPathsForTeacher(supabase, user.id);
  const [{ classOptions, studentOptions }, stepCountByPath] = await Promise.all([
    getTeacherPathAssignmentOptions(supabase, user.id),
    getStepCountByPath(supabase, paths.map((path) => path.id)),
  ]);

  const publishedCount = paths.filter((path) => path.status === 'published').length;
  const draftCount = paths.filter((path) => path.status === 'draft').length;
  const archivedCount = paths.filter((path) => path.status === 'archived').length;

  return (
    <div className="min-h-screen bg-surface-container text-on-surface">
      <div className="sticky top-0 z-10 border-b border-outline-variant bg-surface-container-lowest px-6 py-4 lg:px-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-on-surface-variant">
              Biblioteca mea
            </p>
            <h1 className="mt-1 font-headline text-2xl font-bold text-on-surface md:text-3xl">
              Parcursuri
            </h1>
            <p className="mt-1 text-sm font-medium text-on-surface-variant">
              Organizează parcursurile pentru lecțiile tale și atribuie activități publicate.
            </p>
          </div>
          <Button
            href={ROUTES.TEACHER.PATH_NEW}
            size="sm"
            data-testid="learning-path-new"
          >
            Creează parcurs
          </Button>
        </div>
        <div className="mx-auto mt-4 flex max-w-6xl gap-2 overflow-x-auto">
          <span className="rounded-md border border-primary bg-primary-soft px-4 py-2 text-sm font-bold text-primary-deep">
            Toate · {paths.length}
          </span>
          <span className="rounded-md border border-outline-variant bg-surface px-4 py-2 text-sm font-bold text-on-surface-variant">
            Publicate · {publishedCount}
          </span>
          <span className="rounded-md border border-outline-variant bg-surface px-4 py-2 text-sm font-bold text-on-surface-variant">
            Ciorne · {draftCount}
          </span>
          <span className="rounded-md border border-outline-variant bg-surface px-4 py-2 text-sm font-bold text-on-surface-variant">
            Arhivate · {archivedCount}
          </span>
        </div>
      </div>

      <main className="px-6 py-6 lg:px-10">
        <div className="mx-auto max-w-6xl">
          {paths.length === 0 ? (
            <EmptyState
              icon="MapTrifold"
              title="Nu ai parcursuri încă"
              description="Începe cu o ciornă scurtă și adaugă pașii potriviți clasei tale."
              action={
                <Button href={ROUTES.TEACHER.PATH_NEW}>
                  Creează un parcurs nou
                </Button>
              }
            />
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-3" data-testid="learning-path-list">
                {paths.map((path) => (
                  <Card
                    key={path.id}
                    padding="none"
                    shadow={false}
                    className="overflow-hidden border border-outline-variant"
                    data-testid="learning-path-card"
                  >
                    <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                      <Link
                        href={ROUTES.TEACHER.PATH(path.id)}
                        className="min-w-0 flex-1 no-underline"
                      >
                        <div className="min-w-0 space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Pill tone={statusTone(path.status)}>
                              {statusLabel(path.status)}
                            </Pill>
                            <Pill tone="sky">
                              {stepCountByPath.get(path.id) ?? 0} pași
                            </Pill>
                          </div>
                          <div>
                            <h3 className="font-headline text-lg font-bold text-on-surface">
                              {path.title}
                            </h3>
                            {path.description ? (
                              <p className="mt-1 line-clamp-2 text-sm font-medium text-on-surface-variant">
                                {path.description}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </Link>
                      <div className="flex flex-wrap items-center gap-3 border-t border-outline-variant pt-4 md:border-l md:border-t-0 md:pl-4 md:pt-0">
                        <p className="text-xs font-bold uppercase tracking-[0.08em] text-on-surface-muted">
                          Actualizat {formatRelativeTime(path.updatedAt).toLowerCase()}
                        </p>
                        <PathAssignmentDialog
                          pathId={path.id}
                          pathTitle={path.title}
                          classes={classOptions}
                          students={studentOptions}
                          disabled={path.status !== 'published'}
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <aside className="lg:sticky lg:top-36 lg:self-start">
                <Card className="space-y-4 border border-outline-variant bg-surface-container-lowest" shadow={false}>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-on-surface-variant">
                      Status clasă
                    </p>
                    <h2 className="mt-1 text-lg font-bold text-on-surface">
                      Flux de publicare
                    </h2>
                  </div>
                  <div className="divide-y divide-outline-variant text-sm font-semibold">
                    <div className="flex items-center justify-between py-3">
                      <span className="text-on-surface-variant">Ciorne în lucru</span>
                      <Pill tone="sun">{draftCount}</Pill>
                    </div>
                    <div className="flex items-center justify-between py-3">
                      <span className="text-on-surface-variant">Gata de atribuit</span>
                      <Pill tone="lime">{publishedCount}</Pill>
                    </div>
                    <div className="flex items-center justify-between py-3">
                      <span className="text-on-surface-variant">Clase disponibile</span>
                      <Pill tone="neutral">{classOptions.length}</Pill>
                    </div>
                  </div>
                  <p className="text-sm font-medium leading-6 text-on-surface-variant">
                    Deschide un parcurs pentru a reordona pașii, apoi publică-l ca să îl poți trimite clasei sau elevilor selectați.
                  </p>
                </Card>
              </aside>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
