export default function LeaderboardLoading() {
  return (
    <main className="max-w-7xl mx-auto px-6 py-14 animate-fade-in">
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="h-8 w-56 bg-bg-card rounded-lg animate-pulse" />
          <div className="h-4 w-80 bg-bg-card rounded animate-pulse" />
        </div>

        {/* Timeframe tabs skeleton */}
        <div className="flex gap-2">
          {["Daily", "Weekly", "Monthly"].map((t) => (
            <div key={t} className="h-8 w-20 bg-bg-card rounded-lg animate-pulse" />
          ))}
        </div>

        {/* Search skeleton */}
        <div className="h-10 w-full max-w-sm bg-bg-card rounded-lg animate-pulse" />

        {/* Table skeleton */}
        <div className="rounded-2xl border border-border bg-bg-card overflow-hidden">
          <div className="flex items-center gap-4 px-5 py-3 border-b border-border">
            {["#", "Name", "Profit", "Wins", "Losses", "Win Rate"].map((h) => (
              <div key={h} className="h-3 w-16 bg-bg-hover rounded animate-pulse" />
            ))}
          </div>
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3 border-b border-border/50">
              <div className="h-3 w-6 bg-bg-hover/60 rounded animate-pulse" />
              <div className="h-3 w-28 bg-bg-hover/60 rounded animate-pulse" />
              <div className="h-3 w-20 bg-bg-hover/60 rounded animate-pulse" />
              <div className="h-3 w-12 bg-bg-hover/60 rounded animate-pulse" />
              <div className="h-3 w-12 bg-bg-hover/60 rounded animate-pulse" />
              <div className="h-3 w-14 bg-bg-hover/60 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
