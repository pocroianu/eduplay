'use client';

import { useEffect } from 'react';
import { DashboardErrorPanel } from './DashboardErrorPanel';
import { ROUTES } from '@/shared/lib/constants/routes';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Dashboard error boundary caught:', error);
  }, [error]);

  return (
    <DashboardErrorPanel
      error={error}
      reset={reset}
      icon="WarningCircle"
      title="A apărut o eroare"
      message="Nu am putut încărca pagina. Te rugăm să încerci din nou."
      retryLabel="Încearcă din nou"
      homeHref={ROUTES.HOME}
      homeLabel="Pagina principală"
      digestLabel="Cod"
    />
  );
}
