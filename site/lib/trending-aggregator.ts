/**
 * Trending Token Aggregator
 * 
 * Fetches trending data from multiple sources and computes a composite trending score.
 * Sources: DexScreener, GeckoTerminal, CoinGecko, Birdeye, GMGN, Jupiter.
 */

// ============ Types ============

export interface TrendingToken {
  address: string;
  chain: string;
  symbol: string;
  name: string;
  logo: string | null;

  // Price data
  price: number;
  priceChange1h: number;
  priceChange24h: number;

  // Volume
  volume1h: number;
  volume24h: number;
  volumeChange: number;

  // Liquidity & market cap
  liquidity: number;
  marketCap: number | null;
  fdv: number | null;

  // Social signals
  twitterMentions: number | null;
  telegramActivity: number | null;

  // Trading signals
  buyCount24h: number;
  sellCount24h: number;
  uniqueTraders24h: number;
  whaleActivity: boolean;

  // Source rankings (rank position on each platform, lower is better)
  sources: {
    dexscreener?: number;
    geckoterminal?: number;
    birdeye?: number;
    coingecko?: number;
    gmgn?: number;
    jupiter?: number;
  };

  // Computed
  trendingScore: number; // 0-100
  momentum: "rising" | "falling" | "stable";
  riskLevel: "low" | "medium" | "high";

  // Metadata
  launchedAt: string | null;
  isNew: boolean; // launched < 24h ago
  categories: string[];
  pairAddress: string | null;
}

export interface TrendingResponse {
  tokens: TrendingToken[];
  lastUpdated: string;
  sources: {
    dexscreener: boolean;
    geckoterminal: boolean;
    birdeye: boolean;
    coingecko: boolean;
    gmgn: boolean;
    jupiter: boolean;
  };
}

export interface TrendingFilters {
  chain?: string;
  category?: string;
  timeframe?: "1h" | "24h" | "7d";
  limit?: number;
  minLiquidity?: number;
  hideRugs?: boolean;
}

// Chain mapping
const CHAIN_MAP: Record<string, string> = {
  solana: "sol",
  sol: "sol",
  ethereum: "eth",
  eth: "eth",
  bsc: "bsc",
  binancecoin: "bsc",
  base: "base",
  arbitrum: "arbitrum",
  polygon: "polygon",
  avalanche: "avalanche",
  optimism: "optimism",
};

const GECKOTERMINAL_NETWORKS: Record<string, string> = {
  sol: "solana",
  eth: "eth",
  bsc: "bsc",
  base: "base",
  arbitrum: "arbitrum",
  polygon: "polygon_pos",
  avalanche: "avax",
  optimism: "optimism",
};

// ============ Fetch Helpers ============

async function fetchWithTimeout(url: string, ms = 8000, headers?: Record<string, string>): Promise<Response | null> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json", ...headers },
    });
    return res.ok ? res : null;
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

// ============ Source Fetchers ============

interface RawTrendingItem {
  address: string;
  chain: string;
  symbol: string;
  name: string;
  logo: string | null;
  price: number;
  priceChange1h: number;
  priceChange24h: number;
  volume1h: number;
  volume24h: number;
  liquidity: number;
  marketCap: number | null;
  fdv: number | null;
  buyCount24h: number;
  sellCount24h: number;
  uniqueTraders24h: number;
  rank: number;
  source: string;
  pairAddress: string | null;
  launchedAt: string | null;
  categories: string[];
}

