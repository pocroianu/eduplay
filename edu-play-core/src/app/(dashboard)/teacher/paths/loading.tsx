import { SectionHeader } from '@/shared/components/ui/kit';

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-surface-container motion-reduce:animate-none ${className}`}
    />
  );
}

export default function TeacherPathsLoading() {
  return (
    <div aria-busy="true" className="min-h-screen bg-surface px-6 py-8 text-on-surface lg:px-10">
      <p className="sr-only" role="status">
        Se încarcă parcursurile.
      </p>

      <div className="mx-auto max-w-6xl space-y-5" aria-hidden="true">
        <SectionHeader
          eyebrow="Parcursuri"
          title="Parcursuri de învățare"
          subtitle="Pregătim parcursurile clasei tale."
          icon="MapTrifold"
          iconTone="primary"
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, item) => (
            <article
              key={item}
              className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4"
            >
              <div className="space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <div className="border-t border-outline-variant pt-3">
                  <Skeleton className="h-9 w-32" />
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
