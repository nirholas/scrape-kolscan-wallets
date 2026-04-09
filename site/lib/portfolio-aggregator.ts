/**
 * Multi-chain portfolio data aggregator.
 * Fetches and unifies wallet data from various sources across multiple blockchains.
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
}

export interface DefiPosition {
  protocol: string;
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
}

export interface PortfolioHistory {
  timestamps: number[];
  values: number[];
}

// ────────────────────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────────────────────

const SOL_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export function detectChains(address: string): Chain[] {
  if (SOL_ADDRESS_RE.test(address)) return ["solana"];
  if (EVM_ADDRESS_RE.test(address)) {
    // Return all supported EVM chains, as an EVM address is valid on all
    return ["ethereum", "bsc", "polygon", "arbitrum", "base", "optimism", "avalanche"];
  }
  return [];
}

async function fetchWithTimeout<T>(
  url: string,
  options: RequestInit = {},
  timeoutMs = 10000
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Request failed with status ${res.status}: ${await res.text()}`);
    }
    return await res.json();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

// ────────────────────────────────────────────────────────────
// Data Fetchers
// ────────────────────────────────────────────────────────────

// ... Implement data fetchers for Solana (Helius, Birdeye) and EVM (DeBank, Moralis, Covalent) ...

// ────────────────────────────────────────────────────────────
// Aggregation Logic
// ────────────────────────────────────────────────────────────

export async function getPortfolioHoldings(address: string, chains: Chain[] | "all" = "all"): Promise<PortfolioAsset[]> {
  // ...
  return [];
}

export async function getPortfolioDefi(address: string, chains: Chain[] | "all" = "all"): Promise<DefiPosition[]> {
  // ...
  return [];
}

export async function getPortfolioNfts(address: string, chains: Chain[] | "all" = "all"): Promise<NftItem[]> {
  // ...
  return [];
}

export async function getPortfolioHistory(address: string, period: "7d" | "30d" | "90d" | "1y" = "30d"): Promise<PortfolioHistory> {
  // ...
  return { timestamps: [], values: [] };
}

export async function getPortfolioSummary(address: string): Promise<PortfolioSummary> {
  // ...
  return {
    totalValueUsd: 0,
    change24h: 0,
    change24hPercent: 0,
    chainBreakdown: [],
  };
}
