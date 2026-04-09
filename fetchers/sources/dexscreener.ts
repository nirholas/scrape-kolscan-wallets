/**
 * DexScreener fetcher — fully public, no API key required
 * Docs: https://docs.dexscreener.com/api/reference
 *
 * Endpoints hit:
 * - /dex/search?q=SOL  (token search trends)
 * - /dex/pairs/:chainId/:pairAddresses (pair data)
 * - /dex/tokens/:tokenAddresses (token profiles)
 * - /token-profiles/latest/v1 (latest token profiles)
 * - /token-boosts/latest/v1 (boosted tokens)
 * - /token-boosts/top/v1 (top boosted tokens)
 * - /orders/v1/:chainId/:tokenAddress (orders per token)
 * - /latest/dex/tokens (trending on each chain)
 */

import { fetchJSON, saveArchive, log, sleep } from "../lib/utils.ts";

const BASE = "https://api.dexscreener.com";
const SRC = "dexscreener";

const CHAINS = [
  "solana", "ethereum", "bsc", "base", "arbitrum", "polygon",
  "avalanche", "fantom", "optimism", "cronos", "sui", "ton",
];

const TRENDING_QUERIES = [
  "SOL", "ETH", "BNB", "TRUMP", "AI", "meme", "dog", "pepe",
  "RWA", "DeFi", "bot", "pump", "moon", "ape", "whale",
];

export async function runDexScreener() {
  log(SRC, "Starting DexScreener full fetch...");

  // 1. Token profiles (latest)
  const profiles = await fetchJSON(`${BASE}/token-profiles/latest/v1`, { source: SRC });
  if (profiles) saveArchive(SRC, "token-profiles-latest", profiles);
  log(SRC, `Token profiles: ${Array.isArray(profiles) ? profiles.length : "?"} entries`);
  await sleep(500);

  // 2. Token boosts latest
  const boostsLatest = await fetchJSON(`${BASE}/token-boosts/latest/v1`, { source: SRC });
  if (boostsLatest) saveArchive(SRC, "token-boosts-latest", boostsLatest);
  await sleep(500);

  // 3. Token boosts top
  const boostsTop = await fetchJSON(`${BASE}/token-boosts/top/v1`, { source: SRC });
  if (boostsTop) saveArchive(SRC, "token-boosts-top", boostsTop);
  await sleep(500);

  // 4. Trending search queries
  const allSearchResults: any[] = [];
  for (const q of TRENDING_QUERIES) {
    const res = await fetchJSON(`${BASE}/latest/dex/search/?q=${encodeURIComponent(q)}`, { source: SRC });
    if (res?.pairs) {
      allSearchResults.push({ query: q, pairs: res.pairs });
      log(SRC, `Search "${q}": ${res.pairs.length} pairs`);
    }
    await sleep(400);
  }
  saveArchive(SRC, "search-trending", allSearchResults);

  // 5. Latest tokens per chain
  const chainResults: any[] = [];
  for (const chain of CHAINS) {
    const res = await fetchJSON(`${BASE}/token-profiles/latest/v1?chainId=${chain}`, { source: SRC });
    if (res) chainResults.push({ chain, data: res });
    await sleep(400);
  }
  saveArchive(SRC, "chain-latest-tokens", chainResults);

  log(SRC, "DexScreener fetch complete.");
}
