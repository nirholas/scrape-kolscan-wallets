export const DUNE_QUERIES: Record<string, number> = {
  // Solana
  "solana-top-traders": 2435924,
  "solana-dex-volume": 2028278,
  "solana-top-100-wallets": 3311589,
  "solana-meme-traders": 3209028,
  "raydium-top-wallets": 2551418,

  // Ethereum
  "eth-smart-money": 3326291,
  "eth-dex-volume": 1258228,
  "eth-whale-movements": 2436278,
  "uniswap-top-wallets": 2041663,
  "kol-twitter-wallets": 1284956,

  // BSC
  "bsc-top-traders": 2726556,

  // Base
  "base-top-traders": 2035353,
  "base-dex-traders-30d": 2763198,
};

function getHeaders() {
  const apiKey = process.env.DUNE_API_KEY;
  return {
    "X-Dune-API-Key": apiKey || "",
    "Content-Type": "application/json",
  };
}

export async function executeDuneQuery(queryId: number, params?: any) {
  const res = await fetch(`https://api.dune.com/api/v1/query/${queryId}/execute`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ query_parameters: params || {} }),
    // Execution caching: 30m
    next: { revalidate: 1800 },
  });
  if (!res.ok) throw new Error(`Dune execute error: ${res.statusText}`);
  return res.json();
}

export async function getDuneExecutionStatus(executionId: string) {
  const res = await fetch(`https://api.dune.com/api/v1/execution/${executionId}/status`, {
    headers: getHeaders(),
    next: { revalidate: 0 }, // Status should not be heavily cached
  });
  if (!res.ok) throw new Error(`Dune status error: ${res.statusText}`);
  return res.json();
}

export async function getDuneExecutionResults(executionId: string, limit = 1000) {
  const res = await fetch(`https://api.dune.com/api/v1/execution/${executionId}/results?limit=${limit}`, {
    headers: getHeaders(),
    // Cached results: 15m
    next: { revalidate: 900 },
  });
  if (!res.ok) throw new Error(`Dune results error: ${res.statusText}`);
  return res.json();
}

export async function getDuneQueryResults(queryId: number, limit = 1000) {
  const res = await fetch(`https://api.dune.com/api/v1/query/${queryId}/results?limit=${limit}`, {
    headers: getHeaders(),
    // Cached results: 15m
    next: { revalidate: 900 },
  });
  if (!res.ok) throw new Error(`Dune query results error: ${res.statusText}`);
  return res.json();
}

export async function getDuneWallet(address: string) {
  // Try EVM first, fallback to Solana etc if needed, but Dune has specific endpoints or unified?
  // Using an echo endpoint placeholder. Echo APIs typically live under echo/v1/
  const res = await fetch(`https://api.dune.com/api/echo/v1/balances/evm/${address}`, {
    headers: getHeaders(),
    next: { revalidate: 300 }, // 5m
  });
  if (!res.ok) throw new Error(`Dune wallet error: ${res.statusText}`);
  return res.json();
}

export async function getDuneEchoTrending(chain: string) {
  // Using an echo endpoint placeholder for trending tokens
  const res = await fetch(`https://api.dune.com/api/echo/v1/trending/tokens/${chain}`, {
    headers: getHeaders(),
    next: { revalidate: 300 }, // Echo trending: 5m
  });
  if (!res.ok) throw new Error(`Dune trending error: ${res.statusText}`);
  return res.json();
}
