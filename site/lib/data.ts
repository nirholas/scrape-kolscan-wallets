import { unstable_cache } from "next/cache";
import type { KolEntry, GmgnWallet, UnifiedWallet, XProfile, XTrackerData, XTrackerAccount, PolymarketTrader, PolymarketMarket, PolymarketData } from "./types";

const KOLSCAN_DATA_URL =
  "https://raw.githubusercontent.com/nirholas/scrape-kolscan-wallets/main/output/kolscan-leaderboard.json";
const SOL_DATA_URL =
  "https://raw.githubusercontent.com/nirholas/scrape-kolscan-wallets/main/solwallets.json";
const BSC_DATA_URL =
  "https://raw.githubusercontent.com/nirholas/scrape-kolscan-wallets/main/bscwallets.json";

// --- KolScan Data ---
async function _getData(): Promise<KolEntry[]> {
  try {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "data", "kolscan-leaderboard.json");
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch {
    // fs not available — use fetch
  }
  try {
    const res = await fetch(KOLSCAN_DATA_URL);
    if (res.ok) return res.json();
  } catch {
    // fetch failed
  }
  return [];
}

export const getData = unstable_cache(_getData, ["kolscan-leaderboard"], { revalidate: 3600 });

async function _getDataWithAvatars(): Promise<KolEntry[]> {
  const [entries, xProfiles] = await Promise.all([getData(), getXProfiles()]);
  for (const e of entries) {
    if (e.twitter) {
      const xp = getXProfile(xProfiles, e.twitter);
      if (xp?.avatar) e.avatar = xp.avatar;
    }
  }
  return entries;
}

export const getDataWithAvatars = unstable_cache(_getDataWithAvatars, ["kolscan-leaderboard-avatars"], { revalidate: 3600 });

// --- GMGN Data ---
function nonEmpty(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v.length > 0 ? v : null;
}

function extractNames(wallet: any, walletDetail: any) {
  const snsId =
    nonEmpty(wallet?.sns?.id) ||
    nonEmpty(wallet?.["sns.id"]) ||
    nonEmpty(wallet?.sns_id) ||
    nonEmpty(walletDetail?.sns?.id) ||
    nonEmpty(walletDetail?.["sns.id"]) ||
    nonEmpty(walletDetail?.sns_id);

  const ensName =
    nonEmpty(wallet?.ens) ||
    nonEmpty(wallet?.ens_name) ||
    nonEmpty(walletDetail?.ens) ||
    nonEmpty(walletDetail?.ens_name);

  const explicitName =
    nonEmpty(wallet?.name) ||
    nonEmpty(wallet?.nickname) ||
    nonEmpty(walletDetail?.name) ||
    nonEmpty(walletDetail?.nickname);

  const socialName = nonEmpty(wallet?.twitter_name) || nonEmpty(walletDetail?.twitter_name);

  return {
    snsId,
    ensName,
    name: explicitName || snsId || ensName || socialName || null,
  };
}

