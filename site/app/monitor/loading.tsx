export default function MonitorLoading() {
  return (
    <main className="max-w-6xl mx-auto px-6 py-14 animate-fade-in">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-40 bg-bg-card rounded-lg animate-pulse" />
          <div className="h-3 w-3 rounded-full bg-buy/30 animate-pulse" />
        </div>
        <div className="flex gap-2">
          {[60, 50, 80].map((w, i) => (
            <div key={i} className="h-8 bg-bg-card rounded-lg animate-pulse" style={{ width: w }} />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 bg-bg-card rounded-xl border border-border p-4">
              <div className="w-10 h-10 rounded-full bg-bg-hover animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-40 bg-bg-hover rounded animate-pulse" />
                <div className="h-3 w-56 bg-bg-hover/60 rounded animate-pulse" />
              </div>
              <div className="text-right space-y-2">
                <div className="h-4 w-24 bg-bg-hover rounded animate-pulse" />
                <div className="h-3 w-16 bg-bg-hover/60 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
