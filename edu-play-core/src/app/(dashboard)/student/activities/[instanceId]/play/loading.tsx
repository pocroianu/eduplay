export default function ActivityPlayerLoading() {
  return (
    <div className="min-h-screen bg-background flex flex-col animate-pulse motion-reduce:animate-none">
      <div className="bg-surface border-b-2 border-outline-variant px-6 py-4 flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-surface-container" />
        <div className="flex-1 flex flex-col gap-2">
          <div className="h-6 w-48 rounded-md bg-surface-container" />
          <div className="h-4 w-64 rounded-md bg-surface-container" />
        </div>
      </div>
      <main className="flex-1 px-6 py-8 flex items-center justify-center">
        <div className="w-full max-w-3xl bg-surface rounded-xl p-8 shadow-soft">
          <div className="h-72 w-full rounded-lg bg-surface-container" />
        </div>
      </main>
      <div className="bg-surface border-t-2 border-outline-variant px-6 py-4 flex flex-wrap items-center justify-center gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-16 w-32 rounded-lg bg-surface-container"
          />
        ))}
      </div>
    </div>
  );
}
