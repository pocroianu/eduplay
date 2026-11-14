export default function ClassSettingsSectionLoading() {
  return (
    <div className="min-h-screen bg-surface-container p-6 lg:p-10">
      <div className="mx-auto grid max-w-[1280px] gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
          <div className="h-5 w-32 animate-pulse rounded-md bg-surface-container motion-reduce:animate-none" />
          {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
            <div key={item} className="h-10 animate-pulse rounded-md bg-surface-container motion-reduce:animate-none" />
          ))}
        </div>
        <div className="rounded-lg border border-outline-variant bg-surface-container-lowest">
          <div className="border-b border-outline-variant p-5">
            <div className="h-4 w-24 animate-pulse rounded-md bg-surface-container motion-reduce:animate-none" />
            <div className="mt-3 h-7 w-64 animate-pulse rounded-md bg-surface-container motion-reduce:animate-none" />
          </div>
          <div className="space-y-4 bg-surface-container p-6">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="rounded-md border border-outline-variant bg-surface-container-lowest p-4">
                <div className="h-5 animate-pulse rounded-md bg-surface-container motion-reduce:animate-none" />
                <div className="mt-2 h-4 w-2/3 animate-pulse rounded-md bg-surface-container motion-reduce:animate-none" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
