"use client";

import { useState, useMemo } from "react";
import type { PortfolioAsset, Chain, AssetCategory } from "@/lib/portfolio-aggregator";
import { formatUsd } from "@/lib/format";

const CHAIN_LABELS: Record<Chain, string> = {
  solana: "Solana",
  ethereum: "ETH",
  bsc: "BNB",
  polygon: "Polygon",
  arbitrum: "Arbitrum",
  base: "Base",
  optimism: "Optimism",
  avalanche: "AVAX",
};

const CATEGORY_LABELS: Record<AssetCategory, string> = {
  native: "Native",
  stablecoin: "Stable",
  defi: "DeFi",
  meme: "Meme",
  lp: "LP",
  staked: "Staked",
  other: "Other",
};

type SortField = "valueUsd" | "balance" | "priceUsd" | "change24h" | "portfolioPercent";
type SortDir = "asc" | "desc";

interface Props {
  holdings: PortfolioAsset[];
  loading?: boolean;
}

export default function HoldingsTable({ holdings, loading = false }: Props) {
  const [sort, setSort] = useState<SortField>("valueUsd");
  const [dir, setDir] = useState<SortDir>("desc");
  const [chainFilter, setChainFilter] = useState<Chain | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<AssetCategory | "all">("all");
  const [hideSmall, setHideSmall] = useState(false);
  const [search, setSearch] = useState("");

  const chains = useMemo(() => {
    const seen = new Set<Chain>();
    holdings.forEach((h) => seen.add(h.chain));
    return Array.from(seen);
  }, [holdings]);

  const categories = useMemo(() => {
    const seen = new Set<AssetCategory>();
    holdings.forEach((h) => seen.add(h.category));
    return Array.from(seen);
  }, [holdings]);

  const filtered = useMemo(() => {
    let rows = holdings;
    if (chainFilter !== "all") rows = rows.filter((r) => r.chain === chainFilter);
    if (categoryFilter !== "all") rows = rows.filter((r) => r.category === categoryFilter);
    if (hideSmall) rows = rows.filter((r) => r.valueUsd >= 10);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.symbol.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          r.address.toLowerCase().includes(q),
      );
    }
    return [...rows].sort((a, b) => {
      const av = a[sort] ?? 0;
      const bv = b[sort] ?? 0;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return dir === "desc" ? Number(bv) - Number(av) : Number(av) - Number(bv);
    });
  }, [holdings, chainFilter, categoryFilter, hideSmall, search, sort, dir]);

  function toggleSort(field: SortField) {
    if (sort === field) {
      setDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSort(field);
      setDir("desc");
    }
  }

  function SortTh({ field, label }: { field: SortField; label: string }) {
    const active = sort === field;
    return (
      <th
        className="px-3 py-2 text-left text-xs font-mono uppercase tracking-wider text-zinc-500 cursor-pointer hover:text-white transition-colors select-none"
        onClick={() => toggleSort(field)}
      >
        {label}
        {active && <span className="ml-1 opacity-60">{dir === "desc" ? "↓" : "↑"}</span>}
      </th>
    );
  }

  if (loading) {
    return (
      <div className="bg-bg-card border border-border rounded-lg p-8 text-center text-zinc-600 text-sm animate-pulse">
        Loading holdings...
      </div>
    );
  }

  if (holdings.length === 0) {
    return (
      <div className="bg-bg-card border border-border rounded-lg p-8 text-center text-zinc-600 text-sm">
        No token holdings found.
      </div>
    );
  }

  return (
    <div className="bg-bg-card border border-border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="p-3 border-b border-border flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Search token..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-1.5 bg-bg-hover border border-border rounded text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 w-44"
        />
        <select
          value={chainFilter}
          onChange={(e) => setChainFilter(e.target.value as Chain | "all")}
          className="px-2 py-1.5 bg-bg-hover border border-border rounded text-xs text-zinc-300 focus:outline-none"
        >
          <option value="all">All Chains</option>
          {chains.map((c) => (
            <option key={c} value={c}>
              {CHAIN_LABELS[c] ?? c}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as AssetCategory | "all")}
          className="px-2 py-1.5 bg-bg-hover border border-border rounded text-xs text-zinc-300 focus:outline-none"
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c] ?? c}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-zinc-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hideSmall}
            onChange={(e) => setHideSmall(e.target.checked)}
            className="accent-accent"
          />
          Hide &lt;$10
        </label>
        <span className="ml-auto text-xs text-zinc-600">
          {filtered.length} of {holdings.length} assets
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-border">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-mono uppercase tracking-wider text-zinc-500 w-8">
                #
              </th>
              <th className="px-3 py-2 text-left text-xs font-mono uppercase tracking-wider text-zinc-500">
                Asset
              </th>
              <th className="px-3 py-2 text-left text-xs font-mono uppercase tracking-wider text-zinc-500">
                Chain
              </th>
              <SortTh field="balance" label="Balance" />
              <SortTh field="priceUsd" label="Price" />
              <SortTh field="valueUsd" label="Value" />
              <SortTh field="change24h" label="24h" />
              <SortTh field="portfolioPercent" label="%" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((asset, idx) => {
              const changePositive = (asset.change24h ?? 0) >= 0;
              return (
                <tr key={`${asset.chain}-${asset.address}`} className="hover:bg-bg-hover/50 transition-colors">
                  <td className="px-3 py-2 text-xs text-zinc-600">{idx + 1}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {asset.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={asset.logo}
                          alt={asset.symbol}
                          className="w-6 h-6 rounded-full bg-bg-hover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-bg-hover flex items-center justify-center text-[10px] text-zinc-500 font-mono">
                          {asset.symbol.slice(0, 2)}
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-medium text-white">{asset.symbol}</div>
                        <div className="text-[11px] text-zinc-600 truncate max-w-[120px]">{asset.name}</div>
                      </div>
                      {asset.category !== "other" && (
                        <span className="hidden sm:inline text-[10px] px-1 py-0.5 rounded bg-bg-hover text-zinc-500">
                          {CATEGORY_LABELS[asset.category]}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-400">
                    {CHAIN_LABELS[asset.chain] ?? asset.chain}
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-300 font-mono">
                    {asset.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-300 font-mono">
                    {asset.priceUsd != null ? formatUsd(asset.priceUsd) : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-white font-mono font-medium">
                    {formatUsd(asset.valueUsd)}
                  </td>
                  <td
                    className={`px-3 py-2 text-xs font-mono ${
                      asset.change24h == null
                        ? "text-zinc-600"
                        : changePositive
                        ? "text-buy"
                        : "text-sell"
                    }`}
                  >
                    {asset.change24h != null
                      ? `${changePositive ? "+" : ""}${asset.change24h.toFixed(2)}%`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-400 font-mono">
                    {asset.portfolioPercent.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
