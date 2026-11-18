const SUMMARY_CARDS = [0, 1, 2, 3] as const;
const SETTINGS_ROWS = [0, 1, 2] as const;
const SECURITY_ROWS = [0, 1] as const;

function LoadingLine({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`h-3 rounded-md bg-surface-container ${className}`}
    />
  );
}

export default function StudentProfileLoading() {
  return (
    <div
      role="status"
      aria-label="Se încarcă profilul elevului"
      className="min-h-screen flex-1 bg-surface px-4 py-6 md:px-8"
    >
      <div className="mx-auto max-w-6xl space-y-5 animate-pulse motion-reduce:animate-none">
        <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-md bg-surface-container" />
              <div className="space-y-3">
                <LoadingLine className="h-6 w-40" />
                <LoadingLine className="w-56 max-w-full" />
              </div>
            </div>
            <LoadingLine className="h-8 w-28" />
          </div>
        </section>

        <section className="space-y-3">
          <LoadingLine className="h-5 w-36" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SUMMARY_CARDS.map((item) => (
              <div
                key={item}
                className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4"
              >
                <LoadingLine className="h-4 w-20" />
                <LoadingLine className="mt-4 h-7 w-14" />
                <LoadingLine className="mt-3 w-24" />
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
          <div className="border-b border-outline-variant p-4">
            <LoadingLine className="h-5 w-28" />
          </div>
          {SETTINGS_ROWS.map((item) => (
            <div
              key={item}
              className="flex flex-col gap-3 border-b border-outline-variant p-4 last:border-b-0 md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0 flex-1 space-y-3">
                <LoadingLine className="h-4 w-44 max-w-full" />
                <LoadingLine className="w-72 max-w-full" />
              </div>
              <LoadingLine className="h-8 w-full md:w-32" />
            </div>
          ))}
        </section>

        <section className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
          <div className="border-b border-outline-variant p-4">
            <LoadingLine className="h-5 w-32" />
          </div>
          {SECURITY_ROWS.map((item) => (
            <div
              key={item}
              className="flex flex-col gap-3 border-b border-outline-variant p-4 last:border-b-0 md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0 flex-1 space-y-3">
                <LoadingLine className="h-4 w-40 max-w-full" />
                <LoadingLine className="w-64 max-w-full" />
              </div>
              <LoadingLine className="h-8 w-full md:w-28" />
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
