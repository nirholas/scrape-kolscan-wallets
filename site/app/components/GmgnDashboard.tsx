"use client";

import { useState } from "react";
import CopyButton from "./CopyButton";
import type { GmgnWallet } from "@/lib/types";

type TF = "1d" | "7d" | "30d";

const TAG_DESCRIPTIONS: Record<string, string> = {
  smart_degen: "High-frequency trader with strong returns",
  kol: "Key Opinion Leader — influential crypto influencer",
  launchpad_smart: "Early buyer on token launches",
  fresh_wallet: "Recently created wallet",
  snipe_bot: "Uses automated sniping strategies",
  live: "Currently active trader",
  top_followed: "One of the most-followed wallets",
  top_renamed: "Wallet that has been frequently renamed/tracked",
};

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

function fmt(v: number) {
  const abs = Math.abs(v);
  const sign = v >= 0 ? "+" : "-";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(2)}`;
}

function fmtHold(secs: number) {
  if (secs <= 0) return "—";
  if (secs >= 86400) return `${(secs / 86400).toFixed(1)}d`;
  if (secs >= 3600) return `${(secs / 3600).toFixed(1)}h`;
  if (secs >= 60) return `${(secs / 60).toFixed(0)}m`;
  return `${secs.toFixed(0)}s`;
}

function profitColor(v: number) {
  return v > 0 ? "text-buy" : v < 0 ? "text-sell" : "text-zinc-500";
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

function truncate(addr: string) {
  if (addr.startsWith("0x")) return addr.slice(0, 6) + "..." + addr.slice(-4);
  return addr.slice(0, 4) + "..." + addr.slice(-4);
}

interface Props {
  wallet: GmgnWallet;
  nativeSymbol: string;
  explorerUrl: string;
  quickLinks: { href: string; label: string }[];
  xProfileFollowers?: number;
  xProfileAvatar?: string;
  xProfileBio?: string;
  kolscanExists: boolean;
}

export default function GmgnDashboard({
  wallet,
  nativeSymbol,
  explorerUrl,
  quickLinks,
  xProfileFollowers,
  xProfileAvatar,
  xProfileBio,
  kolscanExists,
}: Props) {
  const [tf, setTf] = useState<TF>("7d");

  const tfMap: Record<TF, {
    profit: number; roi: number; buys: number; sells: number;
    txs: number; winrate: number; volume: number;
    avgCost: number; avgHold: number; netInflow: number; label: string;
  }> = {
    "1d": {
      profit: wallet.realized_profit_1d, roi: wallet.pnl_1d * 100,
      buys: wallet.buy_1d, sells: wallet.sell_1d, txs: wallet.txs_1d,
      winrate: wallet.winrate_1d, volume: wallet.volume_1d,
      avgCost: wallet.avg_cost_1d, avgHold: wallet.avg_holding_period_1d,
      netInflow: wallet.net_inflow_1d, label: "1D",
    },
    "7d": {
      profit: wallet.realized_profit_7d, roi: wallet.pnl_7d * 100,
      buys: wallet.buy_7d, sells: wallet.sell_7d, txs: wallet.txs_7d,
      winrate: wallet.winrate_7d, volume: wallet.volume_7d,
      avgCost: wallet.avg_cost_7d, avgHold: wallet.avg_holding_period_7d,
      netInflow: wallet.net_inflow_7d, label: "7D",
    },
    "30d": {
      profit: wallet.realized_profit_30d, roi: wallet.pnl_30d * 100,
      buys: wallet.buy_30d, sells: wallet.sell_30d, txs: wallet.txs_30d,
      winrate: wallet.winrate_30d, volume: wallet.volume_30d,
      avgCost: wallet.avg_cost_30d, avgHold: wallet.avg_holding_period_30d,
      netInflow: wallet.net_inflow_30d, label: "30D",
    },
  };

  const curr = tfMap[tf];
  const winratePct = curr.winrate * 100;
  const lowSample = curr.txs > 0 && curr.txs < 10;

  // Win rate trend across all timeframes
  const wrTrend = [
    { label: "1D", wr: wallet.winrate_1d * 100, txs: wallet.txs_1d },
    { label: "7D", wr: wallet.winrate_7d * 100, txs: wallet.txs_7d },
    { label: "30D", wr: wallet.winrate_30d * 100, txs: wallet.txs_30d },
  ];

  // 7D distribution (always shown)
  const dist = [
    { label: "<-50%", value: wallet.pnl_lt_minus_dot5_num_7d, color: "bg-red-500", textColor: "text-red-400" },
    { label: "-50%–0", value: wallet.pnl_minus_dot5_0x_num_7d, color: "bg-orange-500", textColor: "text-orange-400" },
    { label: "0–2x", value: wallet.pnl_lt_2x_num_7d, color: "bg-zinc-500", textColor: "text-zinc-400" },
    { label: "2–5x", value: wallet.pnl_2x_5x_num_7d, color: "bg-emerald-500", textColor: "text-emerald-400" },
    { label: ">5x", value: wallet.pnl_gt_5x_num_7d, color: "bg-green-400", textColor: "text-green-400" },
  ];
  const distTotal = dist.reduce((s, d) => s + d.value, 0);

  const dailyProfits = wallet.daily_profit_7d;
  const maxAbs = Math.max(...dailyProfits.map((d) => Math.abs(d.profit)), 1);

  const followers = xProfileFollowers ?? wallet.follow_count;

  return (
    <div>
      {/* ── Compact Header ── */}
      <div className="flex items-center gap-3 mb-5">
        {(xProfileAvatar || wallet.avatar) ? (
          <img src={xProfileAvatar || wallet.avatar!} alt="" className="w-10 h-10 rounded-full flex-shrink-0" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
        ) : null}
        <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-base font-bold text-white flex-shrink-0 ${(xProfileAvatar || wallet.avatar) ? 'hidden' : ''}`}>
          {wallet.name.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-bold text-base">{wallet.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 uppercase tracking-wide">{wallet.chain}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 border border-yellow-500/25">GMGN</span>
            {kolscanExists && (
              <a href={`/wallet/${wallet.wallet_address}`}
                className="text-[10px] px-1.5 py-0.5 rounded bg-buy/15 text-buy border border-buy/25 hover:bg-buy/25 transition-colors"
                title="Also tracked on KolScan — click to view">
                KolScan ↗
              </a>
            )}
            {wallet.tags.map((tag) => (
              <span key={tag} title={TAG_DESCRIPTIONS[tag] || tag}
                className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/25 cursor-help">
                {CATEGORY_LABELS[tag] || tag}
              </span>
            ))}
            {wallet.twitter_username && (
              <a href={`https://x.com/${wallet.twitter_username}`} target="_blank" rel="noopener noreferrer"
                className="text-zinc-500 hover:text-white transition-colors text-sm leading-none">𝕏</a>
            )}
            {followers > 0 && (
              <span className="text-zinc-600 text-xs">
                {followers >= 1000 ? `${(followers / 1000).toFixed(1)}K` : followers} followers
              </span>
            )}
          </div>
          {xProfileBio && (
            <p className="text-zinc-500 text-[11px] mt-0.5 line-clamp-1 max-w-lg">{xProfileBio}</p>
          )}
          <div className="flex items-center gap-1.5 mt-0.5">
            <a href={explorerUrl} target="_blank" rel="noopener noreferrer"
              className="font-mono text-[11px] text-zinc-600 hover:text-buy transition-colors">
              {truncate(wallet.wallet_address)}
            </a>
            <CopyButton text={wallet.wallet_address}
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

      {/* ── Timeframe Tabs ── */}
      <div className="flex items-center gap-1 mb-3">
        {(["1d", "7d", "30d"] as TF[]).map((t) => {
          const d = tfMap[t];
          return (
            <button key={t} onClick={() => setTf(t)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                tf === t
                  ? "bg-buy/15 text-buy border border-buy/30"
                  : "text-zinc-500 hover:text-white border border-transparent"
              }`}>
              <span>{t.toUpperCase()}</span>
              {d.profit !== 0 && (
                <span className={`tabular-nums text-[10px] ${profitColor(d.profit)}`}>
                  {fmt(d.profit)}
                </span>
              )}
            </button>
          );
        })}
        <div className="ml-auto text-[11px] text-zinc-600">
          Last active: <span className="text-zinc-400">{relativeTime(wallet.last_active)}</span>
        </div>
      </div>

      {/* ── 3-Column Dashboard ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">

        {/* Left: PnL + Sparkline */}
        <div className="bg-bg-card border border-border rounded-xl p-4">
          <div className="text-zinc-500 text-[11px] uppercase tracking-wider mb-2">
            {curr.label} Realized PnL · {nativeSymbol}
          </div>
          <div className={`text-3xl font-bold tabular-nums leading-none mb-0.5 ${profitColor(curr.roi)}`}>
            {curr.roi >= 0 ? "+" : ""}{curr.roi.toFixed(2)}%
          </div>
          <div className={`text-sm font-medium tabular-nums mb-3 ${profitColor(curr.profit)}`}>
            {fmt(curr.profit)}
          </div>

          <div className="space-y-1.5 text-xs mb-4">
            <div className="flex justify-between">
              <span className="text-zinc-500">Balance</span>
              <span className="text-white tabular-nums font-medium">{wallet.balance.toFixed(2)} {nativeSymbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Buys / Sells</span>
              <span className="tabular-nums font-medium">
                <span className="text-buy">{curr.buys}</span>
                <span className="text-zinc-600"> / </span>
                <span className="text-sell">{curr.sells}</span>
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Total Txs</span>
              <span className="text-white tabular-nums font-medium">{curr.txs}</span>
            </div>
          </div>

          {/* Daily sparkline — always visible, labeled */}
          {dailyProfits.length > 0 && (
            <div>
              <div className="text-zinc-600 text-[10px] mb-1.5">Daily (7D)</div>
              <div className="flex items-end gap-1 h-14">
                {dailyProfits.map((d) => {
                  const pct = Math.abs(d.profit) / maxAbs;
                  return (
                    <div key={d.timestamp} className="flex-1 flex flex-col items-center justify-end h-full">
                      <div
                        className={`w-full rounded-sm ${d.profit >= 0 ? "bg-buy/70" : "bg-sell/60"}`}
                        style={{ height: `${Math.max(pct * 100, 4)}%` }}
                        title={`${d.profit >= 0 ? "+" : ""}${d.profit.toFixed(2)}`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-1 mt-1">
                {dailyProfits.map((d) => (
                  <div key={d.timestamp} className="flex-1 text-center text-[9px] text-zinc-700">
                    {new Date(d.timestamp * 1000).toLocaleDateString(undefined, { weekday: "short" })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Center: Win Rate + Analysis */}
        <div className="bg-bg-card border border-border rounded-xl p-4">
          <div className="text-zinc-500 text-[11px] uppercase tracking-wider mb-2">
            Win Rate · {curr.label}
            {lowSample && (
              <span className="ml-2 text-yellow-500/80 normal-case" title="Low sample size — win rate may not be reliable">
                ⚠ {curr.txs} trades
              </span>
            )}
          </div>
          <div className={`text-3xl font-bold tabular-nums leading-none mb-1 ${winratePct >= 50 ? "text-buy" : curr.winrate > 0 ? "text-sell" : "text-zinc-500"}`}>
            {curr.winrate > 0 ? `${winratePct.toFixed(2)}%` : "—"}
          </div>

          {/* Win rate trend */}
          <div className="flex gap-2 mb-3">
            {wrTrend.map((w) => (
              <div key={w.label} className={`text-[10px] px-1.5 py-0.5 rounded border ${
                tf === w.label.toLowerCase() + (w.label === "30D" ? "" : "")
                  ? "border-zinc-600 bg-zinc-800/50"
                  : "border-transparent"
              }`}>
                <span className="text-zinc-600">{w.label} </span>
                <span className={w.wr > 0 ? (w.wr >= 50 ? "text-buy" : "text-sell") : "text-zinc-600"}>
                  {w.wr > 0 ? `${w.wr.toFixed(0)}%` : "—"}
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-2 text-xs">
            {[
              { label: `${curr.label} Volume`, value: curr.volume > 0 ? fmt(curr.volume).replace(/^\+/, "") : "—" },
              { label: `Avg Cost ${curr.label}`, value: curr.avgCost > 0 ? fmt(curr.avgCost).replace(/^\+/, "") : "—" },
              { label: `Avg Hold ${curr.label}`, value: fmtHold(curr.avgHold) },
              { label: `ROI ${curr.label}`, value: curr.roi !== 0 ? `${curr.roi >= 0 ? "+" : ""}${curr.roi.toFixed(1)}%` : "—", color: profitColor(curr.roi) },
              { label: `Net Inflow ${curr.label}`, value: curr.netInflow !== 0 ? fmt(curr.netInflow) : "—", color: profitColor(curr.netInflow) },
            ].map((row) => (
              <div key={row.label} className="flex justify-between items-baseline">
                <span className="text-zinc-500">{row.label}</span>
                <span className={`tabular-nums font-medium ${(row as any).color || "text-white"}`}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Distribution (always 7D) */}
        <div className="bg-bg-card border border-border rounded-xl p-4 sm:col-span-2 lg:col-span-1">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-zinc-500 text-[11px] uppercase tracking-wider">PnL Distribution · 7D</span>
            {distTotal > 0 && <span className="text-zinc-600 text-[11px]">{distTotal} trades</span>}
          </div>

          {distTotal > 0 ? (
            <>
              <div className="flex rounded overflow-hidden h-2 mb-3">
                {dist.map((d) => d.value > 0 ? (
                  <div key={d.label} className={`${d.color} transition-all`}
                    style={{ width: `${(d.value / distTotal) * 100}%` }}
                    title={`${d.label}: ${d.value} (${((d.value / distTotal) * 100).toFixed(0)}%)`} />
                ) : null)}
              </div>
              <div className="space-y-1.5 mb-4">
                {dist.map((d) => (
                  <div key={d.label} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-sm flex-shrink-0 ${d.color}`} />
                      <span className="text-zinc-500">{d.label}</span>
                    </div>
                    <div className="flex items-center gap-2 tabular-nums">
                      <span className="text-zinc-600 text-[10px]">
                        {distTotal > 0 ? `${((d.value / distTotal) * 100).toFixed(0)}%` : ""}
                      </span>
                      <span className="text-white font-medium w-6 text-right">{d.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-zinc-600 text-xs mb-4">No distribution data</div>
          )}

          <div className="border-t border-border/50 pt-3">
            <div className="text-zinc-500 text-[10px] uppercase tracking-wider mb-2">All Timeframes</div>
            <div className="space-y-1.5">
              {(["1d", "7d", "30d"] as TF[]).map((t) => {
                const d = tfMap[t];
                return (
                  <button key={t} onClick={() => setTf(t)}
                    className={`w-full flex items-center justify-between text-xs rounded px-2 py-1 transition-all ${
                      tf === t ? "bg-bg-elevated/60" : "hover:bg-bg-elevated/30"
                    }`}>
                    <span className={tf === t ? "text-white font-medium" : "text-zinc-500"}>{t.toUpperCase()}</span>
                    <div className="flex items-center gap-3 tabular-nums">
                      <span className="text-zinc-600">
                        <span className="text-buy">{d.buys}</span>/<span className="text-sell">{d.sells}</span>
                      </span>
                      <span className={`font-medium ${profitColor(d.profit)}`}>{fmt(d.profit)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
