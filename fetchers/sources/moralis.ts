/**
 * Moralis fetcher — free API key required (25 req/sec free tier)
 * Docs: https://docs.moralis.com/web3-data-api/evm/reference
 *
 * Endpoints hit:
 * - /wallets/:address/tokens (ERC-20 balances)
 * - /wallets/:address/history (full history)
 * - /wallets/:address/net-worth
 * - /wallets/:address/profitability/top-tokens
 * - /wallets/:address/chains
 * - /wallets/:address/nfts
 * - /wallets/:address/defi/positions
 * - /erc20/metadata (token metadata)
 * - /market-data/global/marked-cap (global stats)
 * - /market-data/erc20s/top-tokens
 * - /market-data/erc20s/trending
 * - /discovery/whales (whale wallets)
 *
 * Solana endpoints:
 * - /sol/account/:address/tokens
 * - /sol/account/:address/portfolio
 */

import { fetchJSON, saveArchive, log, sleep, env, hasKey } from "../lib/utils.ts";
import { loadEvmWallets, loadSolWallets, loadTopWallets } from "../lib/wallets.ts";

const BASE = "https://deep-index.moralis.io/api/v2.2";
const SOL_BASE = "https://solana-gateway.moralis.io";
const SRC = "moralis";

function headers(): Record<string, string> {
  const key = env("MORALIS_API_KEY") || "";
  return { "X-API-Key": key };
}

export async function runMoralis() {
  if (!hasKey("MORALIS_API_KEY")) {
    log(SRC, "Warning: No MORALIS_API_KEY — skipping (required for all Moralis endpoints)");
    return;
  }

  log(SRC, "Starting Moralis fetch...");
  const h = headers();

  // 1. Global market data
  const globalMcap = await fetchJSON(`${BASE}/market-data/global/market-cap`, { source: SRC, headers: h });
  if (globalMcap) saveArchive(SRC, "global-market-cap", globalMcap);
  await sleep(400);

  // 2. Top ERC-20 tokens
  const topTokens = await fetchJSON(`${BASE}/market-data/erc20s/top-tokens`, { source: SRC, headers: h });
  if (topTokens) saveArchive(SRC, "top-erc20-tokens", topTokens);
  await sleep(400);

  // 3. Trending tokens
  const trending = await fetchJSON(`${BASE}/market-data/erc20s/trending`, { source: SRC, headers: h });
  if (trending) saveArchive(SRC, "trending-tokens", trending);
  await sleep(400);

  // 4. Discovery: whales
  const whales = await fetchJSON(
    `${BASE}/discovery/whales?chains=eth,bsc,base,polygon,arbitrum&limit=30`,
    { source: SRC, headers: h }
  );
  if (whales) saveArchive(SRC, "whale-wallets", whales);
  await sleep(500);

  // 5. EVM wallet data (top performers)
  const evmWallets = loadEvmWallets();
  const topEvm = evmWallets.slice(0, 30);
  log(SRC, `Fetching EVM wallet data for ${topEvm.length} wallets`);

  for (const wallet of topEvm) {
    const data: any = { wallet };

    const tokens = await fetchJSON(
      `${BASE}/wallets/${wallet}/tokens?exclude_spam=true&exclude_unverified_contracts=true`,
      { source: SRC, headers: h, delayMs: 100 }
    );
    if (tokens) data.tokens = tokens;

    const netWorth = await fetchJSON(`${BASE}/wallets/${wallet}/net-worth?exclude_spam=true`, {
      source: SRC, headers: h, delayMs: 100,
    });
    if (netWorth) data.net_worth = netWorth;

    const history = await fetchJSON(
      `${BASE}/wallets/${wallet}/history?include_internal_transactions=true&limit=50`,
      { source: SRC, headers: h, delayMs: 100 }
    );
    if (history) data.history = history;

    const profitability = await fetchJSON(`${BASE}/wallets/${wallet}/profitability/top-tokens?days=30`, {
      source: SRC, headers: h, delayMs: 100,
    });
    if (profitability) data.profitability_top_tokens = profitability;

    const defi = await fetchJSON(`${BASE}/wallets/${wallet}/defi/positions?protocol=all`, {
      source: SRC, headers: h, delayMs: 100,
    });
    if (defi) data.defi_positions = defi;

    const chains = await fetchJSON(`${BASE}/wallets/${wallet}/chains`, {
      source: SRC, headers: h, delayMs: 100,
    });
    if (chains) data.active_chains = chains;

    const nfts = await fetchJSON(
      `${BASE}/wallets/${wallet}/nfts?exclude_spam=true&limit=20`,
      { source: SRC, headers: h, delayMs: 100 }
    );
    if (nfts) data.nfts = nfts;

    saveArchive(SRC, `evm-wallet-${wallet.toLowerCase()}`, data);
    log(SRC, `Saved EVM wallet ${wallet.slice(0, 8)}...`);
    await sleep(300);
  }

  // 6. Solana wallet data
  const solWallets = loadTopWallets("sol", 30);
  log(SRC, `Fetching Solana wallet data for ${solWallets.length} wallets`);

  for (const wallet of solWallets) {
    const data: any = { wallet };

    const tokens = await fetchJSON(
      `${SOL_BASE}/account/mainnet/${wallet}/tokens`,
      { source: SRC, headers: h, delayMs: 100 }
    );
    if (tokens) data.tokens = tokens;

    const portfolio = await fetchJSON(
      `${SOL_BASE}/account/mainnet/${wallet}/portfolio`,
      { source: SRC, headers: h, delayMs: 100 }
    );
    if (portfolio) data.portfolio = portfolio;

    saveArchive(SRC, `sol-wallet-${wallet}`, data);
    log(SRC, `Saved SOL wallet ${wallet.slice(0, 8)}...`);
    await sleep(300);
  }

  log(SRC, "Moralis fetch complete.");
}
