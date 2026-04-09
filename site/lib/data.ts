import type { KolEntry, GmgnWallet, UnifiedWallet, XProfile } from "./types";

const KOLSCAN_DATA_URL =
  "https://raw.githubusercontent.com/nirholas/scrape-kolscan-wallets/main/output/kolscan-leaderboard.json";
const SOL_DATA_URL =
  "https://raw.githubusercontent.com/nirholas/scrape-kolscan-wallets/main/solwallets.json";
const BSC_DATA_URL =
  "https://raw.githubusercontent.com/nirholas/scrape-kolscan-wallets/main/bscwallets.json";

// --- KolScan Data ---
export async function getData(): Promise<KolEntry[]> {
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
  const res = await fetch(KOLSCAN_DATA_URL);
  return res.json();
}

// --- GMGN Data ---
function parseGmgnRaw(raw: any, chain: "sol" | "bsc"): GmgnWallet[] {
  const wallets: GmgnWallet[] = [];
  const seen = new Set<string>();

  function addWallet(w: any, category: string) {
    if (!w.wallet_address || seen.has(w.wallet_address)) return;
    seen.add(w.wallet_address);
    wallets.push({
      wallet_address: w.wallet_address,
      name: w.name || w.twitter_name || w.nickname || w.wallet_address.slice(0, 8),
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

export async function getSolGmgnData(): Promise<GmgnWallet[]> {
  return loadGmgnFile("solwallets.json", SOL_DATA_URL, "sol");
}

export async function getBscGmgnData(): Promise<GmgnWallet[]> {
  return loadGmgnFile("bscwallets.json", BSC_DATA_URL, "bsc");
}

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
    winrate_7d: w.winrate_7d,
    winrate_30d: w.winrate_30d,
    avatar: w.avatar,
  }));
}

export async function getAllSolanaWallets(): Promise<UnifiedWallet[]> {
  const [kolscan, gmgn] = await Promise.all([getData(), getSolGmgnData()]);
  const kolUnified = kolscanToUnified(kolscan);
  const gmgnUnified = gmgnToUnified(gmgn);

  // Merge — deduplicate by address, preferring GMGN data (richer)
  const map = new Map<string, UnifiedWallet>();
  for (const w of kolUnified) map.set(w.wallet_address, w);
  for (const w of gmgnUnified) {
    if (map.has(w.wallet_address)) {
      // Merge: keep GMGN data but add kolscan tag
      const existing = map.get(w.wallet_address)!;
      map.set(w.wallet_address, {
        ...w,
        tags: [...new Set([...w.tags, "kolscan"])],
      });
    } else {
      map.set(w.wallet_address, w);
    }
  }
  return Array.from(map.values());
}

export async function getBscWallets(): Promise<UnifiedWallet[]> {
  const bsc = await getBscGmgnData();
  return gmgnToUnified(bsc);
}

// --- X Profile Data ---
const X_PROFILES_URL =
  "https://raw.githubusercontent.com/nirholas/scrape-kolscan-wallets/main/site/data/x-profiles.json";

let xProfilesCache: Record<string, XProfile> | null = null;

export async function getXProfiles(): Promise<Record<string, XProfile>> {
  if (xProfilesCache) return xProfilesCache;

  try {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "data", "x-profiles.json");
    if (fs.existsSync(filePath)) {
      xProfilesCache = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      return xProfilesCache!;
    }
  } catch {
    // fs not available
  }

  try {
    const res = await fetch(X_PROFILES_URL);
    if (res.ok) {
      xProfilesCache = await res.json();
      return xProfilesCache!;
    }
  } catch {
    // fetch failed
  }

  return {};
}

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
