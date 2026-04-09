/**
 * Multi-chain portfolio data aggregator.
 * Fetches and unifies wallet data from various sources across multiple blockchains.
 *
 * Required environment variables (optional — missing keys show empty data):
 *   HELIUS_API_KEY    — Solana DAS (token balances, NFTs)
 *   DEBANK_API_KEY    — EVM tokens, DeFi positions, NFTs (best coverage)
 *   MORALIS_API_KEY   — EVM fallback for tokens + NFTs
 *   COVALENT_API_KEY  — EVM fallback for multi-chain token balances
 */

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export type Chain =
  | "solana"
  | "ethereum"
  | "bsc"
  | "polygon"
  | "arbitrum"
  | "base"
  | "optimism"
  | "avalanche";

export type AssetCategory =
  | "native"
  | "stablecoin"
  | "defi"
  | "meme"
  | "lp"
  | "staked"
  | "other";

export interface PortfolioAsset {
  address: string;
  symbol: string;
  name: string;
  logo: string | null;
  balance: number;
  decimals: number;
  priceUsd: number | null;
  valueUsd: number;
  change24h: number | null;
  portfolioPercent: number;
  chain: Chain;
  category: AssetCategory;
}

export interface DefiPosition {
  protocol: string;
  protocolId: string;
  protocolLogo: string | null;
  type: "lending" | "liquidity" | "staking" | "farming" | "other";
  poolName: string;
  valueUsd: number;
  rewards: number;
  apy: number | null;
  chain: Chain;
  healthFactor?: number;
}

export interface NftItem {
  address: string;
  tokenId: string;
  name: string;
  image: string | null;
  collection: string;
  collectionImage: string | null;
  floorPrice: number | null;
  chain: Chain;
}

export interface PortfolioSummary {
  totalValueUsd: number;
  change24h: number;
  change24hPercent: number;
  chainBreakdown: {
    chain: Chain;
    valueUsd: number;
    percent: number;
  }[];
  categoryBreakdown: {
    category: AssetCategory;
    valueUsd: number;
    percent: number;
  }[];
  sources: string[];
  warnings: string[];
}

export interface PortfolioHistory {
  timestamps: number[];
  values: number[];
  period: "7d" | "30d" | "90d" | "1y";
}

// ────────────────────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────────────────────

const SOL_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export function detectChains(address: string): Chain[] {
  if (SOL_ADDRESS_RE.test(address)) return ["solana"];
  if (EVM_ADDRESS_RE.test(address)) {
    return ["ethereum", "bsc", "polygon", "arbitrum", "base", "optimism", "avalanche"];
  }
  return [];
}

export function isEvm(address: string): boolean {
  return EVM_ADDRESS_RE.test(address);
}

export function isSolana(address: string): boolean {
  return SOL_ADDRESS_RE.test(address);
}

// Chain ID mapping for Covalent / Moralis
const CHAIN_IDS: Record<Chain, string> = {
  ethereum: "1",
  bsc: "56",
  polygon: "137",
  arbitrum: "42161",
  base: "8453",
  optimism: "10",
  avalanche: "43114",
  solana: "solana-mainnet",
};

// DeBank chain identifiers
const DEBANK_CHAIN_IDS: Record<Chain, string> = {
  ethereum: "eth",
  bsc: "bsc",
  polygon: "matic",
  arbitrum: "arb",
  base: "base",
  optimism: "op",
  avalanche: "avax",
  solana: "sol",
};

// Native tokens per chain
const NATIVE_SYMBOLS: Record<Chain, string> = {
  solana: "SOL",
  ethereum: "ETH",
  bsc: "BNB",
  polygon: "MATIC",
  arbitrum: "ETH",
  base: "ETH",
  optimism: "ETH",
  avalanche: "AVAX",
};

const STABLECOINS = new Set([
  "USDC", "USDT", "DAI", "BUSD", "FRAX", "LUSD", "USDH", "USDD",
  "TUSD", "USDP", "GUSD", "EURS", "PAX", "sUSD", "SUSD", "UXD",
  "EURC", "CNGN", "AGEUR", "USDE", "PYUSD", "FDUSD",
]);

const LP_PATTERNS = /^(LP|UNI-V|CAKE-LP|SLP|GAUGE|APT-POOL|LPT|VLP|cLP|sLP|FLP|GLP)/i;
const STAKED_PATTERNS = /^(st|sT|ST|s)[A-Z]|^(Lido|Rocket|cbETH|wstETH|rETH|frxETH|ankrETH|bETH|stSOL|mSOL|jitoSOL|bSOL|hSOL|MSOL)/;
const MEME_SYMBOLS = new Set(["DOGE", "SHIB", "PEPE", "FLOKI", "BONK", "WIF", "POPCAT", "BOME", "MEW"]);

