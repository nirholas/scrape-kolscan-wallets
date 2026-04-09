/**
 * Multi-source wallet data aggregator
 * Fetches wallet data from multiple APIs in parallel with graceful fallbacks
 */

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export type ChainType = "solana" | "ethereum" | "bsc" | "polygon" | "arbitrum" | "base";

export interface WalletToken {
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
  chain: ChainType;
}

export interface WalletTransaction {
  hash: string;
  type: "swap" | "transfer" | "mint" | "burn" | "nft" | "defi" | "unknown";
  timestamp: number;
  tokenIn?: { symbol: string; amount: number; valueUsd: number | null };
  tokenOut?: { symbol: string; amount: number; valueUsd: number | null };
  valueUsd: number | null;
  fee: number | null;
  chain: ChainType;
  source: string;
}

export interface WalletPnl {
  realized: number;
  unrealized: number;
  total: number;
  winRate: number;
  totalTrades: number;
  bestTrade: { token: string; profit: number } | null;
  worstTrade: { token: string; profit: number } | null;
  dailyPnl: { date: string; pnl: number }[];
  perToken: { symbol: string; address: string; pnl: number; trades: number }[];
}

export interface DefiPosition {
  protocol: string;
  protocolLogo: string | null;
  type: "lending" | "liquidity" | "staking" | "farming" | "other";
  poolName: string;
  valueUsd: number;
  rewards: number;
  apy: number | null;
  chain: ChainType;
}

export interface NFTItem {
  address: string;
  tokenId: string;
  name: string;
  image: string | null;
  collection: string;
  collectionImage: string | null;
  floorPrice: number | null;
  chain: ChainType;
}

export interface WalletSummary {
  address: string;
  chain: ChainType;
  ens: string | null;
  sns: string | null;
  totalValueUsd: number;
  pnl24h: number;
  pnl7d: number;
  pnl30d: number;
  sparkline7d: number[];
  tags: string[];
  twitterHandle: string | null;
  lastActive: number | null;
}

export interface AggregatedWalletData {
  summary: WalletSummary;
  holdings: WalletToken[];
  transactions: WalletTransaction[];
  pnl: WalletPnl;
  defiPositions: DefiPosition[];
  nfts: NFTItem[];
  sources: { name: string; success: boolean; error?: string }[];
}

// ────────────────────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────────────────────

const SOL_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export function detectChain(address: string): ChainType | null {
  if (SOL_ADDRESS_RE.test(address)) return "solana";
  if (EVM_ADDRESS_RE.test(address)) return "ethereum"; // Default EVM to ethereum
  return null;
}

export function isEvmChain(chain: ChainType): boolean {
  return ["ethereum", "bsc", "polygon", "arbitrum", "base"].includes(chain);
}

async function fetchWithTimeout<T>(
  url: string,
  options: RequestInit = {},
  timeoutMs = 10000
): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ────────────────────────────────────────────────────────────
// Source Fetchers - Solana
// ────────────────────────────────────────────────────────────

const GMGN_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const GMGN_HEADERS = {
  "User-Agent": GMGN_UA,
  Accept: "application/json, */*",
  Referer: "https://gmgn.ai/",
};

async function fetchGmgnHoldings(address: string): Promise<WalletToken[]> {
  const gmgnToken = process.env.GMGN_TOKEN;
  const headers: Record<string, string> = { ...GMGN_HEADERS };
  if (gmgnToken) headers.Authorization = `Bearer ${gmgnToken}`;

  const data = await fetchWithTimeout<any>(
    `https://gmgn.ai/defi/quotation/v1/wallet/sol/holdings/${address}?limit=100`,
    { headers }
  );

  if (!data?.data?.holdings) return [];

  return data.data.holdings.map((h: any) => ({
    address: h.token_address || h.address,
    symbol: h.symbol || "???",
    name: h.name || h.symbol || "Unknown",
    logo: h.logo || null,
    balance: Number(h.balance || 0),
    decimals: h.decimals || 9,
    priceUsd: h.price ?? null,
    valueUsd: Number(h.usd_value || h.total_profit || 0),
    change24h: h.price_change_24h ?? null,
    portfolioPercent: 0, // Calculated later
    chain: "solana" as ChainType,
  }));
}

