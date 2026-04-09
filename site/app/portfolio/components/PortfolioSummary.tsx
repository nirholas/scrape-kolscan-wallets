"use client";

import type { PortfolioSummary, Chain, AssetCategory } from "@/lib/portfolio-aggregator";
import { formatUsd } from "@/lib/format";

const CHAIN_LABELS: Record<Chain, string> = {
  solana: "Solana",
  ethereum: "Ethereum",
  bsc: "BNB Chain",
  polygon: "Polygon",
  arbitrum: "Arbitrum",
  base: "Base",
  optimism: "Optimism",
  avalanche: "Avalanche",
};

const CHAIN_COLORS: Record<Chain, string> = {
  solana: "#9945FF",
  ethereum: "#627EEA",
  bsc: "#F0B90B",
  polygon: "#8247E5",
  arbitrum: "#12AAFF",
  base: "#0052FF",
  optimism: "#FF0420",
  avalanche: "#E84142",
};

const CATEGORY_LABELS: Record<AssetCategory, string> = {
  native: "Native",
  stablecoin: "Stablecoins",
  defi: "DeFi",
  meme: "Meme",
  lp: "LP Positions",
  staked: "Staked",
  other: "Other",
};

const CATEGORY_COLORS: Record<AssetCategory, string> = {
  native: "#4ade80",
  stablecoin: "#22d3ee",
  defi: "#a78bfa",
  meme: "#f97316",
  lp: "#fb923c",
  staked: "#60a5fa",
  other: "#6b7280",
};

function BarRow({
  label,
  value,
  percent,
  color,
}: {
  label: string;
  value: number;
  percent: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 text-xs text-zinc-400 text-right shrink-0">{label}</div>
      <div className="flex-1 h-3 bg-bg-hover rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.max(percent, 0.5)}%`, backgroundColor: color }}
        />
      </div>
      <div className="w-20 text-xs text-zinc-300 shrink-0">{formatUsd(value)}</div>
      <div className="w-12 text-xs text-zinc-500 text-right shrink-0">{percent.toFixed(1)}%</div>
    </div>
  );
}

interface Props {
  summary: PortfolioSummary;
  address: string;
}

export default function PortfolioSummaryCard({ summary, address }: Props) {
  const isPositive = summary.change24h >= 0;

  return (
    <div className="space-y-4">
      {/* Total value */}
      <div className="bg-bg-card border border-border rounded-lg p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs text-zinc-500 font-mono uppercase tracking-wider mb-1">
              Total Portfolio Value
            </div>
            <div className="text-3xl font-bold text-white font-mono">
              {formatUsd(summary.totalValueUsd)}
            </div>
            <div
              className={`text-sm mt-1 font-mono ${isPositive ? "text-buy" : "text-sell"}`}
            >
              {isPositive ? "+" : ""}
              {formatUsd(summary.change24h)} ({isPositive ? "+" : ""}
              {summary.change24hPercent.toFixed(2)}%) <span className="text-zinc-600">24h</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {summary.sources.length > 0 && (
              <div className="text-xs text-zinc-600 flex items-center gap-1">
                <span>Sources:</span>
                {summary.sources.map((s) => (
                  <span
                    key={s}
                    className="px-1.5 py-0.5 bg-bg-hover rounded text-zinc-400 font-mono"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {summary.warnings.length > 0 && (
          <div className="mt-3 space-y-1">
            {summary.warnings.map((w, i) => (
              <div
                key={i}
                className="text-xs text-amber-500/80 bg-amber-500/10 border border-amber-500/20 rounded px-3 py-1.5"
              >
                ⚠ {w}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chain breakdown */}
      {summary.chainBreakdown.length > 0 && (
        <div className="bg-bg-card border border-border rounded-lg p-5">
          <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-4">
            Chain Breakdown
          </h3>
          <div className="space-y-2.5">
            {summary.chainBreakdown.map(({ chain, valueUsd, percent }) => (
              <BarRow
                key={chain}
                label={CHAIN_LABELS[chain] ?? chain}
                value={valueUsd}
                percent={percent}
                color={CHAIN_COLORS[chain] ?? "#6b7280"}
              />
            ))}
          </div>
        </div>
      )}

      {/* Category breakdown */}
      {summary.categoryBreakdown.length > 0 && (
        <div className="bg-bg-card border border-border rounded-lg p-5">
          <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-4">
            Asset Categories
          </h3>
          <div className="space-y-2.5">
            {summary.categoryBreakdown.map(({ category, valueUsd, percent }) => (
              <BarRow
                key={category}
                label={CATEGORY_LABELS[category] ?? category}
                value={valueUsd}
                percent={percent}
                color={CATEGORY_COLORS[category] ?? "#6b7280"}
              />
            ))}
          </div>
        </div>
      )}

      {summary.totalValueUsd === 0 && summary.warnings.length === 0 && (
        <div className="bg-bg-card border border-border rounded-lg p-8 text-center text-zinc-600 text-sm">
          No portfolio data found for this address.
        </div>
      )}
    </div>
  );
}