function parseGmgnRaw(raw: any, chain: "sol" | "bsc"): GmgnWallet[] {
  const wallets: GmgnWallet[] = [];
  const seen = new Set<string>();
  const details: Record<string, any> = {
    ...(raw?.walletDetails || {}),
    ...(raw?.wallet_details || {}),
  };

  function addWallet(w: any, category: string) {
    if (!w.wallet_address || seen.has(w.wallet_address)) return;
    seen.add(w.wallet_address);
    const detail = details[w.wallet_address] || null;
    const names = extractNames(w, detail);

    wallets.push({
      wallet_address: w.wallet_address,
      name: names.name || w.wallet_address.slice(0, 8),
      sns_id: names.snsId,
      ens_name: names.ensName,
      twitter_username: w.twitter_username || null,
      twitter_name: w.twitter_name || null,
      avatar: w.avatar || null,
      tags: w.tags || [],
      category,
      chain,
      realized_profit_1d: parseFloat(w.realized_profit_1d) || 0,
      realized_profit_7d: parseFloat(w.realized_profit_7d) || 0,
      realized_profit_30d: parseFloat(w.realized_profit_30d) || 0,
      buy_1d: w.buy_1d || 0,
      buy_7d: w.buy_7d || 0,
      buy_30d: w.buy_30d || 0,
      sell_1d: w.sell_1d || 0,
      sell_7d: w.sell_7d || 0,
      sell_30d: w.sell_30d || 0,
      winrate_7d: w.winrate_7d || 0,
      winrate_30d: w.winrate_30d || 0,
      balance: parseFloat(w.balance) || 0,
      last_active: w.last_active || 0,
      follow_count: w.follow_count || 0,
      // PnL ratios
      pnl_1d: parseFloat(w.pnl_1d) || 0,
      pnl_7d: parseFloat(w.pnl_7d) || 0,
      pnl_30d: parseFloat(w.pnl_30d) || 0,
      // Transaction counts
      txs_1d: w.txs_1d || 0,
      txs_7d: w.txs_7d || 0,
      txs_30d: w.txs_30d || 0,
      // Win rate 1d
      winrate_1d: w.winrate_1d || 0,
      // Volume
      volume_1d: parseFloat(w.volume_1d) || 0,
      volume_7d: parseFloat(w.volume_7d) || 0,
      volume_30d: parseFloat(w.volume_30d) || 0,
      // Average cost
      avg_cost_1d: parseFloat(w.avg_cost_1d) || 0,
      avg_cost_7d: parseFloat(w.avg_cost_7d) || 0,
      avg_cost_30d: parseFloat(w.avg_cost_30d) || 0,
      // Average holding period
      avg_holding_period_1d: w.avg_holding_period_1d || 0,
      avg_holding_period_7d: w.avg_holding_period_7d || 0,
      avg_holding_period_30d: w.avg_holding_period_30d || 0,
      // Net inflow
      net_inflow_1d: parseFloat(w.net_inflow_1d) || 0,
      net_inflow_7d: parseFloat(w.net_inflow_7d) || 0,
      net_inflow_30d: parseFloat(w.net_inflow_30d) || 0,
      // PnL distribution
      pnl_lt_minus_dot5_num_7d: w.pnl_lt_minus_dot5_num_7d || 0,
      pnl_minus_dot5_0x_num_7d: w.pnl_minus_dot5_0x_num_7d || 0,
      pnl_lt_2x_num_7d: w.pnl_lt_2x_num_7d || 0,
      pnl_2x_5x_num_7d: w.pnl_2x_5x_num_7d || 0,
      pnl_gt_5x_num_7d: w.pnl_gt_5x_num_7d || 0,
      // Daily profit sparkline
      daily_profit_7d: Array.isArray(w.daily_profit_7d)
        ? w.daily_profit_7d.map((d: any) => ({
            timestamp: d.timestamp || 0,
            profit: parseFloat(d.profit) || 0,
          }))
        : [],
      // All-time totals
      buy_total: w.buy || 0,
      sell_total: w.sell || 0,
      txs_total: w.txs || 0,
      // Tracker count
      remark_count: w.remark_count || 0,
      // Per-chain balances
      eth_balance: parseFloat(w.eth_balance) || 0,
      sol_balance: parseFloat(w.sol_balance) || 0,
      trx_balance: parseFloat(w.trx_balance) || 0,
      monad_balance: parseFloat(w.monad_balance) || 0,
    });
  }

  // SmartMoney categories
  if (raw.smartMoney?.wallets) {
    for (const [cat, list] of Object.entries(raw.smartMoney.wallets)) {
      if (Array.isArray(list)) {
        for (const w of list) addWallet(w, cat);
      }
    }
  }

  // KOL wallets
  if (raw.kol?.wallets && Array.isArray(raw.kol.wallets)) {
    for (const w of raw.kol.wallets) addWallet(w, "kol");
  }

  return wallets;
}

async function loadGmgnFile(localName: string, remoteUrl: string, chain: "sol" | "bsc"): Promise<GmgnWallet[]> {
  try {
    const fs = await import("fs");
    const path = await import("path");
    // Try from data/ dir first, then root
    for (const dir of [path.join(process.cwd(), "data"), path.join(process.cwd(), "..")]) {
      const filePath = path.join(dir, localName);
      if (fs.existsSync(filePath)) {
        const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        return parseGmgnRaw(raw, chain);
      }
    }
  } catch {
    // fs not available
  }
  try {
    const res = await fetch(remoteUrl);
    if (res.ok) {
      const raw = await res.json();
      return parseGmgnRaw(raw, chain);
    }
  } catch {
    // fetch failed
  }
  return [];
}

export const getSolGmgnData = unstable_cache(
  (): Promise<GmgnWallet[]> => loadGmgnFile("solwallets.json", SOL_DATA_URL, "sol"),
  ["gmgn-sol"],
  { revalidate: 3600 },
);

export const getBscGmgnData = unstable_cache(
  (): Promise<GmgnWallet[]> => loadGmgnFile("bscwallets.json", BSC_DATA_URL, "bsc"),
  ["gmgn-bsc"],
  { revalidate: 3600 },
);

export const getSolGmgnDataWithAvatars = unstable_cache(
  async (): Promise<GmgnWallet[]> => {
    const [wallets, xProfiles] = await Promise.all([getSolGmgnData(), getXProfiles()]);
    for (const w of wallets) {
      if (w.twitter_username) {
        const xp = getXProfile(xProfiles, w.twitter_username);
        if (xp?.avatar) w.avatar = xp.avatar;
      }
    }
    return wallets;
  },
  ["gmgn-sol-avatars"],
  { revalidate: 3600 },
);

export const getBscGmgnDataWithAvatars = unstable_cache(
  async (): Promise<GmgnWallet[]> => {
    const [wallets, xProfiles] = await Promise.all([getBscGmgnData(), getXProfiles()]);
    for (const w of wallets) {
      if (w.twitter_username) {
        const xp = getXProfile(xProfiles, w.twitter_username);
        if (xp?.avatar) w.avatar = xp.avatar;
      }
    }
    return wallets;
  },
  ["gmgn-bsc-avatars"],
  { revalidate: 3600 },
);

