import { Card } from '@/shared/components/ui/kit';

function Skeleton({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-surface-container motion-reduce:animate-none ${className}`}
    />
  );
}

export default function ParentDashboardLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Se încarcă panoul părintelui"
      className="min-h-screen bg-surface text-on-surface"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-6 py-8 lg:px-10">
        <header className="flex flex-col gap-3 border-b border-outline-variant bg-surface-container-lowest pb-5">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-full max-w-sm" />
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <Card
              key={item}
              padding="none"
              shadow={false}
              className="overflow-hidden border border-outline-variant"
            >
              <div className="flex min-h-28 items-center justify-between gap-4 bg-surface-container-lowest px-5 py-4">
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-7 w-14" />
                </div>
                <Skeleton className="h-10 w-10" />
              </div>
            </Card>
          ))}
        </section>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.72fr)_360px]">
          <section className="flex min-w-0 flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-9 w-32" />
            </div>

            <Card padding="none" shadow={false} className="overflow-hidden border border-outline-variant">
              <div className="flex flex-wrap gap-2 border-b border-outline-variant bg-surface-container-lowest px-5 py-3">
                {[0, 1, 2, 3].map((item) => (
                  <Skeleton key={item} className="h-7 w-20" />
                ))}
              </div>
              <div className="divide-y divide-outline-variant bg-surface-container-lowest">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="px-5 py-5">
                    <div className="mb-4 flex items-center gap-3">
                      <Skeleton className="h-10 w-10" />
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                      <Skeleton className="h-6 w-24" />
                    </div>
                    <Skeleton className="aspect-[4/3] w-full" />
                    <Skeleton className="mt-3 h-4 w-44" />
                  </div>
                ))}
              </div>
            </Card>
          </section>

          <aside className="flex min-w-0 flex-col gap-5">
            {[0, 1, 2].map((item) => (
              <Card
                key={item}
                padding="none"
                shadow={false}
                className="overflow-hidden border border-outline-variant"
              >
                <div className="border-b border-outline-variant bg-surface-container-lowest px-5 py-3">
                  <Skeleton className="h-3 w-24" />
                </div>
                <div className="flex flex-col gap-3 bg-surface-container-lowest px-5 py-4">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              </Card>
            ))}
          </aside>
        </div>
      </div>
    </main>
  );
}
