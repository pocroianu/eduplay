function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-surface-container motion-reduce:animate-none ${className}`}
    />
  )
}

export default function AdminUsersLoading() {
  return (
    <section className="flex flex-col gap-5 text-on-surface" aria-busy="true">
      <p className="sr-only" role="status">
        Se încarcă utilizatorii din administrare.
      </p>

      <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-5" aria-hidden="true">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, item) => (
          <div
            key={item}
            className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-8" />
              </div>
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4" aria-hidden="true">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Skeleton className="h-10 w-full max-w-md" />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Skeleton className="h-10 w-52 max-w-full" />
            <Skeleton className="h-10 w-40 max-w-full" />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest" aria-hidden="true">
        <div className="border-b border-outline-variant p-4">
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="divide-y divide-outline-variant">
          {Array.from({ length: 7 }).map((_, item) => (
            <div key={item} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-8" />
            </div>
          ))}
        </div>
      </section>
    </section>
  )
}
