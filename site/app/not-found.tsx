import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20">
          <span className="text-accent text-2xl font-bold font-mono">404</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Page not found</h1>
          <p className="text-zinc-400 text-sm">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-zinc-200 transition-colors"
          >
            Go home
          </Link>
          <Link
            href="/leaderboard"
            className="px-4 py-2 rounded-lg bg-bg-card border border-border text-zinc-400 text-sm font-medium hover:text-white transition-colors"
          >
            Leaderboard
          </Link>
        </div>
      </div>
    </main>
  );
}
