export interface SourceConfig {
  baseUrl: string;
  headers?: Record<string, string>;
  appendKey?: { param: string; value: string };
}

export const sources: Record<string, SourceConfig> = {
  helius: {
    baseUrl: 'https://api.helius.xyz',
    appendKey: { param: 'api-key', value: process.env.HELIUS_API_KEY || '' }
  },
  helius_rpc: {
    baseUrl: 'https://mainnet.helius-rpc.com',
    appendKey: { param: 'api-key', value: process.env.HELIUS_API_KEY || '' }
  },
  birdeye: {
    baseUrl: 'https://public-api.birdeye.so',
    headers: {
      'X-API-KEY': process.env.BIRDEYE_API_KEY || '',
      'x-chain': 'solana',
    }
  },
  solscan: {
    baseUrl: 'https://public-api.solscan.io',
    headers: {
      ...(process.env.SOLSCAN_API_KEY ? { token: process.env.SOLSCAN_API_KEY } : {})
    }
  },
  jupiter: {
    baseUrl: 'https://quote-api.jup.ag/v6',
  },
  jupiter_price: {
    baseUrl: 'https://price.jup.ag/v6',
  },
  jupiter_tokens: {
    baseUrl: 'https://tokens.jup.ag',
  }
};