// ---- DexScreener ----
async function fetchDexScreener(chain?: string): Promise<RawTrendingItem[]> {
  const items: RawTrendingItem[] = [];

  // Token boosts (promoted/trending)
  const boostsRes = await fetchWithTimeout("https://api.dexscreener.com/token-boosts/top/v1");
  if (boostsRes) {
    try {
      const data = await boostsRes.json();
      const tokens: any[] = Array.isArray(data) ? data : [];
      tokens.forEach((t, i) => {
        const normalizedChain = CHAIN_MAP[t.chainId] ?? t.chainId;
        if (chain && normalizedChain !== chain) return;
        items.push({
          address: t.tokenAddress,
          chain: normalizedChain,
          symbol: t.symbol ?? "???",
          name: t.name ?? t.symbol ?? "Unknown",
          logo: t.icon ?? null,
          price: 0,
          priceChange1h: 0,
          priceChange24h: 0,
          volume1h: 0,
          volume24h: 0,
          liquidity: 0,
          marketCap: null,
          fdv: null,
          buyCount24h: 0,
          sellCount24h: 0,
          uniqueTraders24h: 0,
          rank: i + 1,
          source: "dexscreener",
          pairAddress: null,
          launchedAt: null,
          categories: [],
        });
      });
    } catch {}
  }

  // Latest token profiles
  const profilesRes = await fetchWithTimeout("https://api.dexscreener.com/token-profiles/latest/v1");
  if (profilesRes) {
    try {
      const data = await profilesRes.json();
      const tokens: any[] = Array.isArray(data) ? data : [];
      tokens.slice(0, 50).forEach((t, i) => {
        const normalizedChain = CHAIN_MAP[t.chainId] ?? t.chainId;
        if (chain && normalizedChain !== chain) return;
        // Only add if not already present
        if (!items.find((x) => x.address === t.tokenAddress && x.chain === normalizedChain)) {
          items.push({
            address: t.tokenAddress,
            chain: normalizedChain,
            symbol: t.symbol ?? "???",
            name: t.name ?? t.symbol ?? "Unknown",
            logo: t.icon ?? null,
            price: 0,
            priceChange1h: 0,
            priceChange24h: 0,
            volume1h: 0,
            volume24h: 0,
            liquidity: 0,
            marketCap: null,
            fdv: null,
            buyCount24h: 0,
            sellCount24h: 0,
            uniqueTraders24h: 0,
            rank: items.length + i + 1,
            source: "dexscreener",
            pairAddress: null,
            launchedAt: null,
            categories: [],
          });
        }
      });
    } catch {}
  }

  return items;
}

// ---- GeckoTerminal ----
async function fetchGeckoTerminal(chain?: string): Promise<RawTrendingItem[]> {
  const items: RawTrendingItem[] = [];
  const headers = { Accept: "application/json;version=20230302" };

  // Global trending pools
  const url = chain
    ? `https://api.geckoterminal.com/api/v2/networks/${GECKOTERMINAL_NETWORKS[chain] ?? chain}/trending_pools?include=base_token`
    : "https://api.geckoterminal.com/api/v2/networks/trending_pools?include=base_token,network";

  const res = await fetchWithTimeout(url, 8000, headers);
  if (!res) return items;

  try {
    const json = await res.json();
    const pools: any[] = json?.data ?? [];
    const included: any[] = json?.included ?? [];

    // Build lookup for included tokens
    const tokenMap = new Map<string, any>();
    included.forEach((inc) => {
      if (inc.type === "token") {
        tokenMap.set(inc.id, inc.attributes);
      }
    });

    pools.forEach((pool, i) => {
      const attr = pool.attributes ?? {};
      // Extract chain from pool ID: "solana_0x..."
      const poolChain = pool.id?.split("_")[0] ?? "unknown";
      const normalizedChain = CHAIN_MAP[poolChain] ?? poolChain;
      if (chain && normalizedChain !== chain) return;

      // Get base token
      const baseTokenId = pool.relationships?.base_token?.data?.id;
      const baseToken = tokenMap.get(baseTokenId) ?? {};
      const tokenAddr = baseTokenId?.split("_").slice(1).join("_") ?? attr.address ?? "";

      items.push({
        address: tokenAddr,
        chain: normalizedChain,
        symbol: baseToken.symbol ?? attr.name?.split(" / ")[0] ?? "???",
        name: baseToken.name ?? attr.name ?? "Unknown",
        logo: baseToken.image_url ?? null,
        price: attr.base_token_price_usd ? parseFloat(attr.base_token_price_usd) : 0,
        priceChange1h: attr.price_change_percentage?.h1 ? parseFloat(attr.price_change_percentage.h1) : 0,
        priceChange24h: attr.price_change_percentage?.h24 ? parseFloat(attr.price_change_percentage.h24) : 0,
        volume1h: attr.volume_usd?.h1 ? parseFloat(attr.volume_usd.h1) : 0,
        volume24h: attr.volume_usd?.h24 ? parseFloat(attr.volume_usd.h24) : 0,
        liquidity: attr.reserve_in_usd ? parseFloat(attr.reserve_in_usd) : 0,
        marketCap: attr.market_cap_usd ? parseFloat(attr.market_cap_usd) : null,
        fdv: attr.fdv_usd ? parseFloat(attr.fdv_usd) : null,
        buyCount24h: attr.transactions?.h24?.buys ?? 0,
        sellCount24h: attr.transactions?.h24?.sells ?? 0,
        uniqueTraders24h: 0,
        rank: i + 1,
        source: "geckoterminal",
        pairAddress: pool.id?.split("_").slice(1).join("_") ?? null,
        launchedAt: attr.pool_created_at ?? null,
        categories: [],
      });
    });
  } catch {}

  return items;
}