async function fetchGmgnPnl(address: string): Promise<Partial<WalletPnl> | null> {
  const gmgnToken = process.env.GMGN_TOKEN;
  const headers: Record<string, string> = { ...GMGN_HEADERS };
  if (gmgnToken) headers.Authorization = `Bearer ${gmgnToken}`;

  const data = await fetchWithTimeout<any>(
    `https://gmgn.ai/defi/quotation/v1/wallet/sol/${address}/current_profit`,
    { headers }
  );

  if (!data?.data) return null;
  const d = data.data;

  return {
    realized: d.realized_profit_7d || d.realized_profit || 0,
    unrealized: d.unrealized_profit || 0,
    total: (d.realized_profit_7d || 0) + (d.unrealized_profit || 0),
    winRate: d.winrate_7d || d.winrate || 0,
    totalTrades: d.txs_7d || d.txs || 0,
    dailyPnl: (d.daily_profit || []).map((dp: any) => ({
      date: new Date(dp.timestamp * 1000).toISOString().split("T")[0],
      pnl: dp.profit || 0,
    })),
  };
}

async function fetchGmgnActivity(address: string): Promise<WalletTransaction[]> {
  const gmgnToken = process.env.GMGN_TOKEN;
  const headers: Record<string, string> = { ...GMGN_HEADERS };
  if (gmgnToken) headers.Authorization = `Bearer ${gmgnToken}`;

  const data = await fetchWithTimeout<any>(
    `https://gmgn.ai/defi/quotation/v1/wallet/sol/${address}/activity?limit=50`,
    { headers }
  );

  if (!data?.data?.activities) return [];

  return data.data.activities.map((a: any) => ({
    hash: a.tx_hash || a.signature || "",
    type: a.event_type === "swap" ? "swap" : a.event_type === "transfer" ? "transfer" : "unknown",
    timestamp: a.timestamp || 0,
    tokenIn: a.token_in ? { symbol: a.token_in.symbol, amount: a.token_in.amount, valueUsd: a.token_in.usd_value } : undefined,
    tokenOut: a.token_out ? { symbol: a.token_out.symbol, amount: a.token_out.amount, valueUsd: a.token_out.usd_value } : undefined,
    valueUsd: a.usd_value ?? null,
    fee: a.fee ?? null,
    chain: "solana" as ChainType,
    source: "gmgn",
  }));
}

