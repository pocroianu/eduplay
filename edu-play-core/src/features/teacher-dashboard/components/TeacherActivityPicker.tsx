'use client';

import { useState, useTransition } from 'react';
import { UnstyledButton } from '@mantine/core';
import { Icon } from '@/shared/components/ui/Icon';
import {
  Button,
  Card,
  FilterSelect,
  type FilterSelectOption,
} from '@/shared/components/ui/kit';
import { assignActivity } from '@/features/activities';
import { ROUTES } from '@/shared/lib/constants';
import dashboardClasses from './TeacherDashboardContent.module.css';

const CREATIVE_ACTIVITIES = [
  {
    typeId: 'drawing-canvas',
    title: 'Desen',
    description: 'O pânză liberă pentru idei, forme și culori.',
    icon: 'Palette',
    config: { mode: 'freeform' },
  },
  {
    typeId: 'voice-recording',
    title: 'Înregistrare vocală',
    description: 'Elevii pot spune o poveste scurtă sau un răspuns audio.',
    icon: 'Microphone',
    config: { promptText: 'Spune o poveste scurtă.' },
  },
] as const;

export interface TeacherActivityPickerProps {
  classes: Array<{ id: string; name: string }>;
  showFullCreateLink?: boolean;
}

export function TeacherActivityPicker({
  classes,
  showFullCreateLink = true,
}: TeacherActivityPickerProps) {
  const [selectedTypeId, setSelectedTypeId] = useState<
    (typeof CREATIVE_ACTIVITIES)[number]['typeId']
  >(CREATIVE_ACTIVITIES[0].typeId);
  const [classId, setClassId] = useState(classes[0]?.id ?? '');
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const classOptions: FilterSelectOption[] = classes.map((classRow) => ({
    value: classRow.id,
    label: classRow.name,
  }));
  const selectedActivity =
    CREATIVE_ACTIVITIES.find((activity) => activity.typeId === selectedTypeId) ??
    CREATIVE_ACTIVITIES[0];

  function onSubmit() {
    setStatus(null);
    startTransition(async () => {
      const result = await assignActivity({
        activityTypeId: selectedActivity.typeId,
        config: selectedActivity.config,
        classId,
      });

      if (result.success) {
        const count = result.data?.instanceIds.length ?? 0;
        setStatus(`Activitatea a fost trimisă către ${count} elevi.`);
      } else {
        setStatus(result.error ?? 'Nu am putut atribui activitatea.');
      }
    });
  }

  return (
    <Card className="space-y-5 rounded-2xl p-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-bold uppercase tracking-[0.08em] text-primary-deep">
          Trimitere rapidă
        </p>
        <h2 className="text-xl font-bold text-on-surface">
          Activități creative rapide
        </h2>
        <p className="text-sm font-medium text-on-surface-variant">
          Alege o activitate scurtă și trimite-o unei clase.
        </p>
      </div>

      <div className={dashboardClasses.choiceGrid}>
        {CREATIVE_ACTIVITIES.map((activity) => {
          const selected = activity.typeId === selectedTypeId;

          return (
            <UnstyledButton
              key={activity.typeId}
              type="button"
              onClick={() => setSelectedTypeId(activity.typeId)}
              aria-pressed={selected}
              data-selected={selected}
              className={dashboardClasses.choiceButton}
            >
              <span className={dashboardClasses.choiceIcon}>
                <Icon name={activity.icon} size={22} aria-hidden />
              </span>
              <span className={dashboardClasses.choiceCopy}>
                <span className={dashboardClasses.choiceTitle}>
                  {activity.title}
                </span>
                <span className={dashboardClasses.choiceDescription}>
                  {activity.description}
                </span>
              </span>
            </UnstyledButton>
          );
        })}
      </div>

      <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <FilterSelect
          label="Clasă"
          icon="Users"
          value={classId}
          onChange={setClassId}
          options={classOptions}
          placeholder={classes.length === 0 ? 'Nu ai clase active' : 'Alege clasa'}
          emptyLabel="Nu ai clase active"
          disabled={isPending || classes.length === 0}
          fullWidth
          radius="md"
          width="100%"
        />
        <div className="flex flex-col gap-2 md:items-end">
          <Button
            type="button"
            onClick={onSubmit}
            disabled={!classId || isPending}
          >
            {isPending ? 'Se trimite…' : 'Trimite activitatea'}
          </Button>
          {showFullCreateLink ? (
            <Button
              href={ROUTES.TEACHER.ACTIVITY_CREATE}
              variant="ghost"
              size="sm"
            >
              Creează activitate completă
            </Button>
          ) : null}
        </div>
      </div>

      {status ? (
        <p role="status" className="text-sm font-semibold text-on-surface-variant">
          {status}
        </p>
      ) : null}
    </Card>
  );
}