// ---- CoinGecko ----
async function fetchCoinGecko(): Promise<RawTrendingItem[]> {
  const items: RawTrendingItem[] = [];

  const res = await fetchWithTimeout("https://api.coingecko.com/api/v3/search/trending");
  if (!res) return items;

  try {
    const json = await res.json();
    const coins: any[] = json?.coins ?? [];

    coins.forEach((c, i) => {
      const item = c.item ?? c;
      // CoinGecko doesn't specify chain in trending, assume multi-chain
      items.push({
        address: item.id ?? "",
        chain: "multi",
        symbol: item.symbol ?? "???",
        name: item.name ?? "Unknown",
        logo: item.large ?? item.thumb ?? null,
        price: item.data?.price ?? 0,
        priceChange1h: 0,
        priceChange24h: item.data?.price_change_percentage_24h?.usd ?? 0,
        volume1h: 0,
        volume24h: item.data?.total_volume ?? 0,
        liquidity: 0,
        marketCap: item.data?.market_cap ?? null,
        fdv: null,
        buyCount24h: 0,
        sellCount24h: 0,
        uniqueTraders24h: 0,
        rank: item.market_cap_rank ?? i + 1,
        source: "coingecko",
        pairAddress: null,
        launchedAt: null,
        categories: [],
      });
    });
  } catch {}

  return items;
}

// ---- Birdeye (Solana only) ----
async function fetchBirdeye(): Promise<RawTrendingItem[]> {
  const items: RawTrendingItem[] = [];
  const apiKey = process.env.BIRDEYE_API_KEY;
  const headers: Record<string, string> = { "x-chain": "solana" };
  if (apiKey) headers["X-API-KEY"] = apiKey;

  const res = await fetchWithTimeout(
    "https://public-api.birdeye.so/defi/token_trending?sort_by=rank&sort_type=asc&offset=0&limit=30",
    8000,
    headers,
  );
  if (!res) return items;

  try {
    const json = await res.json();
    const tokens: any[] = json?.data?.items ?? json?.data?.tokens ?? [];

    tokens.forEach((t, i) => {
      items.push({
        address: t.address ?? "",
        chain: "sol",
        symbol: t.symbol ?? "???",
        name: t.name ?? "Unknown",
        logo: t.logoURI ?? t.logo ?? null,
        price: t.price ?? 0,
        priceChange1h: t.priceChange1h ?? 0,
        priceChange24h: t.priceChange24h ?? 0,
        volume1h: t.v1hUSD ?? t.volume1h ?? 0,
        volume24h: t.v24hUSD ?? t.volume24h ?? 0,
        liquidity: t.liquidity ?? 0,
        marketCap: t.mc ?? t.marketCap ?? null,
        fdv: null,
        buyCount24h: t.trade24h ?? 0,
        sellCount24h: 0,
        uniqueTraders24h: t.uniqueWallet24h ?? 0,
        rank: t.rank ?? i + 1,
        source: "birdeye",
        pairAddress: null,
        launchedAt: null,
        categories: [],
      });
    });
  } catch {}

  return items;
}

