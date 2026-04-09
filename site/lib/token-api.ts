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
  launchpad: string | null;
  // Social & metadata
  website: string | null;
  twitter: string | null;
  telegram: string | null;
  discord: string | null;
  coingeckoId: string | null;
  marketCapRank: number | null;
  totalSupply: number | null;
  circulatingSupply: number | null;
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

async function fetchWithTimeout(url: string, ms?: number): Promise<Response>;
async function fetchWithTimeout(url: string, options: RequestInit, ms: number): Promise<Response>;
async function fetchWithTimeout(url: string, msOrOptions?: number | RequestInit, ms?: number): Promise<Response> {
  const options: RequestInit = typeof msOrOptions === "object" ? msOrOptions : {};
  const timeout = typeof msOrOptions === "number" ? msOrOptions : (ms ?? 6000);
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { Accept: "application/json", ...((options.headers as Record<string, string>) ?? {}) },
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

    // Extract social links from pair info
    const info = (pair as any).info ?? {};
    const websites: string[] = info.websites?.map((w: any) => w.url).filter(Boolean) ?? [];
    const socials: { type: string; url: string }[] = info.socials ?? [];
    const twitterLink = socials.find((s) => s.type?.toLowerCase() === "twitter")?.url ?? null;
    const telegramLink = socials.find((s) => s.type?.toLowerCase() === "telegram")?.url ?? null;
    const discordLink = socials.find((s) => s.type?.toLowerCase() === "discord")?.url ?? null;

    return {
      address,
      chain,
      name: pair.baseToken?.name ?? null,
      symbol: pair.baseToken?.symbol ?? null,
      logo: info.imageUrl ?? null,
      price: pair.priceUsd ? parseFloat(pair.priceUsd) : null,
      priceChange24h: pair.priceChange?.h24 ?? null,
      volume24h: pair.volume?.h24 ?? null,
      liquidity: pair.liquidity?.usd ?? null,
      marketCap: pair.marketCap ?? null,
      fdv: pair.fdv ?? null,
      buys24h: pair.txns?.h24?.buys ?? null,
      sells24h: pair.txns?.h24?.sells ?? null,
      topPairAddress: pair.pairAddress ?? null,
      launchpad: null,
      website: websites[0] ?? null,
      twitter: twitterLink,
      telegram: telegramLink,
      discord: discordLink,
      coingeckoId: null,
      marketCapRank: null,
      totalSupply: null,
      circulatingSupply: null,
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
      launchpad: null,
      website: null,
      twitter: null,
      telegram: null,
      discord: null,
      coingeckoId: null,
      marketCapRank: null,
      totalSupply: null,
      circulatingSupply: null,
      source: "geckoterminal",
    };
  } catch {
    return null;
  }
}

// ---- Provider 3: CoinGecko (market cap rank, supply, social links) ----
const COINGECKO_PLATFORM: Record<string, string> = {
  sol: "solana",
  bsc: "binance-smart-chain",
};

async function fromCoinGecko(
  chain: "sol" | "bsc",
  address: string,
): Promise<Partial<TokenData> | null> {
  try {
    const platform = COINGECKO_PLATFORM[chain];
    const apiKey = process.env.COINGECKO_API_KEY;
    const baseUrl = apiKey
      ? "https://pro-api.coingecko.com/api/v3"
      : "https://api.coingecko.com/api/v3";
    const headers: Record<string, string> = apiKey
      ? { "x-cg-pro-api-key": apiKey }
      : {};

    const res = await fetchWithTimeout(
      `${baseUrl}/coins/${platform}/contract/${address}`,
      { headers },
      8000,
    );
    if (!res.ok) return null;
    const json = await res.json();
    if (json.error) return null;

    const links = json.links ?? {};
    const website = links.homepage?.find((u: string) => u) ?? null;
    const twitter = links.twitter_screen_name
      ? `https://x.com/${links.twitter_screen_name}`
      : null;
    const telegram = links.telegram_channel_identifier
      ? `https://t.me/${links.telegram_channel_identifier}`
      : null;
    const discord = links.chat_url?.find((u: string) => u?.includes("discord")) ?? null;

    return {
      logo: json.image?.large ?? json.image?.small ?? null,
      marketCap: json.market_data?.market_cap?.usd ?? null,
      fdv: json.market_data?.fully_diluted_valuation?.usd ?? null,
      marketCapRank: json.market_cap_rank ?? null,
      coingeckoId: json.id ?? null,
      totalSupply: json.market_data?.total_supply ?? null,
      circulatingSupply: json.market_data?.circulating_supply ?? null,
      website,
      twitter,
      telegram,
      discord,
    };
  } catch {
    return null;
  }
}

// ---- Provider 4: Jupiter (Solana only, price-only fallback) ----
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
  const EMPTY_SOCIALS = {
    website: null,
    twitter: null,
    telegram: null,
    discord: null,
    coingeckoId: null,
    marketCapRank: null,
    totalSupply: null,
    circulatingSupply: null,
  };

  // Fire CoinGecko in parallel with primary providers (best-effort, non-blocking)
  const cgPromise = fromCoinGecko(chain, address).catch(() => null);

  const [dex, gecko] = await Promise.all([
    fromDexScreener(chain, address),
    fromGeckoTerminal(chain, address),
  ]);

  const cg = await cgPromise;

  function mergeCoinGecko(data: TokenData): TokenData {
    if (!cg) return data;
    return {
      ...data,
      logo: data.logo ?? cg.logo ?? null,
      marketCap: data.marketCap ?? cg.marketCap ?? null,
      fdv: data.fdv ?? cg.fdv ?? null,
      website: data.website ?? cg.website ?? null,
      twitter: data.twitter ?? cg.twitter ?? null,
      telegram: data.telegram ?? cg.telegram ?? null,
      discord: data.discord ?? cg.discord ?? null,
      coingeckoId: cg.coingeckoId ?? null,
      marketCapRank: cg.marketCapRank ?? null,
      totalSupply: cg.totalSupply ?? null,
      circulatingSupply: cg.circulatingSupply ?? null,
    };
  }

  if (dex && dex.price != null) {
    // Patch metadata from cache if missing
    if (!dex.logo && cachedMeta?.logo) dex.logo = cachedMeta.logo;
    if (!dex.name && cachedMeta?.name) dex.name = cachedMeta.name;
    if (!dex.symbol && cachedMeta?.symbol) dex.symbol = cachedMeta.symbol;
    return mergeCoinGecko(dex);
  }

  if (gecko && gecko.price != null) {
    // Merge any extra data from dex (e.g. buys/sells) if dex partially responded
    if (dex) {
      gecko.buys24h = gecko.buys24h ?? dex.buys24h;
      gecko.sells24h = gecko.sells24h ?? dex.sells24h;
      gecko.liquidity = gecko.liquidity ?? dex.liquidity;
      gecko.topPairAddress = gecko.topPairAddress ?? dex.topPairAddress;
      gecko.website = gecko.website ?? dex.website;
      gecko.twitter = gecko.twitter ?? dex.twitter;
      gecko.telegram = gecko.telegram ?? dex.telegram;
    }
    return mergeCoinGecko(gecko);
  }

  // Jupiter fallback for Solana
  if (chain === "sol") {
    const jup = await fromJupiter(address);
    if (jup) {
      const jupData: TokenData = {
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
        launchpad: null,
        ...EMPTY_SOCIALS,
        source: "jupiter",
      };
      return mergeCoinGecko(jupData);
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
    launchpad: null,
    ...EMPTY_SOCIALS,
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
