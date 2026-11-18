'use client';

import { useEffect } from 'react';
import { Icon } from '@/shared/components/ui/Icon';
import { Button } from '@/shared/components/ui/kit/Button';
import { Card } from '@/shared/components/ui/kit/Card';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Root error boundary caught:', error);
  }, [error]);

  return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card
          mode="standard"
          tone="cream"
          padding="lg"
          className="w-full max-w-md text-center"
        >
          <div className="flex flex-col items-center gap-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-error-soft text-error">
              <Icon name="WarningCircle" size="lg" aria-hidden />
            </div>
            <div className="flex flex-col gap-2">
              <h1 className="font-headline text-2xl font-semibold text-on-surface">
                Ceva nu a mers bine
              </h1>
              <p className="text-base leading-relaxed text-on-surface-variant">
                A apărut o eroare neașteptată. Te rugăm să încerci din nou.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Button mode="standard" variant="primary" onClick={reset} className="w-full sm:flex-1">
                Încearcă din nou
              </Button>
              <Button mode="standard" variant="secondary" href="/" className="w-full sm:flex-1">
                Pagina principală
              </Button>
            </div>
            {error.digest && (
              <p className="text-xs text-on-surface-variant/60">
                Cod eroare: {error.digest}
              </p>
            )}
          </div>
        </Card>
      </div>
  );
}