// ---- GMGN ----
async function fetchGMGN(chain?: string): Promise<RawTrendingItem[]> {
  const items: RawTrendingItem[] = [];
  const chains = chain ? [chain] : ["sol", "bsc"];
  const headers = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
    Referer: "https://gmgn.ai/",
  };

  for (const c of chains) {
    const res = await fetchWithTimeout(
      `https://gmgn.ai/defi/quotation/v1/tokens/trending/${c}?orderby=total_volume&direction=desc&limit=30`,
      8000,
      headers,
    );
    if (!res) continue;

    try {
      const json = await res.json();
      const tokens: any[] = json?.data ?? [];

      tokens.forEach((t, i) => {
        const existing = items.find((x) => x.address === t.address);
        if (existing) return;

        items.push({
          address: t.address ?? t.token_address ?? "",
          chain: c,
          symbol: t.symbol ?? "???",
          name: t.token_name ?? t.name ?? "Unknown",
          logo: t.logo ?? null,
          price: t.price ?? 0,
          priceChange1h: t.price_change_1h ?? t.price_change_percent ?? 0,
          priceChange24h: t.price_change_24h ?? 0,
          volume1h: t.volume_1h ?? 0,
          volume24h: t.volume ?? t.volume_24h ?? 0,
          liquidity: t.liquidity ?? 0,
          marketCap: t.market_cap ?? null,
          fdv: t.fdv ?? null,
          buyCount24h: t.buy_count ?? t.buys ?? 0,
          sellCount24h: t.sell_count ?? t.sells ?? 0,
          uniqueTraders24h: t.holder_count ?? 0,
          rank: i + 1,
          source: "gmgn",
          pairAddress: t.pool_address ?? null,
          launchedAt: t.open_timestamp ? new Date(t.open_timestamp * 1000).toISOString() : null,
          categories: t.launchpad ? [t.launchpad] : [],
        });
      });
    } catch {}
  }

  return items;
}

// ---- Jupiter (Solana only) ----
async function fetchJupiter(): Promise<RawTrendingItem[]> {
  const items: RawTrendingItem[] = [];

  const res = await fetchWithTimeout("https://cache.jup.ag/top-tokens");
  if (!res) return items;

  try {
    const tokens: string[] = await res.json();
    // Jupiter just returns addresses, we'll enrich later or use as backup
    tokens.slice(0, 30).forEach((addr, i) => {
      items.push({
        address: addr,
        chain: "sol",
        symbol: "",
        name: "",
        logo: null,
        price: 0,
        priceChange1h: 0,
        priceChange24h: 0,
        volume1h: 0,
        volume24h: 0,
        liquidity: 0,
        marketCap: null,
        fdv: null,
        buyCount24h: 0,
        sellCount24h: 0,
        uniqueTraders24h: 0,
        rank: i + 1,
        source: "jupiter",
        pairAddress: null,
        launchedAt: null,
        categories: [],
      });
    });
  } catch {}

  return items;
}

// ============ Aggregation & Scoring ============