function classifyAsset(symbol: string, name: string): AssetCategory {
  const s = symbol.toUpperCase();
  if (STABLECOINS.has(s)) return "stablecoin";
  if (LP_PATTERNS.test(s) || LP_PATTERNS.test(name)) return "lp";
  if (STAKED_PATTERNS.test(s) || STAKED_PATTERNS.test(name)) return "staked";
  if (MEME_SYMBOLS.has(s)) return "meme";
  return "other";
}

async function fetchWithTimeout<T>(
  url: string,
  options: RequestInit = {},
  timeoutMs = 12_000,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    return await res.json() as T;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// ────────────────────────────────────────────────────────────
// Helius Fetchers (Solana)
// ────────────────────────────────────────────────────────────

interface HeliusAsset {
  id: string;
  content: {
    metadata: { name: string; symbol: string };
    links?: { image?: string };
    files?: { uri?: string; cdn_uri?: string }[];
  };
  interface: string; // "FungibleToken" | "FungibleAsset" | "V1_NFT" | "ProgrammableNFT" | etc.
  token_info?: {
    symbol?: string;
    balance?: number;
    decimals?: number;
    price_info?: {
      price_per_token?: number;
      currency?: string;
    };
  };
  grouping?: { group_key: string; group_value: string }[];
  ownership: { owner: string };
}

interface HeliusNft {
  id: string;
  content: {
    metadata: { name: string; symbol: string };
    links?: { image?: string };
    files?: { uri?: string; cdn_uri?: string }[];
  };
  grouping?: { group_key: string; group_value: string }[];
}

async function heliusDasGetAssets(
  address: string,
  apiKey: string,
): Promise<HeliusAsset[]> {
  const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
  let allAssets: HeliusAsset[] = [];
  let page = 1;

  while (true) {
    const data = await fetchWithTimeout<{ result: { items: HeliusAsset[]; total: number } }>(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "portfolio",
          method: "getAssetsByOwner",
          params: {
            ownerAddress: address,
            page,
            limit: 1000,
            displayOptions: {
              showFungible: true,
              showNativeBalance: true,
            },
          },
        }),
      },
    );
    const items = data?.result?.items ?? [];
    allAssets = allAssets.concat(items);
    if (items.length < 1000) break;
    page++;
    if (page > 10) break; // safety cap
  }

  return allAssets;
}

async function getSolNativeBalance(
  address: string,
  apiKey: string,
): Promise<number> {
  const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
  const data = await fetchWithTimeout<{ result: { value: number } }>(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "balance",
        method: "getBalance",
        params: [address],
      }),
    },
  );
  return (data?.result?.value ?? 0) / 1e9;
}

async function getSolPrice(): Promise<number> {
  try {
    const data = await fetchWithTimeout<{ data: { SOL: { price: number } } }>(
      "https://price.jup.ag/v6/price?ids=SOL",
      {},
      5000,
    );
    return data?.data?.SOL?.price ?? 0;
  } catch {
    return 0;
  }
}

// ────────────────────────────────────────────────────────────
// DeBank Fetchers (EVM)
// ────────────────────────────────────────────────────────────

interface DeBankToken {
  id: string;
  chain: string;
  name: string;
  symbol: string;
  logo_url: string | null;
  price: number;
  price_24h_change: number | null;
  amount: number;
  raw_amount: number;
  decimals: number;
}

interface DeBankProtocolAssetItem {
  token_list?: { id: string; symbol: string; name: string; logo_url: string | null; amount: number; price: number }[];
  reward_token_list?: { id: string; symbol: string; amount: number; price: number }[];
  health_rate?: number;
  borrow_token_list?: { id: string; symbol: string; amount: number; price: number }[];
}

interface DeBankProtocol {
  id: string;
  chain: string;
  name: string;
  logo_url: string | null;
  portfolio_item_list: {
    stats: { net_usd_value: number; asset_usd_value: number; debt_usd_value: number };
    name: string;
    detail: DeBankProtocolAssetItem;
    detail_types?: string[];
  }[];
}

interface DeBankTotalBalance {
  total_usd_value: number;
  chain_list: { id: string; usd_value: number }[];
}

