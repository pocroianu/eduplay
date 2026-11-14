import { formatDateTime } from '@/lib/i18n/formatters';
import { ROUTES } from '@/shared/lib/constants/routes';
import {
  ChunkyButton,
  DuoCard,
  EmptyState,
  Pill,
  SectionHeader,
} from '@/shared/components/ui/kit';
import type {
  ClassPathProgressResult,
  ClassPathProgressRow,
} from '../queries/get-class-path-progress';
import type { StudentPathProgressStatus } from '../types';
import { ProgressOverrideControl } from './ProgressOverrideControl';

interface ClassPathProgressMatrixProps {
  classId: string;
  pathId: string;
  result: ClassPathProgressResult;
}

const STATUS_META: Record<
  StudentPathProgressStatus,
  { label: string; tone: 'neutral' | 'lime' | 'sun' | 'sky' | 'purple' }
> = {
  not_started: { label: 'Neînceput', tone: 'neutral' },
  in_progress: { label: 'În progres', tone: 'sky' },
  completed: { label: 'Finalizat', tone: 'lime' },
  overridden: { label: 'Corectat manual', tone: 'purple' },
};

function statusMeta(row: ClassPathProgressRow) {
  return STATUS_META[row.progress?.status ?? 'not_started'];
}

function stepLabel(stepId: string | null | undefined, labels: Map<string, string>) {
  if (!stepId) return 'Niciun pas';
  return labels.get(stepId) ?? stepId;
}

function completionLabel(completedAt: string | null | undefined) {
  return completedAt ? formatDateTime(completedAt) : 'Nefinalizat';
}

function displayName(row: ClassPathProgressRow) {
  const fullName = row.student.fullName?.trim();
  return fullName ? fullName : row.student.username;
}

function hasAnyProgress(rows: ClassPathProgressRow[]) {
  return rows.some((row) => row.progress !== null);
}

export function ClassPathProgressMatrix({
  classId,
  pathId,
  result,
}: ClassPathProgressMatrixProps) {
  if (!result.ok) {
    const isNotAssigned = result.reason === 'not_assigned';

    return (
      <div className="min-h-screen bg-surface px-6 py-8 text-on-surface lg:px-10">
        <div className="mx-auto max-w-6xl">
          <EmptyState
            icon={isNotAssigned ? 'ClipboardText' : 'MagnifyingGlass'}
            title={
              isNotAssigned
                ? 'Parcurs neatribuit clasei'
                : 'Nu am găsit parcursul'
            }
            description={
              isNotAssigned
                ? 'Acest parcurs este vizibil, dar nu este atribuit clasei selectate.'
                : 'Parcursul sau clasa nu este disponibilă pentru contul tău.'
            }
            action={
              <ChunkyButton
                href={
                  isNotAssigned
                    ? ROUTES.TEACHER.PATH(pathId)
                    : ROUTES.TEACHER.CLASS(classId)
                }
                icon={isNotAssigned ? 'MapTrifold' : 'ArrowLeft'}
              >
                {isNotAssigned ? 'Deschide parcursul' : 'Înapoi la clasă'}
              </ChunkyButton>
            }
          />
        </div>
      </div>
    );
  }

  const rows = result.rows;
  const steps = result.steps;
  const hasProgress = hasAnyProgress(rows);
  const stepLabels = new Map(
    steps.map((step) => [step.id, `${step.stepOrder + 1}. ${step.title}`]),
  );

  return (
    <div className="min-h-screen bg-surface px-6 py-8 text-on-surface lg:px-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <SectionHeader
          eyebrow="Profesor"
          title={`Progres · ${result.path.title}`}
          subtitle="Urmărește unde se află fiecare elev în parcursul atribuit clasei."
          icon="ChartLineUp"
          iconTone="primary"
          action={
            <ChunkyButton
              href={ROUTES.TEACHER.CLASS(classId)}
              size="sm"
              variant="ghost"
              icon="ArrowLeft"
            >
              Înapoi la clasă
            </ChunkyButton>
          }
        />

        {rows.length === 0 ? (
          <EmptyState
            icon="Users"
            title="Clasa nu are elevi încă"
            description="Adaugă elevi în clasă pentru a vedea matricea de progres."
            action={
              <ChunkyButton
                href={ROUTES.TEACHER.CLASS(classId)}
                icon="Users"
              >
                Deschide clasa
              </ChunkyButton>
            }
          />
        ) : (
          <DuoCard className="space-y-5" data-testid="class-path-progress-matrix">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-headline text-2xl font-bold text-on-surface">
                  Matrice progres clasă
                </h2>
                <p className="mt-1 text-sm font-semibold text-on-surface-variant">
                  {hasProgress
                    ? 'Datele sunt grupate pe elev și se actualizează când elevii finalizează pași.'
                    : 'Nu există progres înregistrat încă'}
                </p>
              </div>
              <Pill tone={hasProgress ? 'lime' : 'neutral'}>
                {rows.length === 1 ? '1 elev' : `${rows.length} elevi`}
              </Pill>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] border-separate border-spacing-0 text-left">
                <caption className="sr-only">
                  Progresul clasei pentru {result.path.title}
                </caption>
                <thead>
                  <tr className="text-xs font-bold uppercase text-on-surface-muted">
                    <th scope="col" className="border-b-2 border-outline-variant px-4 py-3">
                      Elev
                    </th>
                    <th scope="col" className="border-b-2 border-outline-variant px-4 py-3">
                      Status
                    </th>
                    <th scope="col" className="border-b-2 border-outline-variant px-4 py-3">
                      Pas curent
                    </th>
                    <th scope="col" className="border-b-2 border-outline-variant px-4 py-3">
                      Ultimul pas finalizat
                    </th>
                    <th scope="col" className="border-b-2 border-outline-variant px-4 py-3">
                      Finalizat la
                    </th>
                    <th scope="col" className="border-b-2 border-outline-variant px-4 py-3">
                      Acțiune
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const meta = statusMeta(row);

                    return (
                      <tr
                        key={row.student.studentId}
                        className="align-top"
                        data-testid={`class-path-progress-row-${row.student.studentId}`}
                      >
                        <td className="border-b border-outline-variant px-4 py-4">
                          <div>
                            <p className="font-headline text-lg font-bold text-on-surface">
                              {displayName(row)}
                            </p>
                            <p className="text-sm font-semibold text-on-surface-muted">
                              @{row.student.username}
                            </p>
                          </div>
                        </td>
                        <td className="border-b border-outline-variant px-4 py-4">
                          <Pill tone={meta.tone}>{meta.label}</Pill>
                        </td>
                        <td className="border-b border-outline-variant px-4 py-4 font-mono text-sm font-bold text-on-surface">
                          {stepLabel(row.progress?.currentStepId, stepLabels)}
                        </td>
                        <td className="border-b border-outline-variant px-4 py-4 font-mono text-sm font-bold text-on-surface">
                          {stepLabel(row.progress?.lastCompletedStepId, stepLabels)}
                        </td>
                        <td className="border-b border-outline-variant px-4 py-4 text-sm font-semibold text-on-surface-variant">
                          {completionLabel(row.progress?.completedAt)}
                        </td>
                        <td className="border-b border-outline-variant px-4 py-4">
                          <ProgressOverrideControl
                            pathId={pathId}
                            studentId={row.student.studentId}
                            studentName={displayName(row)}
                            steps={steps}
                            currentStepId={row.progress?.currentStepId}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </DuoCard>
        )}
      </div>
    </div>
  );
}
