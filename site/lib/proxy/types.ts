/**
 * Shared types for EVM proxy routes
 */

// Chain mappings
export const EVM_CHAINS = ["eth", "bsc", "polygon", "arbitrum", "optimism", "base", "avalanche"] as const;
export type EvmChain = (typeof EVM_CHAINS)[number];

export const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  eth: 1,
  bsc: 56,
  polygon: 137,
  arbitrum: 42161,
  optimism: 10,
  base: 8453,
  avalanche: 43114,
  fantom: 250,
};

export const COVALENT_CHAIN_NAMES: Record<string, string> = {
  eth: "eth-mainnet",
  bsc: "bsc-mainnet",
  polygon: "matic-mainnet",
  arbitrum: "arbitrum-mainnet",
  optimism: "optimism-mainnet",
  base: "base-mainnet",
  avalanche: "avalanche-mainnet",
};

export const MORALIS_CHAIN_NAMES: Record<string, string> = {
  eth: "eth",
  bsc: "bsc",
  polygon: "polygon",
  arbitrum: "arbitrum",
  optimism: "optimism",
  base: "base",
  avalanche: "avalanche",
};

// Cache TTL configurations (in seconds)
export const CACHE_TTL = {
  tokenPrice: 30,
  walletBalances: 120,
  defiPositions: 300,
  nfts: 600,
  transactions: 60,
  gasPrices: 15,
  chainInfo: 3600,
} as const;

// Stale-while-revalidate durations (in seconds)
export const CACHE_STALE = {
  tokenPrice: 120,
  walletBalances: 600,
  defiPositions: 1800,
  nfts: 3600,
  transactions: 300,
  gasPrices: 60,
  chainInfo: 86400,
} as const;

// Token balance interface
export interface TokenBalance {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  balanceFormatted: string;
  usdValue: number;
  price: number;
  logo?: string;
  verified?: boolean;
}

// DeFi position interface
export interface DefiPosition {
  protocol: string;
  protocolLogo?: string;
  chain: string;
  type: string;
  tvl: number;
  tokens: {
    symbol: string;
    amount: string;
    usdValue: number;
  }[];
}

// Unified EVM wallet response
export interface UnifiedEvmWallet {
  address: string;
  chains: string[];
  totalBalance: number;
  balanceByChain: {
    [chain: string]: {
      native: { balance: string; usd: number };
      tokens: TokenBalance[];
      nfts: number;
      defi: { protocols: number; totalValue: number };
    };
  };
  defiPositions: DefiPosition[];
  netWorth: number;
  profitability: { realized: number; unrealized: number };
  sources: {
    moralis: boolean;
    debank: boolean;
    alchemy: boolean;
    etherscan: boolean;
    covalent: boolean;
  };
  timestamp: number;
}

// Proxy error response
export interface ProxyError {
  error: string;
  code: string;
  details?: string;
}

// Validate EVM address
export function isValidEvmAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Validate chain parameter
export function isValidChain(chain: string): chain is EvmChain {
  return EVM_CHAINS.includes(chain as EvmChain);
}

// Get cache headers
export function getCacheHeaders(ttl: number, stale: number): HeadersInit {
  return {
    "Cache-Control": `public, s-maxage=${ttl}, stale-while-revalidate=${stale}`,
  };
}
