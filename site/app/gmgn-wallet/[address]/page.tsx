import { getSolGmgnData, getBscGmgnData, getXProfiles, getXProfile } from "@/lib/data";

function truncate(addr: string) {
  if (addr.startsWith("0x")) return addr.slice(0, 6) + "..." + addr.slice(-4);
  return addr.slice(0, 4) + "..." + addr.slice(-4);
}

function profitColor(v: number) {
  return v > 0 ? "text-buy" : v < 0 ? "text-sell" : "text-zinc-600";
}

function formatProfit(v: number) {
  if (Math.abs(v) >= 1000) return `${v >= 0 ? "+" : ""}${(v / 1000).toFixed(1)}k`;
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;
}

const CATEGORY_LABELS: Record<string, string> = {
  smart_degen: "Smart Degen",
  kol: "KOL",
  launchpad_smart: "Launchpad",
  fresh_wallet: "Fresh Wallet",
  snipe_bot: "Sniper",
  live: "Live",
  top_followed: "Top Followed",
  top_renamed: "Top Renamed",
};

export async function generateStaticParams() {
  const [sol, bsc] = await Promise.all([getSolGmgnData(), getBscGmgnData()]);
  const all = [...sol, ...bsc];
  return all.map((w) => ({ address: w.wallet_address }));
}

export async function generateMetadata({ params }: { params: { address: string } }) {
  const [sol, bsc] = await Promise.all([getSolGmgnData(), getBscGmgnData()]);
  const all = [...sol, ...bsc];
  const w = all.find((e) => e.wallet_address === params.address);
  const name = w?.name || params.address.slice(0, 8);
  const title = `${name} Wallet`;
  const description = `GMGN smart money profile for ${name} — realized profit, win rate, and token trades.`;
  return {
    title,
    description,
    openGraph: {
      title: `${title} | KolQuest`,
      description,
    },
  };
}

