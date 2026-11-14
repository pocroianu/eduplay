'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/lib/i18n/formatters';
import { ROUTES } from '@/shared/lib/constants/routes';
import {
  Card,
  ChunkyButton,
  Pill,
} from '@/shared/components/ui/kit';
import { unassignPath } from '../actions';

interface PathAssignmentItem {
  id: string;
  classId: string | null;
  studentId: string | null;
  targetType: 'class' | 'student';
  targetName: string;
  targetDetail: string | null;
  dueDate: string | null;
}

interface PathAssignmentsListProps {
  pathId: string;
  assignments: PathAssignmentItem[];
}

export function formatAssignmentDueDate(dueDate: string): string {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDate);
  if (!dateOnlyMatch) return formatDate(dueDate);

  const [, year, month, day] = dateOnlyMatch;
  return formatDate(
    new Date(Number(year), Number(month) - 1, Number(day)),
  );
}

export function formatAssignmentsCount(count: number): string {
  return count === 1 ? '1 atribuire' : `${count} atribuiri`;
}

export function PathAssignmentsList({ pathId, assignments }: PathAssignmentsListProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleUnassign(assignmentId: string) {
    setMessage(null);
    setPendingId(assignmentId);
    startTransition(async () => {
      const result = await unassignPath(assignmentId);
      if (!result.success) {
        setMessage(result.error ?? 'Nu am putut retrage atribuirea.');
        setPendingId(null);
        return;
      }
      setPendingId(null);
      router.refresh();
    });
  }

  return (
    <Card className="space-y-4" data-testid="learning-path-assignments">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-headline text-2xl font-bold text-on-surface">
            Atribuiri
          </h3>
          <p className="mt-1 text-sm font-semibold text-on-surface-variant">
            Clasele și elevii care primesc acest parcurs.
          </p>
        </div>
        <Pill tone="sky">{formatAssignmentsCount(assignments.length)}</Pill>
      </div>

      {message ? (
        <Card role="alert" className="border border-coral-dim bg-coral-soft">
          <p className="font-body text-sm font-semibold text-coral-deep">
            {message}
          </p>
        </Card>
      ) : null}

      {assignments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container p-6 text-sm font-semibold text-on-surface-variant">
          Nu ai atribuit încă acest parcurs.
        </div>
      ) : (
        <ul className="space-y-3">
          {assignments.map((assignment) => (
            <li key={assignment.id}>
              <Card className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={assignment.targetType === 'class' ? 'sky' : 'purple'}>
                      {assignment.targetType === 'class' ? 'Clasă' : 'Elev'}
                    </Pill>
                    {assignment.dueDate ? (
                      <Pill tone="sun">
                        Scadent {formatAssignmentDueDate(assignment.dueDate)}
                      </Pill>
                    ) : null}
                  </div>
                  <div>
                    <h4
                      className="font-headline text-lg font-bold text-on-surface"
                      data-testid="learning-path-assignment-target"
                    >
                      {assignment.targetName}
                    </h4>
                    {assignment.targetDetail ? (
                      <p className="mt-1 text-sm font-semibold text-on-surface-variant">
                        {assignment.targetDetail}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  {assignment.targetType === 'class' && assignment.classId ? (
                    <ChunkyButton
                      size="sm"
                      variant="ghost"
                      icon="ChartLineUp"
                      href={ROUTES.TEACHER.CLASS_PATH_PROGRESS(
                        assignment.classId,
                        pathId,
                      )}
                    >
                      Vezi progresul
                    </ChunkyButton>
                  ) : null}
                  <ChunkyButton
                    type="button"
                    size="sm"
                    variant="ghost"
                    icon="UserMinus"
                    disabled={isPending && pendingId === assignment.id}
                    loading={isPending && pendingId === assignment.id}
                    onClick={() => handleUnassign(assignment.id)}
                    data-testid="learning-path-unassign"
                  >
                    Retrage
                  </ChunkyButton>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
