'use client';

import {
  useEffect,
  useState,
  useTransition,
  type DragEvent,
  type FormEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Card,
  FilterSelect,
  type FilterSelectOption,
  Pill,
} from '@/shared/components/ui/kit';
import { Textarea, TextInput } from '@mantine/core';
import { MantineBoundary } from '@/shared/components/ui/kit';
import { ROUTES } from '@/shared/lib/constants';
import { addStep, publishPath, reorderSteps } from '../actions';
import type { LearningPath, LearningPathStep } from '../types';
import {
  PathAssignmentDialog,
  type PathAssignmentClassOption,
  type PathAssignmentStudentOption,
} from './PathAssignmentDialog';
import { PathAssignmentsList } from './PathAssignmentsList';
import { pathBuilderReducer } from './path-builder-reducer';

interface ActivityTypeOption {
  typeId: string;
  displayName: string;
  category: string;
}

interface PathBuilderProps {
  path: LearningPath;
  initialSteps: LearningPathStep[];
  activityTypes: ActivityTypeOption[];
  classes: PathAssignmentClassOption[];
  students: PathAssignmentStudentOption[];
  assignments: Array<{
    id: string;
    classId: string | null;
    studentId: string | null;
    targetType: 'class' | 'student';
    targetName: string;
    targetDetail: string | null;
    dueDate: string | null;
  }>;
}

function statusLabel(status: LearningPath['status']) {
  if (status === 'published') return 'Publicat';
  if (status === 'archived') return 'Arhivat';
  return 'Ciornă';
}

function statusTone(status: LearningPath['status']) {
  if (status === 'published') return 'lime';
  if (status === 'archived') return 'neutral';
  return 'sun';
}

