export interface TokenData {
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
  error?: string;
}

const DEXSCREENER_CHAIN: Record<string, string> = {
  sol: "solana",
  bsc: "bsc",
};

const GECKOTERMINAL_CHAIN: Record<string, string> = {
  sol: "solana",
  bsc: "bsc",
};

async function fetchWithTimeout(url: string, ms = 6000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    return res;
  } finally {
    clearTimeout(id);
  }
}

// ---- Provider 1: DexScreener ----
async function fromDexScreener(
  chain: "sol" | "bsc",
  address: string,
): Promise<TokenData | null> {
  try {
    const res = await fetchWithTimeout(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`,
    );
    if (!res.ok) return null;
    const json = await res.json();
    const pairs: DexScreenerPair[] = json?.pairs ?? [];
    if (!pairs.length) return null;

    // Prefer pairs on the correct chain, highest liquidity
    const chainId = DEXSCREENER_CHAIN[chain];
    const filtered = pairs
      .filter((p) => p.chainId === chainId)
      .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
    const pair = filtered[0] ?? pairs[0];

    return {
      address,
      chain,
      name: pair.baseToken?.name ?? null,
      symbol: pair.baseToken?.symbol ?? null,
      logo: null, // DexScreener doesn't provide logo in this endpoint
      price: pair.priceUsd ? parseFloat(pair.priceUsd) : null,
      priceChange24h: pair.priceChange?.h24 ?? null,
      volume24h: pair.volume?.h24 ?? null,
      liquidity: pair.liquidity?.usd ?? null,
      marketCap: pair.marketCap ?? null,
      fdv: pair.fdv ?? null,
      buys24h: pair.txns?.h24?.buys ?? null,
      sells24h: pair.txns?.h24?.sells ?? null,
      topPairAddress: pair.pairAddress ?? null,
      source: "dexscreener",
    };
  } catch {
    return null;
  }
}

// ---- Provider 2: GeckoTerminal ----
async function fromGeckoTerminal(
  chain: "sol" | "bsc",
  address: string,
): Promise<TokenData | null> {
  try {
    const network = GECKOTERMINAL_CHAIN[chain];
    const res = await fetchWithTimeout(
      `https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${address}?include=top_pools`,
    );
    if (!res.ok) return null;
    const json = await res.json();
    const attr = json?.data?.attributes;
    if (!attr) return null;

    // Extract top pool address from included data
    let topPairAddress: string | null = null;
    const topPools = json?.data?.relationships?.top_pools?.data;
    if (topPools?.length) {
      // ID is like "solana_POOLADDRESS"
      const poolId: string = topPools[0].id ?? "";
      topPairAddress = poolId.includes("_") ? poolId.split("_").slice(1).join("_") : poolId;
    }

    return {
      address,
      chain,
      name: attr.name ?? null,
      symbol: attr.symbol ?? null,
      logo: attr.image_url ?? null,
      price: attr.price_usd ? parseFloat(attr.price_usd) : null,
      priceChange24h: attr.price_change_percentage?.h24
        ? parseFloat(attr.price_change_percentage.h24)
        : null,
      volume24h: attr.volume_usd?.h24 ? parseFloat(attr.volume_usd.h24) : null,
      liquidity: null, // not in token endpoint
      marketCap: attr.market_cap_usd ? parseFloat(attr.market_cap_usd) : null,
      fdv: attr.fdv_usd ? parseFloat(attr.fdv_usd) : null,
      buys24h: null,
      sells24h: null,
      topPairAddress,
      source: "geckoterminal",
    };
  } catch {
    return null;
  }
}

// ---- Provider 3: Jupiter (Solana only, price-only fallback) ----
async function fromJupiter(address: string): Promise<{ price: number } | null> {
  try {
    const res = await fetchWithTimeout(
      `https://price.jup.ag/v4/price?ids=${address}`,
    );
    if (!res.ok) return null;
    const json = await res.json();
    const price = json?.data?.[address]?.price;
    return price != null ? { price } : null;
  } catch {
    return null;
  }
}

// ---- Main export with fallbacks ----
export async function getTokenData(
  chain: "sol" | "bsc",
  address: string,
  cachedMeta?: { name?: string | null; symbol?: string | null; logo?: string | null },
): Promise<TokenData> {
  // Try providers in order
  const dex = await fromDexScreener(chain, address);
  if (dex && dex.price != null) {
    // Patch logo from cache if missing
    if (!dex.logo && cachedMeta?.logo) dex.logo = cachedMeta.logo;
    if (!dex.name && cachedMeta?.name) dex.name = cachedMeta.name;
    if (!dex.symbol && cachedMeta?.symbol) dex.symbol = cachedMeta.symbol;
    return dex;
  }

  const gecko = await fromGeckoTerminal(chain, address);
  if (gecko && gecko.price != null) {
    // Merge any extra data from dex (e.g. buys/sells) if dex partially responded
    if (dex) {
      gecko.buys24h = gecko.buys24h ?? dex.buys24h;
      gecko.sells24h = gecko.sells24h ?? dex.sells24h;
      gecko.liquidity = gecko.liquidity ?? dex.liquidity;
      gecko.topPairAddress = gecko.topPairAddress ?? dex.topPairAddress;
    }
    return gecko;
  }

  // Jupiter fallback for Solana
  if (chain === "sol") {
    const jup = await fromJupiter(address);
    if (jup) {
      return {
        address,
        chain,
        name: cachedMeta?.name ?? null,
        symbol: cachedMeta?.symbol ?? null,
        logo: cachedMeta?.logo ?? null,
        price: jup.price,
        priceChange24h: null,
        volume24h: null,
        liquidity: null,
        marketCap: null,
        fdv: null,
        buys24h: null,
        sells24h: null,
        topPairAddress: null,
        source: "jupiter",
      };
    }
  }

  // All providers failed — return stub with cached metadata
  return {
    address,
    chain,
    name: cachedMeta?.name ?? null,
    symbol: cachedMeta?.symbol ?? null,
    logo: cachedMeta?.logo ?? null,
    price: null,
    priceChange24h: null,
    volume24h: null,
    liquidity: null,
    marketCap: null,
    fdv: null,
    buys24h: null,
    sells24h: null,
    topPairAddress: null,
    source: "unavailable",
    error: "Price data unavailable",
  };
}

// ---- Chart embed URLs ----
export function getChartEmbedUrl(
  provider: "dexscreener" | "geckoterminal",
  chain: "sol" | "bsc",
  pairAddress: string,
): string {
  if (provider === "dexscreener") {
    const chainSlug = DEXSCREENER_CHAIN[chain];
    return `https://dexscreener.com/${chainSlug}/${pairAddress}?embed=1&theme=dark&trades=1&info=0`;
  }
  // geckoterminal
  const network = GECKOTERMINAL_CHAIN[chain];
  return `https://www.geckoterminal.com/${network}/pools/${pairAddress}?embed=1&grayscale=0&light_chart=0`;
}

// DexScreener API types
interface DexScreenerPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { symbol: string };
  priceUsd?: string;
  priceNative?: string;
  txns?: { h24?: { buys: number; sells: number } };
  volume?: { h24?: number };
  priceChange?: { h24?: number };
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
}
