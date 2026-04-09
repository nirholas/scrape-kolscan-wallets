/**
 * DeBank fetcher — free API key required (Cloud API)
 * Docs: https://cloud.debank.com/api-access
 *
 * Best-in-class for EVM DeFi positions.
 * Free plan: 100k API units.
 *
 * Endpoints per wallet:
 * - /user/all_token_list (all token balances)
 * - /user/total_balance (total USD value)
 * - /user/complex_protocol_list (DeFi positions)
 * - /user/all_complex_protocol_list
 * - /user/history_list (transaction history)
 * - /user/nft_list
 *
 * Global endpoints:
 * - /protocol/all_list (supported protocols)
 * - /chain/list
 */

import { fetchJSON, saveArchive, log, sleep, env, hasKey } from "../lib/utils.ts";
import { loadEvmWallets } from "../lib/wallets.ts";

const BASE = "https://pro-openapi.debank.com/v1";
const SRC = "debank";

function headers(): Record<string, string> {
  return { AccessKey: env("DEBANK_API_KEY") || "" };
}

export async function runDeBank() {
  if (!hasKey("DEBANK_API_KEY")) {
    log(SRC, "Warning: No DEBANK_API_KEY — skipping DeBank (required)");
    return;
  }

  log(SRC, "Starting DeBank fetch...");
  const h = headers();

  // 1. Chain list
  const chainList = await fetchJSON(`${BASE}/chain/list`, { source: SRC, headers: h });
  if (chainList) saveArchive(SRC, "chain-list", chainList);
  await sleep(400);

  // 2. Protocol list (all DeFi protocols)
  const protocols = await fetchJSON(`${BASE}/protocol/all_list`, { source: SRC, headers: h });
  if (protocols) {
    saveArchive(SRC, "protocol-list", protocols);
    log(SRC, `Protocols: ${Array.isArray(protocols) ? protocols.length : "?"}`);
  }
  await sleep(400);

  // 3. Per-wallet data
  const wallets = loadEvmWallets().slice(0, 30);
  log(SRC, `Fetching DeBank data for ${wallets.length} wallets`);

  for (const wallet of wallets) {
    const data: any = { wallet };

    // Total balance
    const totalBalance = await fetchJSON(
      `${BASE}/user/total_balance?id=${wallet.toLowerCase()}`,
      { source: SRC, headers: h, delayMs: 200 }
    );
    if (totalBalance) data.total_balance = totalBalance;

    // All token balances
    const tokens = await fetchJSON(
      `${BASE}/user/all_token_list?id=${wallet.toLowerCase()}&is_all=true`,
      { source: SRC, headers: h, delayMs: 200 }
    );
    if (tokens) data.tokens = tokens;

    // DeFi positions
    const defiPositions = await fetchJSON(
      `${BASE}/user/all_complex_protocol_list?id=${wallet.toLowerCase()}`,
      { source: SRC, headers: h, delayMs: 200 }
    );
    if (defiPositions) data.defi_positions = defiPositions;

    // Transaction history (last 20)
    const history = await fetchJSON(
      `${BASE}/user/history_list?id=${wallet.toLowerCase()}&page_count=20`,
      { source: SRC, headers: h, delayMs: 200 }
    );
    if (history) data.history = history;

    // Used chains
    const usedChains = await fetchJSON(
      `${BASE}/user/used_chain_list?id=${wallet.toLowerCase()}`,
      { source: SRC, headers: h, delayMs: 200 }
    );
    if (usedChains) data.used_chains = usedChains;

    if (data.total_balance || data.tokens) {
      saveArchive(SRC, `wallet-${wallet.toLowerCase()}`, data);
      log(SRC, `Saved wallet ${wallet.slice(0, 8)}... (${data.total_balance?.total_usd_value?.toFixed(0) ?? "?"} USD)`);
    }

    await sleep(500);
  }

  log(SRC, "DeBank fetch complete.");
}
