export default function ClassJournalLoading() {
  return <ClassTabLoading />
}

function ClassTabLoading() {
  return (
    <div className="min-h-screen bg-surface-container">
      <div className="bg-primary-deep px-6 py-6 lg:px-10">
        <div className="mx-auto max-w-[1440px] space-y-5">
          <div className="h-4 w-40 animate-pulse rounded-md bg-on-primary/20 motion-reduce:animate-none" />
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 animate-pulse rounded-lg bg-on-primary/20 motion-reduce:animate-none" />
            <div className="space-y-2">
              <div className="h-7 w-56 animate-pulse rounded-md bg-on-primary/20 motion-reduce:animate-none" />
              <div className="h-4 w-24 animate-pulse rounded-md bg-on-primary/20 motion-reduce:animate-none" />
            </div>
          </div>
          <div className="flex gap-2 pl-0 md:pl-[70px]">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-11 w-28 animate-pulse rounded-md bg-on-primary/20 motion-reduce:animate-none" />
            ))}
          </div>
        </div>
      </div>
      <div className="mx-auto grid max-w-[1440px] gap-0 px-6 py-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:px-10">
        <div className="min-h-[540px] rounded-t-lg border border-outline-variant bg-surface-container-lowest p-4 lg:rounded-l-lg lg:rounded-tr-none">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="h-14 animate-pulse rounded-md bg-surface-container motion-reduce:animate-none" />
            ))}
          </div>
        </div>
        <div className="min-h-[540px] rounded-b-lg border border-t-0 border-outline-variant bg-surface-container-lowest p-5 lg:rounded-r-lg lg:rounded-bl-none lg:border-l-0 lg:border-t">
          <div className="h-10 animate-pulse rounded-md bg-surface-container motion-reduce:animate-none" />
          <div className="mt-5 h-72 animate-pulse rounded-md bg-surface-container motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  )
}
