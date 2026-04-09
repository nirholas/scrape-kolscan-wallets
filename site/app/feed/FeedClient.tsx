"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { timeAgo, shortAddr, formatUsd } from "@/lib/format";

interface Trade {
  id: string;
  walletAddress: string;
  walletLabel: string | null;
  walletAvatar: string | null;
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

function FeedInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const chain = searchParams.get("chain");
  const type = searchParams.get("type");

  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const pendingRef = useRef<Trade[]>([]);

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value != null) params.set(key, value);
    else params.delete(key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function buildQuery(extra?: Record<string, string>) {
    const params = new URLSearchParams();
    if (chain) params.set("chain", chain);
    if (type) params.set("type", type);
    params.set("limit", "50");
    if (extra) Object.entries(extra).forEach(([k, v]) => params.set(k, v));
    return params.toString();
  }

  // Initial load + filter changes
  useEffect(() => {
    setLoading(true);
    setCursor(null);
    setNewCount(0);
    pendingRef.current = [];
    fetch(`/api/trades?${buildQuery()}`)
      .then((r) => r.json())
      .then((data) => {
        setTrades(data.trades);
        setCursor(data.nextCursor);
        setHasMore(!!data.nextCursor);
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain, type]);

  // Auto-refresh: fetch silently, show banner instead of replacing
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetch(`/api/trades?${buildQuery()}`)
        .then((r) => r.json())
        .then((data) => {
          const fresh: Trade[] = data.trades;
          if (fresh.length === 0) return;
          setTrades((current) => {
            if (current.length === 0 || fresh[0]?.id === current[0]?.id) return current;
            const knownIds = new Set(current.map((t) => t.id));
            const count = fresh.filter((t) => !knownIds.has(t.id)).length;
            if (count > 0) {
              pendingRef.current = fresh;
              setNewCount(count);
            }
            return current;
          });
        });
    }, 15_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, chain, type]);

  function applyPending() {
    setTrades(pendingRef.current);
    pendingRef.current = [];
    setNewCount(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function loadMore() {
    if (!cursor) return;
    fetch(`/api/trades?${buildQuery({ cursor })}`)
      .then((r) => r.json())
      .then((data) => {
        setTrades((prev) => [...prev, ...data.trades]);
        setCursor(data.nextCursor);
        setHasMore(!!data.nextCursor);
      });
  }

  const explorerUrl = (c: string, txHash: string) =>
    c === "bsc" ? `https://bscscan.com/tx/${txHash}` : `https://solscan.io/tx/${txHash}`;

  const walletHref = (c: string, addr: string) =>
    c === "bsc" ? `/gmgn-wallet/${addr}?chain=bsc` : `/wallet/${addr}`;

  return (
    <div className="animate-fade-in">
      {/* New trades banner */}
      {newCount > 0 && (
        <button
          onClick={applyPending}
          className="sticky top-0 z-10 w-full py-2 bg-buy/10 border-b border-buy/20 text-buy text-xs font-mono font-medium text-center hover:bg-buy/20 transition-colors"
        >
          ↑ {newCount} new trade{newCount !== 1 ? "s" : ""} — click to load
        </button>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Live Trade Feed</h1>
          <p className="text-sm text-zinc-500 mt-1">Real-time buys &amp; sells from tracked wallets</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { label: "All", value: null },
            { label: "SOL", value: "sol" },
            { label: "BSC", value: "bsc" },
          ].map((opt) => (
            <button
              key={opt.label}
              onClick={() => setParam("chain", opt.value)}
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
          {[
            { label: "All", value: null },
            { label: "Buys", value: "buy" },
            { label: "Sells", value: "sell" },
          ].map((opt) => (
            <button
              key={opt.label}
              onClick={() => setParam("type", opt.value)}
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
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              autoRefresh
                ? "bg-buy/10 border border-buy/30 text-buy"
                : "bg-bg-card border border-border text-zinc-500"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? "bg-buy animate-pulse" : "bg-zinc-600"}`}
            />
            Live
          </button>
        </div>
      </div>

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
                  {[
                    { label: "Time", right: false },
                    { label: "Type", right: false },
                    { label: "Wallet", right: false },
                    { label: "Token", right: false },
                    { label: "Amount", right: true },
                    { label: "Profit", right: true },
                    { label: "Chain", right: false },
                    { label: "Tx", right: true },
                  ].map(({ label, right }) => (
                    <th
                      key={label}
                      className={`px-4 py-3 text-[11px] font-medium text-zinc-600 uppercase tracking-wider ${right ? "text-right" : "text-left"}`}
                    >
                      {label}
                    </th>
                  ))}
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
                          t.type === "buy" ? "bg-buy/10 text-buy" : "bg-sell/10 text-sell"
                        }`}
                      >
                        {t.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {t.walletAvatar ? (
                          <img src={t.walletAvatar} alt="" className="w-5 h-5 rounded-full flex-shrink-0" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
                        ) : null}
                        <div className={`w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[9px] font-bold text-zinc-400 flex-shrink-0 ${t.walletAvatar ? 'hidden' : ''}`}>
                          {(t.walletLabel || t.walletAddress).charAt(0).toUpperCase()}
                        </div>
                        <Link href={walletHref(t.chain, t.walletAddress)} className="text-sm text-white hover:text-accent transition-colors">
                          {t.walletLabel || shortAddr(t.walletAddress)}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {t.tokenLogo && <img src={t.tokenLogo} alt="" className="w-5 h-5 rounded-full" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
                        <div>
                          <span className="text-sm text-white font-medium">
                            {t.tokenSymbol || shortAddr(t.tokenAddress)}
                          </span>
                          {t.tokenName && <span className="text-[11px] text-zinc-600 ml-1.5">{t.tokenName}</span>}
                          {t.tokenLaunchpad && <span className="text-[9px] text-zinc-600 ml-1.5">via {t.tokenLaunchpad}</span>}
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
                        <a href={explorerUrl(t.chain, t.txHash)} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-zinc-500 hover:text-accent transition-colors">
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
                onClick={loadMore}
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

export default function FeedClient() {
  return (
    <Suspense
      fallback={
        <div className="animate-fade-in">
          <div className="h-16 w-64 bg-zinc-900 rounded animate-pulse mb-6" />
          <div className="h-96 bg-bg-card rounded-xl border border-border animate-pulse" />
        </div>
      }
    >
      <FeedInner />
    </Suspense>
  );
}
