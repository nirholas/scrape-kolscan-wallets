export default function FeedLoading() {
  return (
    <main className="max-w-5xl mx-auto px-6 py-14 animate-fade-in">
      <div className="space-y-4">
        <div className="h-8 w-48 bg-bg-card rounded-lg animate-pulse" />
        <div className="flex gap-2">
          {[60, 50, 50, 70].map((w, i) => (
            <div key={i} className="h-8 bg-bg-card rounded-lg animate-pulse" style={{ width: w }} />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 bg-bg-card rounded-xl border border-border p-4">
              <div className="w-8 h-8 rounded-full bg-bg-hover animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 bg-bg-hover rounded animate-pulse" />
                <div className="h-3 w-48 bg-bg-hover/60 rounded animate-pulse" />
              </div>
              <div className="h-4 w-20 bg-bg-hover rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
