"use client";

import { useState, useMemo } from "react";
import ExportButton from "../components/ExportButton";
import type { CommunityWallet } from "./page";

const CHAIN_OPTIONS = ["all", "sol", "bsc"] as const;
const SOURCE_OPTIONS = ["all", "community", "kolscan", "gmgn"] as const;

export default function CommunityClient({ wallets }: { wallets: CommunityWallet[] }) {
  const [search, setSearch] = useState("");
  const [chain, setChain] = useState<(typeof CHAIN_OPTIONS)[number]>("all");
  const [source, setSource] = useState<(typeof SOURCE_OPTIONS)[number]>("all");

  const filtered = useMemo(() => {
    let list = wallets;
    if (chain !== "all") list = list.filter((w) => w.chain === chain);
    if (source !== "all") list = list.filter((w) => w.source === source);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (w) =>
          w.label.toLowerCase().includes(q) ||
          w.wallet_address.toLowerCase().includes(q)
      );
    }
    return list;
  }, [wallets, chain, source, search]);

  const exportData = useMemo(
    () =>
      filtered.map((w) => ({
        wallet_address: w.wallet_address,
        name: w.label,
        chain: w.chain as "sol" | "bsc",
      })),
    [filtered]
  );

  return (
    <main className="max-w-7xl mx-auto px-6 py-12 space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Community Wallets</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {filtered.length.toLocaleString()} wallets from community submissions, KolScan, and GMGN scrapers.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ExportButton wallets={exportData} filename="kolquest-community-wallets" />
          <a href="/submit" className="px-3 py-2 rounded-lg bg-white text-black text-sm font-medium">
            Submit wallet
          </a>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" d="m21 21-4.35-4.35" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search label or address..."
            className="bg-bg-card border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-white font-mono placeholder:text-zinc-700 outline-none focus:border-zinc-600 w-56 transition-all"
          />
        </div>
        <select
          value={chain}
          onChange={(e) => setChain(e.target.value as typeof chain)}
          className="bg-bg-card border border-border rounded-lg px-3 py-1.5 text-xs text-zinc-400 outline-none focus:border-zinc-600"
        >
          <option value="all">All Chains</option>
          <option value="sol">Solana</option>
          <option value="bsc">BSC</option>
        </select>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as typeof source)}
          className="bg-bg-card border border-border rounded-lg px-3 py-1.5 text-xs text-zinc-400 outline-none focus:border-zinc-600"
        >
          <option value="all">All Sources</option>
          <option value="community">Community</option>
          <option value="kolscan">KolScan</option>
          <option value="gmgn">GMGN</option>
        </select>
      </div>

      <section className="rounded-2xl border border-border bg-bg-card shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-zinc-500 bg-black/30">
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 w-12">#</th>
                <th className="text-left py-3 px-4">Label</th>
                <th className="text-left py-3 px-4">Wallet</th>
                <th className="text-left py-3 px-4">Chain</th>
                <th className="text-left py-3 px-4">Source</th>
                <th className="text-left py-3 px-4">Socials</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((w, i) => (
                <tr key={w.wallet_address} className="border-b border-border/50 hover:bg-bg-hover/40">
                  <td className="py-3 px-4 text-zinc-600 text-xs">{i + 1}</td>
                  <td className="py-3 px-4 text-zinc-200">{w.label}</td>
                  <td className="py-3 px-4 text-zinc-400 font-mono text-xs">
                    {w.wallet_address.slice(0, 6)}...{w.wallet_address.slice(-4)}
                  </td>
                  <td className="py-3 px-4 text-zinc-400 uppercase text-xs">{w.chain}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      w.source === "community"
                        ? "bg-purple-500/10 text-purple-400"
                        : w.source === "kolscan"
                        ? "bg-blue-500/10 text-blue-400"
                        : "bg-emerald-500/10 text-emerald-400"
                    }`}>
                      {w.source}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-zinc-400">
                    <div className="flex gap-3">
                      {w.twitter && w.twitter.startsWith("https://") ? (
                        <a className="hover:text-accent" href={w.twitter} target="_blank" rel="noopener noreferrer">X</a>
                      ) : (
                        <span className="text-zinc-700">-</span>
                      )}
                      {w.telegram && w.telegram.startsWith("https://") ? (
                        <a className="hover:text-accent" href={w.telegram} target="_blank" rel="noopener noreferrer">TG</a>
                      ) : (
                        <span className="text-zinc-700">-</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="p-5 text-zinc-500 text-sm">No wallets match the current filters.</div>
          )}
        </div>
      </section>
    </main>
  );
}
