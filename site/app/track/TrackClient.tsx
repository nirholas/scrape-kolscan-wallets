"use client";

import { useState, useMemo } from "react";
import ShareButtons from "../components/ShareButtons";

interface TrackedToken {
  name: string;
  logo?: string;
  marketCap: number;
  txBuy24h: number;
  txSell24h: number;
  walletCount: number;
  inflow24h: number;
  age: string;
  address: string;
}

const DEMO_TOKENS: TrackedToken[] = [
  { name: "Mikerisu", marketCap: 3400, txBuy24h: 170, txSell24h: 151, walletCount: 1, inflow24h: 45.01, age: "2m", address: "0x1" },
  { name: "Barsik", marketCap: 15200, txBuy24h: 1000, txSell24h: 1000, walletCount: 1, inflow24h: -36, age: "22m", address: "0x2" },
  { name: "MAYHEM", marketCap: 268.3, txBuy24h: 122, txSell24h: 85, walletCount: 1, inflow24h: -1400, age: "3m", address: "0x3" },
  { name: "Mythos", marketCap: 145000, txBuy24h: 2000, txSell24h: 2000, walletCount: 1, inflow24h: 1280, age: "12d", address: "0x4" },
  { name: "MONDAY", marketCap: 574.5, txBuy24h: 463, txSell24h: 146, walletCount: 1, inflow24h: 201.8, age: "5m", address: "0x5" },
  { name: "MONDAY", marketCap: 521.3, txBuy24h: 139, txSell24h: 113, walletCount: 1, inflow24h: 243.9, age: "6m", address: "0x6" },
  { name: "Pound", marketCap: 11200, txBuy24h: 4000, txSell24h: 3000, walletCount: 3, inflow24h: 1130, age: "36m", address: "0x7" },
  { name: "BULL", marketCap: 650.6, txBuy24h: 95, txSell24h: 40, walletCount: 1, inflow24h: 49.21, age: "14m", address: "0x8" },
  { name: "CroydonAI", marketCap: 3700, txBuy24h: 756, txSell24h: 671, walletCount: 1, inflow24h: -15.2, age: "17h", address: "0x9" },
  { name: "뉴크구", marketCap: 2300, txBuy24h: 22, txSell24h: 28, walletCount: 1, inflow24h: 5.704, age: "33m", address: "0xa" },
  { name: "67POOP", marketCap: 2300, txBuy24h: 32, txSell24h: 34, walletCount: 1, inflow24h: -0.19, age: "33m", address: "0xb" },
];

type TimeFilter = "5m" | "1h" | "6h" | "24h";
type GroupFilter = "all" | "default" | "axiom";

