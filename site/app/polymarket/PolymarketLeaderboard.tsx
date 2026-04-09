"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import type { PolymarketTrader, PolymarketMarket } from "@/lib/types";
import ExportButton from "@/app/components/ExportButton";
import ShareButtons from "@/app/components/ShareButtons";
import CopyButton from "@/app/components/CopyButton";
import { AvatarFallback } from "@/app/components/FallbackImg";
import { formatProfit } from "@/lib/format";

type SortField = "rank" | "pnl_total" | "pnl_7d" | "pnl_30d" | "volume_total" | "winrate" | "trades_count" | "markets_traded";
type SortDir = "asc" | "desc";

function SortIcon({ field, current, dir }: { field: string; current: string; dir: SortDir }) {
  if (field !== current) return <span className="text-zinc-700 ml-1 text-[10px]">↕</span>;
  return <span className="text-buy ml-1 text-[10px]">{dir === "desc" ? "↓" : "↑"}</span>;
}

function truncateAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function PolymarketLeaderboardInner({
  traders,
  markets,
}: {
  traders: PolymarketTrader[];
  markets: PolymarketMarket[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sortField = (searchParams.get("sort") as SortField) || "pnl_total";
  const sortDir = (searchParams.get("dir") as SortDir) || "desc";
  const search = searchParams.get("q") || "";
  const [showMarkets, setShowMarkets] = useState(false);

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
    let entries = [...traders];
    if (search) {
      const q = search.toLowerCase();
      entries = entries.filter(
        (t) =>
          (t.username || "").toLowerCase().includes(q) ||
          (t.display_name || "").toLowerCase().includes(q) ||
          t.wallet_address.toLowerCase().includes(q) ||
          (t.twitter_handle || "").toLowerCase().includes(q)
      );
    }
    return entries.sort((a, b) => {
      const av = (a as unknown as Record<string, number>)[sortField] ?? 0;
      const bv = (b as unknown as Record<string, number>)[sortField] ?? 0;
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [traders, search, sortField, sortDir]);

  const topMarkets = useMemo(() => {
    return markets.slice(0, 10);
  }, [markets]);

  return (
    <main className="max-w-7xl mx-auto px-3 py-6 sm:px-6 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-6 mb-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-2xl">🎲</span>
              Polymarket Leaderboard
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              {traders.length} prediction market traders • {markets.length} active markets
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton
              data={filtered}
              filename="polymarket-leaderboard"
              fields={["rank", "wallet_address", "username", "pnl_total", "pnl_7d", "pnl_30d", "volume_total", "winrate", "trades_count"]}
            />
            <ShareButtons title="Polymarket Leaderboard | KolQuest" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setShowMarkets(false)}
            className={`px-4 py-1.5 text-sm rounded-md border transition ${
              !showMarkets
                ? "bg-accent text-black border-accent"
                : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600"
            }`}
          >
            Traders
          </button>
          <button
            onClick={() => setShowMarkets(true)}
            className={`px-4 py-1.5 text-sm rounded-md border transition ${
              showMarkets
                ? "bg-accent text-black border-accent"
                : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600"
            }`}
          >
            Top Markets
          </button>
        </div>

        {/* Search */}
        {!showMarkets && (
          <input
            type="text"
            placeholder="Search by name, address, or Twitter..."
            value={search}
            onChange={(e) => setParam("q", e.target.value || null)}
            className="w-full sm:w-80 px-3 py-2 rounded-md bg-zinc-900 border border-zinc-800 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-accent"
          />
        )}
      </div>

      {showMarkets ? (
        /* Markets View */
        <div className="space-y-3">
          {topMarkets.map((m) => (
            <div key={m.id} className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <h3 className="text-white font-medium mb-1">{m.question}</h3>
                  <div className="flex items-center gap-3 text-sm text-zinc-500">
                    <span className="bg-zinc-800 px-2 py-0.5 rounded text-xs">{m.category}</span>
                    <span>Vol: ${(m.volume / 1e6).toFixed(2)}M</span>
                    <span>OI: ${(m.open_interest / 1e6).toFixed(2)}M</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {m.outcomes.map((outcome, i) => (
                    <div key={i} className="text-center min-w-[60px]">
                      <div className={`text-lg font-bold ${m.outcome_prices[i] > 0.5 ? "text-buy" : "text-white"}`}>
                        {(m.outcome_prices[i] * 100).toFixed(0)}¢
                      </div>
                      <div className="text-xs text-zinc-500">{outcome}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Traders Table */
        <div className="overflow-x-auto bg-zinc-900/50 rounded-lg border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-900 border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
                <th className="text-left py-3 px-4 font-medium cursor-pointer hover:text-white" onClick={() => toggleSort("rank")}>
                  Rank
                  <SortIcon field="rank" current={sortField} dir={sortDir} />
                </th>
                <th className="text-left py-3 px-4 font-medium">Trader</th>
                <th className="text-right py-3 px-4 font-medium cursor-pointer hover:text-white" onClick={() => toggleSort("pnl_total")}>
                  Total PnL
                  <SortIcon field="pnl_total" current={sortField} dir={sortDir} />
                </th>
                <th className="text-right py-3 px-4 font-medium cursor-pointer hover:text-white" onClick={() => toggleSort("pnl_7d")}>
                  7D PnL
                  <SortIcon field="pnl_7d" current={sortField} dir={sortDir} />
                </th>
                <th className="text-right py-3 px-4 font-medium cursor-pointer hover:text-white" onClick={() => toggleSort("pnl_30d")}>
                  30D PnL
                  <SortIcon field="pnl_30d" current={sortField} dir={sortDir} />
                </th>
                <th className="text-right py-3 px-4 font-medium cursor-pointer hover:text-white" onClick={() => toggleSort("volume_total")}>
                  Volume
                  <SortIcon field="volume_total" current={sortField} dir={sortDir} />
                </th>
                <th className="text-right py-3 px-4 font-medium cursor-pointer hover:text-white" onClick={() => toggleSort("winrate")}>
                  Win%
                  <SortIcon field="winrate" current={sortField} dir={sortDir} />
                </th>
                <th className="text-right py-3 px-4 font-medium cursor-pointer hover:text-white" onClick={() => toggleSort("trades_count")}>
                  Trades
                  <SortIcon field="trades_count" current={sortField} dir={sortDir} />
                </th>
                <th className="text-right py-3 px-4 font-medium cursor-pointer hover:text-white" onClick={() => toggleSort("markets_traded")}>
                  Markets
                  <SortIcon field="markets_traded" current={sortField} dir={sortDir} />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filtered.slice(0, 100).map((t, idx) => (
                <tr key={t.wallet_address} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="py-3 px-4 text-zinc-500 font-mono text-xs">{t.rank || idx + 1}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <AvatarFallback
                        src={t.profile_image}
                        name={t.display_name || t.username || t.wallet_address}
                        size={32}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">
                            {t.display_name || t.username || truncateAddr(t.wallet_address)}
                          </span>
                          {t.twitter_handle && (
                            <a
                              href={`https://x.com/${t.twitter_handle}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-zinc-500 hover:text-accent text-xs"
                            >
                              @{t.twitter_handle}
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-zinc-600 text-xs font-mono">{truncateAddr(t.wallet_address)}</span>
                          <CopyButton text={t.wallet_address} size="xs" />
                          <a
                            href={`https://polygonscan.com/address/${t.wallet_address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-zinc-600 hover:text-accent"
                            title="View on PolygonScan"
                          >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                              <path d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z"/>
                              <path d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z"/>
                            </svg>
                          </a>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className={`py-3 px-4 text-right font-mono ${t.pnl_total >= 0 ? "text-buy" : "text-sell"}`}>
                    {formatProfit(t.pnl_total)}
                  </td>
                  <td className={`py-3 px-4 text-right font-mono ${t.pnl_7d >= 0 ? "text-buy" : "text-sell"}`}>
                    {formatProfit(t.pnl_7d)}
                  </td>
                  <td className={`py-3 px-4 text-right font-mono ${t.pnl_30d >= 0 ? "text-buy" : "text-sell"}`}>
                    {formatProfit(t.pnl_30d)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-zinc-400">
                    ${t.volume_total >= 1e6 ? `${(t.volume_total / 1e6).toFixed(2)}M` : t.volume_total >= 1000 ? `${(t.volume_total / 1000).toFixed(1)}K` : t.volume_total.toFixed(0)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-zinc-300">
                    {(t.winrate * 100).toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 text-right text-zinc-400">{t.trades_count.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-zinc-400">{t.markets_traded}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 100 && (
            <div className="text-center py-4 text-zinc-600 text-sm">
              Showing 100 of {filtered.length} traders
            </div>
          )}
        </div>
      )}
    </main>
  );
}

export default function PolymarketLeaderboard({
  traders,
  markets,
}: {
  traders: PolymarketTrader[];
  markets: PolymarketMarket[];
}) {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center text-zinc-600">
          Loading...
        </div>
      }
    >
      <PolymarketLeaderboardInner traders={traders} markets={markets} />
    </Suspense>
  );
}
