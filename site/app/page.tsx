import Link from "next/link";

function StatCard({ value, label, sub }: { value: string; label: string; sub: string }) {
  return (
    <div className="group relative bg-bg-card rounded-2xl p-5 border border-border hover:border-border-light transition-all duration-300 gradient-border">
      <div className="text-3xl font-bold text-white tracking-tight tabular-nums">{value}</div>
      <div className="text-buy text-sm font-semibold mt-1">{label}</div>
      <div className="text-zinc-500 text-xs mt-0.5">{sub}</div>
    </div>
  );
}

function ViewCard({ href, title, description, accent }: { href: string; title: string; description: string; accent: string }) {
  return (
    <Link href={href} className={`group bg-bg-card rounded-2xl p-6 border border-border hover:border-${accent}/30 transition-all duration-300 shadow-card hover:shadow-elevated`}>
      <h3 className="text-white font-semibold text-base mb-1.5 group-hover:text-buy transition-colors">{title}</h3>
      <p className="text-zinc-500 text-sm leading-relaxed">{description}</p>
      <span className="inline-flex items-center gap-1 text-xs text-zinc-600 group-hover:text-buy mt-3 transition-colors">
        View →
      </span>
    </Link>
  );
}

export default function Home() {
  return (
    <main className="max-w-5xl mx-auto px-6 animate-fade-in">
      {/* Hero */}
      <div className="text-center py-20 sm:py-28">
        <div className="inline-flex items-center gap-2 bg-bg-card border border-border rounded-full px-4 py-1.5 mb-6">
          <div className="w-1.5 h-1.5 rounded-full bg-buy animate-pulse" />
          <span className="text-xs text-zinc-400 font-medium">Open Source Intelligence</span>
        </div>
        <h1 className="text-4xl sm:text-[3.5rem] font-extrabold text-white mb-5 tracking-tight leading-[1.1]">
          Solana KOL<br />
          <span className="gradient-text">Wallet Intelligence</span>
        </h1>
        <p className="text-zinc-400 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
          472 KOL wallets reverse-engineered from KolScan.io — sortable leaderboards,
          per-wallet analytics, and one-click import to{" "}
          <a href="https://gmgn.ai/r/nichxbt" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300 transition-colors">GMGN</a>
          {" "}and{" "}
          <a href="https://trade.padre.gg/rk/nich" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 transition-colors">Padre</a>.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-2 bg-buy hover:bg-buy-light text-black font-semibold px-6 py-2.5 rounded-xl transition-all duration-200 shadow-glow hover:shadow-glow-lg text-sm"
          >
            Explore Leaderboard
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          </Link>
          <a
            href="https://gmgn.ai/r/nichxbt"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 font-medium px-5 py-2.5 rounded-xl transition-all duration-200 text-sm"
          >
            Open GMGN
          </a>
          <a
            href="https://trade.padre.gg/rk/nich"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-400 font-medium px-5 py-2.5 rounded-xl transition-all duration-200 text-sm"
          >
            Trade on Padre
          </a>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-16">
        <StatCard value="472" label="Wallets" sub="unique addresses" />
        <StatCard value="1,304" label="Entries" sub="across timeframes" />
        <StatCard value="3" label="Timeframes" sub="daily · weekly · monthly" />
        <StatCard value="100%" label="Open Source" sub="fully documented" />
      </div>

      {/* Views Grid */}
      <div className="mb-16">
        <h2 className="text-xl font-bold text-white mb-1">Explore the Data</h2>
        <p className="text-zinc-500 text-sm mb-6">Multiple views to analyze KOL performance across Solana.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ViewCard
            href="/leaderboard"
            title="Full Leaderboard"
            description="All 472 wallets with sortable columns — profit, wins, losses, win rate."
            accent="buy"
          />
          <ViewCard
            href="/top-performers"
            title="Top Win Rate"
            description="KOLs ranked by win percentage — find the most consistent traders."
            accent="buy"
          />
          <ViewCard
            href="/most-profitable"
            title="Most Profitable"
            description="Ranked by total profit in SOL — the biggest earners on-chain."
            accent="buy"
          />
        </div>
      </div>

      {/* Tools */}
      <div className="mb-16">
        <h2 className="text-xl font-bold text-white mb-1">Trading Tools</h2>
        <p className="text-zinc-500 text-sm mb-6">Track KOL wallets and copy-trade with these platforms.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <a
            href="https://gmgn.ai/r/nichxbt"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative bg-bg-card rounded-2xl p-6 border border-border hover:border-amber-500/30 transition-all duration-300 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none" />
            <div className="relative">
              <h3 className="text-white font-semibold text-base mb-1.5">GMGN.ai</h3>
              <p className="text-zinc-500 text-sm leading-relaxed mb-3">
                Import all 472 wallets for real-time tracking, copy-trading, and alerts. Pre-formatted JSON ready to paste.
              </p>
              <span className="inline-flex items-center gap-1 text-xs text-amber-400 group-hover:text-amber-300 transition-colors font-medium">
                Open GMGN →
              </span>
            </div>
          </a>
          <a
            href="https://trade.padre.gg/rk/nich"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative bg-bg-card rounded-2xl p-6 border border-border hover:border-purple-500/30 transition-all duration-300 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />
            <div className="relative">
              <h3 className="text-white font-semibold text-base mb-1.5">Padre</h3>
              <p className="text-zinc-500 text-sm leading-relaxed mb-3">
                Advanced Solana trading terminal — execute trades, track wallets, and manage positions.
              </p>
              <span className="inline-flex items-center gap-1 text-xs text-purple-400 group-hover:text-purple-300 transition-colors font-medium">
                Trade on Padre →
              </span>
            </div>
          </a>
        </div>
      </div>

      {/* Writeup CTA */}
      <div className="relative bg-bg-card rounded-2xl p-6 sm:p-8 mb-16 border border-border overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-buy/5 to-transparent pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-white font-semibold text-lg">How we built this</h2>
            <p className="text-zinc-500 text-sm mt-1">Full reverse-engineering writeup — from finding the hidden POST API to extracting 1,304 entries with Playwright.</p>
          </div>
          <Link
            href="/writeup"
            className="inline-flex items-center gap-2 bg-bg-hover hover:bg-bg-elevated border border-border text-white font-medium px-5 py-2.5 rounded-xl transition-all duration-200 whitespace-nowrap text-sm"
          >
            Read Writeup
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="pt-8 pb-12 border-t border-border text-center">
        <p className="text-zinc-500 text-sm">
          Built by{" "}
          <a href="https://github.com/nirholas" className="text-zinc-300 hover:text-buy transition-colors">
            @nirholas
          </a>{" "}
          ·{" "}
          <a
            href="https://github.com/nirholas/scrape-kolscan-wallets"
            className="text-zinc-300 hover:text-buy transition-colors"
          >
            Source on GitHub
          </a>{" "}
          ·{" "}
          <a href="https://gmgn.ai/r/nichxbt" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300 transition-colors">
            GMGN
          </a>{" "}
          ·{" "}
          <a href="https://trade.padre.gg/rk/nich" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 transition-colors">
            Padre
          </a>
        </p>
      </footer>
    </main>
  );
}
