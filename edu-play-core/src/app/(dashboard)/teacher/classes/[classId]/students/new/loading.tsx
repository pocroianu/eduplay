export default function NewClassStudentLoading() {
  return (
    <div className="min-h-screen bg-surface-container p-6 lg:p-10">
      <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-5">
            <div className="mb-4 h-6 w-56 animate-pulse rounded-md bg-surface-container motion-reduce:animate-none" />
            <div className="grid gap-4 lg:grid-cols-5">
              <div className="space-y-4 lg:col-span-3">
                <div className="h-64 animate-pulse rounded-lg bg-surface-container motion-reduce:animate-none" />
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((row) => (
                    <div key={row} className="h-12 animate-pulse rounded-full bg-surface-container motion-reduce:animate-none" />
                  ))}
                </div>
              </div>
              <div className="space-y-4 lg:col-span-2">
                {[1, 2].map((card) => (
                  <div key={card} className="h-32 animate-pulse rounded-lg bg-surface-container motion-reduce:animate-none" />
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-5">
            <div className="mb-4 h-5 w-40 animate-pulse rounded-md bg-surface-container motion-reduce:animate-none" />
            <div className="space-y-3">
              {[1, 2, 3].map((student) => (
                <div key={student} className="h-14 animate-pulse rounded-md bg-surface-container motion-reduce:animate-none" />
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-6 xl:col-span-4">
          <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-5">
            <div className="mb-4 h-5 w-36 animate-pulse rounded-md bg-surface-container motion-reduce:animate-none" />
            <div className="h-32 animate-pulse rounded-lg bg-surface-container motion-reduce:animate-none" />
            <div className="mt-4 space-y-3">
              {[1, 2, 3].map((step) => (
                <div key={step} className="h-16 animate-pulse rounded-lg bg-surface-container motion-reduce:animate-none" />
              ))}
            </div>
          </div>
          <div className="h-36 animate-pulse rounded-lg border border-outline-variant bg-surface-container-lowest motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  )
}
