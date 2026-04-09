/**
 * Blockscout fetcher — open-source explorer APIs, fully free and public
 * Docs: https://docs.blockscout.com/for-users/api/rest-api-endpoints
 *
 * Chains covered:
 * - Ethereum (eth.blockscout.com)
 * - Base (base.blockscout.com)
 * - Optimism (optimism.blockscout.com)
 * - Gnosis (gnosis.blockscout.com)
 * - Celo (celo.blockscout.com)
 * - Rootstock (rootstock.blockscout.com)
 * - Zora (zora.blockscout.com)
 * - Neon (neon.blockscout.com)
 *
 * Per wallet: address summary, token balances, transactions, token transfers
 * Global: stats, transactions, blocks
 */

import { fetchJSON, saveArchive, log, sleep } from "../lib/utils.ts";
import { loadEvmWallets } from "../lib/wallets.ts";

const SRC = "blockscout";

const CHAINS = [
  { name: "ethereum", base: "https://eth.blockscout.com/api/v2" },
  { name: "base", base: "https://base.blockscout.com/api/v2" },
  { name: "optimism", base: "https://optimism.blockscout.com/api/v2" },
  { name: "gnosis", base: "https://gnosis.blockscout.com/api/v2" },
  { name: "celo", base: "https://celo.blockscout.com/api/v2" },
  { name: "zora", base: "https://zora.blockscout.com/api/v2" },
];

async function fetchChain(chain: typeof CHAINS[0], wallets: string[]) {
  const src = `${SRC}-${chain.name}`;

  // Global stats
  const stats = await fetchJSON(`${chain.base}/stats`, { source: src });
  if (stats) saveArchive(src, "stats", stats);
  await sleep(400);

  // Recent transactions
  const recentTxs = await fetchJSON(`${chain.base}/transactions?filter=validated`, { source: src });
  if (recentTxs) saveArchive(src, "recent-transactions", recentTxs);
  await sleep(400);

  // Recent blocks
  const blocks = await fetchJSON(`${chain.base}/blocks?type=block`, { source: src });
  if (blocks) saveArchive(src, "recent-blocks", blocks);
  await sleep(400);

  // Per wallet (limit 20 per chain, all public)
  const limit = Math.min(wallets.length, 20);
  for (const wallet of wallets.slice(0, limit)) {
    const data: any = { wallet };

    const summary = await fetchJSON(`${chain.base}/addresses/${wallet}`, { source: src, delayMs: 300 });
    if (summary) data.summary = summary;

    const tokenBalances = await fetchJSON(`${chain.base}/addresses/${wallet}/tokens?type=ERC-20`, {
      source: src, delayMs: 300,
    });
    if (tokenBalances) data.token_balances = tokenBalances;

    const txList = await fetchJSON(
      `${chain.base}/addresses/${wallet}/transactions?filter=to%20%7C%20from`,
      { source: src, delayMs: 300 }
    );
    if (txList) data.transactions = txList;

    const tokenTransfers = await fetchJSON(
      `${chain.base}/addresses/${wallet}/token-transfers?type=ERC-20`,
      { source: src, delayMs: 300 }
    );
    if (tokenTransfers) data.token_transfers = tokenTransfers;

    saveArchive(src, `wallet-${wallet.toLowerCase()}`, data);
    await sleep(400);
  }

  log(src, `Done.`);
}

export async function runBlockscout() {
  log(SRC, "Starting Blockscout fetch...");

  const wallets = loadEvmWallets();
  log(SRC, `EVM wallets: ${wallets.length}`);

  for (const chain of CHAINS) {
    log(SRC, `Fetching chain: ${chain.name}`);
    await fetchChain(chain, wallets);
    await sleep(1000);
  }

  log(SRC, "Blockscout fetch complete.");
}
