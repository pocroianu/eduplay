import { SectionHeader } from '@/shared/components/ui/kit';

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-surface-container motion-reduce:animate-none ${className}`}
    />
  );
}

export default function TeacherClassPathProgressLoading() {
  return (
    <main aria-busy="true" className="min-h-screen bg-surface px-6 py-8 text-on-surface lg:px-10">
      <p className="sr-only" role="status">
        Se încarcă progresul parcursului clasei.
      </p>

      <div className="mx-auto max-w-7xl space-y-5" aria-hidden="true">
        <SectionHeader
          eyebrow="Profesor"
          title="Se încarcă progresul"
          subtitle="Pregătim matricea clasei."
          icon="ChartLineUp"
          iconTone="primary"
        />

        <section className="rounded-lg border border-outline-variant bg-surface-container-lowest">
          <div className="border-b border-outline-variant p-4">
            <Skeleton className="h-6 w-56 max-w-full" />
          </div>
          <div className="divide-y divide-outline-variant">
            {Array.from({ length: 4 }).map((_, item) => (
              <div key={item} className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(160px,1fr)_repeat(4,minmax(64px,120px))] md:items-center">
                <Skeleton className="h-5 w-44" />
                {[0, 1, 2, 3].map((cell) => (
                  <Skeleton key={cell} className="h-5 w-full" />
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
