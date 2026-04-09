"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getChartEmbedUrl } from "@/lib/token-api";

interface TokenData {
  address: string;
  chain: "sol" | "bsc";
  name: string | null;
  symbol: string | null;
  logo: string | null;
  price: number | null;
  priceChange24h: number | null;
  volume24h: number | null;
  liquidity: number | null;
  marketCap: number | null;
  fdv: number | null;
  buys24h: number | null;
  sells24h: number | null;
  topPairAddress: string | null;
  source: string;
  launchpad: string | null;
  error?: string;
}

interface KolSummary {
  walletAddress: string;
  walletLabel: string | null;
  walletAvatar: string | null;
  totalBought: number;
  totalSold: number;
  realizedProfit: number;
  buyCount: number;
  sellCount: number;
  firstBuy: string | null;
  lastTrade: string | null;
}

interface TradeRow {
  id: string;
  walletAddress: string;
  walletLabel: string | null;
  walletAvatar: string | null;
  type: "buy" | "sell";
  amountUsd: number | null;
  amountToken: number | null;
  priceUsd: number | null;
  realizedProfit: number | null;
  realizedProfitPnl: number | null;
  txHash: string | null;
  tradedAt: string | null;
  source: string;
}

interface Stats {
  totalKols: number;
  totalVolume: number;
  buyCount: number;
  sellCount: number;
}

type ChartProvider = "dexscreener" | "geckoterminal";

