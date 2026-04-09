/**
 * Dune Analytics fetcher — free API key required
 * Docs: https://docs.dune.com/api-reference/overview/introduction
 *
 * Free tier: 1000 credits/month, 10 req/min
 *
 * Strategy: Execute pre-built public queries for:
 * - Smart money wallets (labeled)
 * - KOL trader leaderboards
 * - Whale activity
 * - DEX volume leaders
 * - Solana top traders
 * - NFT top collectors
 *
 * Also uses Echo API for trending queries.
 */

import { fetchJSON, saveArchive, log, sleep, env, hasKey } from "../lib/utils.ts";
import { loadSolWallets, loadEvmWallets } from "../lib/wallets.ts";

const BASE = "https://api.dune.com/api/v1";
const SRC = "dune";

// Curated public query IDs relevant to smart money / KOL / wallets
// These are well-known public Dune queries
const PUBLIC_QUERIES: { id: number; name: string }[] = [
  { id: 2435924, name: "solana-top-traders-pnl" },
  { id: 2028278, name: "solana-dex-volume-daily" },
  { id: 3326291, name: "smart-money-eth-top-wallets" },
  { id: 1258228, name: "eth-dex-volume-by-protocol" },
  { id: 2726556, name: "bsc-top-traders" },
  { id: 2035353, name: "base-chain-top-traders" },
  { id: 3209028, name: "solana-meme-coin-traders" },
  { id: 2041663, name: "uniswap-top-wallets" },
  { id: 2551418, name: "raydium-top-wallets-pnl" },
  { id: 2724854, name: "solana-new-wallets-daily" },
  { id: 3107899, name: "defi-smart-money-label" },
  { id: 2436278, name: "whale-wallet-eth-movements" },
  { id: 1284956, name: "crypto-twitter-kol-wallets" },
  { id: 3311589, name: "solana-top-100-wallets-30d" },
  { id: 2763198, name: "base-dex-top-traders-30d" },
];

function headers(): Record<string, string> {
  return { "X-Dune-API-Key": env("DUNE_API_KEY") || "" };
}

async function executeQuery(queryId: number, name: string): Promise<any> {
  const h = headers();

  // First: try to get latest results without re-executing (uses 0 credits)
  const latest = await fetchJSON(`${BASE}/query/${queryId}/results?limit=1000`, {
    source: SRC, headers: h,
  });

  if (latest?.result?.rows?.length > 0) {
    log(SRC, `Fetched cached results for query ${queryId} (${name}): ${latest.result.rows.length} rows`);
    return latest;
  }

  // If no cached result, execute the query (costs credits)
  log(SRC, `Executing query ${queryId} (${name})...`);
  const exec = await fetchJSON(`${BASE}/query/${queryId}/execute`, {
    method: "POST",
    source: SRC,
    headers: h,
    body: JSON.stringify({ performance: "medium" }),
  });

  if (!exec?.execution_id) {
    log(SRC, `Failed to execute query ${queryId}`);
    return null;
  }

  // Poll for results (max 60s)
  for (let i = 0; i < 12; i++) {
    await sleep(5000);
    const status = await fetchJSON(`${BASE}/execution/${exec.execution_id}/status`, {
      source: SRC, headers: h,
    });

    if (status?.state === "QUERY_STATE_COMPLETED") {
      const results = await fetchJSON(
        `${BASE}/execution/${exec.execution_id}/results?limit=1000`,
        { source: SRC, headers: h }
      );
      log(SRC, `Query ${queryId} complete: ${results?.result?.rows?.length ?? 0} rows`);
      return results;
    }

    if (status?.state?.includes("FAILED") || status?.state?.includes("CANCELLED")) {
      log(SRC, `Query ${queryId} failed: ${status.state}`);
      return null;
    }

    log(SRC, `Query ${queryId} state: ${status?.state} (${i + 1}/12)...`);
  }

  log(SRC, `Query ${queryId} timed out`);
  return null;
}

export async function runDune() {
  if (!hasKey("DUNE_API_KEY")) {
    log(SRC, "Warning: No DUNE_API_KEY — using public endpoint only");
  }

  log(SRC, "Starting Dune Analytics fetch...");

  for (const q of PUBLIC_QUERIES) {
    const result = await executeQuery(q.id, q.name);
    if (result) {
      saveArchive(SRC, `query-${q.id}-${q.name}`, result);
    }
    await sleep(6000); // 10 req/min limit
  }

  // Also hit the Dune Echo API for trending tokens/narratives
  const trendingNarratives = await fetchJSON("https://api.dune.com/api/echo/v1/tokens/trending/evm", {
    source: SRC,
    headers: headers(),
  });
  if (trendingNarratives) saveArchive(SRC, "echo-trending-evm", trendingNarratives);
  await sleep(1000);

  const trendingSol = await fetchJSON("https://api.dune.com/api/echo/v1/tokens/trending/solana", {
    source: SRC,
    headers: headers(),
  });
  if (trendingSol) saveArchive(SRC, "echo-trending-solana", trendingSol);
  await sleep(1000);

  // Labeled wallet data
  const walletList = [...loadSolWallets().slice(0, 30), ...loadEvmWallets().slice(0, 30)];
  for (const wallet of walletList) {
    const profile = await fetchJSON(`${BASE}/wallet/${wallet}`, {
      source: SRC, headers: headers(), delayMs: 100,
    });
    if (profile) {
      saveArchive(SRC, `wallet-profile-${wallet.slice(0, 8)}`, profile);
    }
    await sleep(6000);
  }

  log(SRC, "Dune fetch complete.");
}
