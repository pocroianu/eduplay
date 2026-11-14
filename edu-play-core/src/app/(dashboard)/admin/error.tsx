'use client';

import { useEffect } from 'react';
import { Button, Card } from '@/shared/components/ui/kit';
import { Icon } from '@/shared/components/ui/Icon';
import { ROUTES } from '@/shared/lib/constants/routes';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AdminError({ error, reset }: ErrorProps) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.error('Admin error boundary caught:', error);
    }
  }, [error]);

  return (
    <section className="min-h-[60vh] bg-surface px-6 py-8 text-on-surface">
      <Card
        padding="none"
        shadow={false}
        className="mx-auto w-full max-w-lg overflow-hidden border border-outline-variant"
      >
        <header className="flex items-center gap-3 border-b border-outline-variant bg-surface-container-lowest px-5 py-4">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-outline-variant bg-surface text-error"
          >
            <Icon name="WarningCircle" size="lg" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">
              Administrare
            </p>
            <h2 className="font-headline text-xl font-bold leading-tight text-on-surface">
              Eroare la încărcarea paginii
            </h2>
          </div>
        </header>
        <div className="flex flex-col gap-4 bg-surface-container-lowest px-5 py-5">
          <p className="text-sm leading-6 text-on-surface-variant">
            A apărut o eroare neașteptată. Încearcă din nou sau revino la panoul de administrare.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" size="sm" onClick={reset}>
              Încearcă din nou
            </Button>
            <Button href={ROUTES.ADMIN.DASHBOARD} variant="secondary" size="sm">
              Panou administrare
            </Button>
          </div>
          {error.digest ? (
            <p className="border-t border-outline-variant pt-3 text-xs text-on-surface-variant">
              Referință: {error.digest}
            </p>
          ) : null}
        </div>
      </Card>
    </section>
  );
}