async function fetchHeliusAssets(address: string): Promise<WalletToken[]> {
  const key = process.env.HELIUS_API_KEY;
  if (!key) return [];

  const data = await fetchWithTimeout<any>(
    `https://mainnet.helius-rpc.com/?api-key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "holdings",
        method: "getAssetsByOwner",
        params: {
          ownerAddress: address,
          page: 1,
          limit: 100,
          displayOptions: { showFungible: true, showNativeBalance: true },
        },
      }),
    }
  );

  if (!data?.result?.items) return [];

  return data.result.items
    .filter((item: any) => item.interface === "FungibleToken" || item.interface === "FungibleAsset")
    .map((item: any) => ({
      address: item.id,
      symbol: item.content?.metadata?.symbol || "???",
      name: item.content?.metadata?.name || "Unknown",
      logo: item.content?.links?.image || item.content?.files?.[0]?.uri || null,
      balance: item.token_info?.balance ? Number(item.token_info.balance) / Math.pow(10, item.token_info.decimals || 9) : 0,
      decimals: item.token_info?.decimals || 9,
      priceUsd: item.token_info?.price_info?.price_per_token ?? null,
      valueUsd: item.token_info?.price_info?.total_price ?? 0,
      change24h: null,
      portfolioPercent: 0,
      chain: "solana" as ChainType,
    }));
}

async function fetchHeliusTransactions(address: string): Promise<WalletTransaction[]> {
  const key = process.env.HELIUS_API_KEY;
  if (!key) return [];

  const data = await fetchWithTimeout<any>(
    `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${key}&limit=50`
  );

  if (!Array.isArray(data)) return [];

  return data.map((tx: any) => {
    let type: WalletTransaction["type"] = "unknown";
    if (tx.type === "SWAP") type = "swap";
    else if (tx.type === "TRANSFER") type = "transfer";
    else if (tx.type === "NFT_SALE" || tx.type === "NFT_MINT") type = "nft";

    return {
      hash: tx.signature,
      type,
      timestamp: tx.timestamp || 0,
      tokenIn: tx.tokenTransfers?.[0] ? {
        symbol: tx.tokenTransfers[0].tokenStandard || "SPL",
        amount: tx.tokenTransfers[0].tokenAmount || 0,
        valueUsd: null,
      } : undefined,
      valueUsd: tx.nativeTransfers?.[0]?.amount ? tx.nativeTransfers[0].amount / 1e9 : null,
      fee: tx.fee ? tx.fee / 1e9 : null,
      chain: "solana" as ChainType,
      source: "helius",
    };
  });
}

async function fetchBirdeyePortfolio(address: string): Promise<{ tokens: WalletToken[]; totalValue: number }> {
  const key = process.env.BIRDEYE_API_KEY;
  if (!key) return { tokens: [], totalValue: 0 };

  const data = await fetchWithTimeout<any>(
    `https://public-api.birdeye.so/v1/wallet/token_list?wallet=${address}`,
    { headers: { "X-API-KEY": key, "x-chain": "solana" } }
  );

  if (!data?.data?.items) return { tokens: [], totalValue: 0 };

  const tokens = data.data.items.map((item: any) => ({
    address: item.address,
    symbol: item.symbol || "???",
    name: item.name || "Unknown",
    logo: item.logoURI || null,
    balance: item.uiAmount || 0,
    decimals: item.decimals || 9,
    priceUsd: item.priceUsd ?? null,
    valueUsd: item.valueUsd || 0,
    change24h: item.priceChange24h ?? null,
    portfolioPercent: 0,
    chain: "solana" as ChainType,
  }));

  return { tokens, totalValue: data.data.totalUsd || 0 };
}

// ────────────────────────────────────────────────────────────
// Source Fetchers - EVM
// ────────────────────────────────────────────────────────────

async function fetchMoralisTokens(address: string, chain: ChainType): Promise<WalletToken[]> {
  const key = process.env.MORALIS_API_KEY;
  if (!key) return [];

  const chainMap: Record<ChainType, string> = {
    ethereum: "eth",
    bsc: "bsc",
    polygon: "polygon",
    arbitrum: "arbitrum",
    base: "base",
    solana: "",
  };
  const chainParam = chainMap[chain] || "eth";

  const data = await fetchWithTimeout<any>(
    `https://deep-index.moralis.io/api/v2.2/wallets/${address}/tokens?chain=${chainParam}&exclude_spam=true`,
    { headers: { "X-API-Key": key } }
  );

  if (!data?.result) return [];

  return data.result.map((t: any) => ({
    address: t.token_address,
    symbol: t.symbol || "???",
    name: t.name || "Unknown",
    logo: t.logo || t.thumbnail || null,
    balance: t.balance ? Number(t.balance) / Math.pow(10, t.decimals || 18) : 0,
    decimals: t.decimals || 18,
    priceUsd: t.usd_price ?? null,
    valueUsd: t.usd_value || 0,
    change24h: t.usd_price_24hr_percent_change ?? null,
    portfolioPercent: t.portfolio_percentage || 0,
    chain,
  }));
}

async function fetchMoralisNetWorth(address: string): Promise<number> {
  const key = process.env.MORALIS_API_KEY;
  if (!key) return 0;

  const data = await fetchWithTimeout<any>(
    `https://deep-index.moralis.io/api/v2.2/wallets/${address}/net-worth?exclude_spam=true`,
    { headers: { "X-API-Key": key } }
  );

  return data?.total_networth_usd || 0;
}

