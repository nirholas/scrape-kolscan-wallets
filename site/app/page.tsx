import Link from "next/link";
import { getData, getSolGmgnData, getBscGmgnData } from "@/lib/data";

export default async function Home() {
  const [kolscanData, solGmgn, bscGmgn] = await Promise.all([
    getData(),
    getSolGmgnData(),
    getBscGmgnData(),
  ]);

  const dailyEntries = kolscanData.filter((e) => e.timeframe === 1);
  const topByProfit = [...dailyEntries].sort((a, b) => b.profit - a.profit).slice(0, 5);
  const topByWinRate = [...dailyEntries]
    .filter((e) => e.wins + e.losses >= 5)
    .sort((a, b) => {
      const ar = a.wins / (a.wins + a.losses);
      const br = b.wins / (b.wins + b.losses);
      return br - ar;
    })
    .slice(0, 5);
  const kolscanWallets = new Set(kolscanData.map((e) => e.wallet_address)).size;

  const topGmgnSol = [...solGmgn].sort((a, b) => b.realized_profit_7d - a.realized_profit_7d).slice(0, 5);
  const topGmgnBsc = [...bscGmgn].sort((a, b) => b.realized_profit_7d - a.realized_profit_7d).slice(0, 5);

  // Combined unique Solana wallets
  const allSolAddresses = new Set([
    ...kolscanData.map((e) => e.wallet_address),
    ...solGmgn.map((w) => w.wallet_address),
  ]);

  return (
    <main className="animate-fade-in">
      {/* Hero — full viewport */}
      <div className="relative min-h-[calc(100vh-4rem)] flex items-center overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-1/2 right-[10%] -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-accent/[0.07] blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[300px] rounded-full bg-buy/[0.04] blur-[100px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 w-full grid lg:grid-cols-2 gap-16 items-center py-20">
          {/* Left — copy */}
          <div>
            <h1 className="text-5xl sm:text-[4rem] lg:text-[4.5rem] font-extrabold text-white tracking-tight leading-[1.05] mb-6">
              Track the<br />
              smartest wallets.
            </h1>
            <p className="text-zinc-500 text-lg sm:text-xl max-w-lg mb-10 leading-relaxed">
              {allSolAddresses.size.toLocaleString()} Solana + {bscGmgn.length.toLocaleString()} BSC wallets tracked.
              KolScan KOLs, GMGN smart money, snipers &amp; degens.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <Link
                href="/all-solana"
                className="inline-flex items-center gap-2 bg-white hover:bg-zinc-200 text-black font-semibold px-7 py-3 rounded-xl transition-colors text-sm"
              >
                Explore Wallets
              </Link>
              <Link
                href="/bsc"
                className="inline-flex items-center gap-2 border border-border hover:border-zinc-600 text-zinc-300 hover:text-white font-medium px-6 py-3 rounded-xl transition-colors text-sm"
              >
                BSC Wallets
              </Link>
              <a
                href="https://gmgn.ai/r/nichxbt"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 border border-border hover:border-zinc-600 text-zinc-300 hover:text-white font-medium px-6 py-3 rounded-xl transition-colors text-sm"
              >
                Track on GMGN
              </a>
            </div>
          </div>

          {/* Right — visual element */}
          <div className="hidden lg:flex items-center justify-center relative">
            <div className="relative w-72 h-72">
              {/* Outer ring */}
              <div className="absolute inset-0 rounded-3xl border border-border/60 rotate-6" />
              <div className="absolute inset-3 rounded-2xl border border-border/40 -rotate-3" />
              {/* Inner cube face */}
              <div className="absolute inset-6 rounded-2xl bg-gradient-to-br from-bg-card to-bg-elevated border border-border flex items-center justify-center shadow-elevated">
                <div className="text-center">
                  <div className="text-5xl font-extrabold text-white mb-1">{allSolAddresses.size.toLocaleString()}</div>
                  <div className="text-xs text-zinc-500 uppercase tracking-widest">Wallets Tracked</div>
                </div>
              </div>
              {/* Accent accents */}
              <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                <div className="text-accent text-lg font-bold">{kolscanWallets}</div>
                <div className="absolute -bottom-5 text-[10px] text-zinc-600">KOLs</div>
              </div>
              <div className="absolute -top-3 -left-3 w-20 h-20 rounded-2xl bg-buy/10 border border-buy/20 flex items-center justify-center">
                <div className="text-buy text-sm font-bold">{solGmgn.length.toLocaleString()}</div>
                <div className="absolute -bottom-5 text-[10px] text-zinc-600">GMGN</div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-zinc-600 animate-bounce">
          <span className="text-[11px] uppercase tracking-widest">Scroll</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="m19 14-7 7-7-7"/></svg>
        </div>
      </div>

      {/* Divider */}
      <div className="border-b border-border" />

      {/* Stats bar */}
      <div className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center gap-8 sm:gap-16 overflow-x-auto">
          {[
            { value: kolscanWallets.toString(), label: "KolScan KOLs" },
            { value: solGmgn.length.toLocaleString(), label: "GMGN Solana" },
            { value: bscGmgn.length.toLocaleString(), label: "GMGN BSC" },
            { value: allSolAddresses.size.toLocaleString(), label: "Total Solana" },
          ].map((s) => (
            <div key={s.label} className="shrink-0">
              <div className="text-2xl font-bold text-white tabular-nums">{s.value}</div>
              <div className="text-xs text-zinc-600 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Three-column preview tables */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* KolScan Top Profit */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider">KolScan KOLs</h2>
                <p className="text-[11px] text-zinc-600 mt-0.5">Top profit today</p>
              </div>
              <Link href="/leaderboard" className="text-xs text-zinc-600 hover:text-white transition-colors">View all →</Link>
            </div>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-2.5 text-left text-[11px] font-medium text-zinc-600 uppercase tracking-wider">#</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-medium text-zinc-600 uppercase tracking-wider">Name</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-medium text-zinc-600 uppercase tracking-wider">PnL</th>
                  </tr>
                </thead>
                <tbody>
                  {topByProfit.map((e, i) => (
                    <tr key={e.wallet_address} className="border-b border-border/50 last:border-b-0 hover:bg-bg-card transition-colors">
                      <td className="px-3 py-2.5 text-xs text-zinc-600 tabular-nums">{i + 1}</td>
                      <td className="px-3 py-2.5">
                        <Link href={`/wallet/${e.wallet_address}`} className="text-sm text-white hover:text-accent transition-colors">
                          {e.name}
                        </Link>
                      </td>
                      <td className={`px-3 py-2.5 text-sm text-right tabular-nums font-medium ${e.profit > 0 ? "text-buy" : "text-sell"}`}>
                        {e.profit > 0 ? "+" : ""}{e.profit.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* GMGN Solana Top */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider">GMGN Solana</h2>
                <p className="text-[11px] text-zinc-600 mt-0.5">Top profit 7D</p>
              </div>
              <Link href="/gmgn-sol" className="text-xs text-zinc-600 hover:text-white transition-colors">View all →</Link>
            </div>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-2.5 text-left text-[11px] font-medium text-zinc-600 uppercase tracking-wider">#</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-medium text-zinc-600 uppercase tracking-wider">Name</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-medium text-zinc-600 uppercase tracking-wider">7D PnL</th>
                  </tr>
                </thead>
                <tbody>
                  {topGmgnSol.map((w, i) => (
                    <tr key={w.wallet_address} className="border-b border-border/50 last:border-b-0 hover:bg-bg-card transition-colors">
                      <td className="px-3 py-2.5 text-xs text-zinc-600 tabular-nums">{i + 1}</td>
                      <td className="px-3 py-2.5">
                        <Link href={`/gmgn-wallet/${w.wallet_address}?chain=sol`} className="text-sm text-white hover:text-accent transition-colors">
                          {w.name}
                        </Link>
                      </td>
                      <td className={`px-3 py-2.5 text-sm text-right tabular-nums font-medium ${w.realized_profit_7d > 0 ? "text-buy" : "text-sell"}`}>
                        {w.realized_profit_7d > 0 ? "+" : ""}{w.realized_profit_7d >= 1000 ? `${(w.realized_profit_7d / 1000).toFixed(1)}k` : w.realized_profit_7d.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* GMGN BSC Top */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider">GMGN BSC</h2>
                <p className="text-[11px] text-zinc-600 mt-0.5">Top profit 7D</p>
              </div>
              <Link href="/bsc" className="text-xs text-zinc-600 hover:text-white transition-colors">View all →</Link>
            </div>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-2.5 text-left text-[11px] font-medium text-zinc-600 uppercase tracking-wider">#</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-medium text-zinc-600 uppercase tracking-wider">Name</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-medium text-zinc-600 uppercase tracking-wider">7D PnL</th>
                  </tr>
                </thead>
                <tbody>
                  {topGmgnBsc.map((w, i) => (
                    <tr key={w.wallet_address} className="border-b border-border/50 last:border-b-0 hover:bg-bg-card transition-colors">
                      <td className="px-3 py-2.5 text-xs text-zinc-600 tabular-nums">{i + 1}</td>
                      <td className="px-3 py-2.5">
                        <Link href={`/gmgn-wallet/${w.wallet_address}?chain=bsc`} className="text-sm text-white hover:text-accent transition-colors">
                          {w.name}
                        </Link>
                      </td>
                      <td className={`px-3 py-2.5 text-sm text-right tabular-nums font-medium ${w.realized_profit_7d > 0 ? "text-buy" : "text-sell"}`}>
                        {w.realized_profit_7d > 0 ? "+" : ""}{w.realized_profit_7d >= 1000 ? `${(w.realized_profit_7d / 1000).toFixed(1)}k` : w.realized_profit_7d.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Source cards */}
      <div className="border-t border-border">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: "KolScan Leaderboard", desc: `${kolscanWallets} KOL wallets. Scraped from kolscan.io with Playwright.`, href: "/leaderboard", tag: "SOL" },
              { title: "GMGN Solana", desc: `${solGmgn.length.toLocaleString()} smart money wallets — degens, snipers, KOLs, launchpad traders.`, href: "/gmgn-sol", tag: "SOL" },
              { title: "GMGN BSC", desc: `${bscGmgn.length.toLocaleString()} BNB Chain wallets — smart degens, KOLs, snipers.`, href: "/bsc", tag: "BSC" },
              { title: "All Solana Combined", desc: `${allSolAddresses.size.toLocaleString()} unique wallets. KolScan + GMGN deduplicated.`, href: "/all-solana", tag: "SOL" },
            ].map((f) => (
              <Link key={f.title} href={f.href} className="bg-bg-card border border-border rounded-xl p-5 hover:border-zinc-600 transition-all group">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-white text-sm font-semibold group-hover:text-accent transition-colors">{f.title}</h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700">{f.tag}</span>
                </div>
                <p className="text-zinc-600 text-xs leading-relaxed">{f.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-zinc-600 text-xs">KolQuest</span>
          <div className="flex items-center gap-6 text-xs text-zinc-600">
            <a href="https://gmgn.ai/r/nichxbt" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GMGN</a>
            <a href="https://trade.padre.gg/rk/nich" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Padre</a>
            <Link href="/writeup" className="hover:text-white transition-colors">Writeup</Link>
            <a href="https://github.com/nirholas/scrape-kolscan-wallets" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
