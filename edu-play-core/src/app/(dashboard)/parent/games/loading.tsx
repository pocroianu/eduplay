export default function ParentGamesLoading() {
  return (
    <div className="flex-1 animate-pulse motion-reduce:animate-none p-8 bg-background min-h-screen">
      {/* Header Skeleton */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="bg-surface-container h-8 w-[220px] mb-2 rounded-md" />
          <div className="bg-surface-container h-5 w-[380px] rounded-md" />
        </div>
        <div className="bg-surface-container h-10 w-[250px] rounded-md" />
      </div>

      {/* Child Info Card Skeleton */}
      <div className="border border-outline-variant bg-surface-container-lowest shadow-soft-sm mb-6 rounded-xl p-6">
        <div className="flex items-center gap-4">
          <div className="bg-surface-container rounded-full w-16 h-16" />
          <div className="flex-1">
            <div className="bg-surface-container h-6 w-[150px] mb-2 rounded-md" />
            <div className="bg-surface-container h-4 w-[120px] rounded-md" />
          </div>
          <div className="flex gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="text-center">
                <div className="bg-surface-container h-8 w-[60px] mb-1 rounded-md" />
                <div className="bg-surface-container h-3 w-[50px] rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Game Cards Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="border border-outline-variant bg-surface-container-lowest shadow-soft-sm overflow-hidden rounded-xl">
            <div className="bg-surface-container h-20" />
            <div className="p-4">
              <div className="bg-surface-container h-4 mb-2 rounded-md" />
              <div className="flex gap-2 mb-3">
                <div className="bg-surface-container h-5 w-[60px] rounded-md" />
                <div className="bg-surface-container h-3 w-[50px] rounded-md" />
              </div>
              <div className="bg-surface-container h-10 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
