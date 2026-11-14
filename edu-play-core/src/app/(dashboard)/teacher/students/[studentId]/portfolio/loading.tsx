import { Card, SectionHeader } from '@/shared/components/ui/kit';

function Skeleton({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse motion-reduce:animate-none rounded-md bg-surface-container ${className}`}
    />
  );
}

export default function TeacherStudentPortfolioLoading() {
  return (
    <div className="flex h-full min-h-screen flex-col bg-surface-container text-on-surface">
      <div className="p-6 lg:p-10">
        <div
          aria-busy="true"
          aria-label="Se încarcă portofoliul elevului"
          className="mx-auto max-w-[1100px] space-y-8"
        >
          <Skeleton className="h-5 w-44" />

          <SectionHeader
            eyebrow="Portofoliu"
            title="Portofoliul elevului"
            subtitle="Toate artefactele copilului — verifică ce este publicat sau încă în revizuire."
            icon="ClipboardText"
            iconTone="primary"
          />

          {[0, 1].map((sectionIdx) => (
            <section key={sectionIdx} className="flex flex-col gap-4">
              <Skeleton className="h-4 w-32" />
              <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {[0, 1].map((cardIdx) => (
                  <li key={cardIdx}>
                    <Card className="flex flex-col gap-4 border border-outline-variant bg-surface-container-lowest" shadow={false}>
                      <div className="flex flex-wrap gap-2">
                        <Skeleton className="h-7 w-24" />
                        <Skeleton className="h-7 w-28" />
                        <Skeleton className="h-7 w-24" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                      <div className="flex flex-wrap gap-3 pt-1">
                        <Skeleton className="h-12 w-56" />
                        <Skeleton className="h-10 w-36" />
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
