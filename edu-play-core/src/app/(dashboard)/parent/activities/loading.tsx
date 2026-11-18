const ACTIVITY_CARDS = [0, 1, 2, 3, 4, 5] as const;
const SUMMARY_ITEMS = [0, 1, 2] as const;

function LoadingLine({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`h-3 rounded-md bg-surface-container ${className}`}
    />
  );
}

export default function ParentActivitiesLoading() {
  return (
    <div
      role="status"
      aria-label="Se încarcă activitățile"
      className="min-h-screen flex-1 bg-surface p-6 lg:p-10"
    >
      <div className="mx-auto max-w-7xl space-y-5 animate-pulse motion-reduce:animate-none">
        <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <LoadingLine className="h-6 w-48" />
              <LoadingLine className="w-80 max-w-full" />
            </div>
            <div className="flex flex-wrap gap-2">
              <LoadingLine className="h-8 w-24" />
              <LoadingLine className="h-8 w-28" />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-surface-container" />
              <div className="space-y-3">
                <LoadingLine className="h-5 w-36" />
                <LoadingLine className="w-44" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {SUMMARY_ITEMS.map((item) => (
                <div
                  key={item}
                  className="border-l border-outline-variant pl-3 first:border-l-0 first:pl-0"
                >
                  <LoadingLine className="h-5 w-12" />
                  <LoadingLine className="mt-2 w-16" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {ACTIVITY_CARDS.map((item) => (
            <article
              key={item}
              className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest"
            >
              <div className="border-b border-outline-variant p-4">
                <LoadingLine className="h-4 w-32" />
              </div>
              <div className="space-y-4 p-4">
                <LoadingLine className="h-5 w-3/4" />
                <LoadingLine className="w-full" />
                <div className="flex flex-wrap gap-2">
                  <LoadingLine className="h-7 w-20" />
                  <LoadingLine className="h-7 w-24" />
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
