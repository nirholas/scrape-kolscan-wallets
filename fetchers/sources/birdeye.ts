/**
 * Birdeye fetcher — Solana-focused, free API key required
 * Docs: https://docs.birdeye.so/reference/get_defi-price
 *
 * Free plan includes most endpoints.
 *
 * Endpoints hit:
 * - /defi/tokenlist (top tokens by volume)
 * - /defi/trending_tokens
 * - /defi/price (per token)
 * - /defi/token_overview (per token)
 * - /wallet/token_list (per wallet)
 * - /wallet/portfolio (per wallet)
 * - /wallet/transaction_history (per wallet)
 * - /defi/history_price (OHLCV per token)
 * - /defi/token_security (per token)
 * - /defi/ohlcv (per token pair)
 * - /wallet/simulation (simulated portfolio)
 */

import { fetchJSON, saveArchive, log, sleep, env, hasKey } from "../lib/utils.ts";
import { loadSolWallets, loadTopWallets } from "../lib/wallets.ts";

const BASE = "https://public-api.birdeye.so";
const SRC = "birdeye";

const TOP_TOKENS = [
  "So11111111111111111111111111111111111111112",  // SOL
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",  // USDT
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",  // BONK
  "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",  // WIF
  "ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82",   // BOME
  "A8C3xuqscfmyLrte3VmTqrAq8kgMASius9AFNANwpump",   // FWOG
  "HhJpBhRRn4g56VsyLuT8DL5Bv31HkXqsrahTTUCZeZg4",  // MOODENG
];

function headers(): Record<string, string> {
  const key = env("BIRDEYE_API_KEY");
  return key
    ? { "X-API-KEY": key, "x-chain": "solana" }
    : { "x-chain": "solana" };
}

export async function runBirdeye() {
  log(SRC, "Starting Birdeye fetch...");

  if (!hasKey("BIRDEYE_API_KEY")) {
    log(SRC, "Warning: No BIRDEYE_API_KEY — some endpoints may return 401");
  }

  const h = headers();

  // 1. Token list by volume (top 50)
  const tokenList = await fetchJSON(
    `${BASE}/defi/tokenlist?sort_by=v24hUSD&sort_type=desc&offset=0&limit=50`,
    { source: SRC, headers: h }
  );
  if (tokenList) saveArchive(SRC, "token-list-top-volume", tokenList);
  await sleep(500);

  // Also by market cap
  const tokenListMcap = await fetchJSON(
    `${BASE}/defi/tokenlist?sort_by=mc&sort_type=desc&offset=0&limit=50`,
    { source: SRC, headers: h }
  );
  if (tokenListMcap) saveArchive(SRC, "token-list-top-mcap", tokenListMcap);
  await sleep(500);

  // 2. Trending tokens
  const trending = await fetchJSON(`${BASE}/defi/trending_tokens?sort_by=rank&sort_type=asc&offset=0&limit=20`, {
    source: SRC, headers: h,
  });
  if (trending) saveArchive(SRC, "trending-tokens", trending);
  await sleep(500);

  // 3. Per-token data
  for (const token of TOP_TOKENS) {
    const tokenData: any = { token };

    const overview = await fetchJSON(`${BASE}/defi/token_overview?address=${token}`, {
      source: SRC, headers: h, delayMs: 300,
    });
    if (overview) tokenData.overview = overview;

    const price = await fetchJSON(`${BASE}/defi/price?address=${token}`, {
      source: SRC, headers: h, delayMs: 300,
    });
    if (price) tokenData.price = price;

    const security = await fetchJSON(`${BASE}/defi/token_security?address=${token}`, {
      source: SRC, headers: h, delayMs: 300,
    });
    if (security) tokenData.security = security;

    const history = await fetchJSON(
      `${BASE}/defi/history_price?address=${token}&address_type=token&type=1D&time_from=${Math.floor(Date.now() / 1000) - 86400 * 30}&time_to=${Math.floor(Date.now() / 1000)}`,
      { source: SRC, headers: h, delayMs: 400 }
    );
    if (history) tokenData.price_history_30d = history;

    saveArchive(SRC, `token-${token.slice(0, 8)}`, tokenData);
    await sleep(700);
  }

  // 4. Wallet data
  const wallets = loadTopWallets("sol", 50);
  log(SRC, `Fetching Birdeye data for ${wallets.length} wallets`);

  for (const wallet of wallets) {
    const data: any = { wallet };

    const portfolio = await fetchJSON(`${BASE}/v1/wallet/token_list?wallet=${wallet}`, {
      source: SRC, headers: h, delayMs: 400,
    });
    if (portfolio) data.token_list = portfolio;

    const txHistory = await fetchJSON(
      `${BASE}/v1/wallet/tx_list?wallet=${wallet}&limit=50`,
      { source: SRC, headers: h, delayMs: 400 }
    );
    if (txHistory) data.tx_history = txHistory;

    saveArchive(SRC, `wallet-${wallet}`, data);
    log(SRC, `Saved wallet ${wallet.slice(0, 8)}...`);
    await sleep(800);
  }

  log(SRC, "Birdeye fetch complete.");
}
