"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { UnifiedWallet, GmgnSortField, SortDir, Timeframe } from "@/lib/types";
import ExportButton from "./ExportButton";

function truncate(addr: string) {
  if (addr.startsWith("0x")) return addr.slice(0, 6) + "..." + addr.slice(-4);
  return addr.slice(0, 4) + "..." + addr.slice(-4);
}

function formatProfit(v: number) {
  if (Math.abs(v) >= 1000) return `${v >= 0 ? "+" : ""}${(v / 1000).toFixed(1)}k`;
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;
}

function SortIcon({ field, current, dir }: { field: string; current: string; dir: SortDir }) {
  if (field !== current) return <span className="text-zinc-700 ml-1 text-[10px]">↕</span>;
  return <span className="text-buy ml-1 text-[10px]">{dir === "desc" ? "↓" : "↑"}</span>;
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
  top_dev: "Top Dev",
};

const CATEGORY_COLORS: Record<string, string> = {
  smart_degen: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  kol: "bg-buy/20 text-buy border-buy/30",
  launchpad_smart: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  fresh_wallet: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  snipe_bot: "bg-sell/20 text-sell border-sell/30",
  live: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  top_followed: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  top_renamed: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

export default function UnifiedTable({
  data,
  title = "Wallet Leaderboard",
  subtitle,
  showSource = false,
  showCategory = true,
  defaultSort = "profit_7d",
  chain,
}: {
  data: UnifiedWallet[];
  title?: string;
  subtitle?: string;
  showSource?: boolean;
  showCategory?: boolean;
  defaultSort?: GmgnSortField;
  chain?: "sol" | "bsc";
}) {
  const [timeframe, setTimeframe] = useState<Timeframe>(7);
  const [sortField, setSortField] = useState<string>(defaultSort);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const categories = useMemo(() => {
    const cats = new Set(data.map((w) => w.category));
    return ["all", ...Array.from(cats).sort()];
  }, [data]);

  const profitField = timeframe === 1 ? "profit_1d" : timeframe === 7 ? "profit_7d" : "profit_30d";
  const buysField = timeframe === 1 ? "buys_1d" : timeframe === 7 ? "buys_7d" : "buys_30d";
  const sellsField = timeframe === 1 ? "sells_1d" : timeframe === 7 ? "sells_7d" : "sells_30d";

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
          w.wallet_address.toLowerCase().includes(q) ||
          w.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    entries.sort((a, b) => {
      if (sortField === "name") {
        return sortDir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      }
      if (sortField === "winrate_7d" || sortField === "winrate_30d") {
        const key = timeframe === 30 ? "winrate_30d" : "winrate_7d";
        const av = a[key];
        const bv = b[key];
        return sortDir === "asc" ? av - bv : bv - av;
      }
      // Dynamic profit/buys/sells based on timeframe
      let aKey = sortField;
      let bKey = sortField;
      if (sortField.startsWith("profit_")) { aKey = profitField; bKey = profitField; }
      if (sortField.startsWith("buys_")) { aKey = buysField; bKey = buysField; }
      if (sortField.startsWith("sells_")) { aKey = sellsField; bKey = sellsField; }
      const av = (a as any)[aKey] ?? 0;
      const bv = (b as any)[bKey] ?? 0;
      return sortDir === "asc" ? av - bv : bv - av;
    });

    return entries;
  }, [data, sortField, sortDir, search, categoryFilter, timeframe, profitField, buysField, sellsField]);

  function toggleSort(field: string) {
    if (sortField === field) setSortDir(sortDir === "desc" ? "asc" : "desc");
    else { setSortField(field); setSortDir("desc"); }
  }

  const timeframes: { label: string; value: Timeframe }[] = [
    { label: "1D", value: 1 },
    { label: "7D", value: 7 },
    { label: "30D", value: 30 },
  ];

  const thClass = "px-3 py-3 text-left font-medium text-zinc-500 cursor-pointer hover:text-zinc-300 select-none whitespace-nowrap text-xs uppercase tracking-wider transition-colors";
  const explorer = chain === "bsc" ? "https://bscscan.com/address" : "https://solscan.io/account";

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{title}</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {subtitle || `${filtered.length} wallets`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Category filter */}
          {showCategory && categories.length > 2 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-bg-card border border-border rounded-xl px-3 py-1.5 text-sm text-zinc-300 outline-none focus:border-buy/40 appearance-none cursor-pointer"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === "all" ? "All Categories" : CATEGORY_LABELS[c] || c}
                </option>
              ))}
            </select>
          )}

          {/* Timeframe */}
          <div className="flex bg-bg-card border border-border rounded-xl p-0.5">
            {timeframes.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setTimeframe(tf.value)}
                className={`px-3 py-1.5 rounded-[10px] text-sm font-medium transition-all duration-200 ${
                  timeframe === tf.value
                    ? "bg-buy text-black shadow-glow"
                    : "text-zinc-500 hover:text-white"
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
            className="bg-bg-card border border-border rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-buy/40 focus:ring-1 focus:ring-buy/20 w-full sm:w-44 transition-all"
            />
          </div>

          {/* Export */}
          <ExportButton wallets={filtered} filename={`kolquest-${chain || "sol"}-wallets`} />
        </div>
      </div>

      {/* Table */}
      <div className="bg-bg-card rounded-2xl border border-border overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-3 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider w-12">#</th>
                <th className={thClass} onClick={() => toggleSort("name")}>
                  Name <SortIcon field="name" current={sortField} dir={sortDir} />
                </th>
                {showSource && (
                  <th className="px-3 py-3 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Source</th>
                )}
                {showCategory && (
                  <th className="px-3 py-3 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Type</th>
                )}
                <th className="px-3 py-3 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Wallet</th>
                <th className={thClass} onClick={() => toggleSort("profit_7d")}>
                  Profit <SortIcon field="profit_7d" current={sortField} dir={sortDir} />
                </th>
                <th className={thClass} onClick={() => toggleSort("buys_7d")}>
                  Buys <SortIcon field="buys_7d" current={sortField} dir={sortDir} />
                </th>
                <th className={thClass} onClick={() => toggleSort("sells_7d")}>
                  Sells <SortIcon field="sells_7d" current={sortField} dir={sortDir} />
                </th>
                <th className={thClass} onClick={() => toggleSort("winrate_7d")}>
                  Win% <SortIcon field="winrate_7d" current={sortField} dir={sortDir} />
                </th>
                <th className="px-3 py-3 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Links</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((w, i) => {
                const profit = (w as any)[profitField] || 0;
                const buys = (w as any)[buysField] || 0;
                const sells = (w as any)[sellsField] || 0;
                const wr = timeframe === 30 ? w.winrate_30d : w.winrate_7d;
                const catColor = CATEGORY_COLORS[w.category] || "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";

                return (
                  <tr
                    key={w.wallet_address}
                    className="border-b border-border/50 last:border-b-0 hover:bg-bg-hover/50 transition-colors group"
                  >
                    <td className="px-3 py-3 text-zinc-600 text-sm tabular-nums">{i + 1}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        {w.avatar && (
                          <img src={w.avatar} alt="" className="w-5 h-5 rounded-full" loading="lazy" />
                        )}
                        <Link
                          href={w.source === "kolscan" ? `/wallet/${w.wallet_address}` : `/gmgn-wallet/${w.wallet_address}?chain=${w.chain}`}
                          className="text-white text-sm font-medium hover:text-buy transition-colors"
                        >
                          {w.name}
                        </Link>
                      </div>
                    </td>
                    {showSource && (
                      <td className="px-3 py-3">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                          w.source === "kolscan"
                            ? "bg-accent/20 text-accent border-accent/30"
                            : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                        }`}>
                          {w.source === "kolscan" ? "KolScan" : "GMGN"}
                        </span>
                      </td>
                    )}
                    {showCategory && (
                      <td className="px-3 py-3">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${catColor}`}>
                          {CATEGORY_LABELS[w.category] || w.category}
                        </span>
                      </td>
                    )}
                    <td className="px-3 py-3">
                      <a
                        href={`${explorer}/${w.wallet_address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-zinc-500 hover:text-buy transition-colors"
                        title={w.wallet_address}
                      >
                        {truncate(w.wallet_address)}
                      </a>
                    </td>
                    <td className={`px-3 py-3 text-sm font-semibold tabular-nums ${
                      profit > 0 ? "text-buy" : profit < 0 ? "text-sell" : "text-zinc-600"
                    }`}>
                      {formatProfit(profit)}
                    </td>
                    <td className="px-3 py-3 text-sm text-buy tabular-nums">{buys}</td>
                    <td className="px-3 py-3 text-sm text-sell tabular-nums">{sells}</td>
                    <td className="px-3 py-3 text-sm tabular-nums">
                      <span className={wr >= 0.5 ? "text-buy" : wr > 0 ? "text-sell" : "text-zinc-600"}>
                        {wr > 0 ? `${(wr * 100).toFixed(1)}%` : "—"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm">
                      <div className="flex gap-2 opacity-40 group-hover:opacity-100 transition-opacity">
                        {w.twitter && (
                          <a href={w.twitter} target="_blank" rel="noopener noreferrer"
                            className="text-zinc-400 hover:text-white transition-colors text-xs" title="Twitter/X">𝕏</a>
                        )}
                        <a href={`https://gmgn.ai/${w.chain === "bsc" ? "bsc" : "sol"}/address/${w.wallet_address}?ref=nichxbt`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-zinc-400 hover:text-yellow-400 transition-colors text-xs" title="GMGN">G</a>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={showSource ? 10 : showCategory ? 9 : 8} className="px-4 py-16 text-center text-zinc-600 text-sm">
                    No wallets found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
