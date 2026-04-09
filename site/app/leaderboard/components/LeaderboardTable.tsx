"use client";

import Link from "next/link";
import { AvatarFallback } from "@/app/components/FallbackImg";
import CopyButton from "@/app/components/CopyButton";
import { formatProfit, formatNumber, timeAgo, truncateAddr } from "@/lib/format";
import type { LeaderboardEntry, LeaderboardQuery, LeaderboardResponse } from "@/lib/types";

// --- Sub-components ---

function RankChange({ change }: { change?: number }) {
  if (change == null || change === 0) return <span className="text-zinc-700">—</span>;
  if (change > 0)
    return <span className="text-buy text-[10px]">+{change}↑</span>;
  return <span className="text-sell text-[10px]">{change}↓</span>;
}

function SourceBadges({ sources }: { sources: string[] }) {
  const badges: Record<string, string> = {
    kolscan: "KS",
    gmgn: "GM",
    dune: "DU",
    flipside: "FL",
  };
  return (
    <div className="flex gap-1">
      {sources.map((s) => (
        <span
          key={s}
          title={s}
          className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-zinc-800 text-zinc-400 border border-zinc-700 uppercase tracking-wide"
        >
          {badges[s] ?? s.slice(0, 2).toUpperCase()}
        </span>
      ))}
    </div>
  );
}

