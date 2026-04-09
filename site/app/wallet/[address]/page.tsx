import Link from "next/link";
import { getData, getXProfiles, getXProfile, getSolGmgnData } from "@/lib/data";
import PnlCalendar from "@/app/components/PnlCalendar";
import CopyButton from "@/app/components/CopyButton";

function truncate(addr: string) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function profitColor(v: number) {
  return v > 0 ? "text-buy" : v < 0 ? "text-sell" : "text-zinc-500";
}

function fmt(v: number) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)} SOL`;
}

function relativeTime(ts: number): string {
  if (!ts) return "N/A";
  const diff = Date.now() - ts * 1000;
  const m = diff / 60000;
  const h = m / 60;
  const d = h / 24;
  if (d >= 1) return `${Math.floor(d)}d ago`;
  if (h >= 1) return `${Math.floor(h)}h ago`;
  if (m >= 1) return `${Math.floor(m)}m ago`;
  return "just now";
}

export async function generateStaticParams() {
  const data = await getData();
  const addresses = [...new Set(data.map((e) => e.wallet_address))];
  return addresses.map((address) => ({ address }));
}

export async function generateMetadata({ params }: { params: { address: string } }) {
  const data = await getData();
  const entry = data.find((e) => e.wallet_address === params.address);
  const name = entry?.name || params.address.slice(0, 8);
  const title = `${name} Wallet`;
  const description = `KolScan wallet profile and PnL for ${name} — profit, win rate, and trade history on Solana.`;
  return {
    title,
    description,
    openGraph: { title: `${title} | KolQuest`, description },
  };
}

export default async function WalletPage({ params }: { params: { address: string } }) {
  const [data, xProfiles, gmgnSol] = await Promise.all([getData(), getXProfiles(), getSolGmgnData()]);
  const entries = data.filter((e) => e.wallet_address === params.address);

  if (entries.length === 0) {
    return (
      <main className="max-w-4xl mx-auto px-6 py-20 text-center animate-fade-in">
        <h1 className="text-2xl font-bold text-white mb-2">Wallet Not Found</h1>
        <p className="text-zinc-500">No data found for this address.</p>
      </main>
    );
  }

  const name = entries[0].name;
  const twitter = entries[0].twitter;
  const telegram = entries[0].telegram;
  const xProfile = getXProfile(xProfiles, twitter);
  const gmgnExists = gmgnSol.some((w) => w.wallet_address === params.address);

  const timeframeLabel = (tf: number) => tf === 1 ? "Daily" : tf === 7 ? "Weekly" : "Monthly";

  const totalProfit = entries.reduce((s, e) => s + e.profit, 0);
  const totalWins = entries.reduce((s, e) => s + e.wins, 0);
  const totalLosses = entries.reduce((s, e) => s + e.losses, 0);
  const totalTrades = totalWins + totalLosses;
  const winRatePct = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;
  const lowSample = totalTrades > 0 && totalTrades < 10;
  const best = entries.reduce((a, b) => (a.profit > b.profit ? a : b));

  const ranks = entries.map((e) => {
    const peers = data.filter((d) => d.timeframe === e.timeframe).sort((a, b) => b.profit - a.profit);
    const rank = peers.findIndex((p) => p.wallet_address === e.wallet_address) + 1;
    return { timeframe: e.timeframe, rank, total: peers.length, entry: e };
  });

  const topWallets = data
    .filter((d) => d.timeframe === 1 && d.wallet_address !== params.address && d.profit > 0)
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 6);

  const quickLinks = [
    { href: `https://solscan.io/account/${params.address}`, label: "Solscan" },
    { href: `https://gmgn.ai/sol/address/${params.address}?ref=nichxbt`, label: "GMGN" },
    { href: `https://trade.padre.gg/rk/nich?wallet=${params.address}`, label: "Padre" },
    { href: `https://kolscan.io/${params.address}`, label: "KolScan" },
    { href: `https://birdeye.so/profile/${params.address}?chain=solana`, label: "Birdeye" },
  ];

  return (
    <main className="max-w-6xl mx-auto px-4 py-6 animate-fade-in">
      {/* Back link */}
      <Link href="/" className="inline-flex items-center gap-1 text-zinc-500 hover:text-white text-xs mb-4 transition-colors">
        ← Leaderboard
      </Link>

      {/* ── Compact Header ── */}
      <div className="flex items-center gap-3 mb-5">
        {xProfile?.avatar ? (
          <img src={xProfile.avatar} alt="" className="w-10 h-10 rounded-full flex-shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-buy to-emerald-600 flex items-center justify-center text-base font-bold text-white flex-shrink-0">
            {name.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-bold text-base">{name}</span>
            {xProfile?.verified && <span className="text-blue-400 text-xs">✓</span>}
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-buy/15 text-buy border border-buy/25">KolScan</span>
            {gmgnExists && (
              <Link href={`/gmgn-wallet/${params.address}`}
                className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 border border-yellow-500/25 hover:bg-yellow-500/25 transition-colors"
                title="Also tracked by GMGN — click to view">
                GMGN ↗
              </Link>
            )}
            {twitter && (
              <a href={twitter} target="_blank" rel="noopener noreferrer"
                className="text-zinc-500 hover:text-white transition-colors text-sm leading-none">𝕏</a>
            )}
            {telegram && (
              <a href={telegram} target="_blank" rel="noopener noreferrer"
                className="text-zinc-500 hover:text-blue-400 transition-colors text-sm leading-none" title="Telegram">✈</a>
            )}
            {xProfile && (
              <span className="text-zinc-600 text-xs">
                {xProfile.followers >= 1000 ? `${(xProfile.followers / 1000).toFixed(1)}K` : xProfile.followers} followers
              </span>
            )}
          </div>
          {xProfile?.bio && (
            <p className="text-zinc-500 text-[11px] mt-0.5 line-clamp-1 max-w-lg">{xProfile.bio}</p>
          )}
          <div className="flex items-center gap-1.5 mt-0.5">
            <a href={`https://solscan.io/account/${params.address}`} target="_blank" rel="noopener noreferrer"
              className="font-mono text-[11px] text-zinc-600 hover:text-buy transition-colors">
              {truncate(params.address)}
            </a>
            <CopyButton text={params.address}
              className="text-zinc-600 hover:text-white transition-colors text-xs leading-none" />
          </div>
        </div>

        <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
          {quickLinks.map((link) => (
            <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer"
              className="bg-bg-card border border-border rounded-lg px-2.5 py-1 text-xs text-zinc-500 hover:text-white hover:border-zinc-600 transition-all">
              {link.label}
            </a>
          ))}
        </div>
      </div>

      {/* ── 3-Column Dashboard ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">

        {/* Left: Total Profit + Rankings */}
        <div className="bg-bg-card border border-border rounded-xl p-4">
          <div className="text-zinc-500 text-[11px] uppercase tracking-wider mb-2">Total Profit · SOL</div>
          <div className={`text-3xl font-bold tabular-nums leading-none mb-0.5 ${profitColor(totalProfit)}`}>
            {totalProfit >= 0 ? "+" : ""}{totalProfit.toFixed(2)}
          </div>
          <div className="text-zinc-600 text-xs mb-4">across all timeframes</div>

          <div className="space-y-1.5 text-xs mb-4">
            <div className="flex justify-between">
              <span className="text-zinc-500">Best Timeframe</span>
              <span className="text-white font-medium">{timeframeLabel(best.timeframe)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Best Profit</span>
              <span className={`tabular-nums font-medium ${profitColor(best.profit)}`}>{fmt(best.profit)}</span>
            </div>
          </div>

          {/* Rankings progress bars */}
          <div className="space-y-2.5">
            <div className="text-zinc-600 text-[10px] uppercase tracking-wider">Leaderboard</div>
            {ranks.map((r) => {
              const pct = r.total > 0 ? (r.rank / r.total) * 100 : 0;
              return (
                <div key={r.timeframe}>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-zinc-500">{timeframeLabel(r.timeframe)}</span>
                    <span className="text-zinc-400 tabular-nums">#{r.rank} / {r.total}</span>
                  </div>
                  <div className="w-full bg-bg-primary rounded-full h-1">
                    <div
                      className={`h-1 rounded-full transition-all ${r.rank <= 10 ? "bg-buy" : r.rank <= 25 ? "bg-yellow-500" : "bg-zinc-600"}`}
                      style={{ width: `${Math.max(100 - pct, 5)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center: Win Rate + Per-timeframe */}
        <div className="bg-bg-card border border-border rounded-xl p-4">
          <div className="text-zinc-500 text-[11px] uppercase tracking-wider mb-2">
            Win Rate
            {lowSample && (
              <span className="ml-2 text-yellow-500/80 normal-case" title="Low sample size — win rate may not be reliable">
                ⚠ {totalTrades} trades
              </span>
            )}
          </div>
          <div className={`text-3xl font-bold tabular-nums leading-none mb-4 ${winRatePct >= 50 ? "text-buy" : totalTrades > 0 ? "text-sell" : "text-zinc-500"}`}>
            {totalTrades > 0 ? `${winRatePct.toFixed(1)}%` : "—"}
          </div>

          <div className="space-y-1.5 text-xs mb-4">
            {[
              { label: "Wins", value: totalWins.toString(), color: "text-buy" },
              { label: "Losses", value: totalLosses.toString(), color: "text-sell" },
              { label: "Total Trades", value: totalTrades.toString(), color: "text-white" },
            ].map((row) => (
              <div key={row.label} className="flex justify-between">
                <span className="text-zinc-500">{row.label}</span>
                <span className={`tabular-nums font-medium ${row.color}`}>{row.value}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-border/50 pt-3 space-y-2">
            <div className="text-zinc-600 text-[10px] uppercase tracking-wider">By Timeframe</div>
            {entries.map((e) => {
              const total = e.wins + e.losses;
              const wr = total > 0 ? (e.wins / total) * 100 : 0;
              return (
                <div key={e.timeframe} className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500 w-16">{timeframeLabel(e.timeframe)}</span>
                  <span className="text-zinc-600 tabular-nums">
                    <span className="text-buy">{e.wins}</span>/<span className="text-sell">{e.losses}</span>
                  </span>
                  <span className={`tabular-nums ${total > 0 ? (wr >= 50 ? "text-buy" : "text-sell") : "text-zinc-600"}`}>
                    {total > 0 ? `${wr.toFixed(1)}%` : "—"}
                  </span>
                  <span className={`tabular-nums font-medium ${profitColor(e.profit)}`}>{fmt(e.profit)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: X Profile or Rankings detail */}
        <div className="bg-bg-card border border-border rounded-xl p-4 sm:col-span-2 lg:col-span-1">
          {xProfile ? (
            <>
              <div className="text-zinc-500 text-[11px] uppercase tracking-wider mb-3">X / Twitter</div>
              {xProfile.header && (
                <div className="rounded-lg overflow-hidden mb-3 -mx-1">
                  <img src={xProfile.header} alt="" className="w-full h-20 object-cover" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs mb-3">
                {[
                  { label: "Followers", value: xProfile.followers.toLocaleString() },
                  { label: "Following", value: xProfile.following.toLocaleString() },
                  { label: "Tweets", value: xProfile.tweets.toLocaleString() },
                  { label: "Likes", value: (xProfile.likes ?? 0).toLocaleString() },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="text-white font-bold tabular-nums">{s.value}</div>
                    <div className="text-zinc-600 text-[10px]">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-1 text-[11px] text-zinc-500">
                {xProfile.location && <div>📍 {xProfile.location}</div>}
                {xProfile.website && (
                  <a href={xProfile.website} target="_blank" rel="noopener noreferrer"
                    className="hover:text-white transition-colors block truncate">
                    🔗 {xProfile.website.replace(/^https?:\/\//, "")}
                  </a>
                )}
                {xProfile.joinDate && (
                  <div>📅 Joined {new Date(xProfile.joinDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="text-zinc-500 text-[11px] uppercase tracking-wider mb-3">Rankings Detail</div>
              <div className="space-y-3">
                {ranks.map((r) => {
                  const pct = r.total > 0 ? (r.rank / r.total) * 100 : 0;
                  return (
                    <div key={r.timeframe} className="bg-bg-elevated/30 rounded-lg p-3">
                      <div className="flex justify-between items-baseline mb-1.5">
                        <span className="text-white text-xs font-medium">{timeframeLabel(r.timeframe)}</span>
                        <span className="text-zinc-500 text-[11px] tabular-nums">#{r.rank}/{r.total}</span>
                      </div>
                      <div className="w-full bg-bg-primary rounded-full h-1 mb-2">
                        <div
                          className={`h-1 rounded-full transition-all ${r.rank <= 10 ? "bg-buy" : r.rank <= 25 ? "bg-yellow-500" : "bg-zinc-600"}`}
                          style={{ width: `${Math.max(100 - pct, 5)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs tabular-nums">
                        <span className={profitColor(r.entry.profit)}>{fmt(r.entry.profit)}</span>
                        <span><span className="text-buy">{r.entry.wins}</span>/<span className="text-sell">{r.entry.losses}</span></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── PnL Calendar ── */}
      <div className="bg-bg-card border border-border rounded-xl p-4 mb-4">
        <div className="text-zinc-500 text-[11px] uppercase tracking-wider mb-3">PnL Calendar</div>
        <PnlCalendar entries={entries} walletAddress={params.address} walletName={name} />
      </div>

      {/* ── Top KOLs ── */}
      {topWallets.length > 0 && (
        <div className="mb-4">
          <div className="text-zinc-500 text-[11px] uppercase tracking-wider mb-2">Top KOLs Today</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {topWallets.map((w) => {
              const wTotal = w.wins + w.losses;
              const wRate = wTotal > 0 ? ((w.wins / wTotal) * 100).toFixed(0) : "0";
              return (
                <Link key={w.wallet_address} href={`/wallet/${w.wallet_address}`}
                  className="group bg-bg-card border border-border rounded-xl p-3 hover:border-buy/30 transition-all">
                  <div className="text-white text-xs font-medium truncate group-hover:text-buy transition-colors mb-1">{w.name}</div>
                  <div className={`text-xs font-bold tabular-nums ${profitColor(w.profit)}`}>{fmt(w.profit)}</div>
                  <div className="text-[10px] text-zinc-600 tabular-nums mt-0.5">
                    <span className="text-buy">{w.wins}</span>/<span className="text-sell">{w.losses}</span>
                    <span className="ml-1">({wRate}%)</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Full Address ── */}
      <div className="border border-border/50 rounded-xl p-3 text-center">
        <span className="text-zinc-600 text-[11px] uppercase tracking-wider">Full Address · </span>
        <a href={`https://solscan.io/account/${params.address}`} target="_blank" rel="noopener noreferrer"
          className="font-mono text-xs text-buy hover:underline break-all">{params.address}</a>
      </div>
    </main>
  );
}
