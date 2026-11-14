'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthShell, type VulpitaMood } from '@/shared/components/ui/kit';
import { ROUTES } from '@/shared/lib/constants/routes';
import { StudentLoginMascot } from './student-login-mascot';
import { StudentPinPad } from './student-pin-pad';

/**
 * Single Vulpița per viewport — the shell renders the mascot; the PIN pad
 * emits mood changes via `onMoodChange`. Layout is centered-stacked: mascot
 * anchors the top, form card sits directly beneath. Tight enough to fit
 * inside a landscape laptop without scroll.
 */
export function StudentLoginShell() {
  const { t } = useTranslation('auth');
  const [mood, setMood] = useState<VulpitaMood>('happy');

  return (
    <AuthShell
      mode="kid"
      backLink={{ href: ROUTES.AUTH.LOGIN, label: t('login.studentPad.backLink') }}
      className="bg-surface"
      mascotSlot={<StudentLoginMascot mood={mood} size={140} />}
    >
      <div className="flex flex-col gap-4">
        <header className="text-center">
          <h1 className="font-headline text-2xl font-bold tracking-tight text-on-surface md:text-3xl">
            {t('login.studentPad.heading')}
          </h1>
        </header>
        <StudentPinPad onMoodChange={setMood} />
      </div>
    </AuthShell>
  );
}