// --- Unified Data ---
function kolscanToUnified(entries: KolEntry[]): UnifiedWallet[] {
  const byAddress = new Map<string, KolEntry[]>();
  for (const e of entries) {
    const list = byAddress.get(e.wallet_address) || [];
    list.push(e);
    byAddress.set(e.wallet_address, list);
  }

  const wallets: UnifiedWallet[] = [];
  for (const [addr, list] of byAddress) {
    const d1 = list.find((e) => e.timeframe === 1);
    const d7 = list.find((e) => e.timeframe === 7);
    const d30 = list.find((e) => e.timeframe === 30);
    wallets.push({
      wallet_address: addr,
      name: list[0].name,
      twitter: list[0].twitter,
      chain: "sol",
      source: "kolscan",
      category: "kol",
      tags: ["kolscan"],
      profit_1d: d1?.profit || 0,
      profit_7d: d7?.profit || 0,
      profit_30d: d30?.profit || 0,
      buys_1d: d1?.wins || 0,
      buys_7d: d7?.wins || 0,
      buys_30d: d30?.wins || 0,
      sells_1d: d1?.losses || 0,
      sells_7d: d7?.losses || 0,
      sells_30d: d30?.losses || 0,
      winrate_1d: d1 ? (d1.wins + d1.losses > 0 ? d1.wins / (d1.wins + d1.losses) : 0) : 0,
      winrate_7d: d7 ? (d7.wins + d7.losses > 0 ? d7.wins / (d7.wins + d7.losses) : 0) : 0,
      winrate_30d: d30 ? (d30.wins + d30.losses > 0 ? d30.wins / (d30.wins + d30.losses) : 0) : 0,
      avatar: null,
    });
  }
  return wallets;
}

function gmgnToUnified(wallets: GmgnWallet[]): UnifiedWallet[] {
  return wallets.map((w) => ({
    wallet_address: w.wallet_address,
    name: w.name,
    sns_id: w.sns_id,
    ens_name: w.ens_name,
    twitter: w.twitter_username ? `https://x.com/${w.twitter_username}` : null,
    chain: w.chain,
    source: "gmgn" as const,
    category: w.category,
    tags: w.tags,
    profit_1d: w.realized_profit_1d,
    profit_7d: w.realized_profit_7d,
    profit_30d: w.realized_profit_30d,
    buys_1d: w.buy_1d,
    buys_7d: w.buy_7d,
    buys_30d: w.buy_30d,
    sells_1d: w.sell_1d,
    sells_7d: w.sell_7d,
    sells_30d: w.sell_30d,
    winrate_1d: w.winrate_1d,
    winrate_7d: w.winrate_7d,
    winrate_30d: w.winrate_30d,
    avatar: w.avatar,
    sparkline: w.daily_profit_7d.length > 0 ? w.daily_profit_7d.map((d) => d.profit) : undefined,
  }));
}

export const getAllSolanaWallets = unstable_cache(
  async (): Promise<UnifiedWallet[]> => {
    const [kolscan, gmgn, xProfiles] = await Promise.all([getData(), getSolGmgnData(), getXProfiles()]);
    const kolUnified = kolscanToUnified(kolscan);
    const gmgnUnified = gmgnToUnified(gmgn);

    // Merge — deduplicate by address, preferring GMGN data (richer)
    const map = new Map<string, UnifiedWallet>();
    for (const w of kolUnified) map.set(w.wallet_address, w);
    for (const w of gmgnUnified) {
      if (map.has(w.wallet_address)) {
        map.set(w.wallet_address, {
          ...w,
          tags: [...new Set([...w.tags, "kolscan"])],
        });
      } else {
        map.set(w.wallet_address, w);
      }
    }

    // Enrich avatars from X profiles where missing
    for (const w of map.values()) {
      if (w.twitter) {
        const xp = getXProfile(xProfiles, w.twitter);
        if (xp?.avatar) w.avatar = xp.avatar;
      }
    }

    return Array.from(map.values());
  },
  ["all-solana-wallets"],
  { revalidate: 3600 },
);

export const getBscWallets = unstable_cache(
  async (): Promise<UnifiedWallet[]> => {
    const [bsc, xProfiles] = await Promise.all([getBscGmgnData(), getXProfiles()]);
    const wallets = gmgnToUnified(bsc);
    for (const w of wallets) {
      if (w.twitter) {
        const xp = getXProfile(xProfiles, w.twitter);
        if (xp?.avatar) w.avatar = xp.avatar;
      }
    }
    return wallets;
  },
  ["bsc-wallets"],
  { revalidate: 3600 },
);

// --- X Profile Data ---
const X_PROFILES_URL =
  "https://raw.githubusercontent.com/nirholas/scrape-kolscan-wallets/main/site/data/x-profiles.json";

export const getXProfiles = unstable_cache(
  async (): Promise<Record<string, XProfile>> => {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const filePath = path.join(process.cwd(), "data", "x-profiles.json");
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, "utf-8"));
      }
    } catch {
      // fs not available
    }

    try {
      const res = await fetch(X_PROFILES_URL);
      if (res.ok) {
        return res.json();
      }
    } catch {
      // fetch failed
    }

    return {};
  },
  ["x-profiles"],
  { revalidate: 3600 },
);