async function fetchMoralisHistory(address: string, chain: ChainType): Promise<WalletTransaction[]> {
  const key = process.env.MORALIS_API_KEY;
  if (!key) return [];

  const chainMap: Record<ChainType, string> = {
    ethereum: "eth",
    bsc: "bsc",
    polygon: "polygon",
    arbitrum: "arbitrum",
    base: "base",
    solana: "",
  };
  const chainParam = chainMap[chain] || "eth";

  const data = await fetchWithTimeout<any>(
    `https://deep-index.moralis.io/api/v2.2/wallets/${address}/history?chain=${chainParam}&limit=50`,
    { headers: { "X-API-Key": key } }
  );

  if (!data?.result) return [];

  return data.result.map((tx: any) => ({
    hash: tx.hash,
    type: tx.category === "token swap" ? "swap" : tx.category === "token send" || tx.category === "token receive" ? "transfer" : "unknown",
    timestamp: new Date(tx.block_timestamp).getTime() / 1000,
    valueUsd: tx.summary ? parseFloat(tx.summary.replace(/[^0-9.-]/g, "")) || null : null,
    fee: null,
    chain,
    source: "moralis",
  }));
}

async function fetchMoralisNFTs(address: string, chain: ChainType): Promise<NFTItem[]> {
  const key = process.env.MORALIS_API_KEY;
  if (!key) return [];

  const chainMap: Record<ChainType, string> = {
    ethereum: "eth",
    bsc: "bsc",
    polygon: "polygon",
    arbitrum: "arbitrum",
    base: "base",
    solana: "",
  };
  const chainParam = chainMap[chain] || "eth";

  const data = await fetchWithTimeout<any>(
    `https://deep-index.moralis.io/api/v2.2/${address}/nft?chain=${chainParam}&limit=50`,
    { headers: { "X-API-Key": key } }
  );

  if (!data?.result) return [];

  return data.result.map((nft: any) => ({
    address: nft.token_address,
    tokenId: nft.token_id,
    name: nft.name || `#${nft.token_id}`,
    image: nft.media?.original_media_url || nft.normalized_metadata?.image || null,
    collection: nft.name || "Unknown",
    collectionImage: nft.collection_logo || null,
    floorPrice: nft.floor_price_usd ?? null,
    chain,
  }));
}

async function fetchDebankBalance(address: string): Promise<{ total: number; chains: { chain: string; value: number }[] }> {
  const key = process.env.DEBANK_API_KEY;
  if (!key) return { total: 0, chains: [] };

  const data = await fetchWithTimeout<any>(
    `https://pro-openapi.debank.com/v1/user/total_balance?id=${address.toLowerCase()}`,
    { headers: { AccessKey: key } }
  );

  if (!data) return { total: 0, chains: [] };

  return {
    total: data.total_usd_value || 0,
    chains: (data.chain_list || []).map((c: any) => ({ chain: c.id, value: c.usd_value })),
  };
}

async function fetchDebankTokens(address: string): Promise<WalletToken[]> {
  const key = process.env.DEBANK_API_KEY;
  if (!key) return [];

  const data = await fetchWithTimeout<any>(
    `https://pro-openapi.debank.com/v1/user/all_token_list?id=${address.toLowerCase()}&is_all=true`,
    { headers: { AccessKey: key } }
  );

  if (!Array.isArray(data)) return [];

  return data.map((t: any) => ({
    address: t.id,
    symbol: t.symbol || "???",
    name: t.name || "Unknown",
    logo: t.logo_url || null,
    balance: t.amount || 0,
    decimals: t.decimals || 18,
    priceUsd: t.price ?? null,
    valueUsd: (t.amount || 0) * (t.price || 0),
    change24h: null,
    portfolioPercent: 0,
    chain: t.chain as ChainType || "ethereum",
  }));
}

async function fetchDebankDefi(address: string): Promise<DefiPosition[]> {
  const key = process.env.DEBANK_API_KEY;
  if (!key) return [];

  const data = await fetchWithTimeout<any>(
    `https://pro-openapi.debank.com/v1/user/all_complex_protocol_list?id=${address.toLowerCase()}`,
    { headers: { AccessKey: key } }
  );

  if (!Array.isArray(data)) return [];

  const positions: DefiPosition[] = [];
  for (const protocol of data) {
    for (const portfolio of protocol.portfolio_item_list || []) {
      positions.push({
        protocol: protocol.name || protocol.id,
        protocolLogo: protocol.logo_url || null,
        type: portfolio.name?.toLowerCase().includes("lend") ? "lending" :
              portfolio.name?.toLowerCase().includes("liquidity") ? "liquidity" :
              portfolio.name?.toLowerCase().includes("stake") ? "staking" :
              portfolio.name?.toLowerCase().includes("farm") ? "farming" : "other",
        poolName: portfolio.name || "Unknown",
        valueUsd: portfolio.stats?.net_usd_value || 0,
        rewards: portfolio.stats?.reward_usd_value || 0,
        apy: null,
        chain: protocol.chain as ChainType || "ethereum",
      });
    }
  }

  return positions;
}

