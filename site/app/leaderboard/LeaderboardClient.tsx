"use client";

import { Suspense, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import type { KolEntry, SortField, SortDir, Timeframe } from "@/lib/types";
import ExportButton from "../components/ExportButton";

function formatProfit(v: number): string {
  const abs = Math.abs(v);
  const str = abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : abs.toFixed(2);
  return `${v >= 0 ? "+" : "-"}${str}`;
}

function WinRate({ wins, losses }: { wins: number; losses: number }) {
  const total = wins + losses;
  if (total === 0) return <span className="text-zinc-600">—</span>;
  const pct = (wins / total) * 100;
  return <span className={pct >= 50 ? "text-buy" : "text-sell"}>{pct.toFixed(1)}%</span>;
}

function SortIcon({ field, current, dir }: { field: string; current: string; dir: SortDir }) {
  if (field !== current) return <span className="text-zinc-700 ml-1 text-[10px]">↕</span>;
  return <span className="text-buy ml-1 text-[10px]">{dir === "desc" ? "↓" : "↑"}</span>;
}

function truncate(addr: string) {
  return addr.slice(0, 4) + "..." + addr.slice(-4);
}

function LeaderboardInner({
  data,
  defaultSort,
  defaultDir,
  title,
  subtitle,
}: {
  data: KolEntry[];
  defaultSort: SortField;
  defaultDir: SortDir;
  title: string;
  subtitle?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const timeframe = (Number(searchParams.get("tf")) as Timeframe) || 1;
  const sortField = (searchParams.get("sort") as SortField) || defaultSort;
  const sortDir = (searchParams.get("dir") as SortDir) || defaultDir;
  const search = searchParams.get("q") || "";

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value != null && value !== "") params.set(key, value);
    else params.delete(key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function toggleSort(field: SortField) {
    const params = new URLSearchParams(searchParams.toString());
    if (sortField === field) {
      params.set("dir", sortDir === "desc" ? "asc" : "desc");
    } else {
      params.set("sort", field);
      params.set("dir", "desc");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const filtered = useMemo(() => {
    let entries = data.filter((e) => e.timeframe === timeframe);
    if (search) {
      const q = search.toLowerCase();
      entries = entries.filter(
        (e) => e.name.toLowerCase().includes(q) || e.wallet_address.toLowerCase().includes(q)
      );
    }
    return [...entries].sort((a, b) => {
      if (sortField === "name") {
        return sortDir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      }
      let av: number, bv: number;
      if (sortField === "winrate") {
        const at = a.wins + a.losses;
        const bt = b.wins + b.losses;
        av = at === 0 ? -1 : a.wins / at;
        bv = bt === 0 ? -1 : b.wins / bt;
      } else {
        av = a[sortField] as number;
        bv = b[sortField] as number;
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [data, timeframe, sortField, sortDir, search]);

  const timeframes: { label: string; value: Timeframe }[] = [
    { label: "Daily", value: 1 },
    { label: "Weekly", value: 7 },
    { label: "Monthly", value: 30 },
  ];

  const thClass =
    "px-4 py-2 text-left font-mono text-zinc-600 cursor-pointer hover:text-zinc-300 select-none whitespace-nowrap text-[10px] uppercase tracking-wider transition-colors";

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{title}</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {subtitle ||
              `${filtered.length} ${filtered.length === 1 ? "entry" : "entries"} · sorted by ${sortField}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
              onChange={(e) => setParam("q", e.target.value)}
              placeholder="Search..."
              className="bg-bg-card border border-border rounded pl-8 pr-3 py-1 text-xs text-white font-mono placeholder:text-zinc-700 outline-none focus:border-zinc-600 w-full sm:w-40 transition-all"
            />
          </div>
          <ExportButton
            wallets={filtered.map((e) => ({
              wallet_address: e.wallet_address,
              name: e.name,
              chain: "sol" as const,
            }))}
            filename="kolquest-kolscan-wallets"
          />
        </div>
      </div>

      <div className="bg-bg-card rounded border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left font-mono text-zinc-600 text-[10px] uppercase tracking-wider w-12">
                  #
                </th>
                <th className={thClass} onClick={() => toggleSort("name")}>
                  Name <SortIcon field="name" current={sortField} dir={sortDir} />
                </th>
                <th className="px-4 py-2 text-left font-mono text-zinc-600 text-[10px] uppercase tracking-wider">
                  Wallet
                </th>
                <th className={thClass} onClick={() => toggleSort("profit")}>
                  Profit <SortIcon field="profit" current={sortField} dir={sortDir} />
                </th>
                <th className={thClass} onClick={() => toggleSort("wins")}>
                  W <SortIcon field="wins" current={sortField} dir={sortDir} />
                </th>
                <th className={thClass} onClick={() => toggleSort("losses")}>
                  L <SortIcon field="losses" current={sortField} dir={sortDir} />
                </th>
                <th className={thClass} onClick={() => toggleSort("winrate")}>
                  Win% <SortIcon field="winrate" current={sortField} dir={sortDir} />
                </th>
                <th className="px-4 py-2 text-left font-mono text-zinc-600 text-[10px] uppercase tracking-wider">
                  Links
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry, i) => (
                <tr
                  key={`${entry.wallet_address}-${entry.timeframe}`}
                  className="border-b border-zinc-900 last:border-b-0 hover:bg-bg-hover/30 transition-colors group"
                >
                  <td className="px-4 py-2 text-zinc-700 text-[11px] font-mono tabular-nums">{i + 1}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      {entry.avatar ? (
                        <img
                          src={entry.avatar}
                          alt=""
                          className="w-6 h-6 rounded-full flex-shrink-0"
                          loading="lazy"
                          onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }}
                        />
                      ) : null}
                      <div className={`w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-mono font-bold text-zinc-400 flex-shrink-0 ${entry.avatar ? 'hidden' : ''}`}>
                        {entry.name.charAt(0).toUpperCase()}
                      </div>
                      <Link
                        href={`/wallet/${entry.wallet_address}`}
                        className="text-white text-sm font-medium hover:text-buy transition-colors"
                      >
                        {entry.name}
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <a
                      href={`https://solscan.io/account/${entry.wallet_address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-zinc-500 hover:text-buy transition-colors"
                      title={entry.wallet_address}
                    >
                      {truncate(entry.wallet_address)}
                    </a>
                  </td>
                  <td
                    className={`px-4 py-2 text-xs font-semibold tabular-nums font-mono ${
                      entry.profit > 0 ? "text-buy" : entry.profit < 0 ? "text-sell" : "text-zinc-600"
                    }`}
                  >
                    {formatProfit(entry.profit)}
                  </td>
                  <td className="px-4 py-2 text-xs text-buy tabular-nums">{entry.wins}</td>
                  <td className="px-4 py-2 text-xs text-sell tabular-nums">{entry.losses}</td>
                  <td className="px-4 py-2 text-xs tabular-nums">
                    <WinRate wins={entry.wins} losses={entry.losses} />
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <div className="flex gap-2.5 opacity-40 group-hover:opacity-100 transition-opacity">
                      {entry.twitter && (
                        <a
                          href={entry.twitter}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-zinc-400 hover:text-white transition-colors text-xs"
                          title="Twitter/X"
                        >
                          𝕏
                        </a>
                      )}
                      {entry.telegram && (
                        <a
                          href={entry.telegram}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-zinc-600 hover:text-accent transition-colors text-xs"
                          title="Telegram"
                        >
                          ✈
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-zinc-600 text-sm">
                    No entries found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function LeaderboardClient({
  data,
  defaultSort = "profit",
  defaultDir = "desc",
  title = "KOL Leaderboard",
  subtitle,
}: {
  data: KolEntry[];
  defaultSort?: SortField;
  defaultDir?: SortDir;
  title?: string;
  subtitle?: string;
}) {
  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="h-16 w-64 bg-zinc-900 rounded animate-pulse mb-8" />
          <div className="h-96 bg-bg-card rounded border border-border animate-pulse" />
        </div>
      }
    >
      <LeaderboardInner
        data={data}
        defaultSort={defaultSort}
        defaultDir={defaultDir}
        title={title}
        subtitle={subtitle}
      />
    </Suspense>
  );
}
