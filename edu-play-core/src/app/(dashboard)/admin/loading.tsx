import { ADMIN_OVERVIEW_LOADING } from '@/features/admin/copy/overview'

const SKELETON_CLASS = 'animate-pulse rounded-md bg-surface-container motion-reduce:animate-none'

function Skeleton({ label, className = '' }: { label: string; className?: string }) {
  return <span aria-label={label} className={`${SKELETON_CLASS} block ${className}`} />
}

export default function AdminOverviewLoading() {
  return (
    <section aria-busy="true" className="space-y-5">
      <p className="sr-only" role="status">
        Se încarcă panoul de administrare.
      </p>

      <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-5">
        <div className="space-y-2">
          <Skeleton label={ADMIN_OVERVIEW_LOADING.panelSkeletonLabel} className="h-3 w-36" />
          <Skeleton label={ADMIN_OVERVIEW_LOADING.panelSkeletonLabel} className="h-7 w-64 max-w-full" />
          <Skeleton label={ADMIN_OVERVIEW_LOADING.panelSkeletonLabel} className="h-4 w-56 max-w-full" />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, item) => (
          <div
            key={item}
            className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4"
          >
            <div className="space-y-3">
              <Skeleton label={ADMIN_OVERVIEW_LOADING.statSkeletonLabel} className="h-4 w-24" />
              <Skeleton label={ADMIN_OVERVIEW_LOADING.statSkeletonLabel} className="h-7 w-16" />
              <Skeleton label={ADMIN_OVERVIEW_LOADING.statSkeletonLabel} className="h-3 w-32 max-w-full" />
            </div>
          </div>
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.72fr_320px]">
        <section className="rounded-lg border border-outline-variant bg-surface-container-lowest">
          <div className="border-b border-outline-variant p-4">
            <Skeleton label={ADMIN_OVERVIEW_LOADING.feedSkeletonLabel} className="h-5 w-40" />
          </div>
          <div className="divide-y divide-outline-variant">
            {Array.from({ length: 5 }).map((_, item) => (
              <div key={item} className="flex items-center gap-4 px-4 py-3">
                <Skeleton label={ADMIN_OVERVIEW_LOADING.feedSkeletonLabel} className="h-8 w-8" />
                <Skeleton label={ADMIN_OVERVIEW_LOADING.feedSkeletonLabel} className="h-4 flex-1" />
                <Skeleton label={ADMIN_OVERVIEW_LOADING.feedSkeletonLabel} className="h-4 w-20" />
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          {[0, 1].map((item) => (
            <section
              key={item}
              className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4"
            >
              <div className="space-y-3">
                <Skeleton label={ADMIN_OVERVIEW_LOADING.panelSkeletonLabel} className="h-5 w-32" />
                <div className="border-t border-outline-variant pt-3">
                  <Skeleton label={ADMIN_OVERVIEW_LOADING.panelSkeletonLabel} className="h-4 w-full" />
                </div>
                <Skeleton label={ADMIN_OVERVIEW_LOADING.panelSkeletonLabel} className="h-4 w-2/3" />
              </div>
            </section>
          ))}
        </aside>
      </div>
    </section>
  )
}