function formatMC(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(1)}`;
}

function formatInflow(v: number): string {
  const abs = Math.abs(v);
  let s: string;
  if (abs >= 1_000) s = `${(abs / 1_000).toFixed(2)}K`;
  else s = abs.toFixed(2);
  return v >= 0 ? `$+${s}` : `$-${s}`;
}

export default function TrackClient() {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("24h");
  const [group, setGroup] = useState<GroupFilter>("all");
  const [search, setSearch] = useState("");
  const [advOpen, setAdvOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = DEMO_TOKENS;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(q) || t.address.toLowerCase().includes(q));
    }
    return list;
  }, [search]);

  const groupCounts: Record<GroupFilter, number> = {
    all: DEMO_TOKENS.length,
    default: 37,
    axiom: 130,
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Track</h1>
          <p className="text-sm text-zinc-500 mt-0.5">New tokens spotted by tracked wallets</p>
        </div>

        {/* Time filter + Advanced */}
        <div className="flex items-center gap-2">
          {(["5m", "1h", "6h", "24h"] as TimeFilter[]).map((t) => (
            <button
              key={t}
              onClick={() => setTimeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                timeFilter === t
                  ? "bg-white text-black"
                  : "bg-bg-card text-zinc-400 hover:text-white hover:bg-bg-hover border border-border"
              }`}
            >
              {t}
            </button>
          ))}
          <button
            onClick={() => setAdvOpen(!advOpen)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${
              advOpen
                ? "bg-accent text-white"
                : "bg-bg-card text-zinc-400 hover:text-white hover:bg-bg-hover border border-border"
            }`}
          >
            Adv.
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </button>
          <ShareButtons title="KolQuest Token Tracker" />
        </div>
      </div>

      {/* Advanced filters panel */}
      {advOpen && (
        <div className="bg-bg-card border border-border rounded-xl p-4 animate-fade-in">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1 block">Min MC</label>
              <input
                type="text"
                placeholder="e.g. 1000"
                className="w-full bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1 block">Max MC</label>
              <input
                type="text"
                placeholder="e.g. 1000000"
                className="w-full bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1 block">Min Wallets</label>
              <input
                type="text"
                placeholder="e.g. 3"
                className="w-full bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1 block">Min Inflow</label>
              <input
                type="text"
                placeholder="e.g. 100"
                className="w-full bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        </div>
      )}

      {/* Portfolio group tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {/* Counter badges */}
        <div className="flex items-center gap-1.5 mr-3 shrink-0">
          <span className="text-xs text-zinc-500">P1</span>
          <span className="text-xs text-zinc-500">P2</span>
          <span className="text-xs text-zinc-500">P3</span>
        </div>
        <div className="h-4 w-px bg-border mr-2 shrink-0" />

        {(["all", "default", "axiom"] as GroupFilter[]).map((g) => (
          <button
            key={g}
            onClick={() => setGroup(g)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap ${
              group === g
                ? "bg-bg-hover text-white border border-border-light"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-bg-hover"
            }`}
          >
            {g === "default" && <span className="text-yellow-400">⭐</span>}
            {g === "axiom" && <span className="text-yellow-400">⭐</span>}
            <span className="capitalize">{g === "all" ? "All" : g.charAt(0).toUpperCase() + g.slice(1)}</span>
            <span className="text-[11px] text-zinc-600 tabular-nums">{groupCounts[g]}</span>
          </button>
        ))}

        <div className="h-4 w-px bg-border mx-1 shrink-0" />
        <span className="text-[11px] text-zinc-600 shrink-0">Groups</span>
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search token or wallet…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-80 bg-bg-card border border-border rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] text-zinc-500 uppercase tracking-wider border-b border-border">
              <th className="text-left px-4 py-3 font-medium">Token / Wallet</th>
              <th className="text-right px-4 py-3 font-medium">MC / Bal</th>
              <th className="text-right px-4 py-3 font-medium whitespace-nowrap">{timeFilter} TXs</th>
              <th className="text-right px-4 py-3 font-medium whitespace-nowrap">{timeFilter} Inflow</th>
              <th className="text-right px-4 py-3 font-medium">Age</th>
              <th className="text-center px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((token, i) => (
              <tr
                key={`${token.address}-${i}`}
                className="hover:bg-bg-hover transition-colors duration-150 cursor-pointer group"
              >
                {/* Token / Wallet */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-bg-elevated border border-border flex items-center justify-center text-xs font-bold text-zinc-400 shrink-0">
                      {token.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <span className="text-white font-medium truncate block">{token.name}</span>
                    </div>
                  </div>
                </td>

                {/* MC */}
                <td className="px-4 py-3 text-right font-mono text-zinc-300 whitespace-nowrap">
                  {formatMC(token.marketCap)}
                </td>

                {/* TXs */}
                <td className="px-4 py-3 text-right font-mono text-zinc-400 whitespace-nowrap">
                  <span className="text-buy">{token.txBuy24h.toLocaleString()}</span>
                  <span className="text-zinc-600 mx-1">/</span>
                  <span className="text-sell">{token.txSell24h.toLocaleString()}</span>
                </td>

                {/* Inflow */}
                <td className={`px-4 py-3 text-right font-mono whitespace-nowrap ${
                  token.inflow24h >= 0 ? "text-buy" : "text-sell"
                }`}>
                  {formatInflow(token.inflow24h)}
                </td>

                {/* Age */}
                <td className="px-4 py-3 text-right text-zinc-500 whitespace-nowrap">
                  {token.age}
                </td>

                {/* Action */}
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-buy/10 text-buy border border-buy/20">
                    Created
                  </span>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-zinc-600">
                  No tokens match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between text-[11px] text-zinc-600 px-1">
        <span>{filtered.length} token{filtered.length !== 1 ? "s" : ""} tracked</span>
        <span>Auto-refresh in 15s</span>
      </div>
    </div>
  );
}