async function debankFetch<T>(path: string, apiKey: string): Promise<T> {
  return fetchWithTimeout<T>(
    `https://pro-openapi.debank.com/v1${path}`,
    { headers: { AccessKey: apiKey } },
  );
}

async function getDebankHoldings(address: string, apiKey: string): Promise<PortfolioAsset[]> {
  const tokens = await debankFetch<DeBankToken[]>(
    `/user/all_token_list?id=${address.toLowerCase()}&is_all=false`,
    apiKey,
  );

  const assets: PortfolioAsset[] = tokens
    .filter((t) => t.amount > 0 && t.price * t.amount >= 0.01)
    .map((t) => {
      const chain = Object.entries(DEBANK_CHAIN_IDS).find(([, v]) => v === t.chain)?.[0] as Chain | undefined;
      const c: Chain = chain ?? "ethereum";
      const symbol = t.symbol.toUpperCase();
      let category: AssetCategory = classifyAsset(t.symbol, t.name);
      if (symbol === NATIVE_SYMBOLS[c]) category = "native";
      return {
        address: t.id,
        symbol,
        name: t.name,
        logo: t.logo_url,
        balance: t.amount,
        decimals: t.decimals,
        priceUsd: t.price,
        valueUsd: t.price * t.amount,
        change24h: t.price_24h_change ?? null,
        portfolioPercent: 0, // calculated later
        chain: c,
        category,
      };
    });

  return assets;
}

async function getDebankDefi(address: string, apiKey: string): Promise<DefiPosition[]> {
  const protocols = await debankFetch<DeBankProtocol[]>(
    `/user/all_complex_protocol_list?id=${address.toLowerCase()}`,
    apiKey,
  );

  const positions: DefiPosition[] = [];

  for (const p of protocols) {
    const chain = Object.entries(DEBANK_CHAIN_IDS).find(([, v]) => v === p.chain)?.[0] as Chain | undefined;
    const c: Chain = chain ?? "ethereum";

    for (const item of p.portfolio_item_list) {
      const netValue = item.stats?.net_usd_value ?? 0;
      if (netValue < 0.01) continue;

      const rewardValue = (item.detail?.reward_token_list ?? []).reduce(
        (sum, r) => sum + r.amount * r.price,
        0,
      );

      const detailTypes = item.detail_types ?? [];
      let type: DefiPosition["type"] = "other";
      if (detailTypes.includes("lending")) type = "lending";
      else if (detailTypes.includes("liquidity_pool") || detailTypes.includes("lp")) type = "liquidity";
      else if (detailTypes.includes("staking") || detailTypes.includes("locked")) type = "staking";
      else if (detailTypes.includes("farming") || detailTypes.includes("yield")) type = "farming";

      positions.push({
        protocol: p.name,
        protocolId: p.id,
        protocolLogo: p.logo_url,
        type,
        poolName: item.name ?? "Position",
        valueUsd: netValue,
        rewards: rewardValue,
        apy: null,
        chain: c,
        healthFactor: item.detail?.health_rate,
      });
    }
  }

  return positions;
}

async function getDebankNfts(address: string, apiKey: string): Promise<NftItem[]> {
  const data = await debankFetch<{ id: string; name: string; thumbnail_url: string | null; floor_price: number | null; chain: string; contract_id: string; contract_name: string; contract_image_url: string | null }[]>(
    `/user/nft_list?id=${address.toLowerCase()}&is_all=false`,
    apiKey,
  );

  return (data ?? []).map((n) => {
    const chain = Object.entries(DEBANK_CHAIN_IDS).find(([, v]) => v === n.chain)?.[0] as Chain | undefined;
    return {
      address: n.contract_id,
      tokenId: n.id,
      name: n.name ?? "NFT",
      image: n.thumbnail_url,
      collection: n.contract_name ?? "Unknown Collection",
      collectionImage: n.contract_image_url,
      floorPrice: n.floor_price,
      chain: chain ?? "ethereum",
    };
  });
}

async function getDebankHistory(address: string, apiKey: string): Promise<PortfolioHistory> {
  // Use DeBank's net_curve endpoint for historical portfolio value
  const data = await debankFetch<{ usd_value_list: { timestamp: number; usd_value: number }[] }>(
    `/user/total_net_curve?id=${address.toLowerCase()}&hours=720`,
    apiKey,
  );

  const list = data?.usd_value_list ?? [];
  return {
    timestamps: list.map((d) => d.timestamp),
    values: list.map((d) => d.usd_value),
    period: "30d",
  };
}

