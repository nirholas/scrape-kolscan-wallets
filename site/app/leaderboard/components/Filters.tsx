"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { LeaderboardQuery, LeaderboardChain, LeaderboardCategory } from "@/lib/types";

type Timeframe = NonNullable<LeaderboardQuery["timeframe"]>;
type Category = NonNullable<LeaderboardQuery["category"]>;

const CHAINS: { label: string; value: LeaderboardChain | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Solana", value: "solana" },
  { label: "BSC", value: "bsc" },
];

const TIMEFRAMES: { label: string; value: Timeframe }[] = [
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "All", value: "all" },
];

const CATEGORIES: { label: string; value: Category }[] = [
  { label: "Overall", value: "overall" },
  { label: "KOLs", value: "kol" },
  { label: "Smart Money", value: "smart_money" },
  { label: "Whales", value: "whale" },
  { label: "Snipers", value: "sniper" },
  { label: "Meme", value: "meme" },
  { label: "DeFi", value: "defi" },
];

function TabGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex bg-bg-card border border-border rounded p-0.5 gap-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1 rounded text-xs font-mono uppercase tracking-wider transition-all duration-150 ${
            value === opt.value
              ? "bg-zinc-800 text-white"
              : "text-zinc-600 hover:text-white"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export interface FiltersProps {
  total: number;
  lastUpdated: string;
  sources: { kolscan: boolean; gmgn: boolean; dune: boolean; flipside: boolean; polymarket: boolean };
}

export default function Filters({ total, lastUpdated, sources }: FiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const chain = (searchParams.get("chain") ?? "all") as LeaderboardChain | "all";
  const timeframe = (searchParams.get("timeframe") ?? "7d") as Timeframe;
  const category = (searchParams.get("category") ?? "overall") as Category;
  const search = searchParams.get("search") ?? "";
  const verifiedOnly = searchParams.get("verifiedOnly") === "true";
  const minPnl = searchParams.get("minPnl") ?? "";
  const minWinRate = searchParams.get("minWinRate") ?? "";

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Reset to page 1 when filters change
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function setMultiple(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v && v !== "") params.set(k, v);
      else params.delete(k);
    }
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const activeSources = Object.entries(sources)
    .filter(([, v]) => v)
    .map(([k]) => k);

  return (
    <div className="space-y-3">
      {/* Chain + Timeframe + Category tabs */}
      <div className="flex flex-wrap items-center gap-3">
        <TabGroup
          options={CHAINS}
          value={chain}
          onChange={(v) => setParam("chain", v === "all" ? null : v)}
        />
        <TabGroup
          options={TIMEFRAMES}
          value={timeframe}
          onChange={(v) => setParam("timeframe", v === "7d" ? null : v)}
        />
        <TabGroup
          options={CATEGORIES}
          value={category}
          onChange={(v) => setParam("category", v === "overall" ? null : v)}
        />
      </div>

      {/* Search + Filters row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
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
            onChange={(e) => setParam("search", e.target.value || null)}
            placeholder="Search name, address, @twitter…"
            className="bg-bg-card border border-border rounded pl-8 pr-3 py-1.5 text-xs text-white font-mono placeholder:text-zinc-700 outline-none focus:border-zinc-600 w-56 transition-all"
          />
        </div>

        {/* Min PnL */}
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600 text-xs">$</span>
          <input
            type="number"
            value={minPnl}
            onChange={(e) => setParam("minPnl", e.target.value || null)}
            placeholder="Min PnL"
            className="bg-bg-card border border-border rounded pl-6 pr-3 py-1.5 text-xs text-white font-mono placeholder:text-zinc-700 outline-none focus:border-zinc-600 w-28 transition-all"
          />
        </div>

        {/* Min Win Rate */}
        <div className="relative">
          <input
            type="number"
            min={0}
            max={100}
            value={minWinRate}
            onChange={(e) => setParam("minWinRate", e.target.value || null)}
            placeholder="Min Win%"
            className="bg-bg-card border border-border rounded px-3 py-1.5 text-xs text-white font-mono placeholder:text-zinc-700 outline-none focus:border-zinc-600 w-24 transition-all"
          />
        </div>

        {/* Verified only toggle */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <div
            onClick={() => setParam("verifiedOnly", verifiedOnly ? null : "true")}
            className={`w-8 h-4 rounded-full relative transition-colors ${
              verifiedOnly ? "bg-buy" : "bg-zinc-800 border border-zinc-700"
            }`}
          >
            <div
              className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${
                verifiedOnly ? "left-4.5" : "left-0.5"
              }`}
            />
          </div>
          <span className="text-xs text-zinc-400 font-mono">Twitter only</span>
        </label>

        {/* Clear filters */}
        {(search || minPnl || minWinRate || verifiedOnly || chain !== "all" || category !== "overall") && (
          <button
            onClick={() =>
              setMultiple({
                search: null,
                minPnl: null,
                minWinRate: null,
                verifiedOnly: null,
                chain: null,
                category: null,
              })
            }
            className="text-xs text-zinc-600 hover:text-zinc-300 font-mono transition-colors underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-[11px] text-zinc-600 font-mono">
        <span>{total.toLocaleString()} wallets</span>
        {activeSources.length > 0 && (
          <span>
            Sources:{" "}
            {activeSources
              .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
              .join(", ")}
          </span>
        )}
        <span>
          Updated{" "}
          {new Date(lastUpdated).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}
