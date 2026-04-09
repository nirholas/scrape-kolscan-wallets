export default function Loading() {
  return (
    <main className="max-w-7xl mx-auto px-6 py-14 animate-fade-in">
      <div className="space-y-6">
        {/* Title skeleton */}
        <div className="space-y-3">
          <div className="h-8 w-64 bg-bg-card rounded-lg animate-pulse" />
          <div className="h-4 w-96 bg-bg-card rounded animate-pulse" />
        </div>

        {/* Table skeleton */}
        <div className="rounded-2xl border border-border bg-bg-card overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-4 px-5 py-3 border-b border-border">
            {[80, 120, 60, 60, 60, 80].map((w, i) => (
              <div key={i} className="h-3 bg-bg-hover rounded animate-pulse" style={{ width: w }} />
            ))}
          </div>
          {/* Rows */}
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3 border-b border-border/50">
              <div className="w-5 h-5 rounded-full bg-bg-hover animate-pulse" />
              {[100, 140, 70, 50, 50, 60].map((w, j) => (
                <div key={j} className="h-3 bg-bg-hover/60 rounded animate-pulse" style={{ width: w }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
