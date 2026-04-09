"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { KolEntry } from "@/lib/types";
import { truncateAddr } from "@/lib/format";

export default function CalendarGrid({ data }: { data: KolEntry[] }) {
  const [search, setSearch] = useState("");

  const wallets = useMemo(() => {
    const map = new Map<string, { name: string; address: string; entries: KolEntry[] }>();
    for (const e of data) {
      if (!map.has(e.wallet_address)) {
        map.set(e.wallet_address, { name: e.name, address: e.wallet_address, entries: [] });
      }
      map.get(e.wallet_address)!.entries.push(e);
    }
    let list = Array.from(map.values());
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (w) => w.name.toLowerCase().includes(q) || w.address.toLowerCase().includes(q)
      );
    }
    // Sort by daily profit descending
    list.sort((a, b) => {
      const ap = a.entries.find((e) => e.timeframe === 1)?.profit || 0;
      const bp = b.entries.find((e) => e.timeframe === 1)?.profit || 0;
      return bp - ap;
    });
    return list;
  }, [data, search]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">PnL Calendar</h1>
          <p className="text-zinc-500 text-sm mt-1">{wallets.length} wallets</p>
        </div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search wallets..."
            className="bg-bg-card border border-border rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-buy/40 focus:ring-1 focus:ring-buy/20 w-52 transition-all"
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {wallets.slice(0, 60).map((w) => {
          const d1 = w.entries.find((e) => e.timeframe === 1);
          const d7 = w.entries.find((e) => e.timeframe === 7);
          const d30 = w.entries.find((e) => e.timeframe === 30);
          const totalProfit = w.entries.reduce((s, e) => s + e.profit, 0);

          return (
            <Link
              key={w.address}
              href={`/wallet/${w.address}`}
              className="bg-bg-card rounded-2xl border border-border shadow-card p-4 hover:border-buy/30 transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-white font-semibold text-sm group-hover:text-buy transition-colors">{w.name}</span>
                <span className="font-mono text-[10px] text-zinc-600">{truncateAddr(w.address)}</span>
              </div>

              {/* Mini PnL bars */}
              <div className="space-y-1.5 mb-3">
                {[
                  { label: "1D", entry: d1 },
                  { label: "7D", entry: d7 },
                  { label: "30D", entry: d30 },
                ].map(({ label, entry }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-600 w-6">{label}</span>
                    <div className="flex-1 h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                      {entry && (
                        <div
                          className={`h-full rounded-full ${entry.profit >= 0 ? "bg-buy/60" : "bg-sell/60"}`}
                          style={{ width: `${Math.min(Math.abs(entry.profit) * 10, 100)}%` }}
                        />
                      )}
                    </div>
                    <span className={`text-[10px] font-medium tabular-nums w-16 text-right ${
                      entry ? (entry.profit > 0 ? "text-buy" : entry.profit < 0 ? "text-sell" : "text-zinc-600") : "text-zinc-700"
                    }`}>
                      {entry ? `${entry.profit > 0 ? "+" : ""}${entry.profit.toFixed(2)}` : "—"}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <span className="text-[10px] text-zinc-600">Total</span>
                <span className={`text-xs font-bold tabular-nums ${
                  totalProfit > 0 ? "text-buy" : totalProfit < 0 ? "text-sell" : "text-zinc-600"
                }`}>
                  {totalProfit > 0 ? "+" : ""}{totalProfit.toFixed(2)} SOL
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {wallets.length > 60 && (
        <p className="text-center text-zinc-600 text-sm mt-8">
          Showing top 60 of {wallets.length} wallets
        </p>
      )}
    </div>
  );
}
