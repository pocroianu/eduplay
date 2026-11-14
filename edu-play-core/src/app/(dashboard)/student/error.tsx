'use client';

import { useEffect } from 'react';
import { ROUTES } from '@/shared/lib/constants/routes';
import { Icon } from '@/shared/components/ui/Icon';
import { Button, Card } from '@/shared/components/ui/kit';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function StudentError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Student error boundary caught:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-6">
      <Card className="w-full max-w-md text-center" padding="lg">
        <Icon name="Warning" size="xl" className="mx-auto text-error" aria-hidden />
        <h2 className="mt-4 text-xl font-semibold text-on-surface">
          Eroare la încărcarea paginii
        </h2>
        <p className="mt-2 text-base text-on-surface-variant">
          A apărut o problemă. Încearcă din nou sau revino la pagina principală.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button mode="kid" size="lg" onClick={reset}>
            Încearcă din nou
          </Button>
          <Button mode="kid" size="lg" variant="secondary" href={ROUTES.STUDENT.DASHBOARD}>
            Înapoi acasă
          </Button>
        </div>
      </Card>
    </div>
  );
}
