"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import ShareButtons from "../components/ShareButtons";
import NextImage from "next/image";
import { timeAgo } from "@/lib/format";

interface TrendingToken {
  tokenAddress: string;
  tokenSymbol: string | null;
  tokenName: string | null;
  tokenLogo: string | null;
  chain: string;
  buyCount: number;
  sellCount: number;
  uniqueBuyers: number;
  totalBuyUsd: number;
  totalSellUsd: number;
  netFlow: number;
  firstSeen: string;
  lastSeen: string;
}

type TimeFilter = "5m" | "1h" | "6h" | "24h";
type ChainFilter = "all" | "sol" | "bsc";

const TIME_HOURS: Record<TimeFilter, number> = {
  "5m": 5 / 60,
  "1h": 1,
  "6h": 6,
  "24h": 24,
};

function formatInflow(v: number): string {
  const abs = Math.abs(v);
  let s: string;
  if (abs >= 1_000) s = `${(abs / 1_000).toFixed(2)}K`;
  else s = abs.toFixed(2);
  return v >= 0 ? `$+${s}` : `$-${s}`;
}

function TokenLogo({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return (
    <div className="w-8 h-8 rounded-full bg-bg-elevated border border-border flex items-center justify-center text-xs font-bold text-zinc-400 shrink-0">?</div>
  );
  return (
    <NextImage
      src={src}
      alt=""
      width={32}
      height={32}
      className="w-8 h-8 rounded-full bg-bg-elevated border border-border shrink-0"
      onError={() => setFailed(true)}
      unoptimized
    />
  );
}

export default function TrackClient() {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("24h");
  const [chainFilter, setChainFilter] = useState<ChainFilter>("all");
  const [search, setSearch] = useState("");
  const [advOpen, setAdvOpen] = useState(false);
  const [tokens, setTokens] = useState<TrendingToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minBuyers, setMinBuyers] = useState("");
  const [minNetFlow, setMinNetFlow] = useState("");
  const [countdown, setCountdown] = useState(30);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTokens = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams({ hours: String(TIME_HOURS[timeFilter]) });
      if (chainFilter !== "all") params.set("chain", chainFilter);
      const res = await fetch(`/api/trending?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTokens(data.tokens ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [timeFilter, chainFilter]);

  useEffect(() => {
    setLoading(true);
    setTokens([]);
    fetchTokens();
  }, [fetchTokens]);

  useEffect(() => {
    setCountdown(30);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { fetchTokens(); return 30; }
        return c - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchTokens]);

  const filtered = useMemo(() => {
    let list = tokens;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          (t.tokenSymbol ?? "").toLowerCase().includes(q) ||
          (t.tokenName ?? "").toLowerCase().includes(q) ||
          t.tokenAddress.toLowerCase().includes(q),
      );
    }
    const minB = parseInt(minBuyers, 10);
    if (!isNaN(minB) && minB > 0) list = list.filter((t) => t.uniqueBuyers >= minB);
    const minF = parseFloat(minNetFlow);
    if (!isNaN(minF)) list = list.filter((t) => t.netFlow >= minF);
    return list;
  }, [tokens, search, minBuyers, minNetFlow]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Track</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Tokens spotted by tracked wallets in the last{" "}
            {timeFilter === "5m" ? "5 minutes" : timeFilter === "1h" ? "hour" : timeFilter === "6h" ? "6 hours" : "24 hours"}
          </p>
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
            Filters
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M3 4h18M7 8h10M11 12h2" />
            </svg>
          </button>
          <div className="flex items-center gap-1.5">
            {(["all", "sol", "bsc"] as ChainFilter[]).map((c) => (
              <button
                key={c}
                onClick={() => setChainFilter(c)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 uppercase ${
                  chainFilter === c
                    ? "bg-accent text-white"
                    : "bg-bg-card text-zinc-500 hover:text-white hover:bg-bg-hover border border-border"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <ShareButtons title="KolQuest Token Tracker" />
        </div>
      </div>

      {/* Advanced filters panel */}
      {advOpen && (
        <div className="bg-bg-card border border-border rounded-xl p-4 animate-fade-in">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1 block">Min KOL Buyers</label>
              <input
                type="text"
                placeholder="e.g. 3"
                value={minBuyers}
                onChange={(e) => setMinBuyers(e.target.value)}
                className="w-full bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1 block">Min Net Flow ($)</label>
              <input
                type="text"
                placeholder="e.g. 1000"
                value={minNetFlow}
                onChange={(e) => setMinNetFlow(e.target.value)}
                className="w-full bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search token name, symbol, or address…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-80 bg-bg-card border border-border rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        {loading ? (
          <div className="space-y-px">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-14 bg-bg-card/60 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="px-4 py-12 text-center">
            <p className="text-zinc-500 text-sm mb-3">{error}</p>
            <button
              onClick={() => { setLoading(true); fetchTokens(); }}
              className="px-4 py-1.5 rounded-lg text-xs font-medium bg-bg-card border border-border text-zinc-300 hover:text-white hover:border-accent transition-all"
            >
              Retry
            </button>
          </div>
        ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] text-zinc-500 uppercase tracking-wider border-b border-border">
              <th className="text-left px-4 py-3 font-medium">Token</th>
              <th className="text-right px-4 py-3 font-medium">Chain</th>
              <th className="text-right px-4 py-3 font-medium whitespace-nowrap">Buys / Sells</th>
              <th className="text-right px-4 py-3 font-medium whitespace-nowrap">KOL Buyers</th>
              <th className="text-right px-4 py-3 font-medium whitespace-nowrap">Net Flow</th>
              <th className="text-right px-4 py-3 font-medium">First Seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((token) => (
              <tr
                key={token.tokenAddress}
                className="hover:bg-bg-hover transition-colors duration-150 cursor-pointer group"
              >
                {/* Token */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {token.tokenLogo ? (
                      <TokenLogo src={token.tokenLogo} />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-bg-elevated border border-border flex items-center justify-center text-xs font-bold text-zinc-400 shrink-0">
                        {(token.tokenSymbol ?? token.tokenName ?? "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <Link
                        href={`/token/${token.chain}/${token.tokenAddress}`}
                        className="text-white font-medium hover:text-buy transition-colors truncate block"
                      >
                        {token.tokenSymbol ?? token.tokenName ?? token.tokenAddress.slice(0, 8)}
                      </Link>
                      {token.tokenName && token.tokenSymbol && token.tokenName !== token.tokenSymbol && (
                        <span className="text-[11px] text-zinc-500 truncate block">{token.tokenName}</span>
                      )}
                    </div>
                  </div>
                </td>

                {/* Chain */}
                <td className="px-4 py-3 text-right">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border bg-zinc-900 text-zinc-500 border-zinc-800 uppercase">
                    {token.chain}
                  </span>
                </td>

                {/* TXs */}
                <td className="px-4 py-3 text-right font-mono text-zinc-400 whitespace-nowrap">
                  <span className="text-buy">{token.buyCount.toLocaleString()}</span>
                  <span className="text-zinc-600 mx-1">/</span>
                  <span className="text-sell">{token.sellCount.toLocaleString()}</span>
                </td>

                {/* KOL Buyers */}
                <td className="px-4 py-3 text-right font-mono text-zinc-300 whitespace-nowrap">
                  {token.uniqueBuyers}
                </td>

                {/* Net Flow */}
                <td className={`px-4 py-3 text-right font-mono whitespace-nowrap ${
                  token.netFlow >= 0 ? "text-buy" : "text-sell"
                }`}>
                  {formatInflow(token.netFlow)}
                </td>

                {/* First Seen */}
                <td className="px-4 py-3 text-right text-zinc-500 whitespace-nowrap font-mono text-xs">
                  {timeAgo(token.firstSeen)}
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-zinc-600">
                  {tokens.length === 0
                    ? `No token activity in the last ${timeFilter}.`
                    : "No tokens match your filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        )}
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between text-[11px] text-zinc-600 px-1">
        <span>{filtered.length} token{filtered.length !== 1 ? "s" : ""}</span>
        <span>Refreshing in {countdown}s</span>
      </div>
    </div>
  );
}
