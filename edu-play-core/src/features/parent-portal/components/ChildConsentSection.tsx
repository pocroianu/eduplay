'use client';

import { useId, useState, useTransition } from 'react';
import { Switch } from '@mantine/core';
import { Icon } from '@/shared/components/ui/Icon';
import { setChildConsent } from '../actions';
import type { ConsentMap } from '@/features/activities';
import classes from './ChildConsentSection.module.css';

interface ChildConsentSectionProps {
  childId: string;
  initialConsents: ConsentMap;
}

interface ConsentToggleSpec {
  key: 'audio_recording';
  label: string;
  description: string;
  icon: 'Microphone';
}

const TOGGLES: ReadonlyArray<ConsentToggleSpec> = [
  {
    key: 'audio_recording',
    label: 'Permite înregistrări audio',
    description:
      'Activează activitățile creative cu voce. Înregistrările sunt salvate în portofoliu și revizuite înainte de a deveni vizibile.',
    icon: 'Microphone',
  },
];

/**
 * Per-child consent panel surfaced on the parent → child detail page.
 * Phase 1 ships only the audio toggle (EDU-295); photo and video reuse the
 * same component once their activity types land.
 */
export function ChildConsentSection({
  childId,
  initialConsents,
}: ChildConsentSectionProps) {
  return (
    <section
      aria-labelledby="child-consents-heading"
      className="space-y-5 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-soft-sm sm:p-6"
    >
      <header className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary-container text-on-primary-container"
        >
          <Icon name="ShieldCheck" size={22} />
        </span>
        <div className="space-y-1">
          <h2
            id="child-consents-heading"
            className="text-lg font-bold text-on-surface"
          >
            Permisiuni
          </h2>
          <p className="text-sm text-on-surface-variant">
            Tu decizi ce poate face copilul tău în EduPlay. Poți schimba aceste
            setări oricând.
          </p>
        </div>
      </header>

      <ul className="space-y-3">
        {TOGGLES.map((toggle) => (
          <li key={toggle.key}>
            <ConsentToggleRow
              childId={childId}
              spec={toggle}
              initialValue={initialConsents[toggle.key] === true}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

interface ConsentToggleRowProps {
  childId: string;
  spec: ConsentToggleSpec;
  initialValue: boolean;
}

function ConsentToggleRow({
  childId,
  spec,
  initialValue,
}: ConsentToggleRowProps) {
  const [enabled, setEnabled] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const labelId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const describedBy = `${descriptionId}${error ? ` ${errorId}` : ''}`;

  function handleToggle(next: boolean) {
    if (isPending) return;
    setEnabled(next);
    setError(null);

    startTransition(async () => {
      const result = await setChildConsent({
        childId,
        consentKey: spec.key,
        value: next,
      });
      if (!result.success) {
        setEnabled(!next);
        setError(result.error ?? 'Nu am putut salva permisiunea');
      }
    });
  }

  return (
    <div className={`${classes.row} rounded-lg border border-outline-variant bg-surface-container p-4 md:p-5`}>
      <span
        aria-hidden="true"
        className="flex h-11 w-11 items-center justify-center rounded-md bg-surface text-on-surface"
      >
        <Icon name={spec.icon} size={20} />
      </span>

      <div className="min-w-0">
        <p id={labelId} className="text-sm font-bold text-on-surface">
          {spec.label}
        </p>
        <p
          id={descriptionId}
          className="mt-1 text-sm text-on-surface-variant leading-relaxed"
        >
          {spec.description}
        </p>
        {error ? (
          <p
            id={errorId}
            role="alert"
            className="mt-2 text-sm text-error"
          >
            {error}
          </p>
        ) : null}
      </div>

      <div className={classes.switchSlot}>
        <Switch
          checked={enabled}
          onChange={(event) => handleToggle(event.currentTarget.checked)}
          disabled={isPending}
          aria-busy={isPending || undefined}
          aria-labelledby={labelId}
          aria-describedby={describedBy}
          data-testid={`consent-toggle-${spec.key}`}
          role="switch"
          color="purple"
          radius="xl"
          size="md"
          withThumbIndicator={false}
          classNames={{
            root: 'min-h-11',
            input: 'cursor-pointer',
            track: 'cursor-pointer',
          }}
          styles={{
            track: {
              backgroundColor: enabled
                ? 'var(--color-primary)'
                : 'var(--color-surface-container-lowest)',
              borderColor: 'var(--color-outline-variant)',
              height: 32,
              minWidth: 52,
              width: 52,
            },
            thumb: {
              backgroundColor: 'var(--color-surface-container-lowest)',
              boxShadow: 'var(--shadow-soft-sm)',
              height: 24,
              width: 24,
            },
          }}
        />
      </div>
    </div>
  );
}
