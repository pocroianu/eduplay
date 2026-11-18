const NOTIFICATION_ROWS = [0, 1, 2, 3, 4] as const;

function LoadingLine({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`h-3 rounded-md bg-surface-container ${className}`}
    />
  );
}

export default function NotificationsLoading() {
  return (
    <div role="status" aria-label="Se încarcă notificările">
      <div className="sticky top-0 z-50 border-b border-outline-variant bg-surface-container-lowest">
        <div className="flex w-full items-center justify-between gap-4 px-6 py-4 lg:px-8">
          <div className="animate-pulse motion-reduce:animate-none space-y-2">
            <LoadingLine className="h-5 w-32" />
            <LoadingLine className="w-48 max-w-full" />
          </div>
          <div
            aria-hidden="true"
            className="h-9 w-9 animate-pulse motion-reduce:animate-none rounded-md bg-surface-container"
          />
        </div>
      </div>

      <div className="bg-surface p-6 lg:p-10">
        <div className="mx-auto max-w-7xl space-y-5 animate-pulse motion-reduce:animate-none">
          <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-3">
                <LoadingLine className="h-6 w-40" />
                <LoadingLine className="w-56 max-w-full" />
              </div>
              <LoadingLine className="h-8 w-24" />
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
            {NOTIFICATION_ROWS.map((item) => (
              <div
                key={item}
                className="flex flex-col gap-4 border-b border-outline-variant px-4 py-4 last:border-b-0 sm:flex-row sm:items-start"
              >
                <div className="h-9 w-9 rounded-md bg-surface-container" />
                <div className="min-w-0 flex-1 space-y-3">
                  <LoadingLine className="h-4 w-3/4" />
                  <LoadingLine className="w-full" />
                  <LoadingLine className="w-2/3" />
                </div>
                <LoadingLine className="h-7 w-20 sm:ml-auto" />
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