// ────────────────────────────────────────────────────────────
// Main Aggregator Functions
// ────────────────────────────────────────────────────────────

export async function fetchWalletHoldings(address: string, chain: ChainType): Promise<WalletToken[]> {
  const sources: { name: string; fetcher: () => Promise<WalletToken[]> }[] = [];

  if (chain === "solana") {
    sources.push({ name: "gmgn", fetcher: () => fetchGmgnHoldings(address) });
    sources.push({ name: "helius", fetcher: () => fetchHeliusAssets(address) });
    sources.push({ name: "birdeye", fetcher: () => fetchBirdeyePortfolio(address).then(r => r.tokens) });
  } else {
    sources.push({ name: "debank", fetcher: () => fetchDebankTokens(address) });
    sources.push({ name: "moralis", fetcher: () => fetchMoralisTokens(address, chain) });
  }

  const results = await Promise.allSettled(sources.map(s => s.fetcher()));
  
  // Merge results, prioritizing first successful source with most data
  const allTokens: Map<string, WalletToken> = new Map();
  
  for (const result of results) {
    if (result.status === "fulfilled" && result.value.length > 0) {
      for (const token of result.value) {
        const key = token.address.toLowerCase();
        if (!allTokens.has(key) || (token.valueUsd > (allTokens.get(key)?.valueUsd || 0))) {
          allTokens.set(key, token);
        }
      }
    }
  }

  const tokens = Array.from(allTokens.values());
  const totalValue = tokens.reduce((sum, t) => sum + t.valueUsd, 0);
  
  // Calculate portfolio percentages
  for (const token of tokens) {
    token.portfolioPercent = totalValue > 0 ? (token.valueUsd / totalValue) * 100 : 0;
  }

  return tokens.sort((a, b) => b.valueUsd - a.valueUsd);
}

