"use client";

import React, { Suspense, useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import type {
  EnrichedSolanaWallet,
  SortDir,
  Timeframe,
  WalletExpandData,
} from "@/lib/types";
import ExportButton from "./ExportButton";
import ShareButtons from "./ShareButtons";
import CopyButton from "./CopyButton";
import { AvatarFallback } from "./FallbackImg";
import { truncateAddr, formatProfit, formatUsd, timeAgo } from "@/lib/format";

// ─── Category display helpers ───────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  smart_degen: "Smart Degen",
  kol: "KOL",
  sniper: "Sniper",
  fresh_wallet: "Fresh",
  top_dev: "Top Dev",
  pump_smart: "Pump Smart",
  launchpad_smart: "Launchpad",
  snipe_bot: "Sniper",
  live: "Live",
  top_followed: "Top Followed",
  top_renamed: "Top Renamed",
  prediction_trader: "Prediction",
};

const CATEGORY_COLORS: Record<string, string> = {
  smart_degen: "bg-accent/10 text-accent border-accent/20",
  kol: "bg-buy/10 text-buy border-buy/20",
  sniper: "bg-sell/10 text-sell border-sell/20",
  fresh_wallet: "bg-zinc-800 text-zinc-400 border-zinc-700",
  top_dev: "bg-purple-900/30 text-purple-400 border-purple-800/40",
  pump_smart: "bg-orange-900/30 text-orange-400 border-orange-800/40",
  launchpad_smart: "bg-accent/10 text-accent border-accent/20",
  snipe_bot: "bg-sell/10 text-sell border-sell/20",
  live: "bg-buy/10 text-buy border-buy/20",
  top_followed: "bg-accent/10 text-accent border-accent/20",
  top_renamed: "bg-zinc-800 text-zinc-500 border-zinc-700",
  prediction_trader: "bg-blue-900/30 text-blue-400 border-blue-800/40",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function SortIcon({ field, current, dir }: { field: string; current: string; dir: SortDir }) {
  if (field !== current) return <span className="text-zinc-700 ml-1 text-[10px]">↕</span>;
  return <span className="text-buy ml-1 text-[10px]">{dir === "desc" ? "↓" : "↑"}</span>;
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values.map(Math.abs), 1);
  return (
    <div className="flex items-end gap-px h-3 mt-1 w-full max-w-[56px]">
      {values.map((v, i) => (
        <div
          key={i}
          className={`flex-1 rounded-sm ${v >= 0 ? "bg-buy/50" : "bg-sell/50"}`}
          style={{ height: `${Math.max((Math.abs(v) / max) * 100, 12)}%` }}
          title={`${v >= 0 ? "+" : ""}${v.toFixed(2)}`}
        />
      ))}
    </div>
  );
}

// ─── Expand Panel ─────────────────────────────────────────────────────────────

