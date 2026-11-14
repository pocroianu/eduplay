'use client';

import { Button, Card } from '@/shared/components/ui/kit';
import { Icon } from '@/shared/components/ui/Icon';
import { ROUTES } from '@/shared/lib/constants/routes';

interface ParentChildPortfolioErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ParentChildPortfolioError({
  reset,
}: ParentChildPortfolioErrorProps) {
  return (
    <main className="min-h-screen bg-surface text-on-surface">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-6 py-8 lg:px-10">
        <header className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-outline-variant bg-surface-container-lowest text-error"
          >
            <Icon name="WarningCircle" size="lg" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">
              Portofoliu
            </p>
            <h1 className="font-headline text-2xl font-bold tracking-tight text-on-surface">
              Nu am putut încărca lucrările
            </h1>
          </div>
        </header>

        <Card padding="none" shadow={false} className="overflow-hidden border border-outline-variant">
          <div className="border-b border-outline-variant bg-surface-container-lowest px-5 py-4">
            <p className="text-sm text-on-surface-variant">
              A apărut o problemă la afișarea portofoliului. Încearcă din nou peste un moment.
            </p>
          </div>
          <div className="flex flex-col gap-4 bg-surface-container-lowest px-5 py-5">
            <p className="text-sm text-on-surface-variant">
              Dacă problema persistă, contactează profesorul copilului tău pentru a verifica accesul.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="primary" onClick={() => reset()}>
                Încearcă din nou
              </Button>
              <Button href={ROUTES.PARENT.DASHBOARD} variant="secondary">
                Înapoi la panou
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
