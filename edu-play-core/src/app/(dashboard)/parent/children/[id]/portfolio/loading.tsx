import { Card } from '@/shared/components/ui/kit';

function Skeleton({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-surface-container motion-reduce:animate-none ${className}`}
    />
  );
}

export default function ParentChildPortfolioLoading() {
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <div className="mx-auto w-full max-w-5xl px-6 py-8 lg:px-10">
        <div
          aria-busy="true"
          aria-label="Se încarcă portofoliul copilului"
          className="flex flex-col gap-5"
        >
          <header className="flex flex-col gap-3 border-b border-outline-variant bg-surface-container-lowest pb-5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-full max-w-md" />
          </header>

          {[0, 1].map((sectionIdx) => (
            <Card
              key={sectionIdx}
              padding="none"
              shadow={false}
              className="overflow-hidden border border-outline-variant"
            >
              <div className="border-b border-outline-variant bg-surface-container-lowest px-5 py-3">
                <Skeleton className="h-4 w-32" />
              </div>
              <ul className="grid grid-cols-1 divide-y divide-outline-variant bg-surface-container-lowest lg:grid-cols-2 lg:divide-x lg:divide-y-0">
                {[0, 1].map((cardIdx) => (
                  <li key={cardIdx} className="flex flex-col gap-4 px-5 py-5">
                    <div className="flex flex-wrap gap-2">
                      <Skeleton className="h-6 w-20" />
                      <Skeleton className="h-6 w-24" />
                    </div>
                    <Skeleton className="h-44 w-full" />
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
