/**
 * Etherscan-family fetcher — free API key required (5 req/sec per key)
 * Same API shape for: Etherscan, BscScan, BaseScan, ArbScan, PolygonScan
 * Docs: https://docs.etherscan.io/api-endpoints
 *
 * Endpoints hit per wallet:
 * - account/balance
 * - account/txlist (normal txns)
 * - account/tokentx (ERC-20 transfers)
 * - account/tokennfttx (ERC-721 transfers)
 * - account/token1155tx (ERC-1155 transfers)
 *
 * Global endpoints:
 * - stats/ethsupply
 * - stats/ethprice
 * - gastracker/gasestimate
 * - blocks/getblocknobytime
 */

import { fetchJSON, saveArchive, log, sleep, env, hasKey } from "../lib/utils.ts";
import { loadEvmWallets, loadTopWallets } from "../lib/wallets.ts";

const SRC = "etherscan";

const EXPLORERS: {
  key: string;
  envKey: string;
  chain: string;
  base: string;
}[] = [
  {
    chain: "ethereum",
    base: "https://api.etherscan.io/api",
    envKey: "ETHERSCAN_API_KEY",
    key: "",
  },
  {
    chain: "bsc",
    base: "https://api.bscscan.com/api",
    envKey: "BSCSCAN_API_KEY",
    key: "",
  },
  {
    chain: "base",
    base: "https://api.basescan.org/api",
    envKey: "BASESCAN_API_KEY",
    key: "",
  },
  {
    chain: "arbitrum",
    base: "https://api.arbiscan.io/api",
    envKey: "ARBISCAN_API_KEY",
    key: "",
  },
  {
    chain: "polygon",
    base: "https://api.polygonscan.com/api",
    envKey: "POLYGONSCAN_API_KEY",
    key: "",
  },
  {
    chain: "optimism",
    base: "https://api-optimistic.etherscan.io/api",
    envKey: "OPTIMISMSCAN_API_KEY",
    key: "",
  },
];

async function fetchExplorer(
  base: string,
  module: string,
  action: string,
  params: Record<string, string>,
  apikey: string,
  source: string
) {
  const qs = new URLSearchParams({ module, action, ...params, apikey }).toString();
  return fetchJSON(`${base}?${qs}`, { source, delayMs: 220 });
}

async function fetchChainWallets(explorer: typeof EXPLORERS[0], wallets: string[]) {
  const apikey = env(explorer.envKey) || "";
  const src = `${SRC}-${explorer.chain}`;

  // Global stats
  const price = await fetchExplorer(explorer.base, "stats", "ethprice", {}, apikey, src);
  if (price) saveArchive(src, "eth-price", price);
  await sleep(250);

  const supply = await fetchExplorer(explorer.base, "stats", "ethsupply", {}, apikey, src);
  if (supply) saveArchive(src, "eth-supply", supply);
  await sleep(250);

  const gas = await fetchExplorer(explorer.base, "gastracker", "gasoracle", {}, apikey, src);
  if (gas) saveArchive(src, "gas-oracle", gas);
  await sleep(250);

  // Per-wallet
  log(src, `Fetching ${wallets.length} wallets...`);

  const limit = apikey ? Math.min(wallets.length, 50) : Math.min(wallets.length, 10);
  for (const wallet of wallets.slice(0, limit)) {
    const data: any = { wallet };

    const balance = await fetchExplorer(
      explorer.base, "account", "balance", { address: wallet, tag: "latest" }, apikey, src
    );
    if (balance) data.balance = balance;

    const txs = await fetchExplorer(
      explorer.base, "account", "txlist",
      { address: wallet, startblock: "0", endblock: "99999999", sort: "desc", page: "1", offset: "50" },
      apikey, src
    );
    if (txs) data.transactions = txs;

    const erc20 = await fetchExplorer(
      explorer.base, "account", "tokentx",
      { address: wallet, startblock: "0", endblock: "99999999", sort: "desc", page: "1", offset: "50" },
      apikey, src
    );
    if (erc20) data.erc20_transfers = erc20;

    saveArchive(src, `wallet-${wallet.toLowerCase()}`, data);
    log(src, `Saved ${wallet.slice(0, 8)}...`);
    await sleep(300);
  }

  log(src, `Done.`);
}

export async function runEtherscan() {
  log(SRC, "Starting Etherscan-family fetch...");

  const evmWallets = loadEvmWallets();
  log(SRC, `Total EVM wallets available: ${evmWallets.length}`);

  for (const explorer of EXPLORERS) {
    if (!hasKey(explorer.envKey)) {
      log(SRC, `No key for ${explorer.chain} (${explorer.envKey}), skipping wallet data (global stats only)`);
    }
    await fetchChainWallets(explorer, evmWallets);
    await sleep(1000);
  }

  log(SRC, "Etherscan-family fetch complete.");
}
