"use client";

import { useState, useMemo } from "react";
import type { WalletToken } from "@/lib/wallet-aggregator";
import { formatUsd } from "@/lib/format";


type SortField = "value" | "change" | "name";

interface Props {
  holdings: WalletToken[];
  loading?: boolean;
}

function TokenSkeleton() {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-zinc-800" />
        <div>
          <div className="w-16 h-3 bg-zinc-800 rounded mb-1" />
          <div className="w-24 h-2 bg-zinc-800/60 rounded" />
        </div>
      </div>
      <div className="text-right">
        <div className="w-16 h-3 bg-zinc-800 rounded mb-1" />
        <div className="w-10 h-2 bg-zinc-800/60 rounded ml-auto" />
      </div>
    </div>
  );
}

export default function HoldingsTab({ holdings, loading }: Props) {
  const [sort, setSort] = useState<SortField>("value");
  const [hideSmall, setHideSmall] = useState(false);
  const [onlyProfitable, setOnlyProfitable] = useState(false);

  const sorted = useMemo(() => {
    let list = [...holdings];
    if (hideSmall) list = list.filter((t) => t.valueUsd >= 10);
    if (onlyProfitable) list = list.filter((t) => (t.change24h ?? 0) > 0);
    list.sort((a, b) => {
      if (sort === "value") return b.valueUsd - a.valueUsd;
      if (sort === "change") return (b.change24h ?? 0) - (a.change24h ?? 0);
      if (sort === "name") return a.symbol.localeCompare(b.symbol);
      return 0;
    });
    return list;
  }, [holdings, sort, hideSmall, onlyProfitable]);

  const totalValue = holdings.reduce((s, t) => s + t.valueUsd, 0);

  if (loading) {
    return (
      <div className="divide-y divide-border/30">
        {Array.from({ length: 8 }).map((_, i) => <TokenSkeleton key={i} />)}
      </div>
    );
  }

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex gap-1">
          {(["value", "change", "name"] as SortField[]).map((f) => (
            <button
              key={f}
              onClick={() => setSort(f)}
              className={`px-2.5 py-1 rounded text-xs capitalize transition-colors ${sort === f ? "bg-accent/20 text-accent border border-accent/30" : "bg-zinc-800/60 text-zinc-500 hover:text-white border border-transparent"}`}
            >
              {f === "value" ? "By Value" : f === "change" ? "24h Change" : "A–Z"}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-zinc-500 cursor-pointer select-none">
          <input type="checkbox" checked={hideSmall} onChange={e => setHideSmall(e.target.checked)} className="accent-accent" />
          Hide &lt;$10
        </label>
        <label className="flex items-center gap-1.5 text-xs text-zinc-500 cursor-pointer select-none">
          <input type="checkbox" checked={onlyProfitable} onChange={e => setOnlyProfitable(e.target.checked)} className="accent-accent" />
          Only profitable
        </label>
        <span className="ml-auto text-xs text-zinc-500">
          {sorted.length} tokens · <span className="text-white">{formatUsd(totalValue)}</span> total
        </span>
      </div>

      {sorted.length === 0 ? (
        <p className="text-zinc-600 text-sm py-6 text-center">No holdings found.</p>
      ) : (
        <div className="divide-y divide-border/30">
          {sorted.map((token) => (
            <div key={token.address} className="flex items-center justify-between py-2.5 hover:bg-white/[0.02] transition-colors -mx-2 px-2 rounded">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-zinc-800 flex items-center justify-center">
                  {token.logo ? (
                    <img src={token.logo} alt={token.symbol} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <span className="text-zinc-600 text-[10px] font-bold">{token.symbol.slice(0, 2)}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-white text-sm font-semibold truncate">{token.symbol}</div>
                  <div className="text-zinc-600 text-xs truncate">{token.name}</div>
                </div>
              </div>

              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="text-right hidden sm:block">
                  <div className="text-zinc-500 text-xs">{token.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
                  <div className="text-zinc-600 text-[10px]">{token.portfolioPercent.toFixed(1)}%</div>
                </div>
                <div className="text-right">
                  <div className="text-white text-sm tabular-nums">{formatUsd(token.valueUsd)}</div>
                  {token.change24h != null && (
                    <div className={`text-[11px] tabular-nums ${token.change24h >= 0 ? "text-buy" : "text-sell"}`}>
                      {token.change24h >= 0 ? "+" : ""}{token.change24h.toFixed(1)}%
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