function CategoryBadges({ categories }: { categories: string[] }) {
  const colorMap: Record<string, string> = {
    kol: "text-purple-400 border-purple-800 bg-purple-900/20",
    smart_degen: "text-blue-400 border-blue-800 bg-blue-900/20",
    whale: "text-yellow-400 border-yellow-800 bg-yellow-900/20",
    sniper: "text-red-400 border-red-800 bg-red-900/20",
    snipe_bot: "text-red-400 border-red-800 bg-red-900/20",
    meme: "text-pink-400 border-pink-800 bg-pink-900/20",
  };
  const shown = categories.slice(0, 3);
  return (
    <div className="flex gap-1">
      {shown.map((c) => (
        <span
          key={c}
          className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${
            colorMap[c] ?? "text-zinc-400 border-zinc-700 bg-zinc-800"
          }`}
        >
          {c.replace(/_/g, " ")}
        </span>
      ))}
    </div>
  );
}

function WinRatePill({ rate }: { rate: number }) {
  const pct = (rate * 100).toFixed(1);
  return (
    <span className={rate >= 0.5 ? "text-buy" : "text-sell"}>
      {pct}%
    </span>
  );
}

// --- Sort header ---

type SortKey = NonNullable<LeaderboardQuery["sort"]>;

function SortTh({
  label,
  field,
  sort,
  order,
  onSort,
  className,
}: {
  label: string;
  field: SortKey;
  sort: SortKey;
  order: "asc" | "desc";
  onSort: (f: SortKey) => void;
  className?: string;
}) {
  const active = sort === field;
  return (
    <th
      onClick={() => onSort(field)}
      className={`px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider cursor-pointer select-none whitespace-nowrap transition-colors ${
        active ? "text-white" : "text-zinc-600 hover:text-zinc-300"
      } ${className ?? ""}`}
    >
      {label}
      {active ? (
        <span className="ml-1 text-buy">{order === "desc" ? "↓" : "↑"}</span>
      ) : (
        <span className="ml-1 text-zinc-700">↕</span>
      )}
    </th>
  );
}

// --- Main table ---

export interface LeaderboardTableProps {
  response: LeaderboardResponse;
  sort: SortKey;
  order: "asc" | "desc";
  page: number;
  onSort: (field: SortKey) => void;
  onPage: (page: number) => void;
}

export default function LeaderboardTable({
  response,
  sort,
  order,
  page,
  onSort,
  onPage,
}: LeaderboardTableProps) {
  const { entries, pagination } = response;

  const thBase =
    "px-4 py-2.5 text-left font-mono text-zinc-600 text-[10px] uppercase tracking-wider whitespace-nowrap";

  return (
    <div className="space-y-3">
      <div className="bg-bg-card rounded border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-border">
                <th className={`${thBase} w-10`}>#</th>
                <th className={thBase}>Wallet</th>
                <th className={thBase}>Twitter</th>
                <SortTh
                  label="7d PnL"
                  field="pnl"
                  sort={sort}
                  order={order}
                  onSort={onSort}
                />
                <SortTh
                  label="Win%"
                  field="winrate"
                  sort={sort}
                  order={order}
                  onSort={onSort}
                />
                <SortTh
                  label="Trades"
                  field="trades"
                  sort={sort}
                  order={order}
                  onSort={onSort}
                />
                <th className={thBase}>Last Active</th>
                <th className={thBase}>Tags</th>
                <th className={thBase}>Sources</th>
                <SortTh
                  label="Score"
                  field="composite"
                  sort={sort}
                  order={order}
                  onSort={onSort}
                  className="text-right"
                />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <EntryRow
                  key={`${entry.chain}:${entry.address}`}
                  entry={entry}
                  rank={(page - 1) * pagination.limit + i + 1}
                />
              ))}
              {entries.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-16 text-center text-zinc-600 text-sm"
                  >
                    No entries found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>
            {pagination.total.toLocaleString()} entries · page {page} of{" "}
            {pagination.totalPages}
          </span>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => onPage(page - 1)}
              className="px-3 py-1 rounded bg-bg-card border border-border hover:border-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ← Prev
            </button>
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, idx) => {
              const p = Math.max(1, Math.min(page - 2, pagination.totalPages - 4)) + idx;
              return (
                <button
                  key={p}
                  onClick={() => onPage(p)}
                  className={`px-3 py-1 rounded border transition-colors ${
                    p === page
                      ? "bg-zinc-800 border-zinc-600 text-white"
                      : "bg-bg-card border-border hover:border-zinc-600"
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              disabled={page >= pagination.totalPages}
              onClick={() => onPage(page + 1)}
              className="px-3 py-1 rounded bg-bg-card border border-border hover:border-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EntryRow({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const walletHref = `/wallet/${entry.address}`;

  return (
    <tr className="border-b border-zinc-900 last:border-b-0 hover:bg-bg-hover/30 transition-colors group">
      {/* Rank */}
      <td className="px-4 py-2.5 text-zinc-700 text-[11px] font-mono tabular-nums">
        <div className="flex flex-col items-start gap-0.5">
          <span>{rank}</span>
          <RankChange change={entry.rankChange} />
        </div>
      </td>

      {/* Wallet */}
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <AvatarFallback
            src={entry.avatar}
            seed={entry.address}
            label={entry.name}
            size="w-7 h-7"
            textSize="text-[10px]"
          />
          <div className="min-w-0">
            <Link
              href={walletHref}
              className="block text-white text-sm font-medium hover:text-buy transition-colors truncate max-w-[160px]"
            >
              {entry.ensOrSns ?? entry.name}
            </Link>
            <div className="flex items-center gap-1.5">
              <a
                href={
                  entry.chain === "solana"
                    ? `https://solscan.io/account/${entry.address}`
                    : `https://bscscan.com/address/${entry.address}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[11px] text-zinc-600 hover:text-buy transition-colors"
                title={entry.address}
              >
                {truncateAddr(entry.address)}
              </a>
              <CopyButton
                text={entry.address}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-white text-xs leading-none"
              />
              <span
                className={`text-[9px] px-1 py-0.5 rounded border font-mono uppercase ${
                  entry.chain === "solana"
                    ? "text-purple-400 border-purple-800 bg-purple-900/10"
                    : entry.chain === "bsc"
                    ? "text-yellow-400 border-yellow-800 bg-yellow-900/10"
                    : "text-blue-400 border-blue-800 bg-blue-900/10"
                }`}
              >
                {entry.chain === "solana" ? "SOL" : entry.chain.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </td>

      {/* Twitter */}
      <td className="px-4 py-2.5">
        {entry.twitter ? (
          <a
            href={`https://x.com/${entry.twitter.username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 group/tw"
          >
            {entry.twitter.avatar && (
              <img
                src={entry.twitter.avatar}
                alt=""
                className="w-5 h-5 rounded-full"
                onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
              />
            )}
            <span className="text-zinc-400 text-xs group-hover/tw:text-white transition-colors truncate max-w-[100px]">
              @{entry.twitter.username}
            </span>
          </a>
        ) : (
          <span className="text-zinc-700 text-xs">—</span>
        )}
      </td>

      {/* PnL */}
      <td
        className={`px-4 py-2.5 text-xs font-semibold tabular-nums font-mono ${
          entry.totalPnl > 0
            ? "text-buy"
            : entry.totalPnl < 0
            ? "text-sell"
            : "text-zinc-600"
        }`}
      >
        {entry.totalPnl !== 0 ? formatProfit(entry.totalPnl) : "—"}
      </td>

      {/* Win rate */}
      <td className="px-4 py-2.5 text-xs tabular-nums">
        {entry.avgWinRate > 0 ? (
          <WinRatePill rate={entry.avgWinRate} />
        ) : (
          <span className="text-zinc-600">—</span>
        )}
      </td>

      {/* Trades */}
      <td className="px-4 py-2.5 text-xs text-zinc-400 tabular-nums">
        {entry.totalTrades > 0 ? formatNumber(entry.totalTrades) : "—"}
      </td>

      {/* Last Active */}
      <td className="px-4 py-2.5 text-xs text-zinc-500 whitespace-nowrap">
        {entry.lastActive ? timeAgo(entry.lastActive) : "—"}
      </td>

      {/* Tags */}
      <td className="px-4 py-2.5">
        <CategoryBadges categories={entry.categories} />
      </td>

      {/* Sources */}
      <td className="px-4 py-2.5">
        <SourceBadges sources={entry.verifiedSources} />
      </td>

      {/* Composite score */}
      <td className="px-4 py-2.5 text-right">
        <span
          className={`text-xs font-mono tabular-nums ${
            entry.compositeScore >= 70
              ? "text-buy"
              : entry.compositeScore >= 40
              ? "text-zinc-300"
              : "text-zinc-600"
          }`}
        >
          {entry.compositeScore.toFixed(1)}
        </span>
      </td>
    </tr>
  );
}