export function PathBuilder({
  path,
  initialSteps,
  activityTypes,
  classes,
  students,
  assignments,
}: PathBuilderProps) {
  const [steps, setSteps] = useState(initialSteps);
  const [targetId, setTargetId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [draggedStepId, setDraggedStepId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isDraft = path.status === 'draft';
  const activityOptions = activityTypes;
  const activitySelectOptions: FilterSelectOption[] = activityOptions.map((option) => ({
    value: option.typeId,
    label: option.displayName,
    description: option.category,
  }));
  const canAddStep = isDraft && !isPending && Boolean(targetId);

  useEffect(() => {
    setSteps(initialSteps);
  }, [initialSteps]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    startTransition(async () => {
      const result = await addStep({
        pathId: path.id,
        kind: 'activity_template',
        title,
        description: description.trim() ? description : null,
        targetActivityType: targetId,
        targetActivityConfig: {},
      });

      if (!result.success) {
        setMessage(result.error ?? 'Nu am putut adăuga pasul.');
        return;
      }

      setTitle('');
      setDescription('');
      setTargetId('');
      router.refresh();
    });
  }

  function handlePublish() {
    setMessage(null);
    startTransition(async () => {
      const result = await publishPath({ pathId: path.id });
      if (!result.success) {
        setMessage(result.error ?? 'Nu am putut publica parcursul.');
        return;
      }
      router.push(ROUTES.TEACHER.PATHS);
      router.refresh();
    });
  }

  function persistStepMove(activeId: string, overId: string | null) {
    if (!isDraft || isPending || !overId) return;

    const nextState = pathBuilderReducer(
      { steps },
      { type: 'moveStep', activeId, overId },
    );

    if (nextState.steps === steps) return;

    setMessage(null);
    startTransition(async () => {
      const result = await reorderSteps({
        pathId: path.id,
        orderedStepIds: nextState.steps.map((step) => step.id),
      });

      if (!result.success) {
        setMessage(result.error ?? 'Nu am putut reordona pașii.');
        return;
      }

      setSteps(nextState.steps);
      router.refresh();
    });
  }

  function handleStepDragStart(
    stepId: string,
    event: DragEvent<HTMLLIElement>,
  ) {
    if (!isDraft || isPending) return;

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', stepId);
    setDraggedStepId(stepId);
  }

  function handleStepDrop(
    overId: string,
    event: DragEvent<HTMLLIElement>,
  ) {
    if (!isDraft || isPending) return;

    event.preventDefault();
    const activeId =
      event.dataTransfer.getData('text/plain') || draggedStepId;
    setDraggedStepId(null);
    if (!activeId) return;

    persistStepMove(activeId, overId);
  }

  return (
    <MantineBoundary>
    <div className="min-h-screen bg-surface text-on-surface">
      <div className="sticky top-0 z-10 border-b border-outline-variant bg-surface-container-lowest px-6 py-4 lg:px-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-on-surface-variant">
              Parcursuri
            </p>
            <h1 className="mt-1 font-headline text-2xl font-bold text-on-surface md:text-3xl">
              {path.title}
            </h1>
            <p className="mt-1 text-sm font-medium text-on-surface-variant">
              {path.description ?? 'Construiește pașii pe care îi vor urma copiii.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Pill tone={statusTone(path.status)}>
              {statusLabel(path.status)}
            </Pill>
            <PathAssignmentDialog
              pathId={path.id}
              pathTitle={path.title}
              classes={classes}
              students={students}
              disabled={path.status !== 'published'}
            />
            <Button
              type="button"
              size="sm"
              variant="primary"
              disabled={!isDraft || isPending}
              isPending={isPending}
              onClick={handlePublish}
              data-testid="learning-path-publish"
            >
              Publică
            </Button>
          </div>
        </div>
        <div className="mx-auto mt-4 flex max-w-6xl overflow-x-auto border-b border-outline-variant">
          <span className="border-b-2 border-primary px-4 py-3 text-sm font-bold text-primary-deep">
            1. Pași · {steps.length}
          </span>
          <span className="border-b-2 border-transparent px-4 py-3 text-sm font-bold text-on-surface-variant">
            2. Publicare
          </span>
          <span className="border-b-2 border-transparent px-4 py-3 text-sm font-bold text-on-surface-variant">
            3. Atribuiri
          </span>
        </div>
      </div>

      <main className="px-6 py-6 lg:px-10">
        <div className="mx-auto max-w-6xl space-y-6">
          {message ? (
            <Card role="alert" className="border border-coral-dim bg-coral-soft" data-testid="learning-path-message">
              <p className="font-body text-sm font-semibold text-coral-deep">
                {message}
              </p>
            </Card>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="space-y-4">
              <Card className="border border-outline-variant bg-surface-container-lowest p-0">
                <div className="flex items-center justify-between gap-3 border-b border-outline-variant px-5 py-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-on-surface-variant">
                      Builder
                    </p>
                    <h2 className="mt-1 text-lg font-bold text-on-surface">
                      Pașii parcursului
                    </h2>
                  </div>
                  <Pill tone="sky">{steps.length} pași</Pill>
                </div>

                <div className="p-5">
                  {steps.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-outline-variant bg-surface-container p-6 text-sm font-semibold text-on-surface-variant">
                      Adaugă primul joc sau prima activitate din panoul din dreapta.
                    </div>
                  ) : (
                    <ol className="space-y-3" data-testid="learning-path-steps">
                      {steps.map((step, index) => (
                        <PathStep
                          key={step.id}
                          step={step}
                          canReorder={isDraft}
                          disabled={isPending}
                          previousStepId={steps[index - 1]?.id ?? null}
                          nextStepId={steps[index + 1]?.id ?? null}
                          onDragStart={handleStepDragStart}
                          onDragOver={(event) => {
                            if (isDraft && !isPending) event.preventDefault();
                          }}
                          onDrop={handleStepDrop}
                          onDragEnd={() => setDraggedStepId(null)}
                          onMove={persistStepMove}
                        />
                      ))}
                    </ol>
                  )}
                </div>
              </Card>

              <PathAssignmentsList pathId={path.id} assignments={assignments} />
            </section>

            <aside className="space-y-4 lg:sticky lg:top-36 lg:self-start">
              <Card className="border border-outline-variant bg-surface-container-lowest p-0">
                <div className="border-b border-outline-variant px-5 py-4">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-on-surface-variant">
                    Adăugare
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-on-surface">
                    Adaugă pas
                  </h2>
                </div>
                <form className="space-y-4 p-5" onSubmit={handleSubmit}>
                  <FilterSelect
                    label="Alegere"
                    icon="ListChecks"
                    value={targetId}
                    onChange={setTargetId}
                    options={activitySelectOptions}
                    placeholder="Alege…"
                    emptyLabel="Nu există activități"
                    disabled={!isDraft || isPending || activitySelectOptions.length === 0}
                    fullWidth
                    radius="md"
                    width="100%"
                    data-testid="learning-path-step-target"
                  />

                  <label className="block space-y-1.5">
                    <span className="text-sm font-bold text-on-surface">
                      Titlu
                    </span>
                    <TextInput
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      disabled={!isDraft || isPending}
                      required
                      minLength={2}
                      maxLength={120}
                      data-testid="learning-path-step-title"
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-sm font-bold text-on-surface">
                      Descriere
                    </span>
                    <Textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      disabled={!isDraft || isPending}
                      rows={3}
                      maxLength={2000}
                      data-testid="learning-path-step-description"
                    />
                  </label>

                  <Button
                    type="submit"
                    fullWidth
                    disabled={!canAddStep}
                    isPending={isPending}
                    data-testid="learning-path-add-step"
                  >
                    Adaugă pas
                  </Button>
                </form>
              </Card>

              <Card className="space-y-4 border border-outline-variant bg-surface-container-lowest">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-on-surface-variant">
                    Sumar
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-on-surface">
                    Pregătire pentru clasă
                  </h2>
                </div>
                <div className="divide-y divide-outline-variant text-sm font-semibold">
                  <div className="flex items-center justify-between py-3">
                    <span className="text-on-surface-variant">Status</span>
                    <Pill tone={statusTone(path.status)}>{statusLabel(path.status)}</Pill>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span className="text-on-surface-variant">Pași</span>
                    <Pill tone="sky">{steps.length}</Pill>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span className="text-on-surface-variant">Atribuiri</span>
                    <Pill tone="neutral">{assignments.length}</Pill>
                  </div>
                </div>
                <p className="text-sm font-medium leading-6 text-on-surface-variant">
                  Publicarea păstrează pașii în ordinea curentă și activează trimiterea către clase sau elevi.
                </p>
              </Card>
            </aside>
          </div>
        </div>
      </main>
    </div>
    </MantineBoundary>
  );
}

interface PathStepProps {
  step: LearningPathStep;
  canReorder: boolean;
  disabled: boolean;
  previousStepId: string | null;
  nextStepId: string | null;
  onDragStart: (stepId: string, event: DragEvent<HTMLLIElement>) => void;
  onDragOver: (event: DragEvent<HTMLLIElement>) => void;
  onDrop: (overId: string, event: DragEvent<HTMLLIElement>) => void;
  onDragEnd: () => void;
  onMove: (activeId: string, overId: string | null) => void;
}

function PathStep({
  step,
  canReorder,
  disabled,
  previousStepId,
  nextStepId,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMove,
}: PathStepProps) {
  return (
    <li
      data-testid="learning-path-step"
      draggable={canReorder && !disabled}
      onDragStart={(event) => onDragStart(step.id, event)}
      onDragOver={onDragOver}
      onDrop={(event) => onDrop(step.id, event)}
      onDragEnd={onDragEnd}
      className={
        canReorder && !disabled ? 'cursor-grab active:cursor-grabbing' : undefined
      }
    >
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="neutral">Pas {step.stepOrder + 1}</Pill>
              <Pill tone="purple">Activitate</Pill>
            </div>
            <div>
              <h4 className="font-headline text-lg font-bold text-on-surface">
                {step.title}
              </h4>
              {step.description ? (
                <p className="mt-1 text-sm font-medium text-on-surface-variant">
                  {step.description}
                </p>
              ) : null}
            </div>
          </div>
          {canReorder ? (
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled || !previousStepId}
                aria-label={`Mută ${step.title} sus`}
                onClick={() => onMove(step.id, previousStepId)}
              >
                Sus
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled || !nextStepId}
                aria-label={`Mută ${step.title} jos`}
                onClick={() => onMove(step.id, nextStepId)}
              >
                Jos
              </Button>
            </div>
          ) : null}
        </div>
      </Card>
    </li>
  );
}
