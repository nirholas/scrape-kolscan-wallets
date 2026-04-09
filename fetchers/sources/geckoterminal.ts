/**
 * GeckoTerminal fetcher — public API, no key required
 * Docs: https://api.geckoterminal.com/docs
 *
 * Endpoints hit:
 * - /networks (all supported chains)
 * - /networks/:network/trending_pools
 * - /networks/:network/new_pools
 * - /networks/:network/pools?sort=h24_volume_usd_liquidity_desc
 * - /networks/:network/dexes
 * - /networks/trending_pools (global)
 * - /tokens/info_recently_updated
 */

import { fetchJSON, saveArchive, log, sleep } from "../lib/utils.ts";

const BASE = "https://api.geckoterminal.com/api/v2";
const SRC = "geckoterminal";
const HEADERS = { Accept: "application/json;version=20230302" };

// High-value networks to deep-fetch
const PRIORITY_NETWORKS = [
  "solana", "eth", "bsc", "base", "arbitrum", "polygon_pos",
  "avalanche", "fantom", "optimism", "sui-network", "ton",
];

export async function runGeckoTerminal() {
  log(SRC, "Starting GeckoTerminal full fetch...");

  // 1. All supported networks
  const networks = await fetchJSON(`${BASE}/networks?page=1`, { source: SRC, headers: HEADERS });
  if (networks) saveArchive(SRC, "networks", networks);
  await sleep(500);

  // Also get page 2+
  const networks2 = await fetchJSON(`${BASE}/networks?page=2`, { source: SRC, headers: HEADERS });
  if (networks2) saveArchive(SRC, "networks-page2", networks2);
  await sleep(500);

  // 2. Global trending pools
  const globalTrending = await fetchJSON(`${BASE}/networks/trending_pools?include=base_token,quote_token,dex,network&page=1`, {
    source: SRC, headers: HEADERS,
  });
  if (globalTrending) saveArchive(SRC, "global-trending-pools", globalTrending);
  await sleep(500);

  // Global new pools
  const globalNew = await fetchJSON(`${BASE}/networks/new_pools?include=base_token,quote_token,dex,network&page=1`, {
    source: SRC, headers: HEADERS,
  });
  if (globalNew) saveArchive(SRC, "global-new-pools", globalNew);
  await sleep(500);

  // 3. Recently updated token info
  const recentTokens = await fetchJSON(`${BASE}/tokens/info_recently_updated?include=network&page=1`, {
    source: SRC, headers: HEADERS,
  });
  if (recentTokens) saveArchive(SRC, "tokens-recently-updated", recentTokens);
  await sleep(500);

  // 4. Per-network: trending, new, top-volume pools + dexes
  for (const network of PRIORITY_NETWORKS) {
    const networkData: any = { network };

    log(SRC, `Fetching network: ${network}`);

    const trending = await fetchJSON(
      `${BASE}/networks/${network}/trending_pools?include=base_token,quote_token,dex&page=1`,
      { source: SRC, headers: HEADERS }
    );
    if (trending) networkData.trending_pools = trending;
    await sleep(400);

    const newPools = await fetchJSON(
      `${BASE}/networks/${network}/new_pools?include=base_token,quote_token,dex&page=1`,
      { source: SRC, headers: HEADERS }
    );
    if (newPools) networkData.new_pools = newPools;
    await sleep(400);

    const topVolume = await fetchJSON(
      `${BASE}/networks/${network}/pools?sort=h24_volume_usd_liquidity_desc&include=base_token,quote_token,dex&page=1`,
      { source: SRC, headers: HEADERS }
    );
    if (topVolume) networkData.top_volume_pools = topVolume;
    await sleep(400);

    const dexes = await fetchJSON(`${BASE}/networks/${network}/dexes`, {
      source: SRC, headers: HEADERS,
    });
    if (dexes) networkData.dexes = dexes;
    await sleep(400);

    saveArchive(SRC, `network-${network}`, networkData);
  }

  log(SRC, "GeckoTerminal fetch complete.");
}
