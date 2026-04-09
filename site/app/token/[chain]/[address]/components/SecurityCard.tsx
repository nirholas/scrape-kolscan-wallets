"use client";

import { useState, useEffect } from "react";
import { shortAddr } from "@/lib/format";

interface SecurityData {
  mintAuthority: { revoked: boolean; address: string | null };
  freezeAuthority: { revoked: boolean; address: string | null };
  lpBurned?: { burned: boolean; percentage: number | null };
  topHolders: { percentage: number; count: number };
  honeypotRisk: "low" | "medium" | "high" | "unknown";
  tokenStandard: string;
  isToken2022?: boolean;
  buyTax?: number | null;
  sellTax?: number | null;
  isHoneypot?: boolean;
  score: number;
  status: "safe" | "caution" | "danger";
  warnings: string[];
  dangers: string[];
  source: string;
}

const statusMap = {
  safe: {
    label: "Safe",
    icon: "🟢",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
  },
  caution: {
    label: "Caution",
    icon: "🟡",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
  },
  danger: {
    label: "Danger",
    icon: "🔴",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
  },
};

const Check = ({ ok }: { ok: boolean }) => (
  <span className={ok ? "text-green-400" : "text-yellow-400"}>
    {ok ? "✅" : "⚠️"}
  </span>
);

export default function SecurityCard({
  chain,
  address,
}: {
  chain: "sol" | "bsc";
  address: string;
}) {
  const [data, setData] = useState<SecurityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/token/${chain}/${address}/security`)
      .then((r) => r.json())
      .then(({ data }) => {
        setData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [chain, address]);

  if (loading) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-5 h-60 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-5 text-center text-sm text-zinc-500">
        Security analysis not available.
      </div>
    );
  }

  const statusInfo = statusMap[data.status] || statusMap.caution;

  return (
    <div className="bg-bg-card border border-border rounded-xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-medium text-white">Security Analysis</h3>
        <span className="text-xs text-zinc-600">via {data.source}</span>
      </div>

      <div className="p-5">
        <div className="flex items-center gap-3">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl ${statusInfo.bgColor}`}
          >
            {statusInfo.icon}
          </div>
          <div>
            <div className={`text-lg font-bold ${statusInfo.color}`}>{statusInfo.label}</div>
            <div className="text-xs text-zinc-500">Score: {data.score}/100</div>
          </div>
        </div>

        {(data.warnings.length > 0 || data.dangers.length > 0) && (
          <div className="mt-4 space-y-2 text-xs">
            {data.dangers.map((d) => (
              <div key={d} className="flex items-start gap-2 text-red-400">
                <span className="mt-0.5">🔴</span>
                <span>{d}</span>
              </div>
            ))}
            {data.warnings.map((w) => (
              <div key={w} className="flex items-start gap-2 text-yellow-400">
                <span className="mt-0.5">🟡</span>
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2.5 text-xs mt-5 pt-4 border-t border-border">
          <div className="flex justify-between">
            <span className="text-zinc-500">Mint Authority</span>
            <div className="flex items-center gap-2">
              <Check ok={data.mintAuthority.revoked} />
              <span className="font-medium text-white">
                {data.mintAuthority.revoked ? "Revoked" : "Active"}
              </span>
              {data.mintAuthority.address && (
                <span className="text-zinc-600 font-mono">
                  ({shortAddr(data.mintAuthority.address)})
                </span>
              )}
            </div>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Freeze Authority</span>
            <div className="flex items-center gap-2">
              <Check ok={data.freezeAuthority.revoked} />
              <span className="font-medium text-white">
                {data.freezeAuthority.revoked ? "Revoked" : "Active"}
              </span>
            </div>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Top 10 Holders</span>
            <span className="font-medium text-white">
              {data.topHolders.percentage.toFixed(2)}%
            </span>
          </div>
          {data.buyTax != null && (
            <div className="flex justify-between">
              <span className="text-zinc-500">Buy Tax</span>
              <span className={`font-medium ${data.buyTax > 5 ? "text-yellow-400" : "text-white"}`}>
                {data.buyTax.toFixed(1)}%
              </span>
            </div>
          )}
          {data.sellTax != null && (
            <div className="flex justify-between">
              <span className="text-zinc-500">Sell Tax</span>
              <span className={`font-medium ${data.sellTax > 5 ? "text-yellow-400" : "text-white"}`}>
                {data.sellTax.toFixed(1)}%
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-zinc-500">Honeypot Risk</span>
            <span className="font-medium text-white capitalize">{data.honeypotRisk}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Token Standard</span>
            <span className="font-medium text-white">{data.tokenStandard}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
