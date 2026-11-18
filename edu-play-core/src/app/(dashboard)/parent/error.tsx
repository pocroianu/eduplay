'use client';

import { useEffect } from 'react';
import { DashboardErrorPanel } from '../DashboardErrorPanel';
import { ROUTES } from '@/shared/lib/constants/routes';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ParentError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Parent error boundary caught:', error);
  }, [error]);

  return (
    <DashboardErrorPanel
      error={error}
      reset={reset}
      icon="Warning"
      title="A apărut o eroare"
      message="Nu am putut încărca pagina. Încearcă din nou."
      retryLabel="Încearcă din nou"
      homeHref={ROUTES.PARENT.DASHBOARD}
      homeLabel="Dashboard"
    />
  );
}
