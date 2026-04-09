/**
 * Covalent (GoldRush) fetcher — free API key required
 * Docs: https://www.covalenthq.com/docs/api/
 *
 * One of the most comprehensive multi-chain wallet APIs.
 * Free plan: 100 req/day baseline with generous limits.
 *
 * Endpoints hit:
 * - /v1/{chain_name}/address/{address}/balances_v2/
 * - /v1/{chain_name}/address/{address}/transactions_v3/
 * - /v1/{chain_name}/address/{address}/portfolio_v2/
 * - /v1/{chain_name}/address/{address}/stacks/uniswap_v3/
 * - /v1/chains/ (chain list)
 * - /v1/chains/status/ (chain status)
 * - /v1/{chain}/tokens/{contract_address}/token_holders_v2/
 * - /v1/pricing/historical_by_addresses_v2/{chain}/{currency}/{contract_addresses}/
 *
 * Chains: eth-mainnet, bsc-mainnet, matic-mainnet, base-mainnet,
 *         arbitrum-mainnet, optimism-mainnet, avalanche-mainnet, solana-mainnet
 */

import { fetchJSON, saveArchive, log, sleep, env, hasKey } from "../lib/utils.ts";
import { loadEvmWallets, loadTopWallets } from "../lib/wallets.ts";

const BASE = "https://api.covalenthq.com";
const SRC = "covalent";

const CHAINS = [
  "eth-mainnet", "bsc-mainnet", "matic-mainnet", "base-mainnet",
  "arbitrum-mainnet", "optimism-mainnet", "avalanche-mainnet",
];

const TOP_ERC20_CONTRACTS = [
  "0xdac17f958d2ee523a2206206994597c13d831ec7", // USDT
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
  "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", // WBTC
  "0x514910771af9ca656af840dff83e8264ecf986ca", // LINK
  "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", // UNI
  "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9", // AAVE
  "0xc00e94cb662c3520282e6f5717214004a7f26888", // COMP
  "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2", // MKR
];

function auth(): Record<string, string> {
  const key = env("COVALENT_API_KEY") || "";
  const encoded = btoa(`${key}:`);
  return { Authorization: `Basic ${encoded}` };
}

export async function runCovalent() {
  if (!hasKey("COVALENT_API_KEY")) {
    log(SRC, "Warning: No COVALENT_API_KEY — skipping (required for Covalent endpoints)");
    return;
  }

  log(SRC, "Starting Covalent fetch...");
  const h = auth();

  // 1. Chain list
  const chains = await fetchJSON(`${BASE}/v1/chains/?key=${env("COVALENT_API_KEY")}`, { source: SRC });
  if (chains) saveArchive(SRC, "chains", chains);
  await sleep(500);

  // 2. Chain status
  const status = await fetchJSON(`${BASE}/v1/chains/status/?key=${env("COVALENT_API_KEY")}`, { source: SRC });
  if (status) saveArchive(SRC, "chains-status", status);
  await sleep(500);

  // 3. Per-wallet data across all chains
  const evmWallets = loadEvmWallets();
  const wallets = evmWallets.slice(0, 20); // 20 wallets × 7 chains × 3 endpoints = ~420 calls
  log(SRC, `Fetching ${wallets.length} wallets across ${CHAINS.length} chains`);

  for (const chain of CHAINS) {
    for (const wallet of wallets) {
      const data: any = { wallet, chain };

      const balances = await fetchJSON(
        `${BASE}/v1/${chain}/address/${wallet}/balances_v2/?key=${env("COVALENT_API_KEY")}&nft=false&no-nft-fetch=true`,
        { source: SRC, delayMs: 300 }
      );
      if (balances) data.balances = balances;

      const txs = await fetchJSON(
        `${BASE}/v1/${chain}/address/${wallet}/transactions_v3/page/0/?key=${env("COVALENT_API_KEY")}&block-signed-at-asc=false&no-logs=false&page-size=20`,
        { source: SRC, delayMs: 300 }
      );
      if (txs) data.transactions = txs;

      const portfolio = await fetchJSON(
        `${BASE}/v1/${chain}/address/${wallet}/portfolio_v2/?key=${env("COVALENT_API_KEY")}&days=30`,
        { source: SRC, delayMs: 300 }
      );
      if (portfolio) data.portfolio = portfolio;

      if (data.balances || data.transactions) {
        saveArchive(SRC, `${chain}-wallet-${wallet.toLowerCase()}`, data);
        log(SRC, `Saved ${chain} wallet ${wallet.slice(0, 8)}...`);
      }

      await sleep(400);
    }
  }

  // 4. Token holder data for top ERC-20s on ETH
  for (const contract of TOP_ERC20_CONTRACTS) {
    const holders = await fetchJSON(
      `${BASE}/v1/eth-mainnet/tokens/${contract}/token_holders_v2/?key=${env("COVALENT_API_KEY")}&page-size=100`,
      { source: SRC, delayMs: 500 }
    );
    if (holders) {
      saveArchive(SRC, `token-holders-${contract.slice(0, 8)}`, holders);
      log(SRC, `Saved token holders for ${contract.slice(0, 8)}...`);
    }
    await sleep(500);
  }

  log(SRC, "Covalent fetch complete.");
}
