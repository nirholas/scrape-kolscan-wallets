/**
 * Bitquery fetcher — free tier with API key (GraphQL)
 * Docs: https://docs.bitquery.io/docs/graphql-ide/how-to-use-api/
 *
 * Free plan: 10k points/month
 *
 * Queries:
 * - Solana DEX trades (top wallets)
 * - EVM smart wallet DEX trades
 * - Token holder distributions
 * - Whale movements
 * - New token launches
 */

import { fetchJSON, saveArchive, log, sleep, env, hasKey } from "../lib/utils.ts";
import { loadSolWallets, loadEvmWallets, loadTopWallets } from "../lib/wallets.ts";

const BASE = "https://streaming.bitquery.io/graphql";
const EAP = "https://streaming.bitquery.io/eap"; // SpreadsheetV2
const SRC = "bitquery";

function headers(): Record<string, string> {
  const key = env("BITQUERY_API_KEY") || "";
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
    "X-API-KEY": key,
  };
}

async function gql(query: string, variables = {}): Promise<any> {
  return fetchJSON(BASE, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ query, variables }),
    source: SRC,
    delayMs: 500,
  });
}

const SOLANA_TOP_TRADERS_QUERY = `
query SolanaTopTraders($since: ISO8601DateTime!) {
  Solana {
    DEXTradeByTokens(
      where: {Trade: {Side: {Type: {is: buy}}}, Block: {Time: {since: $since}}}
      orderBy: {descendingByField: "volume_usd"}
      limit: {count: 100}
    ) {
      Trade {
        Account {
          Address
        }
        Currency {
          Symbol
          MintAddress
        }
        Amount
        PriceInUSD
      }
      volume_usd: sum(of: Trade__AmountInUSD)
      trades: count
    }
  }
}`;

const SOLANA_WHALE_QUERY = `
query SolanaWhales {
  Solana {
    Transfers(
      where: {Transfer: {AmountInUSD: {gt: "10000"}}}
      orderBy: {descendingByField: "Transfer__AmountInUSD"}
      limit: {count: 100}
    ) {
      Transfer {
        Amount
        AmountInUSD
        Currency {
          Symbol
          MintAddress
        }
        Sender
        Receiver
      }
      Block {
        Time
      }
    }
  }
}`;

const ETH_TOP_DEX_TRADERS = `
query EthTopTraders($since: ISO8601DateTime!) {
  EVM(network: eth) {
    DEXTradeByTokens(
      where: {Block: {Time: {since: $since}}}
      orderBy: {descendingByField: "volume_usd"}
      limit: {count: 100}
    ) {
      Trade {
        Buyer
        Sender
        Currency {
          Symbol
          SmartContract
        }
        AmountInUSD
      }
      volume_usd: sum(of: Trade__AmountInUSD)
      trades: count
    }
  }
}`;

const NEW_SOLANA_TOKENS = `
query NewSolanaTokens {
  Solana {
    Instructions(
      where: {Instruction: {Program: {Method: {is: "initializeMint"}}}}
      orderBy: {descending: Block__Time}
      limit: {count: 200}
    ) {
      Instruction {
        Accounts {
          Address
        }
        Program {
          Method
        }
      }
      Block {
        Time
      }
      Transaction {
        Signer
      }
    }
  }
}`;

const BSC_SMART_MONEY = `
query BSCSmartMoney($since: ISO8601DateTime!) {
  EVM(network: bsc) {
    DEXTradeByTokens(
      where: {Block: {Time: {since: $since}}}
      orderBy: {descendingByField: "volume_usd"}
      limit: {count: 100}
    ) {
      Trade {
        Buyer
        Currency { Symbol SmartContract }
        AmountInUSD
      }
      volume_usd: sum(of: Trade__AmountInUSD)
      trades: count
    }
  }
}`;

export async function runBitquery() {
  if (!hasKey("BITQUERY_API_KEY")) {
    log(SRC, "Warning: No BITQUERY_API_KEY — skipping (required for Bitquery GraphQL)");
    return;
  }

  log(SRC, "Starting Bitquery fetch...");

  const since7d = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
  const since24h = new Date(Date.now() - 86400 * 1000).toISOString();

  // 1. Solana top traders (7d)
  const solTraders = await gql(SOLANA_TOP_TRADERS_QUERY, { since: since7d });
  if (solTraders?.data) saveArchive(SRC, "solana-top-traders-7d", solTraders.data);
  await sleep(2000);

  // 2. Solana whales (recent large transfers)
  const solWhales = await gql(SOLANA_WHALE_QUERY);
  if (solWhales?.data) saveArchive(SRC, "solana-whale-transfers", solWhales.data);
  await sleep(2000);

  // 3. ETH top DEX traders (7d)
  const ethTraders = await gql(ETH_TOP_DEX_TRADERS, { since: since7d });
  if (ethTraders?.data) saveArchive(SRC, "eth-top-dex-traders-7d", ethTraders.data);
  await sleep(2000);

  // 4. New Solana token launches
  const newTokens = await gql(NEW_SOLANA_TOKENS);
  if (newTokens?.data) saveArchive(SRC, "solana-new-tokens", newTokens.data);
  await sleep(2000);

  // 5. BSC smart money (24h)
  const bscMoney = await gql(BSC_SMART_MONEY, { since: since24h });
  if (bscMoney?.data) saveArchive(SRC, "bsc-smart-money-24h", bscMoney.data);
  await sleep(2000);

  // 6. Per-wallet trade history for top wallets (Solana)
  const topWallets = loadTopWallets("sol", 20);
  for (const wallet of topWallets) {
    const walletTradesQ = `
      query WalletTrades {
        Solana {
          DEXTradeByTokens(
            where: {
              Trade: {Account: {Address: {is: "${wallet}"}}}
            }
            orderBy: {descending: Block__Time}
            limit: {count: 100}
          ) {
            Trade {
              Currency { Symbol MintAddress }
              Amount
              AmountInUSD
              Side { Type }
              PriceInUSD
            }
            Block { Time }
          }
        }
      }
    `;
    const result = await gql(walletTradesQ);
    if (result?.data) {
      saveArchive(SRC, `wallet-trades-${wallet.slice(0, 8)}`, result.data);
      log(SRC, `Saved Bitquery trades for wallet ${wallet.slice(0, 8)}...`);
    }
    await sleep(3000);
  }

  log(SRC, "Bitquery fetch complete.");
}
