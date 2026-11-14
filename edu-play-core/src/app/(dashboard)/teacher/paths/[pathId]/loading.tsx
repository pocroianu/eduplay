import { SectionHeader } from '@/shared/components/ui/kit';

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-surface-container motion-reduce:animate-none ${className}`}
    />
  );
}

export default function TeacherPathDetailLoading() {
  return (
    <main aria-busy="true" className="min-h-screen bg-surface px-6 py-8 text-on-surface lg:px-10">
      <p className="sr-only" role="status">
        Se încarcă editorul de parcurs.
      </p>

      <div className="mx-auto max-w-6xl space-y-5" aria-hidden="true">
        <SectionHeader
          eyebrow="Parcursuri"
          title="Editor parcurs"
          subtitle="Pregătim pașii și opțiunile disponibile."
          icon="MapTrifold"
          iconTone="primary"
        />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-lg border border-outline-variant bg-surface-container-lowest">
            <div className="border-b border-outline-variant p-4">
              <Skeleton className="h-6 w-44" />
            </div>
            <div className="divide-y divide-outline-variant">
              {Array.from({ length: 3 }).map((_, item) => (
                <div key={item} className="space-y-3 p-4">
                  <Skeleton className="h-5 w-52 max-w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ))}
            </div>
          </section>

          <aside className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
            <div className="space-y-3">
              <Skeleton className="h-5 w-32" />
              <div className="space-y-2 border-t border-outline-variant pt-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
