'use client';

import { useEffect } from 'react';
import { DashboardErrorPanel } from '../DashboardErrorPanel';
import { ROUTES } from '@/shared/lib/constants/routes';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function TeacherError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Teacher error boundary caught:', error);
  }, [error]);

  return (
    <DashboardErrorPanel
      error={error}
      reset={reset}
      icon="Warning"
      title="Eroare la încărcarea paginii"
      message="A apărut o eroare neașteptată. Încearcă din nou sau contactează suportul."
      retryLabel="Încearcă din nou"
      homeHref={ROUTES.TEACHER.DASHBOARD}
      homeLabel="Dashboard"
      digestLabel="Referință"
    />
  );
}
