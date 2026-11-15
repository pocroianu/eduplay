'use client';

import { useMemo, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Checkbox } from '@mantine/core';
import {
  ChunkyButton,
  FilterSelect,
  MantineBoundary,
  type FilterSelectOption,
} from '@/shared/components/ui/kit';
import { overrideProgress } from '../actions';
import type { LearningPathStep, StudentPathProgressStatus } from '../types';

type OverrideAction = 'completed' | 'overridden' | 'in_progress';

interface ProgressOverrideControlProps {
  pathId: string;
  studentId: string;
  studentName: string;
  steps: LearningPathStep[];
  currentStepId: string | null | undefined;
}

const ACTION_COPY: Record<OverrideAction, string> = {
  completed: 'Marchează finalizat',
  overridden: 'Marchează corectat manual',
  in_progress: 'Redeschide la pas',
};

const ACTION_OPTIONS: FilterSelectOption[] = Object.entries(ACTION_COPY).map(
  ([value, label]) => ({ value, label }),
);

export function ProgressOverrideControl({
  pathId,
  studentId,
  studentName,
  steps,
  currentStepId,
}: ProgressOverrideControlProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<OverrideAction>('completed');
  const [selectedStepId, setSelectedStepId] = useState(currentStepId ?? '');
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<'success' | 'error'>('success');
  const [isPending, startTransition] = useTransition();

  const fallbackStepId = steps[0]?.id ?? '';
  const stepOptions = useMemo<FilterSelectOption[]>(
    () =>
      steps.map((step) => ({
        value: step.id,
        label: `${step.stepOrder + 1}. ${step.title}`,
      })),
    [steps],
  );
  const stepValue = useMemo(() => {
    if (action !== 'in_progress') return undefined;
    return selectedStepId || fallbackStepId || undefined;
  }, [action, fallbackStepId, selectedStepId]);
  const canSubmit =
    confirmed && !isPending && (action !== 'in_progress' || Boolean(stepValue));

  function handleActionChange(nextAction: OverrideAction) {
    setAction(nextAction);
    setMessage(null);
    if (nextAction === 'in_progress' && !selectedStepId && fallbackStepId) {
      setSelectedStepId(fallbackStepId);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!confirmed) {
      setMessageKind('error');
      setMessage('Confirmă corectarea manuală înainte de aplicare.');
      return;
    }
    if (action === 'in_progress' && !stepValue) {
      setMessageKind('error');
      setMessage('Alege pasul de reluare pentru elev.');
      return;
    }

    startTransition(async () => {
      const status = action as StudentPathProgressStatus;
      const result = await overrideProgress({
        studentId,
        pathId,
        status,
        ...(status === 'in_progress' ? { currentStepId: stepValue } : {}),
      });

      if (!result.success) {
        setMessageKind('error');
        setMessage(result.error ?? 'Nu am putut actualiza progresul.');
        return;
      }

      setMessageKind('success');
      setMessage('Progresul a fost actualizat.');
      setConfirmed(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <ChunkyButton
        type="button"
        size="sm"
        variant="ghost"
        icon="PencilSimple"
        onClick={() => setOpen(true)}
      >
        Corectează
      </ChunkyButton>
    );
  }

  return (
    <form className="min-w-64 space-y-3" onSubmit={handleSubmit}>
      <FilterSelect
        label={`Acțiune pentru ${studentName}`}
        icon="PencilSimple"
        value={action}
        onChange={(nextAction) => {
          handleActionChange(nextAction as OverrideAction);
        }}
        options={ACTION_OPTIONS}
        disabled={isPending}
        fullWidth
        radius="md"
        size="sm"
        width="100%"
      />

      {action === 'in_progress' ? (
        <FilterSelect
          label="Pas de reluare"
          icon="ListChecks"
          value={stepValue ?? ''}
          onChange={setSelectedStepId}
          options={stepOptions}
          placeholder="Nu există pași"
          emptyLabel="Nu există pași"
          disabled={isPending || steps.length === 0}
          fullWidth
          radius="md"
          size="sm"
          width="100%"
        />
      ) : null}

      <label className="flex items-start gap-2 text-xs font-semibold text-on-surface-variant">
        <MantineBoundary>
        <Checkbox
          checked={confirmed}
          onChange={(event) => setConfirmed(event.currentTarget.checked)}
          disabled={isPending}
          aria-label="Confirm cÄƒ vreau sÄƒ corectez manual progresul acestui elev."
        />
        </MantineBoundary>
        Confirm că vreau să corectez manual progresul acestui elev.
      </label>

      {message ? (
        <p
          role={messageKind === 'success' ? 'status' : 'alert'}
          className={`text-xs font-bold ${
            messageKind === 'success' ? 'text-primary-deep' : 'text-coral-deep'
          }`}
        >
          {message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <ChunkyButton
          type="submit"
          size="sm"
          icon="CheckCircle"
          disabled={!canSubmit}
          loading={isPending}
        >
          Aplică modificarea
        </ChunkyButton>
        <ChunkyButton
          type="button"
          size="sm"
          variant="ghost"
          icon="X"
          disabled={isPending}
          onClick={() => {
            setOpen(false);
            setMessage(null);
            setConfirmed(false);
          }}
        >
          Închide
        </ChunkyButton>
      </div>
    </form>
  );
}
