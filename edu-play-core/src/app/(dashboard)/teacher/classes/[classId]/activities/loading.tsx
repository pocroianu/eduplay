export default function ClassActivitiesLoading() {
  return (
    <div className="min-h-screen bg-surface-container p-6 lg:p-10">
      <div className="mx-auto max-w-[1440px] space-y-5">
        <div className="h-28 animate-pulse rounded-lg bg-primary-deep/90 motion-reduce:animate-none" />
        <div className="flex flex-wrap gap-3">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-10 w-28 animate-pulse rounded-md bg-surface-container-lowest motion-reduce:animate-none" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-64 animate-pulse rounded-lg border border-outline-variant bg-surface-container-lowest motion-reduce:animate-none" />
          ))}
        </div>
      </div>
    </div>
  )
}
