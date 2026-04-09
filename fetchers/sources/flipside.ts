/**
 * Flipside Crypto fetcher — free API key required
 * Docs: https://docs.flipsidecrypto.xyz/flipside-api/get-started
 *
 * Free tier: generous SQL access.
 * Strategy: Run pre-built SQL queries for smart money analysis.
 *
 * Chains: Solana, Ethereum, Base, Arbitrum, BSC, Polygon
 */

import { fetchJSON, saveArchive, log, sleep, env, hasKey } from "../lib/utils.ts";
import { loadSolWallets, loadEvmWallets } from "../lib/wallets.ts";

const BASE = "https://api-v2.flipsidecrypto.xyz";
const SRC = "flipside";

function headers(): Record<string, string> {
  return { "x-api-key": env("FLIPSIDE_API_KEY") || "" };
}

// Pre-built SQL queries for smart money / KOL / whale analysis
const QUERIES: { name: string; sql: string }[] = [
  {
    name: "solana-top-traders-7d",
    sql: `
      SELECT
        tx_from AS wallet,
        COUNT(DISTINCT tx_id) AS tx_count,
        SUM(swap_to_amount_usd) AS total_buy_usd,
        SUM(swap_from_amount_usd) AS total_sell_usd,
        SUM(swap_to_amount_usd - swap_from_amount_usd) AS pnl_usd
      FROM solana.defi.ez_dex_swaps
      WHERE block_timestamp >= CURRENT_TIMESTAMP - INTERVAL '7 days'
        AND swap_to_amount_usd > 10
      GROUP BY 1
      HAVING SUM(swap_to_amount_usd) > 50000
      ORDER BY pnl_usd DESC
      LIMIT 500
    `.trim(),
  },
  {
    name: "solana-kol-wallets-30d",
    sql: `
      SELECT
        tx_from AS wallet,
        COUNT(DISTINCT swap_to_mint) AS tokens_traded,
        COUNT(DISTINCT tx_id) AS total_trades,
        SUM(swap_to_amount_usd) AS total_volume_usd,
        SUM(CASE WHEN swap_to_amount_usd > swap_from_amount_usd THEN 1 ELSE 0 END) AS winning_trades,
        COUNT(*) AS all_trades,
        SUM(CASE WHEN swap_to_amount_usd > swap_from_amount_usd THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) AS win_rate
      FROM solana.defi.ez_dex_swaps
      WHERE block_timestamp >= CURRENT_TIMESTAMP - INTERVAL '30 days'
        AND swap_to_amount_usd > 1
      GROUP BY 1
      HAVING COUNT(DISTINCT tx_id) >= 20 AND SUM(swap_to_amount_usd) > 10000
      ORDER BY total_volume_usd DESC
      LIMIT 500
    `.trim(),
  },
  {
    name: "eth-smart-money-wallets-30d",
    sql: `
      SELECT
        from_address AS wallet,
        COUNT(DISTINCT tx_hash) AS tx_count,
        SUM(amount_usd) AS total_volume_usd,
        COUNT(DISTINCT contract_address) AS tokens_swapped,
        MAX(block_timestamp) AS last_active
      FROM ethereum.defi.ez_dex_swaps
      WHERE block_timestamp >= CURRENT_TIMESTAMP - INTERVAL '30 days'
        AND amount_usd > 10
      GROUP BY 1
      HAVING SUM(amount_usd) > 100000
      ORDER BY total_volume_usd DESC
      LIMIT 500
    `.trim(),
  },
  {
    name: "base-top-traders-30d",
    sql: `
      SELECT
        origin_from_address AS wallet,
        COUNT(DISTINCT tx_hash) AS tx_count,
        SUM(amount_usd) AS total_volume_usd,
        COUNT(DISTINCT token_in) AS tokens_in,
        COUNT(DISTINCT token_out) AS tokens_out
      FROM base.defi.ez_dex_swaps
      WHERE block_timestamp >= CURRENT_TIMESTAMP - INTERVAL '30 days'
        AND amount_usd > 10
      GROUP BY 1
      HAVING SUM(amount_usd) > 10000
      ORDER BY total_volume_usd DESC
      LIMIT 500
    `.trim(),
  },
  {
    name: "solana-new-whale-wallets",
    sql: `
      SELECT
        account_address AS wallet,
        balance / 1e9 AS sol_balance,
        first_tx_block_timestamp AS first_seen
      FROM solana.core.dim_labels
      WHERE label_type = 'cex' OR label_subtype = 'whale'
      LIMIT 1000
    `.trim(),
  },
  {
    name: "solana-trending-tokens-24h",
    sql: `
      SELECT
        swap_to_mint AS token_address,
        COUNT(DISTINCT tx_from) AS unique_buyers,
        COUNT(DISTINCT tx_id) AS buy_count,
        SUM(swap_from_amount_usd) AS buy_volume_usd
      FROM solana.defi.ez_dex_swaps
      WHERE block_timestamp >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
        AND swap_from_amount_usd > 1
      GROUP BY 1
      HAVING COUNT(DISTINCT tx_from) >= 10
      ORDER BY unique_buyers DESC
      LIMIT 200
    `.trim(),
  },
];

async function runQuery(name: string, sql: string): Promise<any> {
  const h = headers();

  // Create the query run
  const create = await fetchJSON(`${BASE}/queries/run`, {
    method: "POST",
    source: SRC,
    headers: h,
    body: JSON.stringify({
      sql,
      ttl_minutes: 60,
      cached: true,
      timeout_minutes: 10,
      retry_backoff_seconds: 10,
      page_size: 10000,
      page_number: 1,
    }),
  });

  if (!create?.queryRunId) {
    log(SRC, `Failed to create query run for ${name}: ${JSON.stringify(create)}`);
    return null;
  }

  const runId = create.queryRunId;

  // Poll for completion
  for (let i = 0; i < 20; i++) {
    await sleep(3000);

    const status = await fetchJSON(`${BASE}/queries/run/${runId}`, {
      source: SRC, headers: h,
    });

    if (status?.state === "QUERY_STATE_SUCCESS" || status?.queryRun?.state === "QUERY_STATE_SUCCESS") {
      // Fetch results
      const results = await fetchJSON(`${BASE}/queries/run/${runId}/results`, {
        source: SRC, headers: h,
      });
      log(SRC, `Query ${name} complete: ${results?.rows?.length ?? 0} rows`);
      return results;
    }

    if (status?.state?.includes("FAILED") || status?.queryRun?.state?.includes("FAILED")) {
      log(SRC, `Query ${name} failed`);
      return null;
    }

    log(SRC, `Query ${name} state: ${status?.state ?? status?.queryRun?.state} (${i + 1}/20)...`);
  }

  log(SRC, `Query ${name} timed out`);
  return null;
}

export async function runFlipside() {
  if (!hasKey("FLIPSIDE_API_KEY")) {
    log(SRC, "Warning: No FLIPSIDE_API_KEY — skipping (required for Flipside queries)");
    return;
  }

  log(SRC, "Starting Flipside fetch...");

  for (const q of QUERIES) {
    log(SRC, `Running query: ${q.name}`);
    const result = await runQuery(q.name, q.sql);
    if (result) {
      saveArchive(SRC, `query-${q.name}`, result);
    }
    await sleep(5000);
  }

  log(SRC, "Flipside fetch complete.");
}
