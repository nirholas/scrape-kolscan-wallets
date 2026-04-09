import Link from "next/link";
import { getData, getXProfiles, getXProfile } from "@/lib/data";
import PnlCalendar from "@/app/components/PnlCalendar";

function truncate(addr: string) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function profitColor(v: number) {
  return v > 0 ? "text-buy" : v < 0 ? "text-sell" : "text-zinc-600";
}

function formatProfit(v: number) {
  return `${v > 0 ? "+" : ""}${v.toFixed(2)} SOL`;
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
    openGraph: {
      title: `${title} | KolQuest`,
      description,
    },
  };
}

export default async function WalletPage({ params }: { params: { address: string } }) {
  const [data, xProfiles] = await Promise.all([getData(), getXProfiles()]);
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

  const timeframeLabel = (tf: number) =>
    tf === 1 ? "Daily" : tf === 7 ? "Weekly" : "Monthly";

  // Aggregate stats
  const totalProfit = entries.reduce((s, e) => s + e.profit, 0);
  const totalWins = entries.reduce((s, e) => s + e.wins, 0);
  const totalLosses = entries.reduce((s, e) => s + e.losses, 0);
  const totalTrades = totalWins + totalLosses;
  const winRate = totalTrades > 0
    ? ((totalWins / totalTrades) * 100).toFixed(1)
    : "N/A";

  // Best timeframe
  const best = entries.reduce((a, b) => (a.profit > b.profit ? a : b));

  // Find rank per timeframe
  const ranks = entries.map((e) => {
    const peers = data
      .filter((d) => d.timeframe === e.timeframe)
      .sort((a, b) => b.profit - a.profit);
    const rank = peers.findIndex((p) => p.wallet_address === e.wallet_address) + 1;
    return { timeframe: e.timeframe, rank, total: peers.length };
  });

  // Get other top wallets for "similar traders" section
  const topWallets = data
    .filter((d) => d.timeframe === 1 && d.wallet_address !== params.address && d.profit > 0)
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 6);

  return (
    <main className="max-w-5xl mx-auto px-6 py-10 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
        {xProfile?.avatar ? (
          <img src={xProfile.avatar} alt="" className="w-12 h-12 rounded-xl shadow-glow" />
        ) : (
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-buy to-emerald-600 flex items-center justify-center text-xl font-bold text-white shadow-glow">
          {name.charAt(0).toUpperCase()}
        </div>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-white tracking-tight">{name}</h1>
            {xProfile?.verified && (
              <span className="text-blue-400 text-sm" title="Verified">✓</span>
            )}
            {twitter && (
              <a href={twitter} target="_blank" rel="noopener noreferrer"
                className="text-zinc-500 hover:text-white transition-colors text-sm" title="Twitter/X">
                𝕏
              </a>
            )}
            {telegram && (
              <a href={telegram} target="_blank" rel="noopener noreferrer"
                className="text-zinc-500 hover:text-blue-400 transition-colors text-sm" title="Telegram">
                ✈
              </a>
            )}
            {xProfile && (
              <span className="text-zinc-600 text-xs">
                {xProfile.followers >= 1000
                  ? `${(xProfile.followers / 1000).toFixed(1)}K`
                  : xProfile.followers}{" "}
                followers
              </span>
            )}
          </div>
          {xProfile?.bio && (
            <p className="text-zinc-400 text-xs mt-1 line-clamp-2 max-w-lg">{xProfile.bio}</p>
          )}
          <a
            href={`https://solscan.io/account/${params.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-zinc-500 hover:text-buy transition-colors"
          >
            {truncate(params.address)}
          </a>
        </div>
        <div className="flex gap-1.5">
          {[
            { href: `https://solscan.io/account/${params.address}`, label: "Solscan", hoverColor: "hover:text-white" },
            { href: `https://gmgn.ai/sol/address/${params.address}?ref=nichxbt`, label: "GMGN", hoverColor: "hover:text-yellow-400" },
            { href: `https://trade.padre.gg/rk/nich?wallet=${params.address}`, label: "Padre", hoverColor: "hover:text-purple-400" },
            { href: `https://kolscan.io/${params.address}`, label: "KolScan", hoverColor: "hover:text-buy" },
          ].map((link) => (
            <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer"
              className={`bg-bg-card border border-border rounded-xl px-3 py-1.5 text-xs text-zinc-500 ${link.hoverColor} transition-all duration-200`}>
              {link.label}
            </a>
          ))}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        {/* Stats panel */}
        <div className="bg-bg-card rounded-2xl border border-border shadow-card p-5">
          <h2 className="text-zinc-500 text-xs font-medium mb-4 uppercase tracking-wider">Stats</h2>
          <div className="space-y-3">
            {[
              { label: "Win Rate", value: winRate === "N/A" ? "N/A" : `${winRate}%`, color: winRate !== "N/A" && parseFloat(winRate) >= 50 ? "text-buy" : winRate !== "N/A" ? "text-sell" : "text-white" },
              { label: "Total Trades", value: totalTrades, color: "text-white" },
              { label: "Wins", value: totalWins, color: "text-buy" },
              { label: "Losses", value: totalLosses, color: "text-sell" },
            ].map((s) => (
              <div key={s.label} className="flex justify-between">
                <span className="text-zinc-500 text-sm">{s.label}</span>
                <span className={`text-sm font-medium tabular-nums ${s.color}`}>{s.value}</span>
              </div>
            ))}
            <div className="border-t border-border/50 my-2" />
            {[
              { label: "Total Profit", value: formatProfit(totalProfit), color: profitColor(totalProfit), bold: true },
              { label: "Best Timeframe", value: timeframeLabel(best.timeframe), color: "text-white" },
              { label: "Best Profit", value: formatProfit(best.profit), color: profitColor(best.profit) },
            ].map((s) => (
              <div key={s.label} className="flex justify-between">
                <span className="text-zinc-500 text-sm">{s.label}</span>
                <span className={`text-sm tabular-nums ${s.bold ? "font-bold" : "font-medium"} ${s.color}`}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Rankings panel */}
        <div className="bg-bg-card rounded-2xl border border-border shadow-card p-5">
          <h2 className="text-zinc-500 text-xs font-medium mb-4 uppercase tracking-wider">Leaderboard Rankings</h2>
          <div className="space-y-3">
            {ranks.map((r) => {
              const entry = entries.find((e) => e.timeframe === r.timeframe)!;
              const pct = r.total > 0 ? ((r.rank / r.total) * 100).toFixed(0) : "0";
              return (
                <div key={r.timeframe} className="bg-bg-elevated/50 rounded-xl p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-white text-sm font-medium">{timeframeLabel(r.timeframe)}</span>
                    <span className="text-zinc-500 text-xs tabular-nums">#{r.rank} / {r.total}</span>
                  </div>
                  <div className="w-full bg-bg-primary rounded-full h-1 mb-2">
                    <div
                      className={`h-1 rounded-full transition-all ${r.rank <= 10 ? "bg-buy" : r.rank <= 25 ? "bg-yellow-500" : "bg-zinc-600"}`}
                      style={{ width: `${Math.max(100 - Number(pct), 5)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs tabular-nums">
                    <span className={profitColor(entry.profit)}>{formatProfit(entry.profit)}</span>
                    <span className="text-zinc-500">
                      <span className="text-buy">{entry.wins}</span>/<span className="text-sell">{entry.losses}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* X Profile */}
      {xProfile && (
        <div className="bg-bg-card rounded-2xl border border-border shadow-card p-5 mb-8">
          <h2 className="text-zinc-500 text-xs font-medium mb-4 uppercase tracking-wider">X / Twitter</h2>
          {xProfile.header && (
            <div className="rounded-xl overflow-hidden mb-4 -mx-1">
              <img src={xProfile.header} alt="" className="w-full h-28 object-cover" />
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
            {[
              { label: "Followers", value: xProfile.followers.toLocaleString() },
              { label: "Following", value: xProfile.following.toLocaleString() },
              { label: "Tweets", value: xProfile.tweets.toLocaleString() },
              { label: "Likes", value: (xProfile.likes ?? 0).toLocaleString() },
              { label: "Media", value: (xProfile.media ?? 0).toLocaleString() },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-white text-sm font-bold tabular-nums">{s.value}</div>
                <div className="text-zinc-500 text-[11px] uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
            {xProfile.location && <span>📍 {xProfile.location}</span>}
            {xProfile.website && (
              <a href={xProfile.website} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors truncate max-w-xs">
                🔗 {xProfile.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            {xProfile.joinDate && <span>📅 Joined {new Date(xProfile.joinDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>}
          </div>
        </div>
      )}

      {/* PnL by Timeframe */}
      <div className="mb-8">
        <div className="flex items-baseline gap-3 mb-4">
          <h2 className="text-base font-bold text-white tracking-tight">PnL by Timeframe</h2>
          <span className="text-xs tabular-nums">
            <span className="text-buy">{totalWins}</span>
            <span className="text-zinc-600">/</span>
            <span className="text-sell">{totalLosses}</span>
            <span className={`ml-2 font-bold ${profitColor(totalProfit)}`}>
              {formatProfit(totalProfit)}
            </span>
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {entries.map((e) => {
            const total = e.wins + e.losses;
            const wr = total > 0 ? ((e.wins / total) * 100).toFixed(1) : "0";
            const roi = total > 0 ? ((e.wins / total) * 100 - 50).toFixed(1) : "0";
            return (
              <div key={e.timeframe} className="bg-bg-card rounded-2xl border border-border shadow-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white font-semibold text-sm">{timeframeLabel(e.timeframe)}</span>
                  <span className={`text-sm font-bold tabular-nums ${profitColor(e.profit)}`}>
                    {formatProfit(e.profit)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <div className="text-zinc-500">Wins</div>
                    <div className="text-buy font-medium tabular-nums">{e.wins}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500">Losses</div>
                    <div className="text-sell font-medium tabular-nums">{e.losses}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500">Win Rate</div>
                    <div className={`font-medium tabular-nums ${parseFloat(wr) >= 50 ? "text-buy" : "text-sell"}`}>
                      {total > 0 ? `${wr}%` : "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-zinc-500">Edge</div>
                    <div className={`font-medium tabular-nums ${parseFloat(roi) >= 0 ? "text-buy" : "text-sell"}`}>
                      {total > 0 ? `${parseFloat(roi) > 0 ? "+" : ""}${roi}%` : "-"}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* PnL Calendar */}
      <div className="mb-8">
        <h2 className="text-base font-bold text-white tracking-tight mb-4">PnL Calendar</h2>
        <PnlCalendar entries={entries} walletAddress={params.address} walletName={name} />
      </div>

      {/* Quick Actions */}
      <div className="bg-bg-card rounded-2xl border border-border shadow-card p-5 mb-8">
        <h2 className="text-zinc-500 text-xs font-medium mb-3 uppercase tracking-wider">Quick Actions</h2>
        <div className="flex flex-wrap gap-2">
          {[
            { href: `https://kolscan.io/${params.address}`, label: "KolScan", border: "hover:border-buy/50" },
            { href: `https://gmgn.ai/sol/address/${params.address}?ref=nichxbt`, label: "GMGN", border: "hover:border-yellow-500/50" },
            { href: `https://trade.padre.gg/rk/nich?wallet=${params.address}`, label: "Padre", border: "hover:border-purple-500/50" },
            { href: `https://solscan.io/account/${params.address}`, label: "Solscan", border: "hover:border-blue-500/50" },
            { href: `https://birdeye.so/profile/${params.address}?chain=solana`, label: "Birdeye", border: "hover:border-indigo-500/50" },
          ].map((link) => (
            <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer"
              className={`bg-bg-elevated/50 border border-border rounded-xl px-4 py-2 text-xs text-zinc-400 hover:text-white ${link.border} transition-all duration-200`}>
              {link.label} →
            </a>
          ))}
        </div>
      </div>

      {/* Top KOLs */}
      {topWallets.length > 0 && (
        <div className="mb-8">
          <h2 className="text-base font-bold text-white tracking-tight mb-4">Top KOLs Today</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {topWallets.map((w) => {
              const wTotal = w.wins + w.losses;
              const wRate = wTotal > 0 ? ((w.wins / wTotal) * 100).toFixed(0) : "0";
              return (
                <Link
                  key={w.wallet_address}
                  href={`/wallet/${w.wallet_address}`}
                  className="group bg-bg-card rounded-2xl border border-border shadow-card p-4 hover:border-buy/30 transition-all duration-200"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium text-sm group-hover:text-buy transition-colors">{w.name}</span>
                    <span className={`text-xs font-bold tabular-nums ${profitColor(w.profit)}`}>
                      {formatProfit(w.profit)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-zinc-500 tabular-nums">
                    <span className="font-mono">{truncate(w.wallet_address)}</span>
                    <span>
                      <span className="text-buy">{w.wins}</span>/<span className="text-sell">{w.losses}</span>
                      {wTotal > 0 && <span className="ml-1 text-zinc-600">({wRate}%)</span>}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Full Address */}
      <div className="bg-bg-card rounded-2xl border border-border shadow-card p-4 text-center">
        <span className="text-zinc-500 text-xs uppercase tracking-wider">Full Address</span>
        <div className="font-mono text-sm text-buy break-all mt-1.5">{params.address}</div>
      </div>
    </main>
  );
}
