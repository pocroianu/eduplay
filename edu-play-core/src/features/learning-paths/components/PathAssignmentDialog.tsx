'use client';

import { useMemo, useReducer, useState, useTransition, type FormEvent } from 'react';
import { CloseButton, SegmentedControl, Select, TextInput } from '@mantine/core';
import { useRouter } from 'next/navigation';
import { Icon } from '@/shared/components/ui/Icon';
import {
  Button,
  ChunkyButton,
} from '@/shared/components/ui/kit';
import { assignPath } from '../actions';
import {
  pathAssignmentPickerReducer,
  type PathAssignmentPickerState,
} from './path-assignment-picker-reducer';

export interface PathAssignmentClassOption {
  id: string;
  name: string;
}

export interface PathAssignmentStudentOption {
  id: string;
  username: string;
  fullName: string | null;
  classId: string | null;
}

interface PathAssignmentDialogProps {
  pathId: string;
  pathTitle: string;
  classes: PathAssignmentClassOption[];
  students: PathAssignmentStudentOption[];
  disabled?: boolean;
  triggerLabel?: string;
  triggerSize?: 'sm' | 'md' | 'lg';
  fullTrigger?: boolean;
}

const initialState: PathAssignmentPickerState = {
  targetType: 'class',
  classId: '',
  studentId: '',
  dueDate: '',
};

const assignmentFieldStyles = {
  label: {
    color: 'var(--color-on-surface)',
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'var(--color-surface-container-lowest)',
    borderColor: 'var(--color-outline-variant)',
    color: 'var(--color-on-surface)',
    fontFamily: 'var(--font-body)',
    fontSize: 14,
    fontWeight: 500,
    minHeight: 44,
  },
} as const;