// ────────────────────────────────────────────────────────────
// Covalent Fallback (EVM tokens only, free tier available)
// ────────────────────────────────────────────────────────────

interface CovalentTokenItem {
  contract_address: string;
  contract_name: string;
  contract_ticker_symbol: string;
  logo_url: string | null;
  balance: string;
  contract_decimals: number;
  quote: number;
  quote_rate: number | null;
  quote_rate_24h: number | null;
}

async function getCovalentHoldings(
  address: string,
  chains: Chain[],
  apiKey: string,
): Promise<PortfolioAsset[]> {
  const evmChains = chains.filter((c) => c !== "solana");
  const results = await Promise.allSettled(
    evmChains.map(async (chain) => {
      const chainId = CHAIN_IDS[chain];
      const data = await fetchWithTimeout<{
        data: { items: CovalentTokenItem[] };
      }>(
        `https://api.covalenthq.com/v1/${chainId}/address/${address}/balances_v2/?key=${apiKey}`,
      );
      return { chain, items: data?.data?.items ?? [] };
    }),
  );

  const assets: PortfolioAsset[] = [];

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    const { chain, items } = result.value;

    for (const item of items) {
      const balance = Number(BigInt(item.balance || "0")) / Math.pow(10, item.contract_decimals);
      const valueUsd = item.quote ?? 0;
      if (valueUsd < 0.01) continue;

      const symbol = (item.contract_ticker_symbol ?? "").toUpperCase();
      let category: AssetCategory = classifyAsset(symbol, item.contract_name ?? "");
      if (symbol === NATIVE_SYMBOLS[chain]) category = "native";

      assets.push({
        address: item.contract_address,
        symbol,
        name: item.contract_name ?? symbol,
        logo: item.logo_url,
        balance,
        decimals: item.contract_decimals,
        priceUsd: item.quote_rate ?? null,
        valueUsd,
        change24h: item.quote_rate_24h != null && item.quote_rate != null && item.quote_rate !== 0
          ? ((item.quote_rate - item.quote_rate_24h) / item.quote_rate_24h) * 100
          : null,
        portfolioPercent: 0,
        chain,
        category,
      });
    }
  }

  return assets;
}

// ────────────────────────────────────────────────────────────
// Aggregation Logic
// ────────────────────────────────────────────────────────────

function applyPortfolioPercents(assets: PortfolioAsset[]): PortfolioAsset[] {
  const total = assets.reduce((s, a) => s + a.valueUsd, 0);
  return assets.map((a) => ({ ...a, portfolioPercent: total > 0 ? (a.valueUsd / total) * 100 : 0 }));
}

function buildChainBreakdown(assets: PortfolioAsset[], defiPositions: DefiPosition[]): PortfolioSummary["chainBreakdown"] {
  const byChain: Partial<Record<Chain, number>> = {};
  for (const a of assets) byChain[a.chain] = (byChain[a.chain] ?? 0) + a.valueUsd;
  for (const p of defiPositions) byChain[p.chain] = (byChain[p.chain] ?? 0) + p.valueUsd;
  const total = Object.values(byChain).reduce((s, v) => s + (v ?? 0), 0);
  return (Object.entries(byChain) as [Chain, number][])
    .sort(([, a], [, b]) => b - a)
    .map(([chain, valueUsd]) => ({ chain, valueUsd, percent: total > 0 ? (valueUsd / total) * 100 : 0 }));
}

function buildCategoryBreakdown(assets: PortfolioAsset[]): PortfolioSummary["categoryBreakdown"] {
  const byCat: Partial<Record<AssetCategory, number>> = {};
  for (const a of assets) byCat[a.category] = (byCat[a.category] ?? 0) + a.valueUsd;
  const total = Object.values(byCat).reduce((s, v) => s + (v ?? 0), 0);
  return (Object.entries(byCat) as [AssetCategory, number][])
    .sort(([, a], [, b]) => b - a)
    .map(([category, valueUsd]) => ({ category, valueUsd, percent: total > 0 ? (valueUsd / total) * 100 : 0 }));
}