function ExpandPanel({ address, colSpan, onClose }: { address: string; colSpan: number; onClose: () => void }) {
  const [data, setData] = useState<WalletExpandData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/wallets/solana?enrichAddress=${encodeURIComponent(address)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<WalletExpandData>;
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setError((e as Error).message);
        setLoading(false);
      });
  }, [address]);

  return (
    <tr>
      <td colSpan={colSpan} className="px-0 py-0">
        <div className="bg-zinc-950 border-y border-zinc-800 px-5 py-4 text-xs">
          {loading && (
            <div className="flex items-center gap-2 text-zinc-500 py-3">
              <div className="w-3 h-3 border border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
              Fetching live data from Helius & Birdeye…
            </div>
          )}

          {error && (
            <div className="text-sell py-2">
              Failed to load enriched data: {error}
            </div>
          )}

          {data && !loading && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* PnL Summary */}
              {data.pnl ? (
                <div>
                  <div className="text-zinc-500 font-mono uppercase tracking-wider text-[10px] mb-2">Helius PnL</div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Realized</span>
                      <span className={data.pnl.realized >= 0 ? "text-buy" : "text-sell"}>
                        {formatProfit(data.pnl.realized)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Unrealized</span>
                      <span className={data.pnl.unrealized >= 0 ? "text-buy" : "text-sell"}>
                        {formatProfit(data.pnl.unrealized)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-zinc-800 pt-1 mt-1">
                      <span className="text-zinc-400">Total</span>
                      <span className={data.pnl.totalValue >= 0 ? "text-buy font-semibold" : "text-sell font-semibold"}>
                        {formatProfit(data.pnl.totalValue)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-zinc-500 font-mono uppercase tracking-wider text-[10px] mb-2">Helius PnL</div>
                  <div className="text-zinc-600 italic">No Helius API key configured</div>
                </div>
              )}

              {/* Top Holdings */}
              <div>
                <div className="text-zinc-500 font-mono uppercase tracking-wider text-[10px] mb-2">
                  Holdings {data.portfolioValue ? `· ${formatUsd(data.portfolioValue)} total` : ""}
                </div>
                {data.holdings && data.holdings.length > 0 ? (
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                    {data.holdings
                      .filter((h) => h.valueUsd > 0)
                      .sort((a, b) => b.valueUsd - a.valueUsd)
                      .slice(0, 8)
                      .map((h) => (
                        <div key={h.address} className="flex justify-between items-center gap-2">
                          <span className="text-zinc-300 font-mono truncate max-w-[80px]">{h.symbol}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            {h.priceChange24h !== 0 && (
                              <span className={`text-[10px] ${h.priceChange24h >= 0 ? "text-buy/70" : "text-sell/70"}`}>
                                {h.priceChange24h >= 0 ? "+" : ""}{h.priceChange24h.toFixed(1)}%
                              </span>
                            )}
                            <span className="text-zinc-400">{formatUsd(h.valueUsd)}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-zinc-600 italic">
                    {process.env.NODE_ENV === "development" ? "No Birdeye API key" : "No holdings data"}
                  </div>
                )}
              </div>

              {/* Recent Transactions */}
              <div>
                <div className="text-zinc-500 font-mono uppercase tracking-wider text-[10px] mb-2">Recent Txs</div>
                {data.recentTxs && data.recentTxs.length > 0 ? (
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                    {data.recentTxs.slice(0, 6).map((tx) => (
                      <div key={tx.signature} className="flex items-center gap-2">
                        <span className={`text-[10px] px-1 py-0.5 rounded font-mono ${
                          tx.type === "SWAP" ? "bg-buy/10 text-buy" : "bg-zinc-800 text-zinc-500"
                        }`}>
                          {tx.type || "TX"}
                        </span>
                        <a
                          href={`https://solscan.io/tx/${tx.signature}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-zinc-500 hover:text-zinc-300 font-mono transition-colors"
                          title={tx.description}
                        >
                          {tx.signature.slice(0, 8)}…
                        </a>
                        <span className="text-zinc-700 ml-auto shrink-0">
                          {tx.timestamp ? timeAgo(new Date(tx.timestamp * 1000).toISOString()) : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-zinc-600 italic">No recent txs available</div>
                )}
              </div>
            </div>
          )}

          {data?.errors && data.errors.length > 0 && (
            <div className="mt-3 pt-3 border-t border-zinc-800 text-zinc-600 text-[10px]">
              Partial data: {data.errors.join("; ")}
            </div>
          )}

          <button
            onClick={onClose}
            className="mt-3 text-zinc-700 hover:text-zinc-400 text-[10px] font-mono transition-colors"
          >
            ▲ Collapse
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

function useFilterState() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const state = {
    timeframe: (Number(searchParams.get("tf")) as Timeframe) || 7,
    sort: searchParams.get("sort") || "profit_7d",
    dir: (searchParams.get("dir") as SortDir) || "desc",
    search: searchParams.get("q") || "",
    category: searchParams.get("cat") || "all",
    minWinrate: searchParams.get("wr") || "",
    activeWithin: searchParams.get("active") || "all",
    hasTwitter: searchParams.get("tw") || "any",
    smartTag: searchParams.get("tag") || "all",
    minPortfolio: searchParams.get("pv") || "",
  };

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value != null && value !== "" && value !== "all" && value !== "any") params.set(key, value);
    else params.delete(key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function clearFilters() {
    const params = new URLSearchParams(searchParams.toString());
    ["q", "cat", "wr", "active", "tw", "tag", "pv"].forEach((k) => params.delete(k));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function toggleSort(field: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (state.sort === field) {
      params.set("dir", state.dir === "desc" ? "asc" : "desc");
    } else {
      params.set("sort", field);
      params.set("dir", "desc");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return { state, setParam, clearFilters, toggleSort };
}

// ─── Main Table Inner ─────────────────────────────────────────────────────────

function EnrichedSolanaTableInner({
  data,
  title,
  subtitle,
}: {
  data: EnrichedSolanaWallet[];
  title: string;
  subtitle?: string;
}) {
  const { state, setParam, clearFilters, toggleSort } = useFilterState();
  const [expandedAddress, setExpandedAddress] = useState<string | null>(null);

  const {
    timeframe,
    sort: sortField,
    dir: sortDir,
    search,
    category: categoryFilter,
    minWinrate,
    activeWithin,
    hasTwitter,
    smartTag,
    minPortfolio,
  } = state;

  const profitField =
    timeframe === 1 ? "profit_1d" : timeframe === 7 ? "profit_7d" : "profit_30d";
  const buysField =
    timeframe === 1 ? "buys_1d" : timeframe === 7 ? "buys_7d" : "buys_30d";
  const sellsField =
    timeframe === 1 ? "sells_1d" : timeframe === 7 ? "sells_7d" : "sells_30d";
  const tfLabel = timeframe === 1 ? "1D" : timeframe === 7 ? "7D" : "30D";

  // Computed options
  const categories = useMemo(
    () => ["all", ...Array.from(new Set(data.map((w) => w.category))).sort()],
    [data]
  );
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const w of data) counts[w.category] = (counts[w.category] || 0) + 1;
    return counts;
  }, [data]);
  const allSmartTags = useMemo(() => {
    const tags = new Set<string>();
    for (const w of data) {
      (w.smart_money_tags || []).forEach((t) => tags.add(t));
    }
    return Array.from(tags).sort();
  }, [data]);

  const hasEnrichedData = useMemo(
    () => data.some((w) => w.portfolio_value_usd != null || w.realized_pnl != null),
    [data]
  );

  // Filter
  const filtered = useMemo(() => {
    let entries = [...data];

    if (categoryFilter !== "all") {
      entries = entries.filter((w) => w.category === categoryFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      entries = entries.filter(
        (w) =>
          w.name.toLowerCase().includes(q) ||
          (w.sns_id || "").toLowerCase().includes(q) ||
          w.wallet_address.toLowerCase().includes(q) ||
          w.tags.some((t) => t.toLowerCase().includes(q)) ||
          (w.smart_money_tags || []).some((t) => t.toLowerCase().includes(q))
      );
    }
    if (minWinrate) {
      const wr = parseFloat(minWinrate) / 100;
      entries = entries.filter((w) => {
        const v = timeframe === 1 ? w.winrate_1d : timeframe === 30 ? w.winrate_30d : w.winrate_7d;
        return v >= wr;
      });
    }
    if (activeWithin && activeWithin !== "all") {
      const now = Date.now();
      const cutoffs: Record<string, number> = {
        "24h": now - 24 * 60 * 60 * 1000,
        "7d": now - 7 * 24 * 60 * 60 * 1000,
        "30d": now - 30 * 24 * 60 * 60 * 1000,
      };
      const cutoff = cutoffs[activeWithin];
      if (cutoff) {
        entries = entries.filter((w) => {
          // last_trade_at is unix seconds
          const ts = (w.last_trade_at ?? 0) * 1000;
          return ts >= cutoff;
        });
      }
    }
    if (hasTwitter === "true") {
      entries = entries.filter((w) => !!w.twitter);
    } else if (hasTwitter === "false") {
      entries = entries.filter((w) => !w.twitter);
    }
    if (smartTag && smartTag !== "all") {
      entries = entries.filter(
        (w) => (w.smart_money_tags || []).includes(smartTag) || w.tags.includes(smartTag)
      );
    }
    if (minPortfolio) {
      const pv = parseFloat(minPortfolio);
      if (!isNaN(pv)) {
        entries = entries.filter((w) => (w.portfolio_value_usd ?? 0) >= pv);
      }
    }

    // Sort
    entries.sort((a, b) => {
      if (sortField === "name") {
        return sortDir === "asc"
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }
      if (sortField === "portfolio_value") {
        const av = a.portfolio_value_usd ?? -Infinity;
        const bv = b.portfolio_value_usd ?? -Infinity;
        return sortDir === "asc" ? av - bv : bv - av;
      }
      if (sortField === "realized_pnl") {
        const av = a.realized_pnl ?? -Infinity;
        const bv = b.realized_pnl ?? -Infinity;
        return sortDir === "asc" ? av - bv : bv - av;
      }
      if (sortField === "last_trade_at") {
        const av = a.last_trade_at ?? 0;
        const bv = b.last_trade_at ?? 0;
        return sortDir === "asc" ? av - bv : bv - av;
      }
      if (sortField === "winrate_7d" || sortField === "winrate_30d") {
        const key =
          timeframe === 30 ? "winrate_30d" : timeframe === 1 ? "winrate_1d" : "winrate_7d";
        const av = (a as unknown as Record<string, number>)[key] ?? 0;
        const bv = (b as unknown as Record<string, number>)[key] ?? 0;
        return sortDir === "asc" ? av - bv : bv - av;
      }
      let aKey = sortField;
      if (sortField.startsWith("profit_")) aKey = profitField;
      if (sortField.startsWith("buys_")) aKey = buysField;
      if (sortField.startsWith("sells_")) aKey = sellsField;
      const av = (a as unknown as Record<string, number>)[aKey] ?? 0;
      const bv = (b as unknown as Record<string, number>)[aKey] ?? 0;
      return sortDir === "asc" ? av - bv : bv - av;
    });

    return entries;
  }, [
    data,
    sortField,
    sortDir,
    search,
    categoryFilter,
    timeframe,
    profitField,
    buysField,
    sellsField,
    minWinrate,
    activeWithin,
    hasTwitter,
    smartTag,
    minPortfolio,
  ]);

  const isFiltered =
    search !== "" ||
    categoryFilter !== "all" ||
    minWinrate !== "" ||
    activeWithin !== "all" ||
    hasTwitter !== "any" ||
    smartTag !== "all" ||
    minPortfolio !== "";

  const thClass =
    "px-3 py-2 text-left font-mono text-zinc-600 cursor-pointer hover:text-zinc-300 select-none whitespace-nowrap text-[10px] uppercase tracking-wider transition-colors";

  const timeframes: { label: string; value: Timeframe }[] = [
    { label: "1D", value: 1 },
    { label: "7D", value: 7 },
    { label: "30D", value: 30 },
  ];

  function toggleRow(address: string) {
    setExpandedAddress((prev) => (prev === address ? null : address));
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{title}</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {subtitle || `${data.length.toLocaleString()} wallets`}
            {isFiltered && filtered.length !== data.length && (
              <span className="ml-2 text-zinc-600">
                ·{" "}
                <span className="text-white">{filtered.length.toLocaleString()}</span> shown
              </span>
            )}
          </p>
          {hasEnrichedData && (
            <p className="text-zinc-600 text-[11px] mt-0.5 font-mono">
              enriched via Helius · Birdeye · Dune
            </p>
          )}
        </div>

        {/* Top controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-bg-card border border-border rounded p-0.5">
            {timeframes.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setParam("tf", String(tf.value))}
                className={`px-3 py-1 rounded text-xs font-mono uppercase tracking-wider transition-all duration-150 ${
                  timeframe === tf.value
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-600 hover:text-white"
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              value={search}
              onChange={(e) => setParam("q", e.target.value)}
              placeholder="Search name, address, tag…"
              className="bg-bg-card border border-border rounded pl-8 pr-8 py-1 text-xs text-white font-mono placeholder:text-zinc-700 outline-none focus:border-zinc-600 w-full sm:w-52 transition-all"
            />
            {search && (
              <button
                onClick={() => setParam("q", null)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white text-sm leading-none"
              >
                ×
              </button>
            )}
          </div>
          <ExportButton
            wallets={filtered.map((w) => ({ wallet_address: w.wallet_address, name: w.name, chain: "sol" as const }))}
            filename="kolquest-all-solana"
          />
          <ShareButtons title={`KolQuest ${title}`} />
        </div>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap gap-2 mb-4">
        {/* Category */}
        {categories.length > 2 && (
          <select
            value={categoryFilter}
            onChange={(e) =>
              setParam("cat", e.target.value === "all" ? null : e.target.value)
            }
            className="bg-bg-card border border-border rounded px-2.5 py-1 text-xs text-zinc-400 font-mono outline-none focus:border-zinc-600 appearance-none cursor-pointer"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === "all"
                  ? `All Types (${data.length})`
                  : `${CATEGORY_LABELS[c] || c} (${categoryCounts[c] || 0})`}
              </option>
            ))}
          </select>
        )}

        {/* Activity recency */}
        <select
          value={activeWithin}
          onChange={(e) => setParam("active", e.target.value)}
          className="bg-bg-card border border-border rounded px-2.5 py-1 text-xs text-zinc-400 font-mono outline-none focus:border-zinc-600 appearance-none cursor-pointer"
        >
          <option value="all">Any activity</option>
          <option value="24h">Active 24h</option>
          <option value="7d">Active 7d</option>
          <option value="30d">Active 30d</option>
        </select>

        {/* Twitter filter */}
        <select
          value={hasTwitter}
          onChange={(e) => setParam("tw", e.target.value === "any" ? null : e.target.value)}
          className="bg-bg-card border border-border rounded px-2.5 py-1 text-xs text-zinc-400 font-mono outline-none focus:border-zinc-600 appearance-none cursor-pointer"
        >
          <option value="any">Any Twitter</option>
          <option value="true">Has Twitter</option>
          <option value="false">No Twitter</option>
        </select>

        {/* Smart money tag */}
        {allSmartTags.length > 0 && (
          <select
            value={smartTag}
            onChange={(e) =>
              setParam("tag", e.target.value === "all" ? null : e.target.value)
            }
            className="bg-bg-card border border-border rounded px-2.5 py-1 text-xs text-zinc-400 font-mono outline-none focus:border-zinc-600 appearance-none cursor-pointer"
          >
            <option value="all">All Tags</option>
            {allSmartTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}

        {/* Min win rate */}
        <div className="relative">
          <input
            type="number"
            min="0"
            max="100"
            value={minWinrate}
            onChange={(e) => setParam("wr", e.target.value)}
            placeholder="Min win%"
            className="bg-bg-card border border-border rounded px-2.5 py-1 text-xs text-zinc-400 font-mono outline-none focus:border-zinc-600 w-24 [appearance:textfield]"
          />
        </div>

        {/* Min portfolio value */}
        {hasEnrichedData && (
          <div className="relative">
            <input
              type="number"
              min="0"
              value={minPortfolio}
              onChange={(e) => setParam("pv", e.target.value)}
              placeholder="Min portfolio $"
              className="bg-bg-card border border-border rounded px-2.5 py-1 text-xs text-zinc-400 font-mono outline-none focus:border-zinc-600 w-32 [appearance:textfield]"
            />
          </div>
        )}

        {/* Clear */}
        {isFiltered && (
          <button
            onClick={clearFilters}
            className="text-zinc-700 hover:text-white text-xs font-mono transition-colors px-1 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-bg-card rounded border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left font-mono text-zinc-600 text-[10px] uppercase tracking-wider w-10">
                  #
                </th>
                <th className={thClass} onClick={() => toggleSort("name")}>
                  Name <SortIcon field="name" current={sortField} dir={sortDir} />
                </th>
                <th className="px-3 py-2 text-left font-mono text-zinc-600 text-[10px] uppercase tracking-wider">
                  Type
                </th>
                <th className="px-3 py-2 text-left font-mono text-zinc-600 text-[10px] uppercase tracking-wider">
                  Wallet
                </th>
                {hasEnrichedData && (
                  <th className={thClass} onClick={() => toggleSort("portfolio_value")}>
                    Portfolio <SortIcon field="portfolio_value" current={sortField} dir={sortDir} />
                  </th>
                )}
                <th className={thClass} onClick={() => toggleSort("profit_7d")}>
                  {tfLabel} PnL <SortIcon field="profit_7d" current={sortField} dir={sortDir} />
                </th>
                {hasEnrichedData && (
                  <th className={thClass} onClick={() => toggleSort("realized_pnl")}>
                    Realized <SortIcon field="realized_pnl" current={sortField} dir={sortDir} />
                  </th>
                )}
                <th className={thClass} onClick={() => toggleSort("buys_7d")}>
                  Buys <SortIcon field="buys_7d" current={sortField} dir={sortDir} />
                </th>
                <th className={thClass} onClick={() => toggleSort("sells_7d")}>
                  Sells <SortIcon field="sells_7d" current={sortField} dir={sortDir} />
                </th>
                <th className={thClass} onClick={() => toggleSort("winrate_7d")}>
                  Win%{" "}
                  <span className="text-zinc-700 font-normal normal-case">{tfLabel}</span>{" "}
                  <SortIcon field="winrate_7d" current={sortField} dir={sortDir} />
                </th>
                {hasEnrichedData && (
                  <th className={thClass} onClick={() => toggleSort("last_trade_at")}>
                    Last Trade <SortIcon field="last_trade_at" current={sortField} dir={sortDir} />
                  </th>
                )}
                <th className="px-3 py-2 text-left font-mono text-zinc-600 text-[10px] uppercase tracking-wider">
                  Links
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((w, i) => {
                const profit = (w as unknown as Record<string, number>)[profitField] || 0;
                const buys = (w as unknown as Record<string, number>)[buysField] || 0;
                const sells = (w as unknown as Record<string, number>)[sellsField] || 0;
                const wr =
                  timeframe === 1
                    ? w.winrate_1d
                    : timeframe === 30
                    ? w.winrate_30d
                    : w.winrate_7d;
                const catColor =
                  CATEGORY_COLORS[w.category] ||
                  "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
                const extraNames = [w.sns_id, w.ens_name].filter(
                  (n): n is string => !!n && n !== w.name
                );
                const isExpanded = expandedAddress === w.wallet_address;

                return (
                  <React.Fragment key={w.wallet_address}>
                    <tr
                      onClick={() => toggleRow(w.wallet_address)}
                      className={`border-b border-zinc-900 last:border-b-0 transition-colors group cursor-pointer ${
                        isExpanded
                          ? "bg-zinc-900/50"
                          : "hover:bg-bg-hover/30"
                      }`}
                    >
                      <td className="px-3 py-2.5 text-zinc-700 text-[11px] font-mono tabular-nums">
                        {i + 1}
                      </td>

                      {/* Name */}
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <AvatarFallback
                            src={w.avatar}
                            seed={w.wallet_address}
                            label={w.name}
                            size="w-5 h-5"
                            textSize="text-[9px]"
                          />
                          <div className="min-w-0">
                            <Link
                              href={`/wallet/${w.wallet_address}`}
                              className="text-white text-sm font-medium hover:text-buy transition-colors"
                            >
                              {w.name}
                            </Link>
                            {extraNames.length > 0 && (
                              <div className="text-[10px] text-zinc-500 font-mono truncate">
                                {extraNames.join(" · ")}
                              </div>
                            )}
                            {(w.smart_money_tags || []).length > 0 && (
                              <div className="flex gap-1 mt-0.5 flex-wrap">
                                {(w.smart_money_tags || []).slice(0, 2).map((tag) => (
                                  <span
                                    key={tag}
                                    className="text-[9px] px-1 py-px rounded bg-yellow-900/30 text-yellow-500/80 border border-yellow-800/30 font-mono"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-3 py-2.5">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded border ${catColor}`}
                        >
                          {CATEGORY_LABELS[w.category] || w.category}
                        </span>
                      </td>

                      {/* Wallet */}
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <a
                            href={`https://solscan.io/account/${w.wallet_address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-xs text-zinc-500 hover:text-buy transition-colors"
                            title={w.wallet_address}
                          >
                            {truncateAddr(w.wallet_address)}
                          </a>
                          <CopyButton
                            text={w.wallet_address}
                            className="text-zinc-700 hover:text-white transition-colors text-xs leading-none opacity-0 group-hover:opacity-100"
                          />
                        </div>
                      </td>

                      {/* Portfolio value */}
                      {hasEnrichedData && (
                        <td className="px-3 py-2.5">
                          <span className="text-xs font-mono tabular-nums text-zinc-300">
                            {w.portfolio_value_usd != null
                              ? formatUsd(w.portfolio_value_usd)
                              : "—"}
                          </span>
                        </td>
                      )}

                      {/* GMGN PnL + sparkline */}
                      <td className="px-3 py-2.5">
                        <div
                          className={`text-xs font-semibold tabular-nums font-mono ${
                            profit > 0
                              ? "text-buy"
                              : profit < 0
                              ? "text-sell"
                              : "text-zinc-600"
                          }`}
                        >
                          {formatProfit(profit)}
                        </div>
                        {w.sparkline && w.sparkline.length > 0 && (
                          <Sparkline values={w.sparkline} />
                        )}
                      </td>

                      {/* Realized PnL from Helius */}
                      {hasEnrichedData && (
                        <td className="px-3 py-2.5">
                          {w.realized_pnl != null ? (
                            <span
                              className={`text-xs font-mono tabular-nums ${
                                w.realized_pnl > 0
                                  ? "text-buy"
                                  : w.realized_pnl < 0
                                  ? "text-sell"
                                  : "text-zinc-600"
                              }`}
                            >
                              {formatProfit(w.realized_pnl)}
                            </span>
                          ) : (
                            <span className="text-zinc-700 text-xs">—</span>
                          )}
                        </td>
                      )}

                      <td className="px-3 py-2.5 text-xs text-buy tabular-nums">
                        {buys || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-sell tabular-nums">
                        {sells || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-xs tabular-nums">
                        <span
                          className={
                            wr >= 0.5
                              ? "text-buy"
                              : wr > 0
                              ? "text-sell"
                              : "text-zinc-600"
                          }
                        >
                          {wr > 0 ? `${(wr * 100).toFixed(1)}%` : "—"}
                        </span>
                      </td>

                      {/* Last trade */}
                      {hasEnrichedData && (
                        <td className="px-3 py-2.5">
                          <span className="text-zinc-500 text-xs font-mono">
                            {w.last_trade_at
                              ? timeAgo(
                                  new Date(w.last_trade_at * 1000).toISOString()
                                )
                              : "—"}
                          </span>
                        </td>
                      )}

                      {/* Links */}
                      <td className="px-3 py-2.5 text-xs" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {w.twitter && (
                            <a
                              href={w.twitter}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-zinc-400 hover:text-white transition-colors"
                              title="Twitter/X"
                            >
                              𝕏
                            </a>
                          )}
                          <a
                            href={`https://gmgn.ai/sol/address/${w.wallet_address}?ref=nichxbt`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-zinc-600 hover:text-white transition-colors font-mono"
                            title="GMGN"
                          >
                            G
                          </a>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded row */}
                    {isExpanded && (
                      <ExpandPanel
                        address={w.wallet_address}
                        colSpan={hasEnrichedData ? 12 : 9}
                        onClose={() => setExpandedAddress(null)}
                      />
                    )}
                  </React.Fragment>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={hasEnrichedData ? 12 : 9}
                    className="px-4 py-16 text-center"
                  >
                    <div className="text-zinc-600 text-sm mb-2">
                      No wallets match your filters
                    </div>
                    {isFiltered && (
                      <button
                        onClick={clearFilters}
                        className="text-zinc-700 hover:text-white text-xs transition-colors underline"
                      >
                        Clear filters
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {filtered.length > 0 && (
          <div className="border-t border-border px-4 py-2 flex items-center justify-between">
            <span className="text-[11px] text-zinc-600 font-mono">
              {isFiltered
                ? `${filtered.length.toLocaleString()} of ${data.length.toLocaleString()} wallets`
                : `${data.length.toLocaleString()} wallets total`}
            </span>
            <span className="text-[11px] text-zinc-700 font-mono">
              KolQuest · SOL · click row to expand
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function EnrichedSolanaTable({
  data,
  title = "All Solana Wallets",
  subtitle,
}: {
  data: EnrichedSolanaWallet[];
  title?: string;
  subtitle?: string;
}) {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="h-16 w-64 bg-zinc-900 rounded animate-pulse mb-6" />
          <div className="h-96 bg-bg-card rounded border border-border animate-pulse" />
        </div>
      }
    >
      <EnrichedSolanaTableInner data={data} title={title} subtitle={subtitle} />
    </Suspense>
  );
}
