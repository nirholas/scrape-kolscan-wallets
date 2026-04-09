export default function TrackerLoading() {
  return (
    <main className="max-w-6xl mx-auto px-6 py-14 animate-fade-in">
      <div className="space-y-6">
        <div className="h-8 w-48 bg-bg-card rounded-lg animate-pulse" />
        <div className="h-4 w-72 bg-bg-card rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-bg-card p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-bg-hover animate-pulse" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3 w-24 bg-bg-hover rounded animate-pulse" />
                  <div className="h-2.5 w-32 bg-bg-hover/60 rounded animate-pulse" />
                </div>
              </div>
              <div className="flex justify-between">
                <div className="h-3 w-16 bg-bg-hover/60 rounded animate-pulse" />
                <div className="h-3 w-20 bg-bg-hover/60 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