export async function getPortfolioHoldings(
  address: string,
  chains: Chain[] | "all" = "all",
): Promise<PortfolioAsset[]> {
  const resolvedChains = chains === "all" ? detectChains(address) : chains;
  const assets: PortfolioAsset[] = [];
  const sources: string[] = [];

  if (resolvedChains.includes("solana")) {
    const apiKey = process.env.HELIUS_API_KEY;
    if (apiKey) {
      try {
        const [heliusAssets, solBalance, solPrice] = await Promise.all([
          heliusDasGetAssets(address, apiKey),
          getSolNativeBalance(address, apiKey),
          getSolPrice(),
        ]);

        // Native SOL
        if (solBalance > 0) {
          assets.push({
            address: "So11111111111111111111111111111111111111112",
            symbol: "SOL",
            name: "Solana",
            logo: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
            balance: solBalance,
            decimals: 9,
            priceUsd: solPrice,
            valueUsd: solBalance * solPrice,
            change24h: null,
            portfolioPercent: 0,
            chain: "solana",
            category: "native",
          });
        }

        // SPL tokens
        for (const item of heliusAssets) {
          if (item.interface !== "FungibleToken" && item.interface !== "FungibleAsset") continue;
          const ti = item.token_info;
          if (!ti) continue;
          const balance = (ti.balance ?? 0) / Math.pow(10, ti.decimals ?? 0);
          const price = ti.price_info?.price_per_token ?? 0;
          const valueUsd = balance * price;
          if (valueUsd < 0.01) continue;
          const sym = (ti.symbol ?? item.content.metadata.symbol ?? "").toUpperCase();
          const name = item.content.metadata.name ?? sym;
          const image =
            item.content.links?.image ??
            item.content.files?.[0]?.cdn_uri ??
            item.content.files?.[0]?.uri ??
            null;
          assets.push({
            address: item.id,
            symbol: sym,
            name,
            logo: image,
            balance,
            decimals: ti.decimals ?? 0,
            priceUsd: price,
            valueUsd,
            change24h: null,
            portfolioPercent: 0,
            chain: "solana",
            category: classifyAsset(sym, name),
          });
        }
        sources.push("helius");
      } catch (err) {
        console.error("[portfolio] Helius error:", err);
      }
    }
  }

  const evmChains = resolvedChains.filter((c) => c !== "solana");
  if (evmChains.length > 0) {
    const debankKey = process.env.DEBANK_API_KEY;
    const covalentKey = process.env.COVALENT_API_KEY;

    if (debankKey) {
      try {
        const evmAssets = await getDebankHoldings(address, debankKey);
        // Filter to only requested EVM chains
        const wanted = new Set(evmChains);
        assets.push(...evmAssets.filter((a) => wanted.has(a.chain)));
        sources.push("debank");
      } catch (err) {
        console.error("[portfolio] DeBank holdings error:", err);
        // Try Covalent fallback
        if (covalentKey) {
          try {
            const fallbackAssets = await getCovalentHoldings(address, evmChains, covalentKey);
            assets.push(...fallbackAssets);
            sources.push("covalent");
          } catch (err2) {
            console.error("[portfolio] Covalent fallback error:", err2);
          }
        }
      }
    } else if (covalentKey) {
      try {
        const fallbackAssets = await getCovalentHoldings(address, evmChains, covalentKey);
        assets.push(...fallbackAssets);
        sources.push("covalent");
      } catch (err) {
        console.error("[portfolio] Covalent error:", err);
      }
    }
  }

  return applyPortfolioPercents(assets);
}

export async function getPortfolioDefi(
  address: string,
  chains: Chain[] | "all" = "all",
): Promise<DefiPosition[]> {
  if (!isEvm(address)) return [];

  const debankKey = process.env.DEBANK_API_KEY;
  if (!debankKey) return [];

  try {
    const positions = await getDebankDefi(address, debankKey);
    if (chains === "all") return positions;
    const wanted = new Set(chains);
    return positions.filter((p) => wanted.has(p.chain));
  } catch (err) {
    console.error("[portfolio] DeBank DeFi error:", err);
    return [];
  }
}

