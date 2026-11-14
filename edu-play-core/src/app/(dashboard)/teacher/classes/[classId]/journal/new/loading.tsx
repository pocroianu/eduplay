export default function NewJournalPostLoading() {
  return (
    <div className="min-h-screen bg-surface-container p-6 lg:p-10">
      <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-5">
            <div className="mb-4 h-5 w-48 animate-pulse rounded-md bg-surface-container motion-reduce:animate-none" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div key={item} className="h-28 animate-pulse rounded-lg bg-surface-container motion-reduce:animate-none" />
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-5">
            <div className="mb-4 h-5 w-32 animate-pulse rounded-md bg-surface-container motion-reduce:animate-none" />
            <div className="h-72 animate-pulse rounded-lg bg-surface-container motion-reduce:animate-none" />
          </div>
        </div>
        <div className="space-y-6 xl:col-span-4">
          {[1, 2, 3].map((section) => (
            <div key={section} className="rounded-lg border border-outline-variant bg-surface-container-lowest p-5">
              <div className="mb-4 h-5 w-40 animate-pulse rounded-md bg-surface-container motion-reduce:animate-none" />
              <div className="space-y-3">
                {[1, 2, 3].map((row) => (
                  <div key={row} className="h-14 animate-pulse rounded-md bg-surface-container motion-reduce:animate-none" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
