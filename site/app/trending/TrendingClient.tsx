"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

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
  totalPnl: number;
  firstSeen: string;
  lastSeen: string;
}

function formatUsd(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  return `$${v.toFixed(2)}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function shortAddr(addr: string): string {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

export default function TrendingClient() {
  const [tokens, setTokens] = useState<TrendingToken[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/trending")
      .then((r) => r.json())
      .then((d) => setTokens(d.tokens || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-14 bg-bg-card border border-border rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-4xl mb-4">📊</div>
        <h2 className="text-xl font-bold text-white mb-2">No Trending Data Yet</h2>
        <p className="text-zinc-500 text-sm max-w-md mx-auto">
          Once trades are ingested, this page will show which tokens tracked wallets are buying the most.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-bg-card">
            <th className="px-3 py-2.5 text-left text-[11px] font-medium text-zinc-600 uppercase tracking-wider">#</th>
            <th className="px-3 py-2.5 text-left text-[11px] font-medium text-zinc-600 uppercase tracking-wider">Token</th>
            <th className="px-3 py-2.5 text-right text-[11px] font-medium text-zinc-600 uppercase tracking-wider">Buyers</th>
            <th className="px-3 py-2.5 text-right text-[11px] font-medium text-zinc-600 uppercase tracking-wider">Buys / Sells</th>
            <th className="px-3 py-2.5 text-right text-[11px] font-medium text-zinc-600 uppercase tracking-wider">Buy Vol</th>
            <th className="px-3 py-2.5 text-right text-[11px] font-medium text-zinc-600 uppercase tracking-wider">Net Flow</th>
            <th className="px-3 py-2.5 text-right text-[11px] font-medium text-zinc-600 uppercase tracking-wider">PnL</th>
            <th className="px-3 py-2.5 text-right text-[11px] font-medium text-zinc-600 uppercase tracking-wider">Last</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((t, i) => (
            <tr key={t.tokenAddress} className="border-b border-border/50 last:border-b-0 hover:bg-bg-card transition-colors">
              <td className="px-3 py-2.5 text-xs text-zinc-600 tabular-nums">{i + 1}</td>
              <td className="px-3 py-2.5">
                <Link
                  href={`/token/${t.chain}/${t.tokenAddress}`}
                  className="flex items-center gap-2 group"
                >
                  {t.tokenLogo ? (
                    <img src={t.tokenLogo} alt="" className="w-6 h-6 rounded-full flex-shrink-0" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-500 flex-shrink-0">
                      {(t.tokenSymbol || "?")[0]}
                    </div>
                  )}
                  <div>
                    <div className="text-sm text-white group-hover:text-accent transition-colors">
                      {t.tokenName || t.tokenSymbol || shortAddr(t.tokenAddress)}
                    </div>
                    <div className="text-[11px] text-zinc-600">
                      {t.tokenSymbol ? `$${t.tokenSymbol}` : shortAddr(t.tokenAddress)}
                      <span className="ml-1.5 px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[9px] uppercase">
                        {t.chain}
                      </span>
                    </div>
                  </div>
                </Link>
              </td>
              <td className="px-3 py-2.5 text-right text-sm text-accent font-bold tabular-nums">{t.uniqueBuyers}</td>
              <td className="px-3 py-2.5 text-right text-sm tabular-nums">
                <span className="text-buy">{t.buyCount}</span>
                <span className="text-zinc-700 mx-0.5">/</span>
                <span className="text-sell">{t.sellCount}</span>
              </td>
              <td className="px-3 py-2.5 text-right text-sm text-white tabular-nums">{formatUsd(t.totalBuyUsd)}</td>
              <td className={`px-3 py-2.5 text-right text-sm tabular-nums font-medium ${t.netFlow > 0 ? "text-buy" : "text-sell"}`}>
                {t.netFlow > 0 ? "+" : ""}{formatUsd(t.netFlow)}
              </td>
              <td className={`px-3 py-2.5 text-right text-sm tabular-nums font-medium ${t.totalPnl > 0 ? "text-buy" : t.totalPnl < 0 ? "text-sell" : "text-zinc-500"}`}>
                {t.totalPnl > 0 ? "+" : ""}{formatUsd(t.totalPnl)}
              </td>
              <td className="px-3 py-2.5 text-right text-xs text-zinc-600">{timeAgo(t.lastSeen)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
