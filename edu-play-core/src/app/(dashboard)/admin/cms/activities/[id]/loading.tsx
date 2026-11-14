export default function AdminCmsActivityEditorLoading() {
  return (
    <div className="flex flex-col gap-8 animate-pulse">
      <div className="space-y-2">
        <div className="h-6 w-36 rounded-full bg-surface-container" />
        <div className="h-8 w-64 rounded-xl bg-surface-container" />
        <div className="h-4 w-[520px] max-w-full rounded-full bg-surface-container" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-h-[520px] rounded-xl border border-outline-variant bg-surface-container-lowest" />
        <div className="flex flex-col gap-4">
          <div className="h-40 rounded-xl border border-outline-variant bg-surface-container-lowest" />
          <div className="h-64 rounded-xl border border-outline-variant bg-surface-container-lowest" />
        </div>
      </div>
    </div>
  );
}
