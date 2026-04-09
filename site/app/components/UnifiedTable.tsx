"use client";

import { Suspense, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import type { UnifiedWallet, GmgnSortField, SortDir, Timeframe } from "@/lib/types";
import ExportButton from "./ExportButton";
import CopyButton from "./CopyButton";

function truncate(addr: string) {
  if (addr.startsWith("0x")) return addr.slice(0, 6) + "..." + addr.slice(-4);
  return addr.slice(0, 4) + "..." + addr.slice(-4);
}

function formatProfit(v: number) {
  if (Math.abs(v) >= 1_000_000) return `${v >= 0 ? "+" : ""}${(v / 1_000_000).toFixed(1)}M`;
  const abs = Math.abs(v);
  const str = abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : abs.toFixed(2);
  return `${v >= 0 ? "+" : "-"}${str}`;
}

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
  smart_degen: "bg-accent/10 text-accent border-accent/20",
  kol: "bg-buy/10 text-buy border-buy/20",
  launchpad_smart: "bg-accent/10 text-accent border-accent/20",
  fresh_wallet: "bg-zinc-800 text-zinc-500 border-zinc-700",
  snipe_bot: "bg-sell/10 text-sell border-sell/20",
  live: "bg-buy/10 text-buy border-buy/20",
  top_followed: "bg-accent/10 text-accent border-accent/20",
  top_renamed: "bg-zinc-800 text-zinc-500 border-zinc-700",
};

