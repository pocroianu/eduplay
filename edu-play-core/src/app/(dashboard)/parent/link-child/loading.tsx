export default function ParentLinkChildLoading() {
  return (
    <div className="flex-1 animate-pulse motion-reduce:animate-none p-8 bg-background min-h-screen">
      <div className="flex flex-col gap-6 max-w-[500px] mx-auto mt-8 items-center">
        <div className="flex flex-col gap-2 w-full items-center">
          <div className="bg-surface-container h-7 w-[260px] rounded-md" />
          <div className="bg-surface-container h-[18px] w-[360px] rounded-md" />
        </div>

        <div className="border border-outline-variant bg-surface-container-lowest shadow-soft-sm w-full rounded-xl p-6">
          <div className="flex flex-col gap-5">
            {/* Invite code field skeleton */}
            <div className="w-full">
              <div className="bg-surface-container h-4 w-[100px] mb-2 rounded-md" />
              <div className="bg-surface-container h-10 w-full rounded-md" />
              <div className="bg-surface-container h-3.5 w-[280px] mt-2 rounded-md" />
            </div>

            {/* Relationship type field skeleton */}
            <div className="w-full">
              <div className="bg-surface-container h-4 w-[60px] mb-2 rounded-md" />
              <div className="bg-surface-container h-10 w-full rounded-md" />
            </div>

            {/* Submit button skeleton */}
            <div className="bg-surface-container h-12 w-full rounded-md mt-2" />
          </div>
        </div>

        <div className="bg-surface-container h-8 w-[180px] rounded-md" />
      </div>
    </div>
  );
}