function computeTrendingScore(token: RawTrendingItem, allItems: RawTrendingItem[]): number {
  let score = 0;

  // Source diversity bonus (appears on multiple platforms)
  const sourcesCount = allItems.filter(
    (t) => t.address === token.address && t.chain === token.chain,
  ).length;
  score += Math.min(sourcesCount * 10, 30); // max 30 pts for 3+ sources

  // Rank bonus (inverse - lower rank is better)
  const rankScore = Math.max(0, 20 - token.rank);
  score += rankScore;

  // Volume momentum
  if (token.volume24h > 0) {
    const volumeScore = Math.min(Math.log10(token.volume24h + 1) * 3, 15);
    score += volumeScore;
  }

  // Price momentum (24h change)
  if (token.priceChange24h > 0) {
    score += Math.min(token.priceChange24h / 10, 15);
  }

  // Liquidity factor (higher is safer)
  if (token.liquidity > 0) {
    const liqScore = Math.min(Math.log10(token.liquidity + 1) * 2, 10);
    score += liqScore;
  }

  // Trading activity
  const txns = token.buyCount24h + token.sellCount24h;
  if (txns > 0) {
    score += Math.min(Math.log10(txns + 1) * 2, 10);
  }

  return Math.min(Math.round(score), 100);
}

function computeMomentum(token: RawTrendingItem): "rising" | "falling" | "stable" {
  // Use 1h change if available, otherwise 24h
  const change = token.priceChange1h || token.priceChange24h;
  if (change > 5) return "rising";
  if (change < -5) return "falling";
  return "stable";
}

function computeRiskLevel(token: RawTrendingItem): "low" | "medium" | "high" {
  // Risk based on liquidity and age
  if (token.liquidity < 10_000) return "high";
  if (token.liquidity < 100_000) return "medium";
  if (token.isNew) return "medium";
  return "low";
}

function deduplicateAndMerge(items: RawTrendingItem[]): Map<string, RawTrendingItem & { sourceRanks: Record<string, number> }> {
  const merged = new Map<string, RawTrendingItem & { sourceRanks: Record<string, number> }>();

  for (const item of items) {
    const key = `${item.chain}:${item.address}`.toLowerCase();
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, {
        ...item,
        sourceRanks: { [item.source]: item.rank },
      });
    } else {
      // Merge: prefer non-zero values
      existing.sourceRanks[item.source] = item.rank;
      if (!existing.symbol && item.symbol) existing.symbol = item.symbol;
      if (!existing.name && item.name) existing.name = item.name;
      if (!existing.logo && item.logo) existing.logo = item.logo;
      if (item.price > 0 && existing.price === 0) existing.price = item.price;
      if (item.priceChange1h !== 0) existing.priceChange1h = item.priceChange1h;
      if (item.priceChange24h !== 0) existing.priceChange24h = item.priceChange24h;
      if (item.volume1h > existing.volume1h) existing.volume1h = item.volume1h;
      if (item.volume24h > existing.volume24h) existing.volume24h = item.volume24h;
      if (item.liquidity > existing.liquidity) existing.liquidity = item.liquidity;
      if (item.marketCap && !existing.marketCap) existing.marketCap = item.marketCap;
      if (item.fdv && !existing.fdv) existing.fdv = item.fdv;
      if (item.buyCount24h > existing.buyCount24h) existing.buyCount24h = item.buyCount24h;
      if (item.sellCount24h > existing.sellCount24h) existing.sellCount24h = item.sellCount24h;
      if (item.uniqueTraders24h > existing.uniqueTraders24h) existing.uniqueTraders24h = item.uniqueTraders24h;
      if (!existing.pairAddress && item.pairAddress) existing.pairAddress = item.pairAddress;
      if (!existing.launchedAt && item.launchedAt) existing.launchedAt = item.launchedAt;
      existing.categories = [...new Set([...existing.categories, ...item.categories])];
    }
  }

  return merged;
}

// ============ Main Export ============

