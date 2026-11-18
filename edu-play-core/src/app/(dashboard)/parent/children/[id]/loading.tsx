export default function ChildDetailLoading() {
  return (
    <div className="min-h-screen flex-1 animate-pulse bg-surface p-8 motion-reduce:animate-none">
      {/* Back Button Skeleton */}
      <div className="bg-surface-container h-5 w-[130px] mb-4 rounded-md" />

      {/* Child Header Skeleton */}
      <div className="border border-outline-variant bg-surface-container-lowest shadow-soft-sm mb-8 flex items-center gap-5 rounded-xl p-6">
        <div className="bg-surface-container rounded-full w-24 h-24" />
        <div>
          <div className="bg-surface-container h-7 w-[180px] mb-2 rounded-md" />
          <div className="bg-surface-container h-4 w-[220px] rounded-md" />
        </div>
      </div>

      {/* Stats Cards Grid Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="border border-outline-variant bg-surface-container-lowest shadow-soft-sm rounded-xl p-6"
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="bg-surface-container h-3.5 w-[100px] mb-2 rounded-md" />
                <div className="bg-surface-container h-9 w-[60px] rounded-md" />
              </div>
              <div className="bg-surface-container rounded-xl w-14 h-14" />
            </div>
          </div>
        ))}
      </div>

      {/* Tabs Section Skeleton */}
      <div className="border border-outline-variant bg-surface-container-lowest shadow-soft-sm rounded-xl p-6">
        {/* Tab buttons */}
        <div className="flex gap-3 mb-6">
          <div className="bg-surface-container h-9 w-[90px] rounded-full" />
          <div className="bg-surface-container h-9 w-20 rounded-full" />
          <div className="bg-surface-container h-9 w-[100px] rounded-full" />
        </div>

        {/* Tab content placeholder (game cards grid) */}
        <div className="flex gap-3 mb-5 flex-wrap">
          <div className="bg-surface-container h-8 w-[140px] rounded-lg" />
          <div className="bg-surface-container h-8 w-[160px] rounded-lg" />
          <div className="bg-surface-container h-8 w-[100px] rounded-lg ml-auto" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="border border-outline-variant bg-surface-container-lowest shadow-soft-sm overflow-hidden rounded-xl"
            >
              <div className="bg-surface-container h-[72px]" />
              <div className="p-4">
                <div className="bg-surface-container h-3.5 w-[80%] mb-2 rounded-md" />
                <div className="flex gap-2 mb-3">
                  <div className="bg-surface-container h-5 w-[60px] rounded-md" />
                  <div className="bg-surface-container h-3 w-[50px] rounded-md" />
                </div>
                <div className="bg-surface-container h-2 w-full mb-3 rounded-full" />
                <div className="bg-surface-container h-3.5 w-[60%] rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