function UnifiedTableInner({
  data,
  title,
  subtitle,
  showSource,
  showCategory,
  defaultSort,
  chain,
}: {
  data: UnifiedWallet[];
  title: string;
  subtitle?: string;
  showSource: boolean;
  showCategory: boolean;
  defaultSort: GmgnSortField;
  chain?: "sol" | "bsc";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const timeframe = (Number(searchParams.get("tf")) as Timeframe) || 7;
  const sortField = searchParams.get("sort") || defaultSort;
  const sortDir = (searchParams.get("dir") as SortDir) || "desc";
  const search = searchParams.get("q") || "";
  const categoryFilter = searchParams.get("cat") || "all";

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value != null && value !== "") params.set(key, value);
    else params.delete(key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function clearFilters() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    params.delete("cat");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function toggleSort(field: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (sortField === field) {
      params.set("dir", sortDir === "desc" ? "asc" : "desc");
    } else {
      params.set("sort", field);
      params.set("dir", "desc");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const profitField = timeframe === 1 ? "profit_1d" : timeframe === 7 ? "profit_7d" : "profit_30d";
  const buysField = timeframe === 1 ? "buys_1d" : timeframe === 7 ? "buys_7d" : "buys_30d";
  const sellsField = timeframe === 1 ? "sells_1d" : timeframe === 7 ? "sells_7d" : "sells_30d";
  const tfLabel = timeframe === 1 ? "1D" : timeframe === 7 ? "7D" : "30D";

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const w of data) counts[w.category] = (counts[w.category] || 0) + 1;
    return counts;
  }, [data]);

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(data.map((w) => w.category))).sort()],
    [data]
  );

  const filtered = useMemo(() => {
    let entries = [...data];
    if (categoryFilter !== "all") entries = entries.filter((w) => w.category === categoryFilter);
    if (search) {
      const q = search.toLowerCase();
      entries = entries.filter(
        (w) =>
          w.name.toLowerCase().includes(q) ||
          w.wallet_address.toLowerCase().includes(q) ||
          w.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return entries.sort((a, b) => {
      if (sortField === "name") {
        return sortDir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      }
      if (sortField === "winrate_7d" || sortField === "winrate_30d") {
        const key = timeframe === 30 ? "winrate_30d" : timeframe === 1 ? "winrate_1d" : "winrate_7d";
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
  }, [data, sortField, sortDir, search, categoryFilter, timeframe, profitField, buysField, sellsField]);

  const isFiltered = search.trim() !== "" || categoryFilter !== "all";

  const timeframes: { label: string; value: Timeframe }[] = [
    { label: "1D", value: 1 },
    { label: "7D", value: 7 },
    { label: "30D", value: 30 },
  ];

  const thClass =
    "px-3 py-2 text-left font-mono text-zinc-600 cursor-pointer hover:text-zinc-300 select-none whitespace-nowrap text-[10px] uppercase tracking-wider transition-colors";
  const explorer =
    chain === "bsc" ? "https://bscscan.com/address" : "https://solscan.io/account";

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{title}</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {subtitle || `${data.length.toLocaleString()} wallets`}
            {isFiltered && filtered.length !== data.length && (
              <span className="ml-2 text-zinc-600">
                · <span className="text-white">{filtered.length.toLocaleString()}</span> shown
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {showCategory && categories.length > 2 && (
            <select
              value={categoryFilter}
              onChange={(e) => setParam("cat", e.target.value === "all" ? null : e.target.value)}
              className="bg-bg-card border border-border rounded px-2.5 py-1 text-xs text-zinc-400 font-mono outline-none focus:border-zinc-600 appearance-none cursor-pointer"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === "all"
                    ? `All (${data.length})`
                    : `${CATEGORY_LABELS[c] || c} (${categoryCounts[c] || 0})`}
                </option>
              ))}
            </select>
          )}
          <div className="flex bg-bg-card border border-border rounded p-0.5">
            {timeframes.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setParam("tf", String(tf.value))}
                className={`px-3 py-1 rounded text-xs font-mono uppercase tracking-wider transition-all duration-150 ${
                  timeframe === tf.value ? "bg-zinc-800 text-white" : "text-zinc-600 hover:text-white"
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              value={search}
              onChange={(e) => setParam("q", e.target.value)}
              placeholder="Search name, address..."
              className="bg-bg-card border border-border rounded pl-8 pr-8 py-1 text-xs text-white font-mono placeholder:text-zinc-700 outline-none focus:border-zinc-600 w-full sm:w-48 transition-all"
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
          <ExportButton wallets={filtered} filename={`kolquest-${chain || "sol"}-wallets`} />
        </div>
      </div>

      <div className="bg-bg-card rounded border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left font-mono text-zinc-600 text-[10px] uppercase tracking-wider w-10">#</th>
                <th className={thClass} onClick={() => toggleSort("name")}>
                  Name <SortIcon field="name" current={sortField} dir={sortDir} />
                </th>
                {showSource && (
                  <th className="px-3 py-2 text-left font-mono text-zinc-600 text-[10px] uppercase tracking-wider">Source</th>
                )}
                {showCategory && (
                  <th className="px-3 py-2 text-left font-mono text-zinc-600 text-[10px] uppercase tracking-wider">Type</th>
                )}
                <th className="px-3 py-2 text-left font-mono text-zinc-600 text-[10px] uppercase tracking-wider">Wallet</th>
                <th className={thClass} onClick={() => toggleSort("profit_7d")}>
                  {tfLabel} Profit <SortIcon field="profit_7d" current={sortField} dir={sortDir} />
                </th>
                <th className={thClass} onClick={() => toggleSort("buys_7d")}>
                  Buys <SortIcon field="buys_7d" current={sortField} dir={sortDir} />
                </th>
                <th className={thClass} onClick={() => toggleSort("sells_7d")}>
                  Sells <SortIcon field="sells_7d" current={sortField} dir={sortDir} />
                </th>
                <th className={thClass} onClick={() => toggleSort("winrate_7d")}>
                  Win% <span className="text-zinc-700 font-normal normal-case">{tfLabel}</span>{" "}
                  <SortIcon field="winrate_7d" current={sortField} dir={sortDir} />
                </th>
                <th className="px-3 py-2 text-left font-mono text-zinc-600 text-[10px] uppercase tracking-wider">Links</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((w, i) => {
                const profit = (w as unknown as Record<string, number>)[profitField] || 0;
                const buys = (w as unknown as Record<string, number>)[buysField] || 0;
                const sells = (w as unknown as Record<string, number>)[sellsField] || 0;
                const wr = timeframe === 1 ? w.winrate_1d : timeframe === 30 ? w.winrate_30d : w.winrate_7d;
                const catColor = CATEGORY_COLORS[w.category] || "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";

                return (
                  <tr
                    key={w.wallet_address}
                    className="border-b border-zinc-900 last:border-b-0 hover:bg-bg-hover/30 transition-colors group"
                  >
                    <td className="px-3 py-2.5 text-zinc-700 text-[11px] font-mono tabular-nums">{i + 1}</td>

                    {/* Name + avatar */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {w.avatar ? (
                          <img src={w.avatar} alt="" className="w-5 h-5 rounded-full flex-shrink-0" loading="lazy" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[9px] font-bold text-zinc-500 flex-shrink-0 border border-zinc-700">
                            {w.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <Link
                          href={
                            w.source === "kolscan"
                              ? `/wallet/${w.wallet_address}`
                              : `/gmgn-wallet/${w.wallet_address}?chain=${w.chain}`
                          }
                          className="text-white text-sm font-medium hover:text-buy transition-colors"
                        >
                          {w.name}
                        </Link>
                      </div>
                    </td>

                    {showSource && (
                      <td className="px-3 py-2.5">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border bg-zinc-900 text-zinc-500 border-zinc-800">
                          {w.source === "kolscan" ? "KolScan" : "GMGN"}
                        </span>
                      </td>
                    )}
                    {showCategory && (
                      <td className="px-3 py-2.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${catColor}`}>
                          {CATEGORY_LABELS[w.category] || w.category}
                        </span>
                      </td>
                    )}

                    {/* Wallet + copy */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <a
                          href={`${explorer}/${w.wallet_address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-zinc-500 hover:text-buy transition-colors"
                          title={w.wallet_address}
                        >
                          {truncate(w.wallet_address)}
                        </a>
                        <CopyButton
                          text={w.wallet_address}
                          className="text-zinc-700 hover:text-white transition-colors text-xs leading-none opacity-0 group-hover:opacity-100"
                        />
                      </div>
                    </td>

                    {/* Profit + sparkline */}
                    <td className="px-3 py-2.5">
                      <div className={`text-xs font-semibold tabular-nums font-mono ${profit > 0 ? "text-buy" : profit < 0 ? "text-sell" : "text-zinc-600"}`}>
                        {formatProfit(profit)}
                      </div>
                      {w.sparkline && w.sparkline.length > 0 && (
                        <Sparkline values={w.sparkline} />
                      )}
                    </td>

                    <td className="px-3 py-2.5 text-xs text-buy tabular-nums">{buys || "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-sell tabular-nums">{sells || "—"}</td>
                    <td className="px-3 py-2.5 text-xs tabular-nums">
                      <span className={wr >= 0.5 ? "text-buy" : wr > 0 ? "text-sell" : "text-zinc-600"}>
                        {wr > 0 ? `${(wr * 100).toFixed(1)}%` : "—"}
                      </span>
                    </td>

                    <td className="px-3 py-2.5 text-xs">
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {w.twitter && (
                          <a href={w.twitter} target="_blank" rel="noopener noreferrer"
                            className="text-zinc-400 hover:text-white transition-colors" title="Twitter/X">𝕏</a>
                        )}
                        <a
                          href={`https://gmgn.ai/${w.chain === "bsc" ? "bsc" : "sol"}/address/${w.wallet_address}?ref=nichxbt`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-zinc-600 hover:text-white transition-colors font-mono" title="GMGN">G</a>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={showSource ? 10 : showCategory ? 9 : 8} className="px-4 py-16 text-center">
                    <div className="text-zinc-600 text-sm mb-2">No wallets match your filters</div>
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
              KolQuest · {chain?.toUpperCase() || "SOL"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

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
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="h-16 w-64 bg-zinc-900 rounded animate-pulse mb-6" />
          <div className="h-96 bg-bg-card rounded border border-border animate-pulse" />
        </div>
      }
    >
      <UnifiedTableInner
        data={data}
        title={title}
        subtitle={subtitle}
        showSource={showSource}
        showCategory={showCategory}
        defaultSort={defaultSort}
        chain={chain}
      />
    </Suspense>
  );
}
