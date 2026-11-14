export default function ClassFamiliesLoading() {
  return (
    <div className="min-h-screen bg-surface-container p-6 lg:p-10">
      <div className="mx-auto grid max-w-[1180px] gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          {[1, 2, 3].map((section) => (
            <div key={section} className="rounded-lg border border-outline-variant bg-surface-container-lowest p-6">
              <div className="mb-4 h-5 w-44 animate-pulse rounded-md bg-surface-container motion-reduce:animate-none" />
              <div className="space-y-3">
                {[1, 2, 3].map((row) => (
                  <div key={row} className="h-12 animate-pulse rounded-md bg-surface-container motion-reduce:animate-none" />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-6">
          {[1, 2, 3].map((card) => (
            <div key={card} className="rounded-lg border border-outline-variant bg-surface-container-lowest p-5">
              <div className="h-5 w-32 animate-pulse rounded-md bg-surface-container motion-reduce:animate-none" />
              <div className="mt-4 h-24 animate-pulse rounded-lg bg-surface-container motion-reduce:animate-none" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
