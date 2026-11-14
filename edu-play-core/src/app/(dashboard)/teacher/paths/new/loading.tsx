import { SectionHeader } from '@/shared/components/ui/kit';

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-surface-container motion-reduce:animate-none ${className}`}
    />
  );
}

export default function NewTeacherPathLoading() {
  return (
    <main aria-busy="true" className="min-h-screen bg-surface px-6 py-8 text-on-surface lg:px-10">
      <p className="sr-only" role="status">
        Se încarcă formularul pentru parcurs nou.
      </p>

      <div className="mx-auto max-w-3xl space-y-5" aria-hidden="true">
        <SectionHeader
          eyebrow="Parcurs nou"
          title="Creează parcurs"
          subtitle="Pregătim formularul."
          icon="MapTrifold"
          iconTone="primary"
        />

        <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-5">
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
            <div className="grid gap-3 border-t border-outline-variant pt-4 sm:grid-cols-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-10 w-40" />
          </div>
        </section>
      </div>
    </main>
  );
}
