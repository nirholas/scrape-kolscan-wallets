import Link from "next/link";
import { getData, getSolGmgnData, getBscGmgnData } from "@/lib/data";
import RecentTradesPreview from "./components/RecentTradesPreview";

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

  const allSolAddresses = new Set([
    ...kolscanData.map((e) => e.wallet_address),
    ...solGmgn.map((w) => w.wallet_address),
  ]);

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "KolQuest",
            url: "https://kol.quest",
            description: "Track the smartest crypto wallets — KolScan KOLs, GMGN smart money, Solana & BSC. Leaderboards, analytics, and copy-trade tools.",
            applicationCategory: "FinanceApplication",
            operatingSystem: "Web",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          }),
        }}
      />

      {/* Hero — compact, copy + CTAs only */}
      <div className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight">
              Smart wallet intelligence.<br />
              <span className="text-zinc-500 font-normal text-xl">KolScan · GMGN · Solana · BSC</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/all-solana"
              className="inline-flex items-center gap-1.5 bg-white text-black font-semibold px-4 py-2 rounded-md text-sm hover:bg-zinc-200 transition-colors"
            >
              Explore Wallets
            </Link>
            <Link
              href="/leaderboard"
              className="inline-flex items-center gap-1.5 border border-border hover:border-zinc-600 text-zinc-400 hover:text-white font-medium px-4 py-2 rounded-md text-sm transition-colors"
            >
              Leaderboard
            </Link>
            <Link
              href="/monitor"
              className="inline-flex items-center gap-1.5 border border-border hover:border-zinc-600 text-zinc-400 hover:text-white font-medium px-4 py-2 rounded-md text-sm transition-colors"
            >
              Monitor
              <span className="w-1.5 h-1.5 rounded-full bg-buy animate-pulse" />
            </Link>
          </div>
        </div>
      </div>

      {/* Live trade feed */}
      <RecentTradesPreview />

      {/* Three-column leaderboard tables */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-6">

          {/* KolScan Top Profit */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-900 text-zinc-500 border border-zinc-800 rounded">SOL</span>
                <h2 className="text-xs font-semibold text-white uppercase tracking-wider">KolScan — Top Profit</h2>
              </div>
              <Link href="/leaderboard" className="text-[11px] text-zinc-600 hover:text-white transition-colors font-mono">all →</Link>
            </div>
            <div className="border border-border rounded overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-bg-secondary">
                    <th className="px-3 py-2 text-left text-[10px] font-mono text-zinc-600 uppercase">#</th>
                    <th className="px-3 py-2 text-left text-[10px] font-mono text-zinc-600 uppercase">Name</th>
                    <th className="px-3 py-2 text-right text-[10px] font-mono text-zinc-600 uppercase">PnL</th>
                  </tr>
                </thead>
                <tbody>
                  {topByProfit.map((e, i) => (
                    <tr key={e.wallet_address} className="border-b border-zinc-900 last:border-b-0 hover:bg-bg-card transition-colors">
                      <td className="px-3 py-2 text-[11px] text-zinc-700 font-mono tabular-nums">{i + 1}</td>
                      <td className="px-3 py-2">
                        <Link href={`/wallet/${e.wallet_address}`} className="text-xs text-zinc-300 hover:text-white transition-colors">
                          {e.name}
                        </Link>
                      </td>
                      <td className={`px-3 py-2 text-xs text-right tabular-nums font-mono font-semibold ${e.profit > 0 ? "text-buy" : "text-sell"}`}>
                        {e.profit > 0 ? "+" : ""}{e.profit.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* GMGN Solana */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-900 text-zinc-500 border border-zinc-800 rounded">SOL</span>
                <h2 className="text-xs font-semibold text-white uppercase tracking-wider">GMGN Solana — 7D</h2>
              </div>
              <Link href="/gmgn-sol" className="text-[11px] text-zinc-600 hover:text-white transition-colors font-mono">all →</Link>
            </div>
            <div className="border border-border rounded overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-bg-secondary">
                    <th className="px-3 py-2 text-left text-[10px] font-mono text-zinc-600 uppercase">#</th>
                    <th className="px-3 py-2 text-left text-[10px] font-mono text-zinc-600 uppercase">Name</th>
                    <th className="px-3 py-2 text-right text-[10px] font-mono text-zinc-600 uppercase">7D PnL</th>
                  </tr>
                </thead>
                <tbody>
                  {topGmgnSol.map((w, i) => (
                    <tr key={w.wallet_address} className="border-b border-zinc-900 last:border-b-0 hover:bg-bg-card transition-colors">
                      <td className="px-3 py-2 text-[11px] text-zinc-700 font-mono tabular-nums">{i + 1}</td>
                      <td className="px-3 py-2">
                        <Link href={`/gmgn-wallet/${w.wallet_address}?chain=sol`} className="text-xs text-zinc-300 hover:text-white transition-colors">
                          {w.name}
                        </Link>
                      </td>
                      <td className={`px-3 py-2 text-xs text-right tabular-nums font-mono font-semibold ${w.realized_profit_7d > 0 ? "text-buy" : "text-sell"}`}>
                        {w.realized_profit_7d > 0 ? "+" : ""}{w.realized_profit_7d >= 1000 ? `${(w.realized_profit_7d / 1000).toFixed(1)}k` : w.realized_profit_7d.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* GMGN BSC */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-900 text-zinc-500 border border-zinc-800 rounded">BSC</span>
                <h2 className="text-xs font-semibold text-white uppercase tracking-wider">GMGN BSC — 7D</h2>
              </div>
              <Link href="/bsc" className="text-[11px] text-zinc-600 hover:text-white transition-colors font-mono">all →</Link>
            </div>
            <div className="border border-border rounded overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-bg-secondary">
                    <th className="px-3 py-2 text-left text-[10px] font-mono text-zinc-600 uppercase">#</th>
                    <th className="px-3 py-2 text-left text-[10px] font-mono text-zinc-600 uppercase">Name</th>
                    <th className="px-3 py-2 text-right text-[10px] font-mono text-zinc-600 uppercase">7D PnL</th>
                  </tr>
                </thead>
                <tbody>
                  {topGmgnBsc.map((w, i) => (
                    <tr key={w.wallet_address} className="border-b border-zinc-900 last:border-b-0 hover:bg-bg-card transition-colors">
                      <td className="px-3 py-2 text-[11px] text-zinc-700 font-mono tabular-nums">{i + 1}</td>
                      <td className="px-3 py-2">
                        <Link href={`/gmgn-wallet/${w.wallet_address}?chain=bsc`} className="text-xs text-zinc-300 hover:text-white transition-colors">
                          {w.name}
                        </Link>
                      </td>
                      <td className={`px-3 py-2 text-xs text-right tabular-nums font-mono font-semibold ${w.realized_profit_7d > 0 ? "text-buy" : "text-sell"}`}>
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

      {/* Source cards — compact */}
      <div className="border-t border-border">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { title: "KolScan Leaderboard", desc: `${kolscanWallets} KOL wallets`, href: "/leaderboard", tag: "SOL" },
              { title: "GMGN Solana", desc: `${solGmgn.length.toLocaleString()} smart money wallets`, href: "/gmgn-sol", tag: "SOL" },
              { title: "GMGN BSC", desc: `${bscGmgn.length.toLocaleString()} BNB Chain wallets`, href: "/bsc", tag: "BSC" },
              { title: "All Solana", desc: `${allSolAddresses.size.toLocaleString()} unique wallets deduplicated`, href: "/all-solana", tag: "SOL" },
            ].map((f) => (
              <Link key={f.title} href={f.href} className="bg-bg-card border border-border rounded p-4 hover:border-zinc-700 transition-all group flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono px-1 py-0.5 bg-zinc-900 text-zinc-600 border border-zinc-800 rounded">{f.tag}</span>
                    <h3 className="text-white text-xs font-semibold group-hover:text-accent transition-colors">{f.title}</h3>
                  </div>
                  <p className="text-zinc-600 text-[11px] font-mono">{f.desc}</p>
                </div>
                <span className="text-zinc-700 group-hover:text-zinc-400 transition-colors text-sm">→</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

    </main>
  );
}