export default async function GmgnWalletPage({ params, searchParams }: { params: { address: string }; searchParams: { chain?: string } }) {
  const [sol, bsc, xProfiles] = await Promise.all([getSolGmgnData(), getBscGmgnData(), getXProfiles()]);
  const all = [...sol, ...bsc];
  const wallet = all.find((w) => w.wallet_address === params.address);

  if (!wallet) {
    return (
      <main className="max-w-4xl mx-auto px-6 py-20 text-center animate-fade-in">
        <h1 className="text-2xl font-bold text-white mb-2">Wallet Not Found</h1>
        <p className="text-zinc-500">No GMGN data found for this address.</p>
      </main>
    );
  }

  const xProfile = getXProfile(xProfiles, wallet.twitter_username);

  const chain = wallet.chain;
  const explorer = chain === "bsc" ? "https://bscscan.com/address" : "https://solscan.io/account";
  const nativeSymbol = chain === "bsc" ? "BNB" : "SOL";

  const timeframes = [
    {
      label: "Daily (1D)",
      profit: wallet.realized_profit_1d,
      buys: wallet.buy_1d,
      sells: wallet.sell_1d,
    },
    {
      label: "Weekly (7D)",
      profit: wallet.realized_profit_7d,
      buys: wallet.buy_7d,
      sells: wallet.sell_7d,
      winrate: wallet.winrate_7d,
    },
    {
      label: "Monthly (30D)",
      profit: wallet.realized_profit_30d,
      buys: wallet.buy_30d,
      sells: wallet.sell_30d,
      winrate: wallet.winrate_30d,
    },
  ];

  const totalProfit = wallet.realized_profit_1d + wallet.realized_profit_7d + wallet.realized_profit_30d;

  return (
    <main className="max-w-5xl mx-auto px-6 py-10 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
        {(xProfile?.avatar || wallet.avatar) ? (
          <img src={xProfile?.avatar || wallet.avatar!} alt="" className="w-12 h-12 rounded-xl shadow-glow" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-xl font-bold text-white shadow-glow">
            {wallet.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-white tracking-tight">{wallet.name}</h1>
            {xProfile?.verified && (
              <span className="text-blue-400 text-sm" title="Verified">✓</span>
            )}
            <span className="text-[10px] px-2 py-0.5 rounded border bg-zinc-800/50 text-zinc-400 border-zinc-700 uppercase">
              {chain}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded border bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
              GMGN
            </span>
            {wallet.tags.map((tag) => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded border bg-purple-500/20 text-purple-400 border-purple-500/30">
                {CATEGORY_LABELS[tag] || tag}
              </span>
            ))}
            {wallet.twitter_username && (
              <a href={`https://x.com/${wallet.twitter_username}`} target="_blank" rel="noopener noreferrer"
                className="text-zinc-500 hover:text-white transition-colors text-sm">𝕏</a>
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
            href={`${explorer}/${params.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-zinc-500 hover:text-buy transition-colors"
          >
            {truncate(params.address)}
          </a>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[
            { href: `${explorer}/${params.address}`, label: chain === "bsc" ? "BscScan" : "Solscan", hoverColor: "hover:text-white" },
            { href: `https://gmgn.ai/${chain === "bsc" ? "bsc" : "sol"}/address/${params.address}?ref=nichxbt`, label: "GMGN", hoverColor: "hover:text-yellow-400" },
            { href: `https://trade.padre.gg/rk/nich?wallet=${params.address}`, label: "Padre", hoverColor: "hover:text-purple-400" },
          ].map((link) => (
            <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer"
              className={`bg-bg-card border border-border rounded-xl px-3 py-1.5 text-xs text-zinc-500 ${link.hoverColor} transition-all duration-200`}>
              {link.label}
            </a>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: "X Followers", value: (xProfile?.followers ?? wallet.follow_count).toLocaleString(), color: "text-white" },
          { label: "Category", value: CATEGORY_LABELS[wallet.category] || wallet.category, color: "text-purple-400" },
          { label: "Balance", value: `${wallet.balance.toFixed(2)} ${nativeSymbol}`, color: "text-white" },
          {
            label: "Last Active",
            value: wallet.last_active > 0
              ? new Date(wallet.last_active * 1000).toLocaleDateString()
              : "N/A",
            color: "text-zinc-400",
          },
        ].map((s) => (
          <div key={s.label} className="bg-bg-card rounded-2xl border border-border shadow-card p-4">
            <div className="text-zinc-500 text-[11px] uppercase tracking-wider mb-1">{s.label}</div>
            <div className={`text-sm font-bold tabular-nums ${s.color}`}>{s.value}</div>
          </div>
        ))}
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
        <h2 className="text-base font-bold text-white tracking-tight mb-4">PnL by Timeframe</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {timeframes.map((tf) => {
            const total = tf.buys + tf.sells;
            return (
              <div key={tf.label} className="bg-bg-card rounded-2xl border border-border shadow-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white font-semibold text-sm">{tf.label}</span>
                  <span className={`text-sm font-bold tabular-nums ${profitColor(tf.profit)}`}>
                    {formatProfit(tf.profit)} {nativeSymbol}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <div className="text-zinc-500">Buys</div>
                    <div className="text-buy font-medium tabular-nums">{tf.buys}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500">Sells</div>
                    <div className="text-sell font-medium tabular-nums">{tf.sells}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500">Total Txs</div>
                    <div className="text-white font-medium tabular-nums">{total}</div>
                  </div>
                  {"winrate" in tf && (
                    <div>
                      <div className="text-zinc-500">Win Rate</div>
                      <div className={`font-medium tabular-nums ${(tf.winrate ?? 0) >= 0.5 ? "text-buy" : (tf.winrate ?? 0) > 0 ? "text-sell" : "text-zinc-600"}`}>
                        {(tf.winrate ?? 0) > 0 ? `${((tf.winrate ?? 0) * 100).toFixed(1)}%` : "—"}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Trading Stats */}
      <div className="mb-8">
        <h2 className="text-base font-bold text-white tracking-tight mb-4">Trading Stats</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Volume 7D", value: wallet.volume_7d >= 1000 ? `$${(wallet.volume_7d / 1000).toFixed(1)}k` : `$${wallet.volume_7d.toFixed(0)}` },
            { label: "Volume 30D", value: wallet.volume_30d >= 1000 ? `$${(wallet.volume_30d / 1000).toFixed(1)}k` : `$${wallet.volume_30d.toFixed(0)}` },
            { label: "Avg Cost 7D", value: wallet.avg_cost_7d >= 1000 ? `$${(wallet.avg_cost_7d / 1000).toFixed(1)}k` : `$${wallet.avg_cost_7d.toFixed(0)}` },
            { label: "Avg Hold 7D", value: wallet.avg_holding_period_7d > 3600 ? `${(wallet.avg_holding_period_7d / 3600).toFixed(1)}h` : wallet.avg_holding_period_7d > 60 ? `${(wallet.avg_holding_period_7d / 60).toFixed(0)}m` : `${wallet.avg_holding_period_7d.toFixed(0)}s` },
            { label: "ROI 7D", value: `${(wallet.pnl_7d * 100).toFixed(1)}%`, color: wallet.pnl_7d > 0 ? "text-buy" : wallet.pnl_7d < 0 ? "text-sell" : undefined },
            { label: "ROI 30D", value: `${(wallet.pnl_30d * 100).toFixed(1)}%`, color: wallet.pnl_30d > 0 ? "text-buy" : wallet.pnl_30d < 0 ? "text-sell" : undefined },
            { label: "Win Rate 1D", value: wallet.winrate_1d > 0 ? `${(wallet.winrate_1d * 100).toFixed(1)}%` : "—" },
            { label: "Net Inflow 7D", value: wallet.net_inflow_7d >= 1000 ? `$${(wallet.net_inflow_7d / 1000).toFixed(1)}k` : wallet.net_inflow_7d <= -1000 ? `-$${(Math.abs(wallet.net_inflow_7d) / 1000).toFixed(1)}k` : `$${wallet.net_inflow_7d.toFixed(0)}`, color: wallet.net_inflow_7d > 0 ? "text-buy" : wallet.net_inflow_7d < 0 ? "text-sell" : undefined },
          ].map((s) => (
            <div key={s.label} className="bg-bg-card rounded-2xl border border-border shadow-card p-4">
              <div className="text-zinc-500 text-[11px] uppercase tracking-wider mb-1">{s.label}</div>
              <div className={`text-sm font-bold tabular-nums ${(s as any).color || "text-white"}`}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* PnL Distribution */}
      {(() => {
        const dist = [
          { label: "<-50%", value: wallet.pnl_lt_minus_dot5_num_7d, color: "bg-red-500" },
          { label: "-50%–0", value: wallet.pnl_minus_dot5_0x_num_7d, color: "bg-orange-500" },
          { label: "0–2x", value: wallet.pnl_lt_2x_num_7d, color: "bg-zinc-500" },
          { label: "2–5x", value: wallet.pnl_2x_5x_num_7d, color: "bg-emerald-500" },
          { label: ">5x", value: wallet.pnl_gt_5x_num_7d, color: "bg-green-400" },
        ];
        const total = dist.reduce((s, d) => s + d.value, 0);
        if (total === 0) return null;
        return (
          <div className="mb-8">
            <h2 className="text-base font-bold text-white tracking-tight mb-4">PnL Distribution (7D)</h2>
            <div className="bg-bg-card rounded-2xl border border-border shadow-card p-5">
              <div className="flex rounded-lg overflow-hidden h-6 mb-3">
                {dist.map((d) => d.value > 0 ? (
                  <div key={d.label} className={`${d.color} transition-all`} style={{ width: `${(d.value / total) * 100}%` }} title={`${d.label}: ${d.value} trades`} />
                ) : null)}
              </div>
              <div className="flex justify-between text-[11px]">
                {dist.map((d) => (
                  <div key={d.label} className="text-center">
                    <div className="text-zinc-500">{d.label}</div>
                    <div className="text-white font-medium tabular-nums">{d.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Daily Profit (7D Sparkline) */}
      {wallet.daily_profit_7d.length > 0 && (() => {
        const profits = wallet.daily_profit_7d;
        const max = Math.max(...profits.map((d) => Math.abs(d.profit)), 1);
        return (
          <div className="mb-8">
            <h2 className="text-base font-bold text-white tracking-tight mb-4">Daily Profit (7D)</h2>
            <div className="bg-bg-card rounded-2xl border border-border shadow-card p-5">
              <div className="flex items-end gap-1.5 h-24">
                {profits.map((d) => {
                  const pct = Math.abs(d.profit) / max;
                  const isPos = d.profit >= 0;
                  return (
                    <div key={d.timestamp} className="flex-1 flex flex-col items-center justify-end h-full">
                      <div
                        className={`w-full rounded-sm ${isPos ? "bg-buy/70" : "bg-sell/70"}`}
                        style={{ height: `${Math.max(pct * 100, 4)}%` }}
                        title={`${isPos ? "+" : ""}${d.profit.toFixed(2)}`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-1.5 mt-2">
                {profits.map((d) => (
                  <div key={d.timestamp} className="flex-1 text-center text-[9px] text-zinc-600">
                    {new Date(d.timestamp * 1000).toLocaleDateString(undefined, { weekday: "short" })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Quick Actions */}
      <div className="bg-bg-card rounded-2xl border border-border shadow-card p-5 mb-8">
        <h2 className="text-zinc-500 text-xs font-medium mb-3 uppercase tracking-wider">Quick Actions</h2>
        <div className="flex flex-wrap gap-2">
          {[
            { href: `https://gmgn.ai/${chain === "bsc" ? "bsc" : "sol"}/address/${params.address}?ref=nichxbt`, label: "GMGN", border: "hover:border-yellow-500/50" },
            { href: `https://trade.padre.gg/rk/nich?wallet=${params.address}`, label: "Padre", border: "hover:border-purple-500/50" },
            { href: `${explorer}/${params.address}`, label: chain === "bsc" ? "BscScan" : "Solscan", border: "hover:border-blue-500/50" },
            ...(chain === "sol" ? [
              { href: `https://birdeye.so/profile/${params.address}?chain=solana`, label: "Birdeye", border: "hover:border-indigo-500/50" },
            ] : []),
          ].map((link) => (
            <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer"
              className={`bg-bg-elevated/50 border border-border rounded-xl px-4 py-2 text-xs text-zinc-400 hover:text-white ${link.border} transition-all duration-200`}>
              {link.label} →
            </a>
          ))}
        </div>
      </div>

      {/* Full Address */}
      <div className="bg-bg-card rounded-2xl border border-border shadow-card p-4 text-center">
        <span className="text-zinc-500 text-xs uppercase tracking-wider">Full Address</span>
        <div className="font-mono text-sm text-buy break-all mt-1.5">{params.address}</div>
      </div>
    </main>
  );
}
