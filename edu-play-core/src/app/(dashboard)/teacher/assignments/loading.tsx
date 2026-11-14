function LoadingLine({ className = '' }: { className?: string }) {
  return <div className={`h-4 rounded-md bg-surface-container ${className}`} />
}

export default function AssignmentsLoading() {
  return (
    <main className="min-h-screen bg-surface p-6 lg:p-10">
      <div className="mx-auto max-w-[1440px] space-y-5 animate-pulse motion-reduce:animate-none">
        <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-3">
              <LoadingLine className="h-6 w-48" />
              <LoadingLine className="w-72 max-w-full" />
            </div>
            <LoadingLine className="h-10 w-40" />
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
              <LoadingLine className="h-5 w-24" />
              <LoadingLine className="mt-4 h-8 w-16" />
              <LoadingLine className="mt-3 w-32" />
            </div>
          ))}
        </section>

        <section className="rounded-lg border border-outline-variant bg-surface-container-lowest">
          <div className="flex flex-wrap items-center gap-3 border-b border-outline-variant p-4">
            <LoadingLine className="h-9 w-64 max-w-full" />
            <LoadingLine className="h-9 w-32" />
            <LoadingLine className="h-9 w-32" />
          </div>
          {[1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="grid gap-3 border-b border-outline-variant p-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_160px_120px]">
              <div className="space-y-3">
                <LoadingLine className="h-5 w-56 max-w-full" />
                <LoadingLine className="w-80 max-w-full" />
              </div>
              <LoadingLine className="h-9 w-full" />
              <LoadingLine className="h-9 w-full" />
            </div>
          ))}
        </section>
      </div>
    </main>
  )
}