export async function fetchWalletTransactions(
  address: string,
  chain: ChainType,
  limit = 50
): Promise<WalletTransaction[]> {
  const sources: { name: string; fetcher: () => Promise<WalletTransaction[]> }[] = [];

  if (chain === "solana") {
    sources.push({ name: "gmgn", fetcher: () => fetchGmgnActivity(address) });
    sources.push({ name: "helius", fetcher: () => fetchHeliusTransactions(address) });
  } else {
    sources.push({ name: "moralis", fetcher: () => fetchMoralisHistory(address, chain) });
  }

  const results = await Promise.allSettled(sources.map(s => s.fetcher()));
  
  // Merge and deduplicate by hash
  const txMap: Map<string, WalletTransaction> = new Map();
  
  for (const result of results) {
    if (result.status === "fulfilled") {
      for (const tx of result.value) {
        if (tx.hash && !txMap.has(tx.hash)) {
          txMap.set(tx.hash, tx);
        }
      }
    }
  }

  return Array.from(txMap.values())
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

export async function fetchWalletPnl(address: string, chain: ChainType): Promise<WalletPnl> {
  const defaultPnl: WalletPnl = {
    realized: 0,
    unrealized: 0,
    total: 0,
    winRate: 0,
    totalTrades: 0,
    bestTrade: null,
    worstTrade: null,
    dailyPnl: [],
    perToken: [],
  };

  if (chain === "solana") {
    const gmgnPnl = await fetchGmgnPnl(address);
    if (gmgnPnl) {
      return { ...defaultPnl, ...gmgnPnl };
    }
  }

  // For EVM, we'd need additional sources like Moralis profitability endpoint
  if (isEvmChain(chain)) {
    const key = process.env.MORALIS_API_KEY;
    if (key) {
      const data = await fetchWithTimeout<any>(
        `https://deep-index.moralis.io/api/v2.2/wallets/${address}/profitability/summary`,
        { headers: { "X-API-Key": key } }
      );
      if (data) {
        return {
          ...defaultPnl,
          realized: data.total_realized_profit_usd || 0,
          winRate: data.total_count_of_trades > 0 
            ? (data.total_count_of_trades - (data.total_sold_count || 0)) / data.total_count_of_trades 
            : 0,
          totalTrades: data.total_count_of_trades || 0,
        };
      }
    }
  }

  return defaultPnl;
}

export async function fetchWalletDefi(address: string, chain: ChainType): Promise<DefiPosition[]> {
  if (chain === "solana") {
    return []; // Solana DeFi positions not as well supported
  }

  return fetchDebankDefi(address);
}

export async function fetchWalletNFTs(address: string, chain: ChainType): Promise<NFTItem[]> {
  if (chain === "solana") {
    // Helius already returns NFTs via getAssetsByOwner, could extend
    return [];
  }

  return fetchMoralisNFTs(address, chain);
}

export async function fetchWalletSummary(address: string, chain: ChainType): Promise<WalletSummary> {
  const summary: WalletSummary = {
    address,
    chain,
    ens: null,
    sns: null,
    totalValueUsd: 0,
    pnl24h: 0,
    pnl7d: 0,
    pnl30d: 0,
    sparkline7d: [],
    tags: [],
    twitterHandle: null,
    lastActive: null,
  };

  if (chain === "solana") {
    const [holdings, pnl] = await Promise.all([
      fetchWalletHoldings(address, chain),
      fetchGmgnPnl(address),
    ]);

    summary.totalValueUsd = holdings.reduce((sum, t) => sum + t.valueUsd, 0);
    if (pnl) {
      summary.pnl7d = pnl.realized || 0;
      summary.sparkline7d = (pnl.dailyPnl || []).map(d => d.pnl);
    }
  } else {
    const [debankBalance, moralisWorth] = await Promise.all([
      fetchDebankBalance(address),
      fetchMoralisNetWorth(address),
    ]);

    summary.totalValueUsd = debankBalance.total || moralisWorth;
  }

  return summary;
}

export async function aggregateWalletData(
  address: string,
  chain?: ChainType
): Promise<AggregatedWalletData> {
  const detectedChain = chain || detectChain(address);
  if (!detectedChain) {
    throw new Error("Invalid wallet address format");
  }

  const sources: { name: string; success: boolean; error?: string }[] = [];

  const [holdings, transactions, pnl, defiPositions, nfts, summary] = await Promise.all([
    fetchWalletHoldings(address, detectedChain).then(r => { sources.push({ name: "holdings", success: true }); return r; }).catch(e => { sources.push({ name: "holdings", success: false, error: e.message }); return []; }),
    fetchWalletTransactions(address, detectedChain).then(r => { sources.push({ name: "transactions", success: true }); return r; }).catch(e => { sources.push({ name: "transactions", success: false, error: e.message }); return []; }),
    fetchWalletPnl(address, detectedChain).then(r => { sources.push({ name: "pnl", success: true }); return r; }).catch(e => { sources.push({ name: "pnl", success: false, error: e.message }); return { realized: 0, unrealized: 0, total: 0, winRate: 0, totalTrades: 0, bestTrade: null, worstTrade: null, dailyPnl: [], perToken: [] }; }),
    fetchWalletDefi(address, detectedChain).then(r => { sources.push({ name: "defi", success: true }); return r; }).catch(e => { sources.push({ name: "defi", success: false, error: e.message }); return []; }),
    fetchWalletNFTs(address, detectedChain).then(r => { sources.push({ name: "nfts", success: true }); return r; }).catch(e => { sources.push({ name: "nfts", success: false, error: e.message }); return []; }),
    fetchWalletSummary(address, detectedChain).then(r => { sources.push({ name: "summary", success: true }); return r; }).catch(e => { sources.push({ name: "summary", success: false, error: e.message }); return { address, chain: detectedChain, ens: null, sns: null, totalValueUsd: 0, pnl24h: 0, pnl7d: 0, pnl30d: 0, sparkline7d: [], tags: [], twitterHandle: null, lastActive: null }; }),
  ]);

  return {
    summary,
    holdings,
    transactions,
    pnl,
    defiPositions,
    nfts,
    sources,
  };
}
