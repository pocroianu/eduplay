import { Card, SectionHeader } from '@/shared/components/ui/kit';

function Skeleton({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse motion-reduce:animate-none rounded-md bg-surface-container ${className}`}
    />
  );
}

export default function TeacherPortfolioLoading() {
  return (
    <div className="flex h-full min-h-screen flex-col bg-surface-container text-on-surface">
      <div className="p-6 lg:p-10">
        <div
          aria-busy="true"
          aria-label="Se încarcă coada de revizuit"
          className="mx-auto max-w-6xl space-y-8"
        >
          <SectionHeader
            eyebrow="Inbox activități"
            title="Răspunsuri de revizuit"
            subtitle="Verifică răspunsurile elevilor înainte să le aprobi sau să ceri refacere."
            icon="ClipboardText"
            iconTone="primary"
          />

          <Card className="border border-outline-variant bg-surface-container-lowest !p-5" shadow={false}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          </Card>

          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <li key={i}>
                <Card className="flex flex-col gap-4 border border-outline-variant bg-surface-container-lowest" shadow={false}>
                  <div className="flex flex-wrap gap-2">
                    <Skeleton className="h-7 w-24" />
                    <Skeleton className="h-7 w-28" />
                    <Skeleton className="h-7 w-24" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <div className="flex flex-wrap gap-3 pt-1">
                    <Skeleton className="h-12 w-56" />
                    <Skeleton className="h-10 w-36" />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
