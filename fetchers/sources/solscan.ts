/**
 * Solscan fetcher — free public endpoints + optional API key for pro
 * Docs: https://pro-api.solscan.io/pro-api-docs/v2.0
 *
 * Endpoints hit per wallet (free tier):
 * - /account/transactions
 * - /account/token-accounts
 * - /account/defi/activities
 * - /account/balance_change_activities
 * - /account/portfolio
 *
 * Also global endpoints:
 * - /market/token list
 * - /monitor/trending
 */

import { fetchJSON, saveArchive, log, sleep, chunk, env } from "../lib/utils.ts";
import { loadSolWallets, loadTopWallets } from "../lib/wallets.ts";

const BASE = "https://pro-api.solscan.io/v2.0";
const PUBLIC_BASE = "https://public-api.solscan.io";
const SRC = "solscan";

function headers(): Record<string, string> {
  const key = env("SOLSCAN_API_KEY");
  return key ? { token: key } : {};
}

export async function runSolscan() {
  log(SRC, "Starting Solscan fetch...");
  const h = headers();

  // 1. Global: trending tokens
  const trending = await fetchJSON(`${PUBLIC_BASE}/market/token/trending?limit=20`, { source: SRC, headers: h });
  if (trending) saveArchive(SRC, "trending-tokens", trending);
  await sleep(500);

  // 2. Token list (top by market cap)
  const tokens = await fetchJSON(`${PUBLIC_BASE}/token/list?sortBy=market_cap&direction=desc&limit=50&offset=0`, {
    source: SRC, headers: h,
  });
  if (tokens) saveArchive(SRC, "token-list", tokens);
  await sleep(500);

  // 3. Solana blockchain stats
  const stats = await fetchJSON(`${PUBLIC_BASE}/chaininfo`, { source: SRC, headers: h });
  if (stats) saveArchive(SRC, "chain-info", stats);
  await sleep(500);

  // 4. Wallet-level data — use top 50 wallets by 30d profit
  const topWallets = loadTopWallets("sol", 50);
  log(SRC, `Fetching data for ${topWallets.length} top Solana wallets`);

  for (const wallet of topWallets) {
    const walletData: any = { wallet };

    try {
      // Token accounts (SPL balances)
      const tokenAccounts = await fetchJSON(
        `${PUBLIC_BASE}/account/tokens?account=${wallet}&type=token&limit=40`,
        { source: SRC, headers: h, delayMs: 200 }
      );
      if (tokenAccounts) walletData.token_accounts = tokenAccounts;

      // Recent transactions
      const txs = await fetchJSON(
        `${PUBLIC_BASE}/account/transactions?account=${wallet}&limit=40`,
        { source: SRC, headers: h, delayMs: 300 }
      );
      if (txs) walletData.transactions = txs;

      // Portfolio (if pro key available)
      if (env("SOLSCAN_API_KEY")) {
        const portfolio = await fetchJSON(
          `${BASE}/account/portfolio?address=${wallet}`,
          { source: SRC, headers: h, delayMs: 300 }
        );
        if (portfolio) walletData.portfolio = portfolio;

        const defi = await fetchJSON(
          `${BASE}/account/defi/activities?address=${wallet}&page=1&page_size=40`,
          { source: SRC, headers: h, delayMs: 300 }
        );
        if (defi) walletData.defi_activities = defi;
      }

      saveArchive(SRC, `wallet-${wallet}`, walletData);
      log(SRC, `Saved wallet ${wallet.slice(0, 8)}...`);
    } catch (e: any) {
      log(SRC, `Error on wallet ${wallet}: ${e.message}`);
    }

    await sleep(600);
  }

  log(SRC, "Solscan fetch complete.");
}