/** Look up an X profile by twitter URL or username */
export function getXProfile(
  profiles: Record<string, XProfile>,
  twitterUrlOrUsername: string | null
): XProfile | null {
  if (!twitterUrlOrUsername) return null;
  const match = twitterUrlOrUsername.match(
    /(?:x\.com|twitter\.com)\/([A-Za-z0-9_]+)/
  );
  const username = match ? match[1].toLowerCase() : twitterUrlOrUsername.toLowerCase();
  const profile = profiles[username];
  if (profile && !profile.error) return profile;
  return null;
}

// --- GMGN X Tracker Data ---
const X_TRACKER_URL =
  "https://raw.githubusercontent.com/nirholas/scrape-kolscan-wallets/main/site/data/gmgn-x-tracker.json";

export const getXTrackerData = unstable_cache(
  async (): Promise<XTrackerData> => {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const filePath = path.join(process.cwd(), "data", "gmgn-x-tracker.json");
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, "utf-8"));
      }
    } catch {
      // fs not available
    }

    try {
      const res = await fetch(X_TRACKER_URL);
      if (res.ok) {
        return res.json();
      }
    } catch {
      // fetch failed
    }

    return { meta: { scrapedAt: "", source: "", totalAccounts: 0 }, accounts: [] };
  },
  ["x-tracker-data"],
  { revalidate: 3600 },
);

export async function getXTrackerAccounts(): Promise<XTrackerAccount[]> {
  const data = await getXTrackerData();
  return data.accounts;
}

// ────────────────────────────────────────────────────────────
// Polymarket Data
// ────────────────────────────────────────────────────────────
const POLYMARKET_DATA_API = "https://data-api.polymarket.com";
const POLYMARKET_GAMMA_API = "https://gamma-api.polymarket.com";
const POLYMARKET_HEADERS = {
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: "https://polymarket.com",
  Referer: "https://polymarket.com/",
};

function mapPolymarketTrader(raw: Record<string, unknown>, rank: number): PolymarketTrader {
  return {
    wallet_address: (raw.proxyWallet || raw.address || raw.user || "") as string,
    username: (raw.username || raw.name || null) as string | null,
    display_name: (raw.displayName || raw.display_name || raw.name || null) as string | null,
    profile_image: (raw.profileImage || raw.avatar || raw.pfp || null) as string | null,
    bio: (raw.bio || null) as string | null,
    twitter_handle: (raw.twitterHandle || raw.twitter || null) as string | null,
    rank,
    pnl_total: parseFloat((raw.pnl || raw.profit || raw.totalPnl || "0") as string) || 0,
    pnl_7d: parseFloat((raw.pnl_7d || raw.weeklyPnl || "0") as string) || 0,
    pnl_30d: parseFloat((raw.pnl_30d || raw.monthlyPnl || "0") as string) || 0,
    pnl_ytd: parseFloat((raw.pnl_ytd || raw.ytdPnl || "0") as string) || 0,
    volume_total: parseFloat((raw.volume || raw.totalVolume || "0") as string) || 0,
    volume_7d: parseFloat((raw.volume_7d || raw.weeklyVolume || "0") as string) || 0,
    volume_30d: parseFloat((raw.volume_30d || raw.monthlyVolume || "0") as string) || 0,
    trades_count: (raw.tradesCount || raw.trades || raw.numTrades || 0) as number,
    markets_traded: (raw.marketsTraded || raw.markets || raw.numMarkets || 0) as number,
    positions_count: (raw.positionsCount || raw.positions || raw.numPositions || 0) as number,
    winrate: parseFloat((raw.winRate || raw.winrate || "0") as string) || 0,
    profit_factor: parseFloat((raw.profitFactor || "0") as string) || 0,
    followers_count: (raw.followersCount || raw.followers || 0) as number,
    last_trade_at: (raw.lastTradeAt || raw.lastTrade || raw.lastActive || null) as string | null,
    created_at: (raw.createdAt || raw.joinDate || null) as string | null,
    tags: (raw.tags || raw.badges || []) as string[],
  };
}

function mapPolymarketMarket(raw: Record<string, unknown>): PolymarketMarket {
  const outcomePrices = raw.outcomePrices as Record<string, string> | null;
  return {
    id: (raw.id || raw.conditionId || raw.condition_id || "") as string,
    condition_id: (raw.conditionId || raw.condition_id || raw.id || "") as string,
    slug: (raw.slug || "") as string,
    question: (raw.question || raw.title || "") as string,
    description: (raw.description || null) as string | null,
    category: (raw.category || raw.tag || "other") as string,
    end_date: (raw.endDate || raw.end_date || raw.endDateIso || null) as string | null,
    outcomes: outcomePrices ? Object.keys(outcomePrices) : ["Yes", "No"],
    outcome_prices: outcomePrices
      ? Object.values(outcomePrices).map(Number)
      : [parseFloat((raw.bestBid || "0.5") as string) || 0.5, 1 - (parseFloat((raw.bestBid || "0.5") as string) || 0.5)],
    volume: parseFloat((raw.volume || "0") as string) || 0,
    liquidity: parseFloat((raw.liquidity || "0") as string) || 0,
    open_interest: parseFloat((raw.openInterest || raw.open_interest || "0") as string) || 0,
    active: raw.active !== false && !raw.closed && !raw.resolved,
    closed: (raw.closed || false) as boolean,
    resolved: (raw.resolved || false) as boolean,
    resolution_outcome: (raw.resolutionOutcome || raw.resolution || null) as string | null,
    image: (raw.image || raw.icon || null) as string | null,
    icon: (raw.icon || null) as string | null,
  };
}

