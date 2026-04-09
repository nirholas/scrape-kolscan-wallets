"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import NextImage from "next/image";

interface SimilarToken {
  address: string;
  name: string;
  symbol: string;
  logo: string | null;
  price: string | null;
  priceChange24h: string | null;
  volume24h: string | null;
  marketCap: string | null;
  poolAddress: string;
}

function TokenImg({ src, symbol }: { src: string; symbol: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
        {symbol.charAt(0).toUpperCase()}
      </div>
    );
  }
  return (
    <NextImage
      src={src}
      alt=""
      width={32}
      height={32}
      className="w-8 h-8 rounded-full flex-shrink-0"
      onError={() => setFailed(true)}
      unoptimized
    />
  );
}

function fmtUsd(v: string | null): string {
  if (!v) return "—";
  const n = parseFloat(v);
  if (isNaN(n)) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toPrecision(4)}`;
}

export default function SimilarTokens({
  chain,
  currentAddress,
}: {
  chain: "sol" | "bsc";
  currentAddress: string;
}) {
  const [tokens, setTokens] = useState<SimilarToken[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const network = chain === "sol" ? "solana" : "bsc";
    fetch(
      `https://api.geckoterminal.com/api/v2/networks/${network}/trending_pools?page=1`,
      { headers: { Accept: "application/json" } },
    )
      .then((r) => r.json())
      .then((json) => {
        const items: SimilarToken[] = (json?.data ?? [])
          .filter((pool: any) => {
            const base = pool.relationships?.base_token?.data?.id ?? "";
            const addr = base.includes("_") ? base.split("_").slice(1).join("_") : base;
            return addr.toLowerCase() !== currentAddress.toLowerCase();
          })
          .slice(0, 8)
          .map((pool: any) => {
            const attr = pool.attributes ?? {};
            const base = pool.relationships?.base_token?.data?.id ?? "";
            const tokenAddr = base.includes("_") ? base.split("_").slice(1).join("_") : base;
            return {
              address: tokenAddr,
              name: attr.name?.split(" / ")[0] ?? "Unknown",
              symbol: attr.name?.split(" / ")[0] ?? "?",
              logo: null,
              price: attr.base_token_price_usd ?? null,
              priceChange24h: attr.price_change_percentage?.h24 ?? null,
              volume24h: attr.volume_usd?.h24 ?? null,
              marketCap: attr.market_cap_usd ?? null,
              poolAddress: attr.address ?? "",
            };
          });
        setTokens(items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [chain, currentAddress]);

  if (loading) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <div className="text-sm font-medium text-white mb-4">Trending Tokens</div>
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!tokens.length) return null;

  const network = chain === "sol" ? "solana" : "bsc";

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-medium text-white">Trending on {chain === "sol" ? "Solana" : "BSC"}</h3>
        <a
          href={`https://www.geckoterminal.com/${network}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-zinc-600 hover:text-accent transition-colors"
        >
          via GeckoTerminal↗
        </a>
      </div>
      <div className="divide-y divide-border/50">
        {tokens.map((token) => {
          const change = token.priceChange24h ? parseFloat(token.priceChange24h) : null;
          return (
            <Link
              key={token.poolAddress}
              href={`/token/${chain}/${token.address}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/40 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                {(token.symbol ?? token.name).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{token.name}</div>
                <div className="text-xs text-zinc-500">{fmtUsd(token.volume24h)} vol</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm text-white tabular-nums">{fmtUsd(token.price)}</div>
                {change != null && (
                  <div className={`text-xs tabular-nums ${change >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {change >= 0 ? "+" : ""}{change.toFixed(2)}%
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