function fmt(v: number | null, prefix = "$"): string {
  if (v == null) return "—";
  if (Math.abs(v) >= 1_000_000_000) return `${prefix}${(v / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(v) >= 1_000_000) return `${prefix}${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `${prefix}${(v / 1_000).toFixed(1)}K`;
  if (Math.abs(v) >= 1) return `${prefix}${v.toFixed(2)}`;
  // Small decimals: show up to 8 significant digits
  return `${prefix}${v.toPrecision(4)}`;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function shortAddr(addr: string): string {
  return addr.slice(0, 4) + "…" + addr.slice(-4);
}

function explorerUrl(chain: string, txHash: string): string {
  if (chain === "bsc") return `https://bscscan.com/tx/${txHash}`;
  return `https://solscan.io/tx/${txHash}`;
}

function walletHref(chain: string, addr: string): string {
  if (chain === "bsc") return `/gmgn-wallet/${addr}?chain=bsc`;
  return `/wallet/${addr}`;
}

export default function TokenPageClient({
  chain,
  address,
}: {
  chain: "sol" | "bsc";
  address: string;
}) {
  const [token, setToken] = useState<TokenData | null>(null);
  const [kols, setKols] = useState<KolSummary[]>([]);
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartProvider, setChartProvider] = useState<ChartProvider>("dexscreener");
  const [activeTab, setActiveTab] = useState<"kols" | "trades">("kols");

  useEffect(() => {
    // Load preferred chart provider from localStorage
    const saved = localStorage.getItem("chartProvider") as ChartProvider | null;
    if (saved === "dexscreener" || saved === "geckoterminal") setChartProvider(saved);
  }, []);

  useEffect(() => {
    fetch(`/api/token/${chain}/${address}`)
      .then((r) => r.json())
      .then((data) => {
        setToken(data.token);
        setKols(data.kols);
        setTrades(data.trades);
        setStats(data.stats);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [chain, address]);

  function setChart(provider: ChartProvider) {
    setChartProvider(provider);
    localStorage.setItem("chartProvider", provider);
  }

  const chartUrl =
    token?.topPairAddress
      ? getChartEmbedUrl(chartProvider, chain, token.topPairAddress)
      : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="text-center py-20 text-zinc-500">Token not found.</div>
    );
  }

  const change = token.priceChange24h;
  const changeColor = change == null ? "text-zinc-500" : change >= 0 ? "text-buy" : "text-sell";

  return (
    <div className="animate-fade-in space-y-6">
      {/* ── Header ── */}
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Logo + identity */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {token.logo ? (
              <img src={token.logo} alt="" className="w-12 h-12 rounded-full flex-shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-lg font-bold text-white flex-shrink-0">
                {(token.symbol ?? token.name ?? "?").charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-white">{token.name ?? "Unknown"}</h1>
                <span className="text-sm text-zinc-500 font-mono">{token.symbol}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700 uppercase">
                  {chain}
                </span>
                {token.launchpad && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-400 border border-purple-800/50 uppercase">
                    {token.launchpad}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs text-zinc-600 font-mono">{shortAddr(address)}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(address)}
                  className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  copy
                </button>
                <a
                  href={chain === "sol" ? `https://solscan.io/token/${address}` : `https://bscscan.com/token/${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-zinc-600 hover:text-accent transition-colors"
                >
                  explorer↗
                </a>
              </div>
            </div>
          </div>

          {/* Price */}
          <div className="text-right">
            <div className="text-2xl font-bold text-white tabular-nums">
              {fmt(token.price)}
            </div>
            {change != null && (
              <div className={`text-sm font-medium tabular-nums ${changeColor}`}>
                {change >= 0 ? "+" : ""}{change.toFixed(2)}% 24h
              </div>
            )}
            <div className="text-[10px] text-zinc-600 mt-0.5">via {token.source}</div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-border">
          {[
            { label: "Market Cap", value: fmt(token.marketCap) },
            { label: "FDV", value: fmt(token.fdv) },
            { label: "Liquidity", value: fmt(token.liquidity) },
            { label: "24h Volume", value: fmt(token.volume24h) },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-[11px] text-zinc-600 uppercase tracking-wider">{label}</div>
              <div className="text-sm font-medium text-white tabular-nums mt-0.5">{value}</div>
            </div>
          ))}
        </div>

        {/* Buys/sells */}
        {(token.buys24h != null || token.sells24h != null) && (
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-buy" />
              <span className="text-xs text-zinc-400">
                {token.buys24h ?? 0} buys
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sell" />
              <span className="text-xs text-zinc-400">
                {token.sells24h ?? 0} sells
              </span>
            </div>
            {token.buys24h != null && token.sells24h != null && (
              <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-buy rounded-full"
                  style={{
                    width: `${Math.round((token.buys24h / (token.buys24h + token.sells24h)) * 100)}%`,
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Chart ── */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-medium text-white">Chart</span>
          <div className="flex items-center gap-1">
            {(["dexscreener", "geckoterminal"] as ChartProvider[]).map((p) => (
              <button
                key={p}
                onClick={() => setChart(p)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                  chartProvider === p
                    ? "bg-white text-black"
                    : "text-zinc-500 hover:text-white"
                }`}
              >
                {p === "dexscreener" ? "DexScreener" : "GeckoTerminal"}
              </button>
            ))}
          </div>
        </div>

        {chartUrl ? (
          <iframe
            src={chartUrl}
            className="w-full"
            style={{ height: 480, border: "none" }}
            title={`${token.symbol ?? address} chart`}
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-600 gap-2">
            <span className="text-sm">No trading pair data available</span>
            <div className="flex gap-3 mt-2">
              {chain === "sol" && (
                <a
                  href={`https://dexscreener.com/solana/${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent hover:underline"
                >
                  View on DexScreener↗
                </a>
              )}
              {chain === "bsc" && (
                <a
                  href={`https://dexscreener.com/bsc/${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent hover:underline"
                >
                  View on DexScreener↗
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── KOL Activity / Trades ── */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        {/* Tab bar */}
        <div className="flex items-center border-b border-border px-4">
          {([
            { id: "kols", label: `KOL Activity (${kols.length})` },
            { id: "trades", label: `Trades (${trades.length})` },
          ] as { id: "kols" | "trades"; label: string }[]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-white text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          ))}

          {/* Stats pills */}
          {stats && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-zinc-600">
                {stats.totalKols} KOLs · {fmt(stats.totalVolume)} vol
              </span>
            </div>
          )}
        </div>

        {/* KOL tab */}
        {activeTab === "kols" && (
          kols.length === 0 ? (
            <div className="py-12 text-center text-zinc-600 text-sm">
              No KOL activity recorded for this token.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-bg-card/50">
                    {["KOL", "Bought", "Sold", "Realized PnL", "Buys", "Sells", "First Buy", "Last Trade"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-medium text-zinc-600 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {kols.map((kol) => (
                    <tr key={kol.walletAddress} className="border-b border-border/50 last:border-0 hover:bg-bg-card/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {kol.walletAvatar ? (
                            <img src={kol.walletAvatar} alt="" className="w-6 h-6 rounded-full flex-shrink-0" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                              {(kol.walletLabel || kol.walletAddress).charAt(0).toUpperCase()}
                            </div>
                          )}
                          <Link
                            href={walletHref(chain, kol.walletAddress)}
                            className="text-sm text-white hover:text-accent transition-colors whitespace-nowrap"
                          >
                            {kol.walletLabel || shortAddr(kol.walletAddress)}
                          </Link>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm tabular-nums text-zinc-300 whitespace-nowrap">
                        {fmt(kol.totalBought)}
                      </td>
                      <td className="px-4 py-3 text-sm tabular-nums text-zinc-300 whitespace-nowrap">
                        {fmt(kol.totalSold)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-sm tabular-nums font-medium ${kol.realizedProfit > 0 ? "text-buy" : kol.realizedProfit < 0 ? "text-sell" : "text-zinc-500"}`}>
                          {kol.realizedProfit !== 0
                            ? `${kol.realizedProfit > 0 ? "+" : ""}${fmt(kol.realizedProfit)}`
                            : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-buy tabular-nums">{kol.buyCount}</td>
                      <td className="px-4 py-3 text-sm text-sell tabular-nums">{kol.sellCount}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500 tabular-nums whitespace-nowrap">
                        {timeAgo(kol.firstBuy)}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500 tabular-nums whitespace-nowrap">
                        {timeAgo(kol.lastTrade)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Trades tab */}
        {activeTab === "trades" && (
          trades.length === 0 ? (
            <div className="py-12 text-center text-zinc-600 text-sm">No trades recorded.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-bg-card/50">
                    {["Time", "Type", "Wallet", "Amount", "Price", "PnL", "Tx"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-medium text-zinc-600 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trades.map((t) => (
                    <tr key={t.id} className="border-b border-border/50 last:border-0 hover:bg-bg-card/60 transition-colors">
                      <td className="px-4 py-3 text-xs text-zinc-500 tabular-nums whitespace-nowrap">
                        {timeAgo(t.tradedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${t.type === "buy" ? "bg-buy/10 text-buy" : "bg-sell/10 text-sell"}`}>
                          {t.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {t.walletAvatar ? (
                            <img src={t.walletAvatar} alt="" className="w-5 h-5 rounded-full" />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-[9px] font-bold text-white">
                              {(t.walletLabel || t.walletAddress).charAt(0).toUpperCase()}
                            </div>
                          )}
                          <Link
                            href={walletHref(chain, t.walletAddress)}
                            className="text-sm text-white hover:text-accent transition-colors"
                          >
                            {t.walletLabel || shortAddr(t.walletAddress)}
                          </Link>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm tabular-nums text-zinc-300 whitespace-nowrap">
                        {fmt(t.amountUsd)}
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums text-zinc-500 whitespace-nowrap">
                        {t.priceUsd ? fmt(t.priceUsd) : "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {t.realizedProfit != null ? (
                          <span className={`text-sm tabular-nums font-medium ${t.realizedProfit > 0 ? "text-buy" : "text-sell"}`}>
                            {t.realizedProfit > 0 ? "+" : ""}{fmt(t.realizedProfit)}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-700">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {t.txHash ? (
                          <a
                            href={explorerUrl(chain, t.txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-zinc-500 hover:text-accent transition-colors"
                          >
                            {shortAddr(t.txHash)}↗
                          </a>
                        ) : (
                          <span className="text-xs text-zinc-700">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* External links footer */}
      <div className="flex items-center gap-3 flex-wrap text-xs text-zinc-600">
        <span>View on:</span>
        <a href={`https://dexscreener.com/${chain === "sol" ? "solana" : "bsc"}/${address}`} target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">DexScreener↗</a>
        <a href={`https://www.geckoterminal.com/${chain === "sol" ? "solana" : "bsc"}/tokens/${address}`} target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">GeckoTerminal↗</a>
        {chain === "sol" && (
          <>
            <a href={`https://birdeye.so/token/${address}?chain=solana`} target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">Birdeye↗</a>
            <a href={`https://gmgn.ai/sol/token/${address}`} target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">GMGN↗</a>
            <a href={`https://solscan.io/token/${address}`} target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">Solscan↗</a>
          </>
        )}
        {chain === "bsc" && (
          <>
            <a href={`https://bscscan.com/token/${address}`} target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">BscScan↗</a>
            <a href={`https://gmgn.ai/bsc/token/${address}`} target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">GMGN↗</a>
          </>
        )}
      </div>
    </div>
  );
}
