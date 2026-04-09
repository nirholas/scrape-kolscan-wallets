"use client";

import { useState, useMemo } from "react";
import type { NftItem, Chain } from "@/lib/portfolio-aggregator";
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

interface Props {
  nfts: NftItem[];
  loading?: boolean;
}

export default function NftGallery({ nfts, loading = false }: Props) {
  const [chainFilter, setChainFilter] = useState<Chain | "all">("all");
  const [collectionFilter, setCollectionFilter] = useState<string>("all");

  const chains = useMemo(() => {
    const seen = new Set<Chain>();
    nfts.forEach((n) => seen.add(n.chain));
    return Array.from(seen);
  }, [nfts]);

  const collections = useMemo(() => {
    const seen = new Set<string>();
    nfts.forEach((n) => { if (n.collection) seen.add(n.collection); });
    return Array.from(seen).slice(0, 30);
  }, [nfts]);

  const collectionStats = useMemo(() => {
    const stats: Record<string, { count: number; totalFloor: number; hasFloor: boolean }> = {};
    for (const nft of nfts) {
      const key = nft.collection || "Unknown";
      if (!stats[key]) stats[key] = { count: 0, totalFloor: 0, hasFloor: false };
      stats[key].count++;
      if (nft.floorPrice != null) {
        stats[key].totalFloor += nft.floorPrice;
        stats[key].hasFloor = true;
      }
    }
    return stats;
  }, [nfts]);

  const filtered = useMemo(() => {
    let rows = nfts;
    if (chainFilter !== "all") rows = rows.filter((n) => n.chain === chainFilter);
    if (collectionFilter !== "all") rows = rows.filter((n) => (n.collection || "Unknown") === collectionFilter);
    return rows;
  }, [nfts, chainFilter, collectionFilter]);

  if (loading) {
    return (
      <div className="bg-bg-card border border-border rounded-lg p-8 text-center text-zinc-600 text-sm animate-pulse">
        Loading NFTs...
      </div>
    );
  }

  if (nfts.length === 0) {
    return (
      <div className="bg-bg-card border border-border rounded-lg p-8 text-center text-zinc-600 text-sm">
        No NFTs found.{" "}
        <span className="text-zinc-700">(Requires HELIUS_API_KEY for Solana or DEBANK_API_KEY for EVM)</span>
      </div>
    );
  }

  const totalEstimatedValue = nfts.reduce((s, n) => s + (n.floorPrice ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="bg-bg-card border border-border rounded-lg p-4 flex flex-wrap gap-6">
        <div>
          <div className="text-xs text-zinc-500 font-mono uppercase">Total NFTs</div>
          <div className="text-lg font-bold text-white font-mono">{nfts.length}</div>
        </div>
        {totalEstimatedValue > 0 && (
          <div>
            <div className="text-xs text-zinc-500 font-mono uppercase">Est. Floor Value</div>
            <div className="text-lg font-bold text-white font-mono">{formatUsd(totalEstimatedValue)}</div>
          </div>
        )}
        <div>
          <div className="text-xs text-zinc-500 font-mono uppercase">Collections</div>
          <div className="text-lg font-bold text-white font-mono">{collections.length}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={chainFilter}
          onChange={(e) => setChainFilter(e.target.value as Chain | "all")}
          className="px-2 py-1.5 bg-bg-card border border-border rounded text-xs text-zinc-300 focus:outline-none"
        >
          <option value="all">All Chains</option>
          {chains.map((c) => (
            <option key={c} value={c}>
              {CHAIN_LABELS[c] ?? c}
            </option>
          ))}
        </select>
        <select
          value={collectionFilter}
          onChange={(e) => setCollectionFilter(e.target.value)}
          className="px-2 py-1.5 bg-bg-card border border-border rounded text-xs text-zinc-300 focus:outline-none max-w-[200px] truncate"
        >
          <option value="all">All Collections</option>
          {collections.map((c) => (
            <option key={c} value={c}>
              {c} ({collectionStats[c]?.count ?? 0})
            </option>
          ))}
        </select>
        <span className="ml-auto self-center text-xs text-zinc-600">
          {filtered.length} of {nfts.length} NFTs
        </span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {filtered.map((nft) => (
          <div
            key={`${nft.chain}-${nft.address}-${nft.tokenId}`}
            className="bg-bg-card border border-border rounded-lg overflow-hidden hover:border-zinc-600 transition-colors group"
          >
            <div className="aspect-square bg-bg-hover relative overflow-hidden">
              {nft.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={nft.image}
                  alt={nft.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-700">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={1.5} />
                    <circle cx="8.5" cy="8.5" r="1.5" strokeWidth={1.5} />
                    <path d="m21 15-5-5L5 21" strokeWidth={1.5} />
                  </svg>
                </div>
              )}
              <div className="absolute top-1 right-1">
                <span className="text-[9px] bg-black/60 text-zinc-300 px-1 py-0.5 rounded font-mono">
                  {CHAIN_LABELS[nft.chain] ?? nft.chain}
                </span>
              </div>
            </div>
            <div className="p-2">
              <div className="text-xs text-white font-medium truncate">{nft.name}</div>
              <div className="text-[11px] text-zinc-600 truncate">{nft.collection || "Unknown"}</div>
              {nft.floorPrice != null && nft.floorPrice > 0 && (
                <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                  Floor: {formatUsd(nft.floorPrice)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
