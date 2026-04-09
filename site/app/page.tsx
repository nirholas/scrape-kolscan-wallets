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

          {/* Right — 3D keycap with iridescent glow */}
          <div className="hidden lg:flex items-center justify-center relative">
            <div className="relative hero-keycap">
              {/* Iridescent reflection underneath */}
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full iridescent-glow opacity-40 blur-2xl" />
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-48 h-20 rounded-full iridescent-glow opacity-60 blur-xl" />

              {/* Keycap body */}
              <div className="relative w-64 h-64 rounded-[2rem] bg-gradient-to-b from-zinc-800 to-zinc-900 shadow-[0_20px_60px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.08)] border border-zinc-700/50">
                {/* Inner face */}
                <div className="absolute inset-3 rounded-[1.5rem] bg-gradient-to-br from-zinc-900 via-[#0d0d0d] to-black border border-zinc-800/60 flex items-center justify-center overflow-hidden">
                  {/* Pumping chart SVG */}
                  <svg viewBox="0 0 120 80" className="w-36 h-24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Grid lines */}
                    <line x1="0" y1="20" x2="120" y2="20" stroke="#222" strokeWidth="0.5" />
                    <line x1="0" y1="40" x2="120" y2="40" stroke="#222" strokeWidth="0.5" />
                    <line x1="0" y1="60" x2="120" y2="60" stroke="#222" strokeWidth="0.5" />
                    {/* Glow under the line */}
                    <defs>
                      <linearGradient id="chartGrad" x1="0" y1="0" x2="120" y2="0">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity="0.6" />
                        <stop offset="100%" stopColor="#4ade80" stopOpacity="1" />
                      </linearGradient>
                      <linearGradient id="fillGrad" x1="60" y1="10" x2="60" y2="75" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {/* Area fill */}
                    <path d="M10 65 L25 58 L40 62 L55 50 L65 45 L75 38 L85 25 L95 18 L110 8 L110 75 L10 75 Z" fill="url(#fillGrad)" />
                    {/* Chart line — pumping up */}
                    <polyline
                      points="10,65 25,58 40,62 55,50 65,45 75,38 85,25 95,18 110,8"
                      stroke="url(#chartGrad)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="chart-line"
                    />
                    {/* Glowing dot at peak */}
                    <circle cx="110" cy="8" r="3" fill="#4ade80">
                      <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
                    </circle>
                    <circle cx="110" cy="8" r="6" fill="#22c55e" opacity="0.2">
                      <animate attributeName="r" values="6;10;6" dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.2;0;0.2" dur="2s" repeatCount="indefinite" />
                    </circle>
                    {/* Dollar sign */}
                    <text x="16" y="22" fill="#4ade80" fontSize="14" fontWeight="bold" opacity="0.6" fontFamily="Inter, sans-serif">$</text>
                  </svg>
                </div>

                {/* Keycap top highlight */}
                <div className="absolute top-3 left-6 right-6 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              </div>

              {/* Floating stat badges */}
              <div className="absolute -bottom-6 -right-6 w-20 h-20 rounded-2xl bg-bg-card/90 backdrop-blur border border-border flex flex-col items-center justify-center shadow-elevated">
                <div className="text-buy text-lg font-bold">{kolscanWallets}</div>
                <div className="text-[9px] text-zinc-600 uppercase tracking-wider">KOLs</div>
              </div>
              <div className="absolute -top-4 -left-4 w-20 h-20 rounded-2xl bg-bg-card/90 backdrop-blur border border-border flex flex-col items-center justify-center shadow-elevated">
                <div className="text-accent text-lg font-bold">{solGmgn.length.toLocaleString()}</div>
                <div className="text-[9px] text-zinc-600 uppercase tracking-wider">GMGN</div>
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

      {/* Live trade feed preview */}
      <RecentTradesPreview />

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

    </main>
  );
}
