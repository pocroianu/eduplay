'use client';

import { useEffect } from 'react';
import { Button, Card, SectionHeader } from '@/shared/components/ui/kit';
import { ROUTES } from '@/shared/lib/constants';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function TeacherPathsError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Teacher paths error boundary caught:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-surface-container px-6 py-8 text-on-surface lg:px-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <SectionHeader
          eyebrow="Parcursuri"
          title="Parcursurile nu s-au încărcat"
          subtitle="Încearcă din nou sau revino la panoul profesorului."
          icon="Warning"
          iconTone="tertiary"
        />

        <Card className="space-y-4 border border-outline-variant bg-surface-container-lowest" role="alert">
          <p className="font-body text-sm font-semibold text-on-surface">
            A apărut o eroare neașteptată.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" size="sm" onClick={reset}>
              Încearcă din nou
            </Button>
            <Button href={ROUTES.TEACHER.DASHBOARD} size="sm" variant="ghost">
              Dashboard
            </Button>
          </div>
          {error.digest ? (
            <p className="text-xs font-semibold text-on-surface-variant">
              Referință: {error.digest}
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
