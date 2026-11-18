'use client';

import { Icon } from '@/shared/components/ui/Icon';
import { Button, Card } from '@/shared/components/ui/kit';
import { ROUTES } from '@/shared/lib/constants/routes';

interface LaunchStepErrorProps {
  reset: () => void;
}

export default function LaunchStepError({ reset }: LaunchStepErrorProps) {
  return (
    <div className="grid min-h-screen place-items-center bg-surface p-6">
      <Card className="w-full max-w-md text-center" padding="lg">
        <Icon name="Warning" size="xl" className="mx-auto text-error" aria-hidden />
        <h2 className="mt-4 text-xl font-semibold text-on-surface">
          Nu putem porni pasul acum
        </h2>
        <p className="mt-2 text-base text-on-surface-variant">
          Întoarce-te la hartă sau încearcă din nou.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button mode="kid" size="lg" onClick={reset}>
            Încearcă din nou
          </Button>
          <Button mode="kid" size="lg" variant="secondary" href={ROUTES.STUDENT.MAP}>
            <Icon name="MapTrifold" size="sm" aria-hidden />
            Înapoi la hartă
          </Button>
        </div>
      </Card>
    </div>
  );
}
