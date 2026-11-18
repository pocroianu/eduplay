function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-surface-container motion-reduce:animate-none ${className}`}
    />
  )
}

export default function TeacherGamesLoading() {
  return (
    <div aria-busy="true" className="min-h-screen flex-1 bg-surface p-6 text-on-surface lg:p-10">
      <p className="sr-only" role="status">
        Se încarcă jocurile profesorului.
      </p>

      <div className="mx-auto max-w-7xl space-y-5" aria-hidden="true">
        <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>
            <Skeleton className="h-9 w-32" />
          </div>
        </section>

        <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <Skeleton className="h-10 w-full max-w-sm" />
            <Skeleton className="h-10 w-48 max-w-full" />
            <Skeleton className="h-10 w-40 max-w-full" />
          </div>
        </section>

        <section className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, item) => (
              <article
                key={item}
                className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest"
              >
                <Skeleton className="h-20 rounded-none" />
                <div className="space-y-3 p-4">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <div className="flex gap-2 border-t border-outline-variant pt-3">
                    <Skeleton className="h-8 flex-1" />
                    <Skeleton className="h-8 flex-1" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
