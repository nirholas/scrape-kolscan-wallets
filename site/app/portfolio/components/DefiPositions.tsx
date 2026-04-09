"use client";

import type { DefiPosition, Chain } from "@/lib/portfolio-aggregator";
import { formatUsd } from "@/lib/format";

const CHAIN_LABELS: Record<Chain, string> = {
  solana: "Solana",
  ethereum: "ETH",
  bsc: "BNB",
  polygon: "Polygon",
  arbitrum: "Arbitrum",
  base: "Base",
  optimism: "Optimism",
  avalanche: "AVAX",
};

const TYPE_LABELS: Record<DefiPosition["type"], string> = {
  lending: "Lending",
  liquidity: "LP",
  staking: "Staking",
  farming: "Farming",
  other: "Other",
};

const TYPE_COLORS: Record<DefiPosition["type"], string> = {
  lending: "text-blue-400 bg-blue-400/10",
  liquidity: "text-purple-400 bg-purple-400/10",
  staking: "text-green-400 bg-green-400/10",
  farming: "text-orange-400 bg-orange-400/10",
  other: "text-zinc-400 bg-zinc-400/10",
};

function HealthBar({ factor }: { factor: number }) {
  const pct = Math.min((factor / 3) * 100, 100);
  const color = factor >= 2 ? "bg-buy" : factor >= 1.3 ? "bg-amber-400" : "bg-sell";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1.5 bg-bg-hover rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-mono ${factor >= 2 ? "text-buy" : factor >= 1.3 ? "text-amber-400" : "text-sell"}`}>
        {factor.toFixed(2)}
      </span>
    </div>
  );
}

interface Props {
  positions: DefiPosition[];
  loading?: boolean;
}

export default function DefiPositions({ positions, loading = false }: Props) {
  if (loading) {
    return (
      <div className="bg-bg-card border border-border rounded-lg p-8 text-center text-zinc-600 text-sm animate-pulse">
        Loading DeFi positions...
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="bg-bg-card border border-border rounded-lg p-8 text-center text-zinc-600 text-sm">
        No DeFi positions found.{" "}
        <span className="text-zinc-700">
          (Requires DEBANK_API_KEY — EVM wallets only)
        </span>
      </div>
    );
  }

  const totalValue = positions.reduce((s, p) => s + p.valueUsd, 0);
  const totalRewards = positions.reduce((s, p) => s + p.rewards, 0);

  return (
    <div className="bg-bg-card border border-border rounded-lg overflow-hidden">
      {/* Header stats */}
      <div className="p-4 border-b border-border flex gap-6">
        <div>
          <div className="text-xs text-zinc-500 font-mono uppercase">Total DeFi Value</div>
          <div className="text-lg font-bold text-white font-mono">{formatUsd(totalValue)}</div>
        </div>
        {totalRewards > 0.01 && (
          <div>
            <div className="text-xs text-zinc-500 font-mono uppercase">Claimable Rewards</div>
            <div className="text-lg font-bold text-buy font-mono">+{formatUsd(totalRewards)}</div>
          </div>
        )}
        <div className="ml-auto self-center text-xs text-zinc-600">
          {positions.length} position{positions.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-border">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-mono uppercase tracking-wider text-zinc-500">
                Protocol
              </th>
              <th className="px-3 py-2 text-left text-xs font-mono uppercase tracking-wider text-zinc-500">
                Chain
              </th>
              <th className="px-3 py-2 text-left text-xs font-mono uppercase tracking-wider text-zinc-500">
                Type
              </th>
              <th className="px-3 py-2 text-left text-xs font-mono uppercase tracking-wider text-zinc-500">
                Pool
              </th>
              <th className="px-3 py-2 text-left text-xs font-mono uppercase tracking-wider text-zinc-500">
                Value
              </th>
              <th className="px-3 py-2 text-left text-xs font-mono uppercase tracking-wider text-zinc-500">
                Rewards
              </th>
              <th className="px-3 py-2 text-left text-xs font-mono uppercase tracking-wider text-zinc-500">
                Health
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {positions.map((pos, idx) => (
              <tr key={idx} className="hover:bg-bg-hover/50 transition-colors">
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    {pos.protocolLogo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={pos.protocolLogo}
                        alt={pos.protocol}
                        className="w-5 h-5 rounded bg-bg-hover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-5 h-5 rounded bg-bg-hover" />
                    )}
                    <span className="text-xs font-medium text-white">{pos.protocol}</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-xs text-zinc-400">
                  {CHAIN_LABELS[pos.chain] ?? pos.chain}
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`text-[11px] px-1.5 py-0.5 rounded font-mono ${
                      TYPE_COLORS[pos.type]
                    }`}
                  >
                    {TYPE_LABELS[pos.type]}
                  </span>
                </td>
                <td className="px-3 py-3 text-xs text-zinc-400 max-w-[160px] truncate">
                  {pos.poolName}
                </td>
                <td className="px-3 py-3 text-xs text-white font-mono font-medium">
                  {formatUsd(pos.valueUsd)}
                </td>
                <td className="px-3 py-3 text-xs font-mono">
                  {pos.rewards > 0.01 ? (
                    <span className="text-buy">+{formatUsd(pos.rewards)}</span>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  {pos.healthFactor != null ? (
                    <HealthBar factor={pos.healthFactor} />
                  ) : (
                    <span className="text-xs text-zinc-600">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
