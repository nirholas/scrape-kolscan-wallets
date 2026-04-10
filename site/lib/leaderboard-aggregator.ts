/**
 * @fileoverview Aggregates leaderboard data from multiple sources (KolScan + GMGN).
 *
 * Builds a unified LeaderboardEntry[] from available data sources, computes
 * composite scores, and caches the result in the database. The API route
 * uses getLeaderboard() which applies in-memory filtering/pagination.
 */

import { db } from "@/drizzle/db";
import { leaderboardCache } from "@/drizzle/db/schema";
import { eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { getData, getSolGmgnData, getBscGmgnData, getXProfiles, getXProfile } from "@/lib/data";
import type {
  LeaderboardEntry,
  LeaderboardChain,
  LeaderboardQuery,
  LeaderboardResponse,
  LeaderboardSource,
  KolEntry,
  GmgnWallet,
} from "@/lib/types";

const CACHE_KEY = "leaderboard_v1";
const STALE_MS = 15 * 60 * 1000; // 15 minutes

// --- Helpers ---

function twitterUsername(val: string | null | undefined): string | null {
  if (!val) return null;
  const m = val.match(/(?:twitter\.com|x\.com)\/([^/?# ]+)/);
  return m ? m[1] : val.startsWith("@") ? val.slice(1) : val;
}

function gmgnCategories(wallet: GmgnWallet): string[] {
  const s = new Set<string>();
  if (wallet.category) s.add(wallet.category);
  for (const t of wallet.tags) s.add(t);
  if (wallet.twitter_username) s.add("kol");
  return [...s];
}

function calcCompositeScore(entry: LeaderboardEntry): number {
  let score = 0;

  // Rank-based component: rank 1 → 60 pts, rank 500 → 0 pts
  const ranks = (Object.values(entry.rankings) as Array<{ rank: number } | undefined>)
    .filter((r): r is { rank: number } => r != null)
    .map((r) => r.rank);
  if (ranks.length > 0) {
    const avgRank = ranks.reduce((a, b) => a + b, 0) / ranks.length;
    score += Math.max(0, 60 - (avgRank - 1) * 0.12);
  }

  // Multi-source bonus (up to 20 pts)
  score += Math.min(20, entry.verifiedSources.length * 10);

  // Twitter/identity bonus (5 pts)
  if (entry.twitter) score += 5;

  // PnL bonus (log scale, up to 10 pts)
  if (entry.totalPnl > 0) {
    score += Math.min(10, Math.log10(entry.totalPnl / 1000 + 1) * 7);
  }

  // Win rate bonus (up to 5 pts)
  if (entry.avgWinRate > 0.5) {
    score += Math.min(5, (entry.avgWinRate - 0.5) * 10);
  }

  return Math.min(100, Math.max(0, score));
}

// --- Dune helpers (optional — skipped if DUNE_API_KEY is not set) ---

interface DuneSolRow { wallet?: string; address?: string; trader?: string; realized_pnl?: number; pnl?: number; trades?: number; tx_count?: number }
interface DuneEthRow { address?: string; wallet?: string; volume?: number; total_volume?: number; trades?: number; tx_count?: number }

async function fetchDuneSolanaTop(): Promise<{ address: string; pnl: number; trades: number; rank: number }[]> {
  const key = process.env.DUNE_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch("https://api.dune.com/api/v1/query/2435924/results?limit=500", {
      headers: { "X-Dune-API-Key": key },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const json = await res.json() as { result?: { rows?: DuneSolRow[] } };
    return (json?.result?.rows ?? [])
      .map((r, i) => ({
        address: (r.wallet ?? r.address ?? r.trader ?? "").toLowerCase(),
        pnl: Number(r.realized_pnl ?? r.pnl ?? 0),
        trades: Number(r.trades ?? r.tx_count ?? 0),
        rank: i + 1,
      }))
      .filter((r) => r.address.length > 10);
  } catch {
    return [];
  }
}

async function fetchDuneEthTop(): Promise<{ address: string; volume: number; trades: number; rank: number }[]> {
  const key = process.env.DUNE_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch("https://api.dune.com/api/v1/query/3326291/results?limit=500", {
      headers: { "X-Dune-API-Key": key },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const json = await res.json() as { result?: { rows?: DuneEthRow[] } };
    return (json?.result?.rows ?? [])
      .map((r, i) => ({
        address: (r.address ?? r.wallet ?? "").toLowerCase(),
        volume: Number(r.volume ?? r.total_volume ?? 0),
        trades: Number(r.trades ?? r.tx_count ?? 0),
        rank: i + 1,
      }))
      .filter((r) => r.address.startsWith("0x") && r.address.length === 42);
  } catch {
    return [];
  }
}

// --- Build entry from GMGN wallet (Solana or BSC) ---

function buildGmgnEntry(w: GmgnWallet, rank: number, chain: "solana" | "bsc", uname: string | null, avatar: string | null, lastActive: string | null): LeaderboardEntry {
  return {
    address: w.wallet_address,
    chain,
    name: w.name,
    avatar,
    ensOrSns: w.sns_id ?? w.ens_name,
    twitter: uname
      ? { username: uname, name: w.twitter_name ?? uname, avatar }
      : undefined,
    rankings: {
      gmgn: {
        rank,
        pnl: w.realized_profit_7d,
        winRate: w.winrate_7d,
        trades: w.txs_7d,
        category: w.category,
      },
    },
    compositeScore: 0,
    avgRank: rank,
    totalPnl: w.realized_profit_7d,
    avgWinRate: w.winrate_7d,
    lastActive,
    totalTrades: w.txs_7d,
    categories: gmgnCategories(w),
    verifiedSources: ["gmgn" as LeaderboardSource],
    portfolioValue: w.balance > 0 ? w.balance : null,
    pnlByTimeframe: {
      "24h": w.realized_profit_1d,
      "7d": w.realized_profit_7d,
      "30d": w.realized_profit_30d,
      "all": w.realized_profit_30d, // best available approximation
    },
    winRateByTimeframe: {
      "24h": w.winrate_1d,
      "7d": w.winrate_7d,
      "30d": w.winrate_30d,
    },
    tradesByTimeframe: {
      "24h": w.txs_1d,
      "7d": w.txs_7d,
      "30d": w.txs_30d,
      "all": w.txs_total,
    },
  };
}

function mergeGmgnInto(existing: LeaderboardEntry, w: GmgnWallet, rank: number, uname: string | null, avatar: string | null, lastActive: string | null) {
  existing.rankings.gmgn = {
    rank,
    pnl: w.realized_profit_7d,
    winRate: w.winrate_7d,
    trades: w.txs_7d,
    category: w.category,
  };
  if (!existing.avatar && avatar) existing.avatar = avatar;
  if (!existing.twitter && uname) {
    existing.twitter = { username: uname, name: w.twitter_name ?? uname, avatar };
  }
  existing.ensOrSns = existing.ensOrSns ?? w.sns_id ?? w.ens_name;
  existing.lastActive = existing.lastActive ?? lastActive;
  existing.totalTrades = Math.max(existing.totalTrades, w.txs_7d);
  existing.portfolioValue = existing.portfolioValue ?? (w.balance > 0 ? w.balance : null);
  existing.verifiedSources = [...new Set([...existing.verifiedSources, "gmgn" as LeaderboardSource])];
  existing.categories = [...new Set([...existing.categories, ...gmgnCategories(w)])];
  // Merge all timeframe data — prefer the higher PnL
  existing.pnlByTimeframe = {
    "24h": Math.max(existing.pnlByTimeframe?.["24h"] ?? -Infinity, w.realized_profit_1d),
    "7d": Math.max(existing.pnlByTimeframe?.["7d"] ?? -Infinity, w.realized_profit_7d),
    "30d": Math.max(existing.pnlByTimeframe?.["30d"] ?? -Infinity, w.realized_profit_30d),
    "all": Math.max(existing.pnlByTimeframe?.["all"] ?? -Infinity, w.realized_profit_30d),
  };
  existing.winRateByTimeframe = {
    "24h": w.winrate_1d || existing.winRateByTimeframe?.["24h"] || 0,
    "7d": w.winrate_7d || existing.winRateByTimeframe?.["7d"] || 0,
    "30d": w.winrate_30d || existing.winRateByTimeframe?.["30d"] || 0,
  };
  existing.tradesByTimeframe = {
    "24h": Math.max(existing.tradesByTimeframe?.["24h"] ?? 0, w.txs_1d),
    "7d": Math.max(existing.tradesByTimeframe?.["7d"] ?? 0, w.txs_7d),
    "30d": Math.max(existing.tradesByTimeframe?.["30d"] ?? 0, w.txs_30d),
    "all": Math.max(existing.tradesByTimeframe?.["all"] ?? 0, w.txs_total),
  };
}

// --- Core aggregation ---

async function _buildEntries(): Promise<LeaderboardEntry[]> {
  const [kolscanRaw, gmgnSol, gmgnBsc, xProfiles, duneSol, duneEth] = await Promise.all([
    getData(),
    getSolGmgnData(),
    getBscGmgnData(),
    getXProfiles(),
    fetchDuneSolanaTop(),
    fetchDuneEthTop(),
  ]);

  const entryMap = new Map<string, LeaderboardEntry>();

  // ── KolScan ───────────────────────────────────────────────────────────────
  const kolsByAddress = new Map<string, KolEntry[]>();
  for (const e of kolscanRaw) {
    const list = kolsByAddress.get(e.wallet_address) ?? [];
    list.push(e);
    kolsByAddress.set(e.wallet_address, list);
  }
  const kols7d = kolscanRaw
    .filter((e) => e.timeframe === 7)
    .sort((a, b) => b.profit - a.profit);
  const kolRank7d = new Map(kols7d.map((e, i) => [e.wallet_address, i + 1]));

  for (const [addr, list] of kolsByAddress) {
    const d7 = list.find((e) => e.timeframe === 7);
    const d30 = list.find((e) => e.timeframe === 30);
    const rank = kolRank7d.get(addr) ?? 9999;
    const wins7 = d7?.wins ?? 0;
    const losses7 = d7?.losses ?? 0;
    const winrate7 = wins7 + losses7 > 0 ? wins7 / (wins7 + losses7) : 0;
    const pnl7 = d7?.profit ?? 0;
    const wins30 = d30?.wins ?? 0;
    const losses30 = d30?.losses ?? 0;
    const winrate30 = wins30 + losses30 > 0 ? wins30 / (wins30 + losses30) : 0;
    const pnl30 = d30?.profit ?? 0;
    const twitterUrl = list[0].twitter;
    const uname = twitterUsername(twitterUrl);
    let avatar: string | null = twitterUrl
      ? (getXProfile(xProfiles, twitterUrl)?.avatar ?? null)
      : null;

    entryMap.set(addr, {
      address: addr,
      chain: "solana",
      name: list[0].name,
      avatar,
      ensOrSns: null,
      twitter: uname ? { username: uname, name: list[0].name, avatar } : undefined,
      rankings: {
        kolscan: { rank, pnl: pnl7, winRate: winrate7, trades: wins7 + losses7 },
      },
      compositeScore: 0,
      avgRank: rank,
      totalPnl: pnl7,
      avgWinRate: winrate7,
      lastActive: null,
      totalTrades: wins7 + losses7,
      categories: ["kol"],
      verifiedSources: ["kolscan" as LeaderboardSource],
      portfolioValue: null,
      pnlByTimeframe: {
        "24h": 0,
        "7d": pnl7,
        "30d": pnl30,
        "all": pnl30,
      },
      winRateByTimeframe: {
        "24h": 0,
        "7d": winrate7,
        "30d": winrate30,
      },
      tradesByTimeframe: {
        "24h": 0,
        "7d": wins7 + losses7,
        "30d": wins30 + losses30,
        "all": wins30 + losses30,
      },
    });
  }

  // ── GMGN Solana ──────────────────────────────────────────────────────────
  const gmgnSolSorted = [...gmgnSol].sort(
    (a, b) => b.realized_profit_7d - a.realized_profit_7d
  );

  for (let i = 0; i < gmgnSolSorted.length; i++) {
    const w = gmgnSolSorted[i];
    const rank = i + 1;
    const lastActive = w.last_active
      ? new Date(w.last_active * 1000).toISOString()
      : null;
    const uname = w.twitter_username ?? null;
    let avatar = w.avatar;
    if (!avatar && uname) {
      avatar = getXProfile(xProfiles, `https://x.com/${uname}`)?.avatar ?? null;
    }

    if (entryMap.has(w.wallet_address)) {
      mergeGmgnInto(entryMap.get(w.wallet_address)!, w, rank, uname, avatar, lastActive);
    } else {
      entryMap.set(w.wallet_address, buildGmgnEntry(w, rank, "solana", uname, avatar, lastActive));
    }
  }

  // ── GMGN BSC ─────────────────────────────────────────────────────────────
  const gmgnBscSorted = [...gmgnBsc].sort(
    (a, b) => b.realized_profit_7d - a.realized_profit_7d
  );

  for (let i = 0; i < gmgnBscSorted.length; i++) {
    const w = gmgnBscSorted[i];
    const rank = i + 1;
    const lastActive = w.last_active
      ? new Date(w.last_active * 1000).toISOString()
      : null;
    const uname = w.twitter_username ?? null;
    let avatar = w.avatar;
    if (!avatar && uname) {
      avatar = getXProfile(xProfiles, `https://x.com/${uname}`)?.avatar ?? null;
    }
    // Chain-prefixed key so BSC wallets with the same address as Solana stay separate
    const key = `bsc:${w.wallet_address}`;
    entryMap.set(key, buildGmgnEntry(w, rank, "bsc", uname, avatar, lastActive));
  }

  // ── Dune — Solana top traders ─────────────────────────────────────────────
  if (duneSol.length > 0) {
    for (const row of duneSol) {
      const duneRanking = { rank: row.rank, pnl: row.pnl, trades: row.trades };
      if (entryMap.has(row.address)) {
        const existing = entryMap.get(row.address)!;
        existing.rankings.dune = duneRanking;
        existing.verifiedSources = [...new Set([...existing.verifiedSources, "dune" as LeaderboardSource])];
      } else {
        entryMap.set(row.address, {
          address: row.address,
          chain: "solana",
          name: row.address.slice(0, 4) + "…" + row.address.slice(-4),
          avatar: null,
          ensOrSns: null,
          rankings: { dune: duneRanking },
          compositeScore: 0,
          avgRank: row.rank,
          totalPnl: row.pnl,
          avgWinRate: 0,
          lastActive: null,
          totalTrades: row.trades,
          categories: [],
          verifiedSources: ["dune" as LeaderboardSource],
          portfolioValue: null,
          pnlByTimeframe: { "24h": 0, "7d": row.pnl, "30d": row.pnl, "all": row.pnl },
          winRateByTimeframe: { "24h": 0, "7d": 0, "30d": 0 },
          tradesByTimeframe: { "24h": 0, "7d": row.trades, "30d": row.trades, "all": row.trades },
        });
      }
    }
  }

  // ── Dune — Ethereum top traders ───────────────────────────────────────────
  if (duneEth.length > 0) {
    for (const row of duneEth) {
      const key = `eth:${row.address}`;
      const duneRanking = { rank: row.rank, volume: row.volume, trades: row.trades };
      entryMap.set(key, {
        address: row.address,
        chain: "ethereum" as LeaderboardChain,
        name: row.address.slice(0, 6) + "…" + row.address.slice(-4),
        avatar: null,
        ensOrSns: null,
        rankings: { dune: duneRanking },
        compositeScore: 0,
        avgRank: row.rank,
        totalPnl: 0,
        avgWinRate: 0,
        lastActive: null,
        totalTrades: row.trades,
        categories: [],
        verifiedSources: ["dune" as LeaderboardSource],
        portfolioValue: null,
        pnlByTimeframe: { "24h": 0, "7d": 0, "30d": 0, "all": 0 },
        winRateByTimeframe: { "24h": 0, "7d": 0, "30d": 0 },
        tradesByTimeframe: { "24h": 0, "7d": row.trades, "30d": row.trades, "all": row.trades },
      });
    }
  }

  // ── Finalize scores ───────────────────────────────────────────────────────
  const entries = Array.from(entryMap.values());

  for (const e of entries) {
    const rankValues = (
      Object.values(e.rankings) as Array<{ rank: number } | undefined>
    )
      .filter((r): r is { rank: number } => r != null)
      .map((r) => r.rank);
    e.avgRank =
      rankValues.length > 0
        ? rankValues.reduce((a, b) => a + b, 0) / rankValues.length
        : 9999;

    const pnlValues = (
      Object.values(e.rankings) as Array<{ pnl?: number } | undefined>
    )
      .filter((r): r is { pnl: number } => r?.pnl != null)
      .map((r) => r.pnl);
    e.totalPnl = pnlValues.length > 0 ? Math.max(...pnlValues) : 0;

    const wrValues = (
      Object.values(e.rankings) as Array<{ winRate?: number } | undefined>
    )
      .filter((r): r is { winRate: number } => r?.winRate != null && r.winRate > 0)
      .map((r) => r.winRate);
    e.avgWinRate =
      wrValues.length > 0
        ? wrValues.reduce((a, b) => a + b, 0) / wrValues.length
        : 0;

    e.compositeScore = calcCompositeScore(e);
  }

  entries.sort((a, b) => b.compositeScore - a.compositeScore);
  return entries;
}

// Cached build — revalidates every 15 minutes
const buildEntries = unstable_cache(_buildEntries, ["leaderboard-entries"], {
  revalidate: 900,
});

// --- Public API ---

/** Rebuild leaderboard data and persist to DB cache. Called by cron job. */
export async function refreshLeaderboardData(): Promise<void> {
  const entries = await _buildEntries();
  await db
    .insert(leaderboardCache)
    .values({ key: CACHE_KEY, data: JSON.stringify(entries), lastUpdated: new Date() })
    .onConflictDoUpdate({
      target: leaderboardCache.key,
      set: { data: JSON.stringify(entries), lastUpdated: new Date() },
    });
}

async function loadEntries(): Promise<{
  entries: LeaderboardEntry[];
  lastUpdated: string;
}> {
  // Try DB cache first (avoids rebuilding on every request)
  try {
    const rows = await db
      .select()
      .from(leaderboardCache)
      .where(eq(leaderboardCache.key, CACHE_KEY))
      .limit(1);
    if (rows.length > 0) {
      const row = rows[0];
      const age = Date.now() - row.lastUpdated.getTime();
      if (age < STALE_MS) {
        return {
          entries: JSON.parse(row.data) as LeaderboardEntry[],
          lastUpdated: row.lastUpdated.toISOString(),
        };
      }
    }
  } catch {
    // DB unavailable — fall through to in-process cache
  }

  const entries = await buildEntries();
  return { entries, lastUpdated: new Date().toISOString() };
}

/** Query the leaderboard with filters, sorting, and pagination. */
export async function getLeaderboard(
  query: LeaderboardQuery
): Promise<LeaderboardResponse> {
  const { entries: all, lastUpdated } = await loadEntries();

  const tf = query.timeframe ?? "7d";

  // Helper: get the effective PnL for the selected timeframe
  function pnlFor(e: LeaderboardEntry): number {
    if (!e.pnlByTimeframe) return e.totalPnl;
    switch (tf) {
      case "24h": return e.pnlByTimeframe["24h"] ?? 0;
      case "30d": return e.pnlByTimeframe["30d"] ?? e.totalPnl;
      case "all": return e.pnlByTimeframe["all"] ?? e.totalPnl;
      default:    return e.pnlByTimeframe["7d"] ?? e.totalPnl;
    }
  }

  function winRateFor(e: LeaderboardEntry): number {
    if (!e.winRateByTimeframe) return e.avgWinRate;
    switch (tf) {
      case "24h": return e.winRateByTimeframe["24h"] ?? 0;
      case "30d": return e.winRateByTimeframe["30d"] ?? e.avgWinRate;
      default:    return e.winRateByTimeframe["7d"] ?? e.avgWinRate;
    }
  }

  function tradesFor(e: LeaderboardEntry): number {
    if (!e.tradesByTimeframe) return e.totalTrades;
    switch (tf) {
      case "24h": return e.tradesByTimeframe["24h"] ?? 0;
      case "30d": return e.tradesByTimeframe["30d"] ?? e.totalTrades;
      case "all": return e.tradesByTimeframe["all"] ?? e.totalTrades;
      default:    return e.tradesByTimeframe["7d"] ?? e.totalTrades;
    }
  }

  let filtered = all;

  if (query.chain && query.chain !== "all") {
    filtered = filtered.filter((e) => e.chain === query.chain);
  }

  if (query.category && query.category !== "overall") {
    const cat = query.category;
    const catAliases: Record<string, string[]> = {
      kol: ["kol"],
      smart_money: ["smart_degen", "smart_money"],
      whale: ["whale"],
      sniper: ["sniper", "snipe_bot"],
      meme: ["meme", "meme_coin"],
      defi: ["defi", "defi_farmer"],
    };
    const matchers = catAliases[cat] ?? [cat];
    filtered = filtered.filter((e) =>
      e.categories.some((c) => matchers.some((m) => c.toLowerCase().includes(m)))
    );
  }

  if (query.search) {
    const q = query.search.toLowerCase();
    filtered = filtered.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.address.toLowerCase().includes(q) ||
        (e.twitter?.username.toLowerCase().includes(q) ?? false) ||
        (e.ensOrSns?.toLowerCase().includes(q) ?? false)
    );
  }

  if (query.minPnl !== undefined) {
    filtered = filtered.filter((e) => pnlFor(e) >= query.minPnl!);
  }

  if (query.minWinRate !== undefined) {
    // Accept 0-100 or 0-1
    const threshold = query.minWinRate > 1 ? query.minWinRate / 100 : query.minWinRate;
    filtered = filtered.filter((e) => winRateFor(e) >= threshold);
  }

  if (query.activeInDays !== undefined) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - query.activeInDays);
    filtered = filtered.filter(
      (e) => e.lastActive != null && new Date(e.lastActive) >= cutoff
    );
  }

  if (query.verifiedOnly) {
    filtered = filtered.filter((e) => !!e.twitter);
  }

  const sortKey = query.sort ?? "composite";
  const order = query.order ?? "desc";
  filtered = [...filtered].sort((a, b) => {
    if (sortKey === "pnl") {
      const pa = pnlFor(a), pb = pnlFor(b);
      return order === "asc" ? pa - pb : pb - pa;
    }
    if (sortKey === "winrate") {
      const wa = winRateFor(a), wb = winRateFor(b);
      return order === "asc" ? wa - wb : wb - wa;
    }
    if (sortKey === "trades") {
      const ta = tradesFor(a), tb = tradesFor(b);
      return order === "asc" ? ta - tb : tb - ta;
    }
    if (sortKey === "rank")
      // Lower avgRank number = better; "desc" = best first
      return order === "desc" ? a.avgRank - b.avgRank : b.avgRank - a.avgRank;
    return order === "asc"
      ? a.compositeScore - b.compositeScore
      : b.compositeScore - a.compositeScore;
  });

  const page = query.page ?? 1;
  const limit = query.limit ?? 50;
  const total = filtered.length;

  return {
    entries: filtered.slice((page - 1) * limit, page * limit),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    lastUpdated,
    sources: {
      kolscan: all.some((e) => e.verifiedSources.includes("kolscan")),
      gmgn: all.some((e) => e.verifiedSources.includes("gmgn")),
      dune: all.some((e) => e.verifiedSources.includes("dune")),
      flipside: all.some((e) => e.verifiedSources.includes("flipside")),
      polymarket: all.some((e) => e.verifiedSources.includes("polymarket")),
    },
  };
}
