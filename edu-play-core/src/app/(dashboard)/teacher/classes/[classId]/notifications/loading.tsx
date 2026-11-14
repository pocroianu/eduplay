export default function ClassNotificationsLoading() {
  return (
    <div className="min-h-screen bg-surface-container p-6 lg:p-10">
      <div className="mx-auto max-w-[1440px] space-y-5">
        <div className="h-28 animate-pulse rounded-lg bg-primary-deep/90 motion-reduce:animate-none" />
        <div className="rounded-lg border border-outline-variant bg-surface-container-lowest">
          <div className="border-b border-outline-variant p-4">
            <div className="h-5 w-40 animate-pulse rounded-md bg-surface-container motion-reduce:animate-none" />
          </div>
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="border-b border-outline-variant p-5 last:border-b-0">
              <div className="h-10 animate-pulse rounded-md bg-surface-container motion-reduce:animate-none" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
