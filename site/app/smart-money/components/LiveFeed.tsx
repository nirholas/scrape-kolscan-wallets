"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { timeAgo, shortAddr, formatUsd, formatNumber, formatProfit } from "@/lib/format";
import NextImage from "next/image";
import type { SmartMoneyActivity } from "@/lib/smart-money-tracker";
import { cn } from "@/lib/utils";

function TokenLogo({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-bold text-sm text-gray-500">
        {alt.slice(0, 1).toUpperCase()}
      </div>
    );
  }
  return (
    <NextImage
      src={src}
      alt=""
      width={32}
      height={32}
      className="w-8 h-8 rounded-full"
      onError={() => setFailed(true)}
      unoptimized
    />
  );
}

function FeedItem({ activity }: { activity: SmartMoneyActivity }) {
  const isBuy = activity.action === "buy";
  const pnlColor = (activity.realizedPnl ?? 0) >= 0 ? "text-green-500" : "text-red-500";

  const explorerUrl = (chain: string, txHash: string) => {
    switch (chain) {
      case "bsc": return `https://bscscan.com/tx/${txHash}`;
      case "eth": return `https://etherscan.io/tx/${txHash}`;
      case "base": return `https://basescan.org/tx/${txHash}`;
      default: return `https://solscan.io/tx/${txHash}`;
    }
  };

  const walletHref = (_chain: string, addr: string) => `/wallet/${addr}`;
  const tokenHref = (chain: string, addr: string) => `/${chain}/token/${addr}`;

  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-4 py-4 border-b border-gray-200 dark:border-gray-800">
      <div className="relative">
        <Link href={walletHref(activity.chain, activity.walletAddress)}>
          <NextImage
            src={activity.walletAvatar || "/img/anon.png"}
            alt={activity.walletLabel || shortAddr(activity.walletAddress)}
            width={40}
            height={40}
            className="w-10 h-10 rounded-full"
            unoptimized
          />
        </Link>
        <span className="absolute -bottom-1 -right-1 bg-white dark:bg-gray-900 rounded-full p-0.5">
          <TokenLogo src={activity.tokenLogo || ""} alt={activity.tokenSymbol || "?"} />
        </span>
      </div>

      <div>
        <div className="flex items-center justify-between text-sm">
          <p className="text-gray-500 dark:text-gray-400">
            <Link href={walletHref(activity.chain, activity.walletAddress)} className="font-medium text-gray-900 dark:text-gray-100 hover:underline">
              {activity.walletLabel || shortAddr(activity.walletAddress)}
            </Link>
            <span className={cn("font-semibold mx-1", isBuy ? "text-green-500" : "text-red-500")}>
              {activity.action}
            </span>
            <span>{formatNumber(activity.amount ?? 0)}</span>
            <Link href={tokenHref(activity.chain, activity.tokenAddress || "")} className="font-medium text-gray-900 dark:text-gray-100 hover:underline ml-1">
              ${activity.tokenSymbol}
            </Link>
          </p>
          <p className="text-gray-400 dark:text-gray-500">{timeAgo(activity.timestamp)}</p>
        </div>
        
        <div className="flex items-center justify-between text-xs mt-1">
          <p className="text-gray-500 dark:text-gray-400">
            {formatUsd(activity.usdValue)}
            {activity.priceUsd && <span className="text-gray-400"> · Entry: {formatUsd(activity.priceUsd)}</span>}
            {activity.realizedPnl != null && (
              <span className={pnlColor}>
                {" · PnL: "}
                {formatProfit(activity.realizedPnl)}
                {activity.realizedPnlPercent != null && ` (${(activity.realizedPnlPercent * 100).toFixed(1)}%)`}
              </span>
            )}
          </p>
          <div className="flex items-center space-x-2 text-gray-400 dark:text-gray-500">
            <a href={explorerUrl(activity.chain, activity.txHash)} target="_blank" rel="noopener noreferrer" className="hover:text-blue-500">Tx</a>
            <Link href={walletHref(activity.chain, activity.walletAddress)} className="hover:text-blue-500">Wallet</Link>
            <Link href={tokenHref(activity.chain, activity.tokenAddress || "")} className="hover:text-blue-500">Token</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LiveFeed() {
  const _router = useRouter();
  const _pathname = usePathname();
  const searchParams = useSearchParams();
  const chain = searchParams.get("chain");

  const [activities, setActivities] = useState<SmartMoneyActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [autoRefresh, _setAutoRefresh] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const pendingRef = useRef<SmartMoneyActivity[]>([]);

  function buildQuery(extra: Record<string, string> = {}) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("limit", "50");
    Object.entries(extra).forEach(([k, v]) => params.set(k, v));
    return params.toString();
  }

  // Initial load + filter changes
  useEffect(() => {
    setLoading(true);
    setCursor(null);
    setNewCount(0);
    pendingRef.current = [];
    fetch(`/api/smart-money/feed?${buildQuery()}`)
      .then((r) => r.json())
      .then((data) => {
        setActivities(data.activities || []);
        setCursor(data.nextCursor);
        setHasMore(!!data.nextCursor);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Feed fetch error:", err);
        setLoading(false);
      });
  }, [chain, searchParams.get("type"), searchParams.get("minValue")]);

  // Auto-refresh timer
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetch(`/api/smart-money/feed?${buildQuery()}`)
        .then((r) => r.json())
        .then((data) => {
          const fresh: SmartMoneyActivity[] = data.activities || [];
          if (fresh.length === 0) return;
          setActivities((current) => {
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
  }, [autoRefresh, chain, searchParams.get("type"), searchParams.get("minValue")]);

  function applyPending() {
    setActivities(pendingRef.current);
    pendingRef.current = [];
    setNewCount(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    fetch(`/api/smart-money/feed?${buildQuery({ cursor })}`)
      .then((r) => r.json())
      .then((data) => {
        setActivities((prev) => [...prev, ...(data.activities || [])]);
        setCursor(data.nextCursor);
        setHasMore(!!data.nextCursor);
        setLoading(false);
      })
      .catch(console.error);
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center">
          <span className="relative flex h-3 w-3 mr-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          Live Feed
        </h2>
        {/* Placeholder for filter button */}
      </div>

      {newCount > 0 && (
        <button
          onClick={applyPending}
          className="w-full text-center py-2 bg-blue-500 text-white font-semibold hover:bg-blue-600 transition-colors"
        >
          Show {newCount} new activities
        </button>
      )}

      <div>
        {activities.map((activity) => (
          <FeedItem key={activity.id} activity={activity} />
        ))}
      </div>
      
      {loading && <div className="text-center p-4">Loading...</div>}
      
      {!loading && activities.length === 0 && (
        <div className="text-center p-8 text-gray-500">No activities found for the selected filters.</div>
      )}

      {hasMore && !loading && (
        <div className="p-4">
          <button
            onClick={loadMore}
            className="w-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold py-2 px-4 rounded"
          >
            Load More
          </button>
        </div>
      )}
    </div>
  );
}
