"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Trade {
  id: string;
  walletAddress: string;
  walletLabel: string | null;
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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
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

export default function FeedClient() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [chain, setChain] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchTrades = useCallback(
    async (append = false) => {
      const params = new URLSearchParams();
      if (chain) params.set("chain", chain);
      if (type) params.set("type", type);
      if (append && cursor) params.set("cursor", cursor);
      params.set("limit", "50");

      const res = await fetch(`/api/trades?${params}`);
      const data = await res.json();

      if (append) {
        setTrades((prev) => [...prev, ...data.trades]);
      } else {
        setTrades(data.trades);
      }
      setCursor(data.nextCursor);
      setHasMore(!!data.nextCursor);
      setLoading(false);
    },
    [chain, type, cursor],
  );

  // Initial load + filter changes
  useEffect(() => {
    setLoading(true);
    setCursor(null);
    const params = new URLSearchParams();
    if (chain) params.set("chain", chain);
    if (type) params.set("type", type);
    params.set("limit", "50");

    fetch(`/api/trades?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setTrades(data.trades);
        setCursor(data.nextCursor);
        setHasMore(!!data.nextCursor);
        setLoading(false);
      });
  }, [chain, type]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      const params = new URLSearchParams();
      if (chain) params.set("chain", chain);
      if (type) params.set("type", type);
      params.set("limit", "50");

      fetch(`/api/trades?${params}`)
        .then((r) => r.json())
        .then((data) => {
          setTrades(data.trades);
          setCursor(data.nextCursor);
          setHasMore(!!data.nextCursor);
        });
    }, 15_000);
    return () => clearInterval(interval);
  }, [autoRefresh, chain, type]);

  const explorerUrl = (chain: string, txHash: string) => {
    if (chain === "bsc") return `https://bscscan.com/tx/${txHash}`;
    return `https://solscan.io/tx/${txHash}`;
  };

  const walletHref = (chain: string, addr: string) => {
    if (chain === "bsc") return `/gmgn-wallet/${addr}?chain=bsc`;
    return `/wallet/${addr}`;
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Live Trade Feed</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Real-time buys & sells from tracked wallets
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
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
                  : "bg-bg-card border border-border text-zinc-400 hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          ))}

          <div className="w-px h-5 bg-border mx-1" />

          {/* Type filter */}
          {[
            { label: "All", value: null },
            { label: "Buys", value: "buy" },
            { label: "Sells", value: "sell" },
          ].map((opt) => (
            <button
              key={opt.label}
              onClick={() => setType(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                type === opt.value
                  ? "bg-white text-black"
                  : "bg-bg-card border border-border text-zinc-400 hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          ))}

          <div className="w-px h-5 bg-border mx-1" />

          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              autoRefresh
                ? "bg-buy/10 border border-buy/30 text-buy"
                : "bg-bg-card border border-border text-zinc-500"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? "bg-buy animate-pulse" : "bg-zinc-600"}`} />
            Live
          </button>
        </div>
      </div>

      {/* Trade list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
        </div>
      ) : trades.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-zinc-600 text-sm">No trades yet</div>
          <p className="text-zinc-700 text-xs mt-2">
            Trades will appear here once the ingestion pipeline is running.
          </p>
        </div>
      ) : (
        <>
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-bg-card/50">
                  <th className="px-4 py-3 text-left text-[11px] font-medium text-zinc-600 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium text-zinc-600 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium text-zinc-600 uppercase tracking-wider">
                    Wallet
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium text-zinc-600 uppercase tracking-wider">
                    Token
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-medium text-zinc-600 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-medium text-zinc-600 uppercase tracking-wider">
                    Profit
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium text-zinc-600 uppercase tracking-wider">
                    Chain
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-medium text-zinc-600 uppercase tracking-wider">
                    Tx
                  </th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-border/50 last:border-b-0 hover:bg-bg-card/60 transition-colors"
                  >
                    <td className="px-4 py-3 text-xs text-zinc-500 tabular-nums whitespace-nowrap">
                      {timeAgo(t.tradedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                          t.type === "buy"
                            ? "bg-buy/10 text-buy"
                            : "bg-sell/10 text-sell"
                        }`}
                      >
                        {t.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={walletHref(t.chain, t.walletAddress)}
                        className="text-sm text-white hover:text-accent transition-colors"
                      >
                        {t.walletLabel || shortAddr(t.walletAddress)}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {t.tokenLogo && (
                          <img src={t.tokenLogo} alt="" className="w-5 h-5 rounded-full" />
                        )}
                        <div>
                          <span className="text-sm text-white font-medium">
                            {t.tokenSymbol || shortAddr(t.tokenAddress)}
                          </span>
                          {t.tokenName && (
                            <span className="text-[11px] text-zinc-600 ml-1.5">
                              {t.tokenName}
                            </span>
                          )}
                          {t.tokenLaunchpad && (
                            <span className="text-[9px] text-zinc-600 ml-1.5">
                              via {t.tokenLaunchpad}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums font-medium text-zinc-300">
                      {formatUsd(t.amountUsd)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {t.realizedProfit != null ? (
                        <span className={`text-sm tabular-nums font-medium ${t.realizedProfit > 0 ? "text-buy" : "text-sell"}`}>
                          {t.realizedProfit > 0 ? "+" : ""}{formatUsd(t.realizedProfit)}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-700">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700 uppercase">
                        {t.chain}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {t.txHash ? (
                        <a
                          href={explorerUrl(t.chain, t.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-zinc-500 hover:text-accent transition-colors"
                        >
                          {shortAddr(t.txHash)}↗
                        </a>
                      ) : (
                        <span className="text-xs text-zinc-700">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="flex justify-center mt-6">
              <button
                onClick={() => fetchTrades(true)}
                className="px-6 py-2.5 bg-bg-card border border-border rounded-xl text-sm text-zinc-400 hover:text-white hover:border-zinc-600 transition-all"
              >
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
