const ACTIVITY_ROWS = [0, 1, 2, 3, 4] as const;
const STAT_CARDS = [0, 1, 2] as const;
const FILTER_CHIPS = [0, 1, 2] as const;

function LoadingLine({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`h-3 rounded-md bg-surface-container ${className}`}
    />
  );
}

export default function TeacherActivitiesLoading() {
  return (
    <div
      role="status"
      aria-label="Se încarcă activitățile"
      className="min-h-screen bg-surface p-6 lg:p-10"
    >
      <div className="mx-auto max-w-7xl space-y-5 animate-pulse motion-reduce:animate-none">
        <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <LoadingLine className="h-6 w-52" />
              <LoadingLine className="w-80 max-w-full" />
            </div>
            <div className="flex flex-wrap gap-2">
              <LoadingLine className="h-8 w-28" />
              <LoadingLine className="h-8 w-32" />
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          {STAT_CARDS.map((item) => (
            <div
              key={item}
              className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4"
            >
              <LoadingLine className="h-4 w-24" />
              <LoadingLine className="mt-4 h-7 w-16" />
              <LoadingLine className="mt-3 w-32" />
            </div>
          ))}
        </section>

        <section className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
          <div className="flex flex-wrap gap-2 border-b border-outline-variant p-4">
            {FILTER_CHIPS.map((item) => (
              <LoadingLine key={item} className="h-8 w-24" />
            ))}
          </div>
          {ACTIVITY_ROWS.map((item) => (
            <div
              key={item}
              className="flex flex-col gap-4 border-b border-outline-variant p-4 last:border-b-0 md:flex-row md:items-center"
            >
              <div className="min-w-0 flex-1 space-y-3">
                <LoadingLine className="h-5 w-56 max-w-full" />
                <LoadingLine className="w-80 max-w-full" />
              </div>
              <LoadingLine className="h-8 w-full md:w-28" />
              <LoadingLine className="h-8 w-full md:w-28" />
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
