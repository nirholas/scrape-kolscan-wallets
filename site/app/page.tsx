import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { getData, getDataWithAvatars, getSolGmgnData, getBscGmgnData, getSolGmgnDataWithAvatars, getBscGmgnDataWithAvatars } from "@/lib/data";
import RecentTradesPreview from "./components/RecentTradesPreview";

function formatPnl(val: number): string {
  const abs = Math.abs(val);
  const str = abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : abs.toFixed(2);
  return `${val >= 0 ? "+" : "-"}${str}`;
}

// ── Skeletons ─────────────────────────────────────────────────

function StatsSkeleton() {
  return (
    <div className="border-b border-border bg-bg-secondary">
      <div className="max-w-7xl mx-auto px-6 h-10 flex items-center gap-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="shrink-0 flex items-center gap-2">
            {i > 0 && <span className="text-zinc-800">|</span>}
            <div className="h-3 w-10 bg-zinc-800 rounded animate-pulse" />
            <div className="h-2.5 w-20 bg-zinc-900 rounded animate-pulse" />
          </div>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
          <div className="h-2.5 w-8 bg-zinc-900 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function TableSkeleton({ title, tag }: { title: string; tag: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-900 text-zinc-600 border border-zinc-800 rounded">{tag}</span>
          <span className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">{title}</span>
        </div>
      </div>
      <div className="border border-border rounded overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-bg-secondary">
              <th className="px-3 py-2"><div className="h-2 w-3 bg-zinc-800 rounded animate-pulse" /></th>
              <th className="px-3 py-2"><div className="h-2 w-16 bg-zinc-800 rounded animate-pulse" /></th>
              <th className="px-3 py-2"><div className="h-2 w-10 bg-zinc-800 rounded animate-pulse ml-auto" /></th>
            </tr>
          </thead>
          <tbody>
            {[20, 28, 16, 24, 20].map((w, i) => (
              <tr key={i} className="border-b border-zinc-900 last:border-b-0">
                <td className="px-3 py-2.5"><div className="h-2.5 w-3 bg-zinc-900 rounded animate-pulse" /></td>
                <td className="px-3 py-2.5"><div style={{ width: `${w * 4}px` }} className="h-2.5 bg-zinc-900 rounded animate-pulse" /></td>
                <td className="px-3 py-2.5 text-right"><div className="h-2.5 w-14 bg-zinc-900 rounded animate-pulse ml-auto" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Async data components ──────────────────────────────────────

async function StatsBar() {
  const [kolscanData, solGmgn, bscGmgn] = await Promise.all([
    getData(),
    getSolGmgnData(),
    getBscGmgnData(),
  ]);

  const kolscanWallets = new Set(kolscanData.map((e) => e.wallet_address)).size;
  const allSolAddresses = new Set([
    ...kolscanData.map((e) => e.wallet_address),
    ...solGmgn.map((w) => w.wallet_address),
  ]);
  const topGainer = [...kolscanData.filter((e) => e.timeframe === 1)]
    .sort((a, b) => b.profit - a.profit)[0];

  return (
    <div className="border-b border-border bg-bg-secondary">
      <div className="max-w-7xl mx-auto px-6 h-10 flex items-center gap-6 overflow-x-auto">
        {[
          { value: kolscanWallets.toString(), label: "KolScan KOLs" },
          { value: solGmgn.length.toLocaleString(), label: "GMGN Solana" },
          { value: bscGmgn.length.toLocaleString(), label: "GMGN BSC" },
          { value: allSolAddresses.size.toLocaleString(), label: "Total Wallets" },
        ].map((s, i) => (
          <div key={s.label} className="shrink-0 flex items-center gap-2">
            {i > 0 && <span className="text-zinc-800 select-none">|</span>}
            <span className="font-mono text-sm font-semibold text-white tabular-nums">{s.value}</span>
            <span className="text-xs text-zinc-600">{s.label}</span>
          </div>
        ))}
        {topGainer && (
          <>
            <span className="text-zinc-800 select-none shrink-0">|</span>
            <div className="shrink-0 flex items-center gap-1.5">
              <span className="text-[11px] text-zinc-600 font-mono">top today</span>
              <Link
                href={`/wallet/${topGainer.wallet_address}`}
                className="text-xs font-mono text-buy hover:text-white transition-colors tabular-nums"
              >
                {topGainer.name} {formatPnl(topGainer.profit)} SOL
              </Link>
            </div>
          </>
        )}
        <div className="shrink-0 flex items-center gap-1.5 ml-auto">
          <span className="w-1.5 h-1.5 rounded-full bg-buy animate-pulse" />
          <span className="text-[11px] text-zinc-600 font-mono">LIVE</span>
        </div>
      </div>
    </div>
  );
}

function Avatar({ src, name }: { src?: string | null; name: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={20}
        height={20}
        className="w-5 h-5 rounded-full shrink-0 object-cover"
      />
    );
  }
  return (
    <span className="w-5 h-5 rounded-full bg-zinc-800 shrink-0 flex items-center justify-center text-[9px] text-zinc-500 font-mono">
      {name[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

async function KolScanPreview() {
  const data = await getDataWithAvatars();
  const topByProfit = [...data.filter((e) => e.timeframe === 1)]
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5);

  return (
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
                <td className="px-3 py-2 max-w-0">
                  <Link href={`/wallet/${e.wallet_address}`} className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white transition-colors min-w-0">
                    <Avatar src={e.avatar} name={e.name} />
                    <span className="truncate">{e.name}</span>
                  </Link>
                </td>
                <td className={`px-3 py-2 text-xs text-right tabular-nums font-mono font-semibold ${e.profit >= 0 ? "text-buy" : "text-sell"}`}>
                  {formatPnl(e.profit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function GmgnSolPreview() {
  const solGmgn = await getSolGmgnDataWithAvatars();
  const top = [...solGmgn].sort((a, b) => b.realized_profit_7d - a.realized_profit_7d).slice(0, 5);

  return (
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
            {top.map((w, i) => (
              <tr key={w.wallet_address} className="border-b border-zinc-900 last:border-b-0 hover:bg-bg-card transition-colors">
                <td className="px-3 py-2 text-[11px] text-zinc-700 font-mono tabular-nums">{i + 1}</td>
                <td className="px-3 py-2 max-w-0">
                  <Link href={`/wallet/${w.wallet_address}`} className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white transition-colors min-w-0">
                    <Avatar src={w.avatar} name={w.name} />
                    <span className="truncate">{w.name}</span>
                  </Link>
                </td>
                <td className={`px-3 py-2 text-xs text-right tabular-nums font-mono font-semibold ${w.realized_profit_7d >= 0 ? "text-buy" : "text-sell"}`}>
                  {formatPnl(w.realized_profit_7d)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function GmgnBscPreview() {
  const bscGmgn = await getBscGmgnDataWithAvatars();
  const top = [...bscGmgn].sort((a, b) => b.realized_profit_7d - a.realized_profit_7d).slice(0, 5);

  return (
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
            {top.map((w, i) => (
              <tr key={w.wallet_address} className="border-b border-zinc-900 last:border-b-0 hover:bg-bg-card transition-colors">
                <td className="px-3 py-2 text-[11px] text-zinc-700 font-mono tabular-nums">{i + 1}</td>
                <td className="px-3 py-2">
                  <Link href={`/wallet/${w.wallet_address}`} className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white transition-colors">
                    <Avatar src={w.avatar} name={w.name} />
                    {w.name}
                  </Link>
                </td>
                <td className={`px-3 py-2 text-xs text-right tabular-nums font-mono font-semibold ${w.realized_profit_7d >= 0 ? "text-buy" : "text-sell"}`}>
                  {formatPnl(w.realized_profit_7d)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function Home() {
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
            description: "See what the top crypto wallets are trading before everyone else. Real-time tracking across Solana & BSC — leaderboards, PnL analytics, and alerts.",
            applicationCategory: "FinanceApplication",
            operatingSystem: "Web",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          }),
        }}
      />

      <Suspense fallback={<StatsSkeleton />}>
        <StatsBar />
      </Suspense>

      {/* Hero */}
      <div className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight">
              Smart wallet intelligence.<br />
              <span className="text-zinc-500 font-normal text-xl">Track top traders across chains</span>
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
          <Suspense fallback={<TableSkeleton title="KolScan — Top Profit" tag="SOL" />}>
            <KolScanPreview />
          </Suspense>
          <Suspense fallback={<TableSkeleton title="GMGN Solana — 7D" tag="SOL" />}>
            <GmgnSolPreview />
          </Suspense>
          <Suspense fallback={<TableSkeleton title="GMGN BSC — 7D" tag="BSC" />}>
            <GmgnBscPreview />
          </Suspense>
        </div>
      </div>

      {/* Tools section — links to features not shown above */}
      <div className="border-t border-border">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { title: "Live Feed", desc: "Real-time wallet activity stream", href: "/feed", tag: "LIVE", live: true },
              { title: "Monitor", desc: "GMGN-style live wallet monitor", href: "/monitor", tag: "LIVE", live: true },
              { title: "Wallet Tracker", desc: "Your tracked portfolio at a glance", href: "/tracker", tag: "SOL" },
              { title: "Submit Wallet", desc: "Add a wallet to be tracked", href: "/submit", tag: "+" },
            ].map((f) => (
              <Link
                key={f.href}
                href={f.href}
                className="bg-bg-card border border-border rounded p-4 hover:border-zinc-700 transition-all group flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-900 text-zinc-600 border border-zinc-800 rounded flex items-center gap-1">
                      {f.live && <span className="w-1 h-1 rounded-full bg-buy animate-pulse" />}
                      {f.tag}
                    </span>
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