export function PathAssignmentDialog({
  pathId,
  pathTitle,
  classes,
  students,
  disabled = false,
  triggerLabel = 'Atribuie',
  triggerSize = 'sm',
  fullTrigger = false,
}: PathAssignmentDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, dispatch] = useReducer(pathAssignmentPickerReducer, initialState);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const visibleStudents = useMemo(() => {
    if (!state.classId) return [];
    return students.filter((student) => student.classId === state.classId);
  }, [state.classId, students]);

  const canSubmit =
    state.targetType === 'class'
      ? state.classId.length > 0
      : state.studentId.length > 0;

  function closeDialog() {
    if (isPending) return;
    setOpen(false);
    setMessage(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!canSubmit) {
      setMessage(
        state.targetType === 'class'
          ? 'Alege clasa pentru atribuire.'
          : 'Alege elevul pentru atribuire.',
      );
      return;
    }

    startTransition(async () => {
      const result = await assignPath({
        pathId,
        classId: state.targetType === 'class' ? state.classId : undefined,
        studentId: state.targetType === 'student' ? state.studentId : undefined,
        dueDate: state.dueDate || undefined,
      });

      if (!result.success) {
        setMessage(result.error ?? 'Nu am putut atribui parcursul.');
        return;
      }

      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <ChunkyButton
        type="button"
        size={triggerSize}
        variant="green"
        icon="UserPlus"
        disabled={disabled}
        full={fullTrigger}
        onClick={() => setOpen(true)}
        data-testid="learning-path-assign"
      >
        {triggerLabel}
      </ChunkyButton>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/25 px-4 py-6"
          role="presentation"
        >
          <div
            className="flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-surface-container-lowest shadow-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="path-assignment-title"
          >
            <header className="flex shrink-0 items-center gap-3 border-b border-outline-variant px-5 py-4">
              <CloseButton
                size={40}
                radius="xl"
                aria-label="Închide dialogul"
                onClick={closeDialog}
                disabled={isPending}
                styles={{
                  root: {
                    color: 'var(--color-on-surface-variant)',
                    flexShrink: 0,
                    minHeight: 44,
                    minWidth: 44,
                  },
                }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                  Parcurs publicat
                </p>
                <h2
                  id="path-assignment-title"
                  className="mt-1 text-[22px] font-bold leading-tight text-on-surface"
                >
                  Atribuie parcursul
                </h2>
                <p className="mt-1 text-sm font-medium text-on-surface-variant">
                  {pathTitle}
                </p>
              </div>
            </header>

              <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
                <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
                <SegmentedControl
                  fullWidth
                  radius="md"
                  value={state.targetType}
                  onChange={(value) =>
                    dispatch({
                      type: 'selectTargetType',
                      targetType: value as PathAssignmentPickerState['targetType'],
                    })
                  }
                  data={[
                    {
                      value: 'class',
                      label: (
                        <span className="inline-flex min-h-10 items-center justify-center gap-2">
                          <Icon name="Users" size={20} aria-hidden />
                          Clasă
                        </span>
                      ),
                    },
                    {
                      value: 'student',
                      label: (
                        <span className="inline-flex min-h-10 items-center justify-center gap-2">
                          <Icon name="User" size={20} aria-hidden />
                          Elev
                        </span>
                      ),
                    },
                  ]}
                  data-testid="learning-path-assign-target-type"
                  styles={{
                    root: {
                      backgroundColor: 'var(--color-surface-container-lowest)',
                      border: '1px solid var(--color-outline-variant)',
                      padding: 4,
                    },
                    control: { minHeight: 44 },
                    indicator: {
                      backgroundColor: 'var(--color-primary-wash)',
                      border: '1px solid var(--color-primary)',
                    },
                    label: {
                      color: 'var(--color-on-surface)',
                      fontFamily: 'var(--font-lexend)',
                      fontSize: 14,
                      fontWeight: 700,
                    },
                  }}
                />

                <Select
                  label="Clasă"
                  value={state.classId}
                  onChange={(value) =>
                    dispatch({ type: 'selectClass', classId: value ?? '' })
                  }
                  data={[
                    { value: '', label: 'Alege clasa...' },
                    ...classes.map((entry) => ({
                      value: entry.id,
                      label: entry.name,
                    })),
                  ]}
                  required
                  allowDeselect={false}
                  checkIconPosition="right"
                  data-testid="learning-path-assign-class"
                  styles={assignmentFieldStyles}
                />

                {state.targetType === 'student' ? (
                  <Select
                    label="Elev"
                    value={state.studentId}
                    onChange={(value) =>
                      dispatch({
                        type: 'selectStudent',
                        studentId: value ?? '',
                        classId: state.classId,
                      })
                    }
                    data={[
                      { value: '', label: 'Alege elevul...' },
                      ...visibleStudents.map((student) => ({
                        value: student.id,
                        label: student.fullName ?? student.username,
                      })),
                    ]}
                    required
                    disabled={!state.classId}
                    allowDeselect={false}
                    checkIconPosition="right"
                    data-testid="learning-path-assign-student"
                    styles={assignmentFieldStyles}
                  />
                ) : null}

                <TextInput
                  type="date"
                  label="Dată scadentă"
                  value={state.dueDate}
                  onChange={(event) =>
                    dispatch({ type: 'setDueDate', dueDate: event.target.value })
                  }
                  data-testid="learning-path-assign-due-date"
                  styles={assignmentFieldStyles}
                />

                {message ? (
                  <div className="rounded-xl bg-error/10 px-4 py-3" role="alert" data-testid="learning-path-assign-message">
                    <p className="font-body text-sm font-semibold text-error">
                      {message}
                    </p>
                  </div>
                ) : null}

                </div>
                <footer className="flex shrink-0 flex-col-reverse gap-3 border-t border-outline-variant px-5 py-4 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={isPending}
                    onClick={closeDialog}
                  >
                    Renunță
                  </Button>
                  <Button
                    type="submit"
                    disabled={isPending}
                    isPending={isPending}
                    data-testid="learning-path-assign-submit"
                  >
                    <Icon name="PaperPlaneTilt" size={18} />
                    Trimite
                  </Button>
                </footer>
              </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