export async function fetchTrendingTokens(filters: TrendingFilters = {}): Promise<TrendingResponse> {
  const { chain, category, limit = 50, minLiquidity = 0 } = filters;

  // Fetch from all sources in parallel
  const [dexscreener, geckoterminal, coingecko, birdeye, gmgn, jupiter] = await Promise.all([
    fetchDexScreener(chain).catch(() => []),
    fetchGeckoTerminal(chain).catch(() => []),
    fetchCoinGecko().catch(() => []),
    fetchBirdeye().catch(() => []),
    fetchGMGN(chain).catch(() => []),
    chain === "sol" || !chain ? fetchJupiter().catch(() => []) : Promise.resolve([]),
  ]);

  const allItems = [...dexscreener, ...geckoterminal, ...coingecko, ...birdeye, ...gmgn, ...jupiter];
  const mergedMap = deduplicateAndMerge(allItems);

  // Convert to array and compute scores
  let tokens: TrendingToken[] = [];
  for (const [, item] of mergedMap) {
    const isNew = item.launchedAt
      ? Date.now() - new Date(item.launchedAt).getTime() < 24 * 60 * 60 * 1000
      : false;

    // Apply filters
    if (chain && item.chain !== chain && item.chain !== "multi") continue;
    if (minLiquidity > 0 && item.liquidity < minLiquidity) continue;
    if (category && !item.categories.includes(category)) continue;

    const trendingScore = computeTrendingScore(item, allItems);

    tokens.push({
      address: item.address,
      chain: item.chain,
      symbol: item.symbol || "???",
      name: item.name || "Unknown",
      logo: item.logo,
      price: item.price,
      priceChange1h: item.priceChange1h,
      priceChange24h: item.priceChange24h,
      volume1h: item.volume1h,
      volume24h: item.volume24h,
      volumeChange: 0,
      liquidity: item.liquidity,
      marketCap: item.marketCap,
      fdv: item.fdv,
      twitterMentions: null,
      telegramActivity: null,
      buyCount24h: item.buyCount24h,
      sellCount24h: item.sellCount24h,
      uniqueTraders24h: item.uniqueTraders24h,
      whaleActivity: false,
      sources: item.sourceRanks,
      trendingScore,
      momentum: computeMomentum(item),
      riskLevel: computeRiskLevel({ ...item, isNew }),
      launchedAt: item.launchedAt,
      isNew,
      categories: item.categories,
      pairAddress: item.pairAddress,
    });
  }

  // Sort by trending score
  tokens.sort((a, b) => b.trendingScore - a.trendingScore);

  // Limit results
  tokens = tokens.slice(0, limit);

  return {
    tokens,
    lastUpdated: new Date().toISOString(),
    sources: {
      dexscreener: dexscreener.length > 0,
      geckoterminal: geckoterminal.length > 0,
      birdeye: birdeye.length > 0,
      coingecko: coingecko.length > 0,
      gmgn: gmgn.length > 0,
      jupiter: jupiter.length > 0,
    },
  };
}

// Category detection helpers
export const TRENDING_CATEGORIES = [
  { id: "meme", label: "Meme Coins", keywords: ["meme", "doge", "shib", "pepe", "wojak", "cat", "dog", "frog"] },
  { id: "ai", label: "AI Tokens", keywords: ["ai", "gpt", "neural", "llm", "agent", "bot"] },
  { id: "defi", label: "DeFi", keywords: ["swap", "dex", "lend", "stake", "yield", "farm", "vault"] },
  { id: "gaming", label: "Gaming", keywords: ["game", "play", "nft", "metaverse", "virtual"] },
  { id: "rwa", label: "RWA", keywords: ["rwa", "real", "asset", "property", "estate"] },
  { id: "pump", label: "Pump.fun", keywords: ["pump", "bonding"] },
] as const;

export const SUPPORTED_CHAINS = [
  { id: "all", label: "All Chains" },
  { id: "sol", label: "Solana" },
  { id: "eth", label: "Ethereum" },
  { id: "bsc", label: "BSC" },
  { id: "base", label: "Base" },
  { id: "arbitrum", label: "Arbitrum" },
] as const;