export async function getPortfolioNfts(
  address: string,
  chains: Chain[] | "all" = "all",
): Promise<NftItem[]> {
  const resolvedChains = chains === "all" ? detectChains(address) : chains;
  const nfts: NftItem[] = [];

  if (resolvedChains.includes("solana")) {
    const apiKey = process.env.HELIUS_API_KEY;
    if (apiKey) {
      try {
        const allAssets = await heliusDasGetAssets(address, apiKey);
        const nftInterfaces = new Set(["V1_NFT", "ProgrammableNFT", "V2_NFT", "CNFT"]);
        for (const item of allAssets as HeliusNft[]) {
          if (!nftInterfaces.has((item as HeliusAsset).interface)) continue;
          const collection = item.grouping?.find((g) => g.group_key === "collection")?.group_value ?? "";
          const image =
            item.content.links?.image ??
            item.content.files?.[0]?.cdn_uri ??
            item.content.files?.[0]?.uri ??
            null;
          nfts.push({
            address: item.id,
            tokenId: item.id,
            name: item.content.metadata.name ?? "NFT",
            image,
            collection,
            collectionImage: null,
            floorPrice: null,
            chain: "solana",
          });
        }
      } catch (err) {
        console.error("[portfolio] Helius NFT error:", err);
      }
    }
  }

  const evmChains = resolvedChains.filter((c) => c !== "solana");
  if (evmChains.length > 0) {
    const debankKey = process.env.DEBANK_API_KEY;
    if (debankKey) {
      try {
        const evmNfts = await getDebankNfts(address, debankKey);
        const wanted = new Set(evmChains);
        nfts.push(...evmNfts.filter((n) => wanted.has(n.chain)));
      } catch (err) {
        console.error("[portfolio] DeBank NFT error:", err);
      }
    }
  }

  return nfts;
}

export async function getPortfolioHistory(
  address: string,
  period: "7d" | "30d" | "90d" | "1y" = "30d",
): Promise<PortfolioHistory> {
  if (!isEvm(address)) {
    return { timestamps: [], values: [], period };
  }

  const debankKey = process.env.DEBANK_API_KEY;
  if (!debankKey) return { timestamps: [], values: [], period };

  const hoursMap: Record<string, number> = { "7d": 168, "30d": 720, "90d": 2160, "1y": 8760 };
  const hours = hoursMap[period] ?? 720;

  try {
    const data = await debankFetch<{
      usd_value_list: { timestamp: number; usd_value: number }[];
    }>(`/user/total_net_curve?id=${address.toLowerCase()}&hours=${hours}`, debankKey);

    const list = data?.usd_value_list ?? [];
    return {
      timestamps: list.map((d) => d.timestamp),
      values: list.map((d) => d.usd_value),
      period,
    };
  } catch (err) {
    console.error("[portfolio] DeBank history error:", err);
    return { timestamps: [], values: [], period };
  }
}

export async function getPortfolioSummary(address: string): Promise<PortfolioSummary> {
  const resolvedChains = detectChains(address);
  const warnings: string[] = [];
  const sources: string[] = [];

  if (resolvedChains.length === 0) {
    return {
      totalValueUsd: 0,
      change24h: 0,
      change24hPercent: 0,
      chainBreakdown: [],
      categoryBreakdown: [],
      sources: [],
      warnings: ["Unrecognized address format."],
    };
  }

  const hasHelius = !!process.env.HELIUS_API_KEY;
  const hasDebank = !!process.env.DEBANK_API_KEY;
  const hasCovalent = !!process.env.COVALENT_API_KEY;

  if (resolvedChains.includes("solana") && !hasHelius) {
    warnings.push("HELIUS_API_KEY not configured — Solana data unavailable.");
  }
  if (resolvedChains.some((c) => c !== "solana") && !hasDebank && !hasCovalent) {
    warnings.push("No EVM API key configured (DEBANK_API_KEY or COVALENT_API_KEY) — EVM data unavailable.");
  }

  const [holdings, defiPositions] = await Promise.all([
    getPortfolioHoldings(address).catch(() => []),
    getPortfolioDefi(address).catch(() => []),
  ]);

  const totalHoldings = holdings.reduce((s, a) => s + a.valueUsd, 0);
  const totalDefi = defiPositions.reduce((s, p) => s + p.valueUsd, 0);
  const totalValueUsd = totalHoldings + totalDefi;

  // Rough 24h change: sum of (valueUsd * change24h%) for assets that have it
  let weightedChange = 0;
  let weightedBase = 0;
  for (const a of holdings) {
    if (a.change24h != null) {
      weightedChange += a.valueUsd * (a.change24h / 100);
      weightedBase += a.valueUsd;
    }
  }
  const change24h = weightedChange;
  const change24hPercent = weightedBase > 0 ? (weightedChange / weightedBase) * 100 : 0;

  if (hasHelius && resolvedChains.includes("solana")) sources.push("helius");
  if (hasDebank) sources.push("debank");
  else if (hasCovalent) sources.push("covalent");

  return {
    totalValueUsd,
    change24h,
    change24hPercent,
    chainBreakdown: buildChainBreakdown(holdings, defiPositions),
    categoryBreakdown: buildCategoryBreakdown(holdings),
    sources,
    warnings,
  };
}