async function fetchPolymarketLive(): Promise<PolymarketData> {
  const traders: PolymarketTrader[] = [];
  const markets: PolymarketMarket[] = [];
  const seenAddresses = new Set<string>();

  try {
    // Fetch main leaderboard
    const [lb, lb7d, lb30d, activeMarkets] = await Promise.allSettled([
      fetch(`${POLYMARKET_DATA_API}/leaderboard?limit=500`, { headers: POLYMARKET_HEADERS }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${POLYMARKET_DATA_API}/leaderboard?window=7d&limit=200`, { headers: POLYMARKET_HEADERS }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${POLYMARKET_DATA_API}/leaderboard?window=30d&limit=200`, { headers: POLYMARKET_HEADERS }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${POLYMARKET_GAMMA_API}/markets?limit=200&active=true&order=volume&ascending=false`, { headers: POLYMARKET_HEADERS }).then((r) => (r.ok ? r.json() : null)),
    ]);

    const lbData = lb.status === "fulfilled" && Array.isArray(lb.value) ? lb.value : [];
    const lb7dData = lb7d.status === "fulfilled" && Array.isArray(lb7d.value) ? lb7d.value : [];
    const lb30dData = lb30d.status === "fulfilled" && Array.isArray(lb30d.value) ? lb30d.value : [];
    const marketsData = activeMarkets.status === "fulfilled" && Array.isArray(activeMarkets.value) ? activeMarkets.value : [];

    // Map traders from main leaderboard
    for (let i = 0; i < lbData.length; i++) {
      const t = mapPolymarketTrader(lbData[i], i + 1);
      if (t.wallet_address && !seenAddresses.has(t.wallet_address.toLowerCase())) {
        traders.push(t);
        seenAddresses.add(t.wallet_address.toLowerCase());
      }
    }

    // Enrich with 7d/30d PnL from windowed leaderboards
    const addrToTrader = new Map(traders.map((t) => [t.wallet_address.toLowerCase(), t]));
    for (const raw of lb7dData) {
      const addr = ((raw.address || raw.user || raw.proxyWallet || "") as string).toLowerCase();
      const existing = addrToTrader.get(addr);
      if (existing && raw.pnl) existing.pnl_7d = parseFloat(raw.pnl as string) || existing.pnl_7d;
      else if (!seenAddresses.has(addr) && addr) {
        const t = mapPolymarketTrader(raw, traders.length + 1);
        traders.push(t);
        seenAddresses.add(addr);
        addrToTrader.set(addr, t);
      }
    }
    for (const raw of lb30dData) {
      const addr = ((raw.address || raw.user || raw.proxyWallet || "") as string).toLowerCase();
      const existing = addrToTrader.get(addr);
      if (existing && raw.pnl) existing.pnl_30d = parseFloat(raw.pnl as string) || existing.pnl_30d;
      else if (!seenAddresses.has(addr) && addr) {
        const t = mapPolymarketTrader(raw, traders.length + 1);
        traders.push(t);
        seenAddresses.add(addr);
      }
    }

    // Map markets
    for (const m of marketsData) {
      markets.push(mapPolymarketMarket(m));
    }
  } catch {
    // live fetch failed
  }

  return {
    meta: { scrapedAt: new Date().toISOString(), source: "polymarket-live", totalTraders: traders.length, totalMarkets: markets.length },
    traders,
    markets,
  };
}

export const getPolymarketData = unstable_cache(
  async (): Promise<PolymarketData> => {
    // 1. Try local file (generated by scrape-polymarket.js)
    try {
      const fs = await import("fs");
      const path = await import("path");
      const filePath = path.join(process.cwd(), "data", "polymarket-leaderboard.json");
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, "utf-8"));
      }
    } catch {
      // fs not available
    }

    // 2. Fetch live from Polymarket APIs (always available, no key needed)
    const live = await fetchPolymarketLive();
    if (live.traders.length > 0) return live;

    return { meta: { scrapedAt: "", source: "polymarket", totalTraders: 0, totalMarkets: 0 }, traders: [], markets: [] };
  },
  ["polymarket-data"],
  { revalidate: 3600 },
);

export async function getPolymarketTraders(): Promise<PolymarketTrader[]> {
  const data = await getPolymarketData();
  return data.traders;
}

export async function getPolymarketMarkets(): Promise<PolymarketMarket[]> {
  const data = await getPolymarketData();
  return data.markets;
}

/**
 * Convert Polymarket traders to UnifiedWallet format for combined views
 */
function polymarketToUnified(traders: PolymarketTrader[]): UnifiedWallet[] {
  return traders.map((t) => ({
    wallet_address: t.wallet_address,
    name: t.display_name || t.username || t.wallet_address.slice(0, 8),
    twitter: t.twitter_handle ? `https://x.com/${t.twitter_handle}` : null,
    chain: "polygon" as const,
    source: "polymarket" as const,
    category: "prediction_trader",
    tags: t.tags.length > 0 ? t.tags : ["polymarket"],
    profit_1d: 0, // Polymarket doesn't have 1d PnL in same format
    profit_7d: t.pnl_7d,
    profit_30d: t.pnl_30d,
    buys_1d: 0,
    buys_7d: 0,
    buys_30d: 0,
    sells_1d: 0,
    sells_7d: 0,
    sells_30d: 0,
    winrate_1d: t.winrate,
    winrate_7d: t.winrate,
    winrate_30d: t.winrate,
    avatar: t.profile_image,
  }));
}

export const getPolymarketWallets = unstable_cache(
  async (): Promise<UnifiedWallet[]> => {
    const traders = await getPolymarketTraders();
    return polymarketToUnified(traders);
  },
  ["polymarket-wallets"],
  { revalidate: 3600 },
);

/**
 * Get all wallets across all sources (Solana + BSC + Polymarket)
 */
export const getAllWallets = unstable_cache(
  async (): Promise<UnifiedWallet[]> => {
    const [solana, bsc, polymarket] = await Promise.all([
      getAllSolanaWallets(),
      getBscWallets(),
      getPolymarketWallets(),
    ]);
    return [...solana, ...bsc, ...polymarket];
  },
  ["all-wallets"],
  { revalidate: 3600 },
);

// ────────────────────────────────────────────────────────────
// Multi-Source Enrichment Functions
// ────────────────────────────────────────────────────────────

import type { EnrichedSolanaWallet, WalletExpandData, SolanaWalletFilters } from "./types";

const HELIUS_API = "https://api.helius.xyz";
const BIRDEYE_API = "https://public-api.birdeye.so";
const DUNE_API = "https://api.dune.com/api/v1";

// Smart money labels from Dune queries (cached on server)
let duneLabelsCache: Map<string, string[]> | null = null;
let duneLabelsCacheTime = 0;
const DUNE_CACHE_TTL = 3600 * 1000; // 1 hour

/**
 * Fetch Helius wallet PnL data
 */
async function fetchHeliusPnl(address: string): Promise<{ realized: number; unrealized: number } | null> {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) return null;
  
  try {
    const res = await fetch(`${HELIUS_API}/v0/pnl/wallets/${address}?api-key=${apiKey}`, {
      next: { revalidate: 300 }, // 5 min cache
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      realized: data.realized_pnl ?? data.realizedPnl ?? 0,
      unrealized: data.unrealized_pnl ?? data.unrealizedPnl ?? 0,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch Helius token balances for a wallet
 */
async function fetchHeliusBalances(address: string): Promise<WalletExpandData["balances"] | null> {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) return null;
  
  try {
    const res = await fetch(`${HELIUS_API}/v0/addresses/${address}/balances?api-key=${apiKey}`, {
      next: { revalidate: 60 }, // 1 min cache
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      tokens: (data.tokens || []).map((t: any) => ({
        mint: t.mint,
        amount: t.amount,
        decimals: t.decimals,
        tokenAccount: t.tokenAccount,
      })),
      nativeBalance: data.nativeBalance || 0,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch Helius recent transactions
 */
async function fetchHeliusTransactions(address: string, limit = 20): Promise<WalletExpandData["recentTxs"] | null> {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) return null;
  
  try {
    const res = await fetch(
      `${HELIUS_API}/v0/addresses/${address}/transactions?api-key=${apiKey}&limit=${limit}`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return (data || []).map((tx: any) => ({
      signature: tx.signature,
      type: tx.type || "unknown",
      timestamp: tx.timestamp,
      description: tx.description,
      fee: tx.fee,
      tokenTransfers: tx.tokenTransfers,
    }));
  } catch {
    return null;
  }
}

/**
 * Fetch Birdeye portfolio/holdings for a wallet
 */
async function fetchBirdeyePortfolio(address: string): Promise<{
  holdings: WalletExpandData["holdings"];
  portfolioValue: number;
} | null> {
  const apiKey = process.env.BIRDEYE_API_KEY;
  if (!apiKey) return null;
  
  try {
    const res = await fetch(`${BIRDEYE_API}/v1/wallet/token_list?wallet=${address}`, {
      headers: { "X-API-KEY": apiKey, "x-chain": "solana" },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const items = data.data?.items || [];
    
    const holdings = items.map((t: any) => ({
      address: t.address,
      symbol: t.symbol || "???",
      name: t.name || t.symbol || "Unknown",
      decimals: t.decimals || 0,
      balance: t.uiAmount || 0,
      valueUsd: t.valueUsd || 0,
      priceUsd: t.priceUsd || 0,
      priceChange24h: t.priceChange24H || 0,
    }));
    
    const portfolioValue = items.reduce((sum: number, t: any) => sum + (t.valueUsd || 0), 0);
    
    return { holdings, portfolioValue };
  } catch {
    return null;
  }
}

/**
 * Fetch Dune smart money labels (batch, cached)
 */
async function fetchDuneLabels(): Promise<Map<string, string[]>> {
  const apiKey = process.env.DUNE_API_KEY;
  if (!apiKey) return new Map();
  
  // Check cache
  if (duneLabelsCache && Date.now() - duneLabelsCacheTime < DUNE_CACHE_TTL) {
    return duneLabelsCache;
  }
  
  const labelsMap = new Map<string, string[]>();
  
  try {
    // Query IDs for smart money labels
    const queryIds = [2435924, 3311589];
    
    for (const queryId of queryIds) {
      const res = await fetch(`${DUNE_API}/query/${queryId}/results?limit=1000`, {
        headers: { "X-Dune-API-Key": apiKey },
        next: { revalidate: 3600 },
      });
      
      if (res.ok) {
        const data = await res.json();
        const rows = data.result?.rows || [];
        
        for (const row of rows) {
          const address = row.wallet_address || row.address || row.wallet;
          const label = row.label || row.tag || row.category;
          if (address && label) {
            const existing = labelsMap.get(address.toLowerCase()) || [];
            if (!existing.includes(label)) {
              existing.push(label);
              labelsMap.set(address.toLowerCase(), existing);
            }
          }
        }
      }
    }
    
    duneLabelsCache = labelsMap;
    duneLabelsCacheTime = Date.now();
    return labelsMap;
  } catch {
    return labelsMap;
  }
}

/**
 * Enrich wallet with data from multiple sources (for table view)
 * This is a lightweight enrichment — for full data use fetchWalletExpandData
 */
export async function enrichWallet(wallet: UnifiedWallet): Promise<EnrichedSolanaWallet> {
  const enriched: EnrichedSolanaWallet = {
    ...wallet,
    sources: {
      kolscan: wallet.source === "kolscan" || wallet.tags.includes("kolscan"),
      gmgn: wallet.source === "gmgn",
      helius: false,
      birdeye: false,
      dune: false,
    },
  };
  
  // Run enrichment in parallel with graceful fallbacks
  const [heliusPnl, birdeyeData, duneLabels] = await Promise.allSettled([
    fetchHeliusPnl(wallet.wallet_address),
    fetchBirdeyePortfolio(wallet.wallet_address),
    fetchDuneLabels(),
  ]);
  
  // Apply Helius PnL
  if (heliusPnl.status === "fulfilled" && heliusPnl.value) {
    enriched.realized_pnl = heliusPnl.value.realized;
    enriched.unrealized_pnl = heliusPnl.value.unrealized;
    enriched.sources!.helius = true;
  }
  
  // Apply Birdeye portfolio
  if (birdeyeData.status === "fulfilled" && birdeyeData.value) {
    enriched.portfolio_value_usd = birdeyeData.value.portfolioValue;
    enriched.active_positions = birdeyeData.value.holdings?.filter(h => h.valueUsd > 0).length ?? 0;
    enriched.sources!.birdeye = true;
  }
  
  // Apply Dune labels
  if (duneLabels.status === "fulfilled") {
    const labels = duneLabels.value.get(wallet.wallet_address.toLowerCase()) || [];
    if (labels.length > 0) {
      enriched.smart_money_tags = labels;
      enriched.sources!.dune = true;
    }
  }
  
  enriched.enriched_at = Date.now();
  return enriched;
}

/**
 * Batch enrich multiple wallets (more efficient)
 */
export async function enrichWalletsBatch(
  wallets: UnifiedWallet[], 
  maxConcurrent = 5
): Promise<EnrichedSolanaWallet[]> {
  // Pre-fetch Dune labels (shared across all wallets)
  const duneLabels = await fetchDuneLabels();
  
  const enriched: EnrichedSolanaWallet[] = [];
  
  // Process in batches to avoid rate limits
  for (let i = 0; i < wallets.length; i += maxConcurrent) {
    const batch = wallets.slice(i, i + maxConcurrent);
    const results = await Promise.all(
      batch.map(async (wallet) => {
        const e: EnrichedSolanaWallet = {
          ...wallet,
          sources: {
            kolscan: wallet.source === "kolscan" || wallet.tags.includes("kolscan"),
            gmgn: wallet.source === "gmgn",
            helius: false,
            birdeye: false,
            dune: false,
          },
        };
        
        // Apply Dune labels (already fetched)
        const labels = duneLabels.get(wallet.wallet_address.toLowerCase()) || [];
        if (labels.length > 0) {
          e.smart_money_tags = labels;
          e.sources!.dune = true;
        }
        
        e.enriched_at = Date.now();
        return e;
      })
    );
    enriched.push(...results);
  }
  
  return enriched;
}

/**
 * Fetch full expand data for a single wallet (click-to-expand)
 */
export async function fetchWalletExpandData(address: string): Promise<WalletExpandData> {
  const errors: string[] = [];
  
  const [balances, recentTxs, heliusPnl, birdeyeData] = await Promise.allSettled([
    fetchHeliusBalances(address),
    fetchHeliusTransactions(address, 20),
    fetchHeliusPnl(address),
    fetchBirdeyePortfolio(address),
  ]);
  
  const result: WalletExpandData = {
    address,
    fetchedAt: Date.now(),
  };
  
  if (balances.status === "fulfilled" && balances.value) {
    result.balances = balances.value;
  } else if (balances.status === "rejected") {
    errors.push("Failed to fetch Helius balances");
  }
  
  if (recentTxs.status === "fulfilled" && recentTxs.value) {
    result.recentTxs = recentTxs.value;
  } else if (recentTxs.status === "rejected") {
    errors.push("Failed to fetch Helius transactions");
  }
  
  if (heliusPnl.status === "fulfilled" && heliusPnl.value) {
    result.pnl = {
      realized: heliusPnl.value.realized,
      unrealized: heliusPnl.value.unrealized,
      totalValue: heliusPnl.value.realized + heliusPnl.value.unrealized,
    };
  }
  
  if (birdeyeData.status === "fulfilled" && birdeyeData.value) {
    result.holdings = birdeyeData.value.holdings;
    result.portfolioValue = birdeyeData.value.portfolioValue;
  } else if (birdeyeData.status === "rejected") {
    errors.push("Failed to fetch Birdeye portfolio");
  }
  
  if (errors.length > 0) {
    result.errors = errors;
  }
  
  return result;
}

/**
 * Filter and sort enriched wallets based on filter params
 */
export function filterSolanaWallets(
  wallets: EnrichedSolanaWallet[],
  filters: SolanaWalletFilters
): EnrichedSolanaWallet[] {
  let result = [...wallets];
  
  // Portfolio value filter
  if (filters.minPortfolioValue !== undefined) {
    result = result.filter(
      (w) => (w.portfolio_value_usd ?? 0) >= filters.minPortfolioValue!
    );
  }
  if (filters.maxPortfolioValue !== undefined) {
    result = result.filter(
      (w) => (w.portfolio_value_usd ?? Infinity) <= filters.maxPortfolioValue!
    );
  }
  
  // Win rate filter
  if (filters.minWinrate !== undefined) {
    result = result.filter((w) => w.winrate_7d >= filters.minWinrate!);
  }
  if (filters.maxWinrate !== undefined) {
    result = result.filter((w) => w.winrate_7d <= filters.maxWinrate!);
  }
  
  // Activity recency filter
  if (filters.activeWithin && filters.activeWithin !== "all") {
    const now = Date.now();
    const cutoffs: Record<string, number> = {
      "24h": now - 24 * 60 * 60 * 1000,
      "7d": now - 7 * 24 * 60 * 60 * 1000,
      "30d": now - 30 * 24 * 60 * 60 * 1000,
    };
    const cutoff = cutoffs[filters.activeWithin];
    if (cutoff) {
      result = result.filter(
        (w) => (w.last_trade_at ?? 0) * 1000 >= cutoff
      );
    }
  }
  
  // Category filter
  if (filters.category) {
    result = result.filter((w) => w.category === filters.category);
  }
  
  // Has Twitter filter
  if (filters.hasTwitter !== undefined) {
    result = result.filter((w) => 
      filters.hasTwitter ? !!w.twitter : !w.twitter
    );
  }
  
  // Smart money tag filter
  if (filters.smartMoneyTag) {
    result = result.filter((w) =>
      w.smart_money_tags?.includes(filters.smartMoneyTag!) ||
      w.tags.includes(filters.smartMoneyTag!)
    );
  }
  
  // Search filter
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.wallet_address.toLowerCase().includes(q) ||
        (w.sns_id || "").toLowerCase().includes(q) ||
        (w.ens_name || "").toLowerCase().includes(q) ||
        w.twitter?.toLowerCase().includes(q) ||
        w.tags.some((t) => t.toLowerCase().includes(q)) ||
        w.smart_money_tags?.some((t) => t.toLowerCase().includes(q))
    );
  }
  
  return result;
}

/**
 * Get enriched Solana wallets (cached)
 */
export const getEnrichedSolanaWallets = unstable_cache(
  async (): Promise<EnrichedSolanaWallet[]> => {
    const wallets = await getAllSolanaWallets();
    // For initial load, only add Dune labels (API calls are expensive)
    const duneLabels = await fetchDuneLabels();
    
    return wallets.map((w) => {
      const labels = duneLabels.get(w.wallet_address.toLowerCase()) || [];
      return {
        ...w,
        smart_money_tags: labels.length > 0 ? labels : undefined,
        sources: {
          kolscan: w.source === "kolscan" || w.tags.includes("kolscan"),
          gmgn: w.source === "gmgn",
          helius: false,
          birdeye: false,
          dune: labels.length > 0,
        },
      } as EnrichedSolanaWallet;
    });
  },
  ["enriched-solana-wallets"],
  { revalidate: 3600 },
);
