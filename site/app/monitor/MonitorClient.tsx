"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Trade {
  id: string;
  walletAddress: string;
  walletLabel: string | null;
  walletTags: string | null;
  chain: string;
  type: "buy" | "sell";
  tokenAddress: string;
  tokenSymbol: string | null;
  tokenName: string | null;
  tokenLogo: string | null;
  tokenLaunchpad: string | null;
  amountUsd: number | null;
  amountToken: number | null;
  priceUsd: number | null;
  realizedProfit: number | null;
  realizedProfitPnl: number | null;
  txHash: string | null;
  source: string;
  tradedAt: string;
}

interface WalletInfo {
  name: string;
  avatar: string | null;
  category: string;
  tags: string[];
  twitter: string | null;
  chain: string;
  profit_1d: number;
  profit_7d: number;
  winrate_7d: number;
}

interface Props {
  walletMap: Record<string, WalletInfo>;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function shortAddr(addr: string): string {
  return addr.slice(0, 4) + "…" + addr.slice(-4);
}

function formatUsd(v: number | null): string {
  if (v == null) return "—";
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  return `$${v.toFixed(2)}`;
}

function formatPnl(v: number | null): string {
  if (v == null) return "—";
  const sign = v > 0 ? "+" : "";
  if (Math.abs(v) >= 1_000_000) return `${sign}$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `${sign}$${(v / 1_000).toFixed(1)}k`;
  return `${sign}$${v.toFixed(2)}`;
}

function pnlColor(v: number | null): string {
  if (v == null) return "text-zinc-500";
  if (v > 0) return "text-buy";
  if (v < 0) return "text-sell";
  return "text-zinc-400";
}

const CATEGORY_COLORS: Record<string, string> = {
  kol: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  smart_degen: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  snipe_bot: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  fresh_wallet: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  launchpad_smart: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  top_dev: "bg-pink-500/15 text-pink-400 border-pink-500/30",
  live: "bg-green-500/15 text-green-400 border-green-500/30",
  kolscan: "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

const CATEGORY_LABELS: Record<string, string> = {
  kol: "KOL",
  smart_degen: "Smart Degen",
  snipe_bot: "Sniper",
  fresh_wallet: "Fresh",
  launchpad_smart: "Launchpad",
  top_dev: "Dev",
  live: "Live",
  kolscan: "KolScan",
};

/* ------------------------------------------------------------------ */
/*  Tabs (category filters mimicking GMGN)                           */
/* ------------------------------------------------------------------ */

type TabFilter = "all" | "smart" | "kol" | "sniper" | "fresh";

const TABS: { label: string; value: TabFilter }[] = [
  { label: "Track", value: "all" },
  { label: "Smart", value: "smart" },
  { label: "KOL", value: "kol" },
  { label: "Sniper", value: "sniper" },
  { label: "Fresh", value: "fresh" },
];

function matchesTab(category: string, tab: TabFilter): boolean {
  if (tab === "all") return true;
  if (tab === "smart") return ["smart_degen", "launchpad_smart"].includes(category);
  if (tab === "kol") return ["kol", "kolscan"].includes(category);
  if (tab === "sniper") return category === "snipe_bot";
  if (tab === "fresh") return category === "fresh_wallet";
  return true;
}

/* ------------------------------------------------------------------ */
/*  Group trades by wallet                                            */
/* ------------------------------------------------------------------ */

interface WalletGroup {
  walletAddress: string;
  info: WalletInfo | null;
  trades: Trade[];
  latestTrade: string; // ISO
  totalPnl: number;
  totalBuys: number;
  totalSells: number;
}

function groupByWallet(
  trades: Trade[],
  walletMap: Record<string, WalletInfo>,
): WalletGroup[] {
  const map = new Map<string, WalletGroup>();

  for (const t of trades) {
    let g = map.get(t.walletAddress);
    if (!g) {
      g = {
        walletAddress: t.walletAddress,
        info: walletMap[t.walletAddress] || null,
        trades: [],
        latestTrade: t.tradedAt,
        totalPnl: 0,
        totalBuys: 0,
        totalSells: 0,
      };
      map.set(t.walletAddress, g);
    }
    g.trades.push(t);
    if (t.realizedProfit) g.totalPnl += t.realizedProfit;
    if (t.type === "buy") g.totalBuys++;
    else g.totalSells++;
    if (new Date(t.tradedAt) > new Date(g.latestTrade)) {
      g.latestTrade = t.tradedAt;
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.latestTrade).getTime() - new Date(a.latestTrade).getTime(),
  );
}

/* ------------------------------------------------------------------ */
/*  Wallet Card                                                       */
/* ------------------------------------------------------------------ */

function WalletCard({ group }: { group: WalletGroup }) {
  const { walletAddress, info, trades, totalPnl } = group;
  const latest = trades[0];
  const name = info?.name || latest?.walletLabel || shortAddr(walletAddress);
  const category = info?.category || "unknown";
  const catClass = CATEGORY_COLORS[category] || "bg-zinc-700/30 text-zinc-400 border-zinc-600/30";
  const catLabel = CATEGORY_LABELS[category] || category;

  const walletHref =
    (info?.chain || latest?.chain) === "bsc"
      ? `/gmgn-wallet/${walletAddress}?chain=bsc`
      : `/wallet/${walletAddress}`;

  const tokenHref = (chain: string, addr: string) =>
    chain === "bsc"
      ? `https://gmgn.ai/bsc/token/${addr}`
      : `https://gmgn.ai/sol/token/${addr}`;

  const explorerUrl = (chain: string, txHash: string) =>
    chain === "bsc"
      ? `https://bscscan.com/tx/${txHash}`
      : `https://solscan.io/tx/${txHash}`;

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden hover:border-border-light transition-colors group">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-2.5 min-w-0">
          {info?.avatar ? (
            <img
              src={info.avatar}
              alt=""
              className="w-8 h-8 rounded-full flex-shrink-0 border border-border"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-bg-hover flex items-center justify-center text-xs text-zinc-500 flex-shrink-0 border border-border">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Link
                href={walletHref}
                className="text-sm font-medium text-white hover:text-accent transition-colors truncate"
              >
                {name}
              </Link>
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase border flex-shrink-0 ${catClass}`}
              >
                {catLabel}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-600">
              <span>{timeAgo(group.latestTrade)} ago</span>
              {info?.twitter && (
                <a
                  href={`https://x.com/${info.twitter.replace(/.*x\.com\/|.*twitter\.com\//, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-accent transition-colors"
                >
                  @{info.twitter.replace(/.*x\.com\/|.*twitter\.com\//, "").replace(/\/$/, "")}
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className={`text-sm font-semibold tabular-nums ${pnlColor(totalPnl)}`}>
            {formatPnl(totalPnl)}
          </div>
          <div className="text-[10px] text-zinc-600">
            {group.totalBuys}B / {group.totalSells}S
          </div>
        </div>
      </div>

      {/* Trades list */}
      <div className="divide-y divide-border/30">
        {trades.slice(0, 5).map((t) => (
          <div
            key={t.id}
            className="px-4 py-2.5 flex items-center justify-between hover:bg-bg-hover/40 transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  t.type === "buy" ? "bg-buy" : "bg-sell"
                }`}
              />
              {t.tokenLogo && (
                <img src={t.tokenLogo} alt="" className="w-5 h-5 rounded-full flex-shrink-0" />
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <a
                    href={tokenHref(t.chain, t.tokenAddress)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-white hover:text-accent transition-colors truncate"
                  >
                    {t.tokenSymbol || shortAddr(t.tokenAddress)}
                  </a>
                  {t.tokenLaunchpad && (
                    <span className="text-[9px] text-zinc-600">{t.tokenLaunchpad}</span>
                  )}
                </div>
                <span className="text-[10px] text-zinc-600">{timeAgo(t.tradedAt)}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="text-right">
                <div className="text-xs tabular-nums text-zinc-300">{formatUsd(t.amountUsd)}</div>
                {t.realizedProfit != null && t.realizedProfit !== 0 && (
                  <div className={`text-[10px] tabular-nums font-medium ${pnlColor(t.realizedProfit)}`}>
                    {formatPnl(t.realizedProfit)}
                  </div>
                )}
              </div>
              <span
                className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                  t.type === "buy"
                    ? "bg-buy/10 text-buy"
                    : "bg-sell/10 text-sell"
                }`}
              >
                {t.type}
              </span>
              {t.txHash && (
                <a
                  href={explorerUrl(t.chain, t.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-zinc-600 hover:text-accent transition-colors"
                >
                  ↗
                </a>
              )}
            </div>
          </div>
        ))}
        {trades.length > 5 && (
          <div className="px-4 py-2 text-center">
            <span className="text-[10px] text-zinc-600">
              +{trades.length - 5} more trades
            </span>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="px-4 py-2.5 border-t border-border/30 flex items-center justify-between bg-bg-card/50">
        <div className="flex items-center gap-3 text-[10px] text-zinc-600">
          <span className="flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-zinc-600" />
            {latest?.chain?.toUpperCase()}
          </span>
          {info && (
            <span>
              WR {((info.winrate_7d || 0) * 100).toFixed(0)}%
            </span>
          )}
        </div>
        <Link
          href={walletHref}
          className="text-[10px] text-zinc-500 hover:text-accent transition-colors font-medium"
        >
          View Wallet →
        </Link>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sidebar wallet list (left panel)                                  */
/* ------------------------------------------------------------------ */

function WalletSidebar({
  groups,
  walletMap,
}: {
  groups: WalletGroup[];
  walletMap: Record<string, WalletInfo>;
}) {
  // Show top wallets from the current feed sorted by activity
  const activeWallets = groups.slice(0, 30);

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Active Wallets
        </h3>
        <span className="text-[10px] text-zinc-600 tabular-nums">
          {activeWallets.length} wallets
        </span>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {activeWallets.map((g) => {
          const info = g.info;
          const name = info?.name || g.trades[0]?.walletLabel || shortAddr(g.walletAddress);
          const walletHref =
            (info?.chain || g.trades[0]?.chain) === "bsc"
              ? `/gmgn-wallet/${g.walletAddress}?chain=bsc`
              : `/wallet/${g.walletAddress}`;

          return (
            <Link
              key={g.walletAddress}
              href={walletHref}
              className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-bg-hover transition-colors border-b border-border/30"
            >
              {info?.avatar ? (
                <img src={info.avatar} alt="" className="w-6 h-6 rounded-full flex-shrink-0" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-bg-hover flex items-center justify-center text-[10px] text-zinc-600 flex-shrink-0">
                  {name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white truncate">{name}</div>
                <div className="text-[10px] text-zinc-600 flex items-center gap-1.5">
                  <span>{timeAgo(g.latestTrade)}</span>
                  <span>·</span>
                  <span>{g.trades.length} txs</span>
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <div className={`text-[11px] font-medium tabular-nums ${pnlColor(g.totalPnl)}`}>
                  {formatPnl(g.totalPnl)}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Monitor Component                                            */
/* ------------------------------------------------------------------ */

export default function MonitorClient({ walletMap }: Props) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabFilter>("all");
  const [chain, setChain] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const fetchTrades = useCallback(async () => {
    const params = new URLSearchParams();
    if (chain) params.set("chain", chain);
    params.set("limit", "200");

    const res = await fetch(`/api/trades?${params}`);
    const data = await res.json();
    setTrades(data.trades);
    setLoading(false);
  }, [chain]);

  // Initial load + filter changes
  useEffect(() => {
    setLoading(true);
    fetchTrades();
  }, [fetchTrades]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchTrades, 10_000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchTrades]);

  // Group & filter
  const groups = useMemo(() => {
    const all = groupByWallet(trades, walletMap);
    if (tab === "all") return all;
    return all.filter((g) => {
      const cat = g.info?.category || "unknown";
      return matchesTab(cat, tab);
    });
  }, [trades, walletMap, tab]);

  return (
    <div className="flex h-full animate-fade-in">
      {/* Left sidebar */}
      {sidebarOpen && (
        <div className="hidden lg:flex flex-col w-72 border-r border-border bg-bg-secondary flex-shrink-0">
          <WalletSidebar groups={groups} walletMap={walletMap} />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-border bg-bg-secondary/50 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            {/* Sidebar toggle */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg bg-bg-card border border-border text-zinc-500 hover:text-white transition-colors"
              title="Toggle sidebar"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Category tabs */}
            <div className="flex items-center bg-bg-card rounded-lg border border-border p-0.5">
              {TABS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTab(t.value)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    tab === t.value
                      ? "bg-white text-black shadow-sm"
                      : "text-zinc-500 hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="w-px h-6 bg-border mx-1" />

            {/* Chain filter */}
            {[
              { label: "All", value: null },
              { label: "SOL", value: "sol" },
              { label: "BSC", value: "bsc" },
            ].map((opt) => (
              <button
                key={opt.label}
                onClick={() => setChain(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  chain === opt.value
                    ? "bg-white text-black"
                    : "bg-bg-card border border-border text-zinc-500 hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Live indicator */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                autoRefresh
                  ? "bg-buy/10 border border-buy/30 text-buy"
                  : "bg-bg-card border border-border text-zinc-600"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  autoRefresh ? "bg-buy animate-pulse" : "bg-zinc-600"
                }`}
              />
              {autoRefresh ? "Live" : "Paused"}
            </button>

            {/* Stats */}
            <div className="hidden sm:flex items-center gap-3 text-[11px] text-zinc-600 bg-bg-card border border-border rounded-lg px-3 py-1.5">
              <span>
                <span className="text-zinc-400 font-medium">{groups.length}</span> wallets
              </span>
              <span className="w-px h-3 bg-border" />
              <span>
                <span className="text-zinc-400 font-medium">{trades.length}</span> trades
              </span>
            </div>
          </div>
        </div>

        {/* Card grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-4xl mb-4">📡</div>
              <h3 className="text-lg font-semibold text-white mb-2">No activity yet</h3>
              <p className="text-sm text-zinc-600 max-w-md mx-auto">
                Trades will appear here once the ingestion pipeline is running.
                Switch tabs or adjust filters to see different wallet categories.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {groups.map((g) => (
                <WalletCard key={g.walletAddress} group={g} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
