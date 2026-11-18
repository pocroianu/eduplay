function LoadingRow({ className = '' }: { className?: string }) {
  return <div className={`h-4 rounded-md bg-surface-container ${className}`} />
}

export default function TeacherActivityReviewLoading() {
  return (
    <div className="min-h-screen bg-surface p-6 lg:p-10">
      <div className="mx-auto max-w-[1440px] space-y-5 animate-pulse motion-reduce:animate-none">
        <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-5">
          <LoadingRow className="h-6 w-56" />
          <LoadingRow className="mt-3 w-80 max-w-full" />
        </section>

        <section className="rounded-lg border border-outline-variant bg-surface-container-lowest">
          <div className="grid grid-cols-[minmax(160px,1fr)_repeat(4,minmax(72px,120px))] gap-0 border-b border-outline-variant p-4">
            <LoadingRow className="h-5 w-40" />
            {[1, 2, 3, 4].map((item) => (
              <LoadingRow key={item} className="mx-auto h-5 w-16" />
            ))}
          </div>
          {[1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="grid grid-cols-[minmax(160px,1fr)_repeat(4,minmax(72px,120px))] gap-4 border-b border-outline-variant px-4 py-3 last:border-b-0">
              <LoadingRow className="h-5 w-44" />
              {[1, 2, 3, 4].map((cell) => (
                <LoadingRow key={cell} className="mx-auto h-5 w-12" />
              ))}
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
