/**
 * Alchemy fetcher — free API key + Alchemy SDK
 * Docs: https://docs.alchemy.com/reference/api-overview
 *
 * Uses Alchemy's Enhanced APIs:
 * - getTokenBalances (ERC-20 for any wallet)
 * - getAssetTransfers (transfers in/out)
 * - getNFTsForOwner
 * - getTransactionReceipts
 * - Token metadata
 * - Solana: getBalance, getTokenAccountsByOwner, getSignaturesForAddress
 *
 * Chains: Ethereum, Base, Arbitrum, Optimism, Polygon, Solana
 */

import { fetchJSON, saveArchive, log, sleep, env, hasKey } from "../lib/utils.ts";
import { loadEvmWallets, loadSolWallets, loadTopWallets } from "../lib/wallets.ts";

const SRC = "alchemy";

const EVM_CHAINS: { name: string; envKey: string; rpcBase: string }[] = [
  { name: "ethereum", envKey: "ALCHEMY_ETH_KEY", rpcBase: "eth-mainnet" },
  { name: "base", envKey: "ALCHEMY_BASE_KEY", rpcBase: "base-mainnet" },
  { name: "arbitrum", envKey: "ALCHEMY_ARB_KEY", rpcBase: "arb-mainnet" },
  { name: "polygon", envKey: "ALCHEMY_POLYGON_KEY", rpcBase: "polygon-mainnet" },
  { name: "optimism", envKey: "ALCHEMY_OPT_KEY", rpcBase: "opt-mainnet" },
];

function alchemyBase(chainSlug: string, apiKey: string) {
  return `https://${chainSlug}.g.alchemy.com/v2/${apiKey}`;
}

function solanaNFTBase(apiKey: string) {
  return `https://solana-mainnet.g.alchemy.com/v2/${apiKey}`;
}

async function jsonRpc(base: string, method: string, params: any[], source: string) {
  return fetchJSON(base, {
    method: "POST",
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    source,
    delayMs: 100,
  });
}

async function fetchEvmChain(chain: typeof EVM_CHAINS[0], wallets: string[]) {
  const key = env(chain.envKey);
  if (!key) {
    log(SRC, `No key for ${chain.name} (${chain.envKey}), skipping`);
    return;
  }
  const base = alchemyBase(chain.rpcBase, key);
  const src = `${SRC}-${chain.name}`;
  const limit = Math.min(wallets.length, 30);

  log(src, `Fetching ${limit} wallets...`);

  for (const wallet of wallets.slice(0, limit)) {
    const data: any = { wallet };

    // ERC-20 balances
    const balances = await jsonRpc(base, "alchemy_getTokenBalances", [wallet, "erc20"], src);
    if (balances?.result) data.token_balances = balances.result;

    // Asset transfers (sent)
    const transfersOut = await fetchJSON(base, {
      method: "POST",
      source: src,
      delayMs: 150,
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "alchemy_getAssetTransfers",
        params: [{
          fromAddress: wallet,
          category: ["external", "internal", "erc20", "erc721", "erc1155"],
          maxCount: "0x32",
          withMetadata: true,
          order: "desc",
        }],
      }),
    });
    if (transfersOut?.result) data.transfers_out = transfersOut.result;

    // Asset transfers (received)
    const transfersIn = await fetchJSON(base, {
      method: "POST",
      source: src,
      delayMs: 150,
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "alchemy_getAssetTransfers",
        params: [{
          toAddress: wallet,
          category: ["external", "internal", "erc20", "erc721", "erc1155"],
          maxCount: "0x32",
          withMetadata: true,
          order: "desc",
        }],
      }),
    });
    if (transfersIn?.result) data.transfers_in = transfersIn.result;

    // NFTs
    const nfts = await fetchJSON(
      `https://${chain.rpcBase}.g.alchemy.com/nft/v3/${key}/getNFTsForOwner?owner=${wallet}&pageSize=20`,
      { source: src, delayMs: 150 }
    );
    if (nfts) data.nfts = nfts;

    // ETH balance
    const ethBal = await jsonRpc(base, "eth_getBalance", [wallet, "latest"], src);
    if (ethBal?.result) data.native_balance = ethBal.result;

    saveArchive(src, `wallet-${wallet.toLowerCase()}`, data);
    await sleep(500);
  }

  log(src, "Done.");
}

export async function runAlchemy() {
  const hasAnyKey = EVM_CHAINS.some((c) => hasKey(c.envKey)) || hasKey("ALCHEMY_SOL_KEY");
  if (!hasAnyKey) {
    log(SRC, "No Alchemy API keys found (ALCHEMY_ETH_KEY, ALCHEMY_BASE_KEY, etc.) — skipping");
    return;
  }

  log(SRC, "Starting Alchemy fetch...");

  const evmWallets = loadEvmWallets();

  // EVM chains
  for (const chain of EVM_CHAINS) {
    await fetchEvmChain(chain, evmWallets);
    await sleep(500);
  }

  // Solana via Alchemy
  const solKey = env("ALCHEMY_SOL_KEY");
  if (solKey) {
    const solBase = solanaNFTBase(solKey);
    const solWallets = loadTopWallets("sol", 30);
    const src = `${SRC}-solana`;

    for (const wallet of solWallets) {
      const data: any = { wallet };

      const balance = await jsonRpc(solBase, "getBalance", [wallet], src);
      if (balance?.result) data.sol_balance = balance.result;

      const tokenAccounts = await jsonRpc(solBase, "getTokenAccountsByOwner", [
        wallet,
        { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
        { encoding: "jsonParsed" },
      ], src);
      if (tokenAccounts?.result) data.token_accounts = tokenAccounts.result;

      const sigs = await jsonRpc(solBase, "getSignaturesForAddress", [wallet, { limit: 50 }], src);
      if (sigs?.result) data.recent_signatures = sigs.result;

      saveArchive(src, `wallet-${wallet}`, data);
      log(src, `Saved SOL wallet ${wallet.slice(0, 8)}...`);
      await sleep(500);
    }
  }

  log(SRC, "Alchemy fetch complete.");
}
