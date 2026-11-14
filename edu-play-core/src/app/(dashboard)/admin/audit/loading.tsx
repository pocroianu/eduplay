export default function AdminAuditLoading() {
  return (
    <div className="flex flex-col gap-8 animate-pulse motion-reduce:animate-none">
      <div className="space-y-2">
        <div className="h-6 w-32 rounded-full bg-surface-container" />
        <div className="h-8 w-56 rounded-xl bg-surface-container" />
        <div className="h-4 w-[520px] max-w-full rounded-full bg-surface-container" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 flex flex-col gap-3"
          >
            <div className="flex items-start justify-between">
              <div className="h-3 w-28 rounded-full bg-surface-container" />
              <div className="h-9 w-9 rounded-xl bg-surface-container" />
            </div>
            <div className="h-8 w-16 rounded-xl bg-surface-container" />
            <div className="h-3 w-3/4 rounded-full bg-surface-container" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="h-10 w-full max-w-md rounded-xl bg-surface-container" />
        <div className="h-10 w-32 rounded-xl bg-surface-container" />
      </div>

      <div className="grid gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="h-3 w-20 rounded-full bg-surface-container" />
            <div className="h-10 rounded-xl bg-surface-container" />
          </div>
        ))}
        <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
          <div className="h-9 w-32 rounded-xl bg-surface-container" />
          <div className="h-9 w-24 rounded-xl bg-surface-container" />
        </div>
      </div>

      <div className="rounded-xl border border-outline-variant bg-surface-container-lowest overflow-hidden">
        <div className="bg-surface-container h-12 border-b-2 border-outline-variant" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div
            key={i}
            className="border-t border-outline-variant/60 px-8 py-4 flex items-center gap-6"
          >
            <div className="h-8 w-32 rounded-xl bg-surface-container" />
            <div className="h-8 w-40 rounded-xl bg-surface-container" />
            <div className="h-4 flex-1 rounded-full bg-surface-container" />
            <div className="h-4 w-32 rounded-full bg-surface-container" />
            <div className="h-4 w-20 rounded-full bg-surface-container" />
          </div>
        ))}
      </div>
    </div>
  )
}
