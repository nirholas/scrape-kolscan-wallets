/**
 * Trade Ingestion Script
 *
 * Reads wallet holdings from solwallets.json and bscwallets.json,
 * extracts per-token position data, and inserts it into the `trade` table.
 *
 * Two modes:
 *   1. `import`  — Bulk import from scraped JSON files (walletHoldings)
 *   2. `poll`    — Poll GMGN API for recent wallet activity (requires GMGN auth token)
 *
 * Usage:
 *   npx tsx site/scripts/ingest-trades.ts import
 *   npx tsx site/scripts/ingest-trades.ts poll
 *
 * Env:
 *   DATABASE_URL — required
 *   GMGN_TOKEN  — optional, for poll mode
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import * as schema from "../drizzle/db/schema";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool, { schema });

function genId(): string {
  return crypto.randomUUID();
}

// ── Bulk import from scraped JSON files ─────────────────────────────

interface HoldingEntry {
  history_bought_cost: string;
  history_bought_fee: string;
  history_bought_amount: string;
  history_sold_income: string;
  history_sold_fee: string;
  history_sold_amount: string;
  history_total_buys: number;
  history_total_sells: number;
  realized_profit: string;
  realized_profit_pnl: string;
  start_holding_at: number;
  end_holding_at: number;
  last_active_timestamp: number;
  wallet_token_tags: string[];
  token: {
    token_address: string;
    symbol: string;
    name: string;
    logo: string;
    launchpad: string;
    launchpad_platform: string;
    price: string;
  };
}

interface WalletData {
  wallet_address: string;
  name: string;
  twitter_username?: string;
  twitter_name?: string;
  nickname?: string;
  tags?: string[];
}

function getWalletLabel(w: WalletData): string {
  return w.name || w.twitter_name || w.nickname || w.wallet_address.slice(0, 8);
}

async function importFromFile(filePath: string, chain: "sol" | "bsc") {
  if (!fs.existsSync(filePath)) {
    console.log(`  Skipping ${filePath} — not found`);
    return 0;
  }

  console.log(`  Reading ${filePath}...`);
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  // Build wallet label lookup from smartMoney + kol wallets
  const labelMap = new Map<string, string>();
  for (const section of ["smartMoney", "kol"]) {
    const wallets = raw[section]?.wallets;
    if (!wallets) continue;
    if (Array.isArray(wallets)) {
      for (const w of wallets) {
        if (w.wallet_address) labelMap.set(w.wallet_address, getWalletLabel(w));
      }
    } else {
      for (const [, list] of Object.entries(wallets)) {
        if (Array.isArray(list)) {
          for (const w of list as WalletData[]) {
            if (w.wallet_address) labelMap.set(w.wallet_address, getWalletLabel(w));
          }
        }
      }
    }
  }

  // Extract holdings from smartMoney.walletHoldings and kol.walletHoldings
  let inserted = 0;
  const batchSize = 100;
  let batch: (typeof schema.trade.$inferInsert)[] = [];

  for (const section of ["smartMoney", "kol"]) {
    const holdings = raw[section]?.walletHoldings;
    if (!holdings || typeof holdings !== "object") continue;

    for (const [walletAddr, holdingData] of Object.entries(holdings)) {
      const list = (holdingData as any)?.list;
      if (!Array.isArray(list)) continue;

      const label = labelMap.get(walletAddr) || walletAddr.slice(0, 8);

      for (const h of list as HoldingEntry[]) {
        const token = h.token;
        if (!token?.token_address) continue;

        const boughtCost = parseFloat(h.history_bought_cost) || 0;
        const soldIncome = parseFloat(h.history_sold_income) || 0;
        const realizedProfit = parseFloat(h.realized_profit) || null;
        const realizedProfitPnl = parseFloat(h.realized_profit_pnl) || null;
        const tokenTags = Array.isArray(h.wallet_token_tags) ? JSON.stringify(h.wallet_token_tags) : null;

        // Create buy trade if there were buys
        if (h.history_total_buys > 0 && boughtCost > 0) {
          batch.push({
            id: genId(),
            walletAddress: walletAddr,
            chain,
            type: "buy",
            tokenAddress: token.token_address,
            tokenSymbol: token.symbol || null,
            tokenName: token.name || null,
            tokenLogo: token.logo || null,
            tokenLaunchpad: token.launchpad || token.launchpad_platform || null,
            amountUsd: boughtCost,
            amountToken: parseFloat(h.history_bought_amount) || null,
            priceUsd: parseFloat(token.price) || null,
            realizedProfit: null,
            realizedProfitPnl: null,
            fee: parseFloat(h.history_bought_fee) || null,
            txHash: null,
            source: "gmgn",
            walletLabel: label,
            walletTags: tokenTags,
            tradedAt: new Date(h.start_holding_at * 1000),
          });
        }

        // Create sell trade if there were sells
        if (h.history_total_sells > 0 && soldIncome > 0) {
          batch.push({
            id: genId(),
            walletAddress: walletAddr,
            chain,
            type: "sell",
            tokenAddress: token.token_address,
            tokenSymbol: token.symbol || null,
            tokenName: token.name || null,
            tokenLogo: token.logo || null,
            tokenLaunchpad: token.launchpad || token.launchpad_platform || null,
            amountUsd: soldIncome,
            amountToken: parseFloat(h.history_sold_amount) || null,
            priceUsd: parseFloat(token.price) || null,
            realizedProfit,
            realizedProfitPnl,
            fee: parseFloat(h.history_sold_fee) || null,
            txHash: null,
            source: "gmgn",
            walletLabel: label,
            walletTags: tokenTags,
            tradedAt: new Date((h.end_holding_at || h.last_active_timestamp || h.start_holding_at) * 1000),
          });
        }

        // Flush batch
        if (batch.length >= batchSize) {
          await db.insert(schema.trade).values(batch).onConflictDoNothing();
          inserted += batch.length;
          batch = [];
          process.stdout.write(`\r  Inserted ${inserted} trades...`);
        }
      }
    }
  }

  // Flush remaining
  if (batch.length > 0) {
    await db.insert(schema.trade).values(batch).onConflictDoNothing();
    inserted += batch.length;
  }

  console.log(`\n  Done: ${inserted} trades from ${chain}`);
  return inserted;
}

async function runImport() {
  console.log("── Bulk import from scraped files ──\n");

  const baseDirs = [
    path.join(__dirname, "..", "data"),
    path.join(__dirname, "..", ".."),
  ];

  let total = 0;

  for (const dir of baseDirs) {
    const solFile = path.join(dir, "solwallets.json");
    if (fs.existsSync(solFile)) {
      total += await importFromFile(solFile, "sol");
      break;
    }
  }

  for (const dir of baseDirs) {
    const bscFile = path.join(dir, "bscwallets.json");
    if (fs.existsSync(bscFile)) {
      total += await importFromFile(bscFile, "bsc");
      break;
    }
  }

  console.log(`\nTotal trades inserted: ${total}`);
}

// ── Poll GMGN API for recent activity ───────────────────────────────

const GMGN_BASE = "https://gmgn.ai/defi/quotation/v1";
const GMGN_TOKEN = process.env.GMGN_TOKEN || "";
const POLL_CHAINS: ("sol" | "bsc")[] = ["sol", "bsc"];
const WALLET_BATCH = 10;
const POLL_DELAY_MS = 2000;

async function fetchWalletActivity(chain: string, walletAddr: string): Promise<any[]> {
  const url = `${GMGN_BASE}/wallet/${chain}/${walletAddr}/activities?type=buy&type=sell&limit=20`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    Referer: "https://gmgn.ai/",
  };
  if (GMGN_TOKEN) {
    headers["Authorization"] = `Bearer ${GMGN_TOKEN}`;
  }

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    const json = await res.json();
    return json?.data?.activities || [];
  } catch {
    return [];
  }
}

async function getTrackedWallets(chain: string): Promise<string[]> {
  // Read from the scraped JSON files
  const baseDirs = [
    path.join(__dirname, "..", "data"),
    path.join(__dirname, "..", ".."),
  ];

  const filename = chain === "bsc" ? "bscwallets.json" : "solwallets.json";

  for (const dir of baseDirs) {
    const filePath = path.join(dir, filename);
    if (!fs.existsSync(filePath)) continue;

    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const wallets = new Set<string>();

    for (const section of ["smartMoney", "kol"]) {
      const w = raw[section]?.wallets;
      if (!w) continue;
      if (Array.isArray(w)) {
        for (const entry of w) {
          if (entry.wallet_address) wallets.add(entry.wallet_address);
        }
      } else {
        for (const [, list] of Object.entries(w)) {
          if (Array.isArray(list)) {
            for (const entry of list as any[]) {
              if (entry.wallet_address) wallets.add(entry.wallet_address);
            }
          }
        }
      }
    }
    return [...wallets];
  }

  return [];
}

async function runPoll() {
  if (!GMGN_TOKEN) {
    console.warn("⚠ GMGN_TOKEN not set — API calls may be rate-limited or rejected.\n");
  }

  console.log("── Polling GMGN for recent trades ──\n");

  for (const chain of POLL_CHAINS) {
    const wallets = await getTrackedWallets(chain);
    console.log(`${chain.toUpperCase()}: ${wallets.length} wallets to poll`);

    let totalNew = 0;

    for (let i = 0; i < wallets.length; i += WALLET_BATCH) {
      const batch = wallets.slice(i, i + WALLET_BATCH);

      const results = await Promise.all(
        batch.map(async (addr) => {
          const activities = await fetchWalletActivity(chain, addr);
          return { addr, activities };
        }),
      );

      const rows: (typeof schema.trade.$inferInsert)[] = [];

      for (const { addr, activities } of results) {
        for (const act of activities) {
          const tradeType = act.event_type === "sell" ? "sell" : "buy";
          const tokenAddr = act.token_address || act.token?.address;
          if (!tokenAddr) continue;

          rows.push({
            id: genId(),
            walletAddress: addr,
            chain,
            type: tradeType,
            tokenAddress: tokenAddr,
            tokenSymbol: act.token?.symbol || act.symbol || null,
            tokenName: act.token?.name || act.name || null,
            amountUsd: parseFloat(act.cost_usd || act.amount_usd) || null,
            amountToken: parseFloat(act.amount) || null,
            priceUsd: parseFloat(act.price_usd || act.price) || null,
            txHash: act.tx_hash || act.hash || null,
            source: "gmgn",
            walletLabel: addr.slice(0, 8),
            tradedAt: new Date((act.timestamp || Date.now() / 1000) * 1000),
          });
        }
      }

      if (rows.length > 0) {
        await db.insert(schema.trade).values(rows).onConflictDoNothing();
        totalNew += rows.length;
      }

      process.stdout.write(`\r  ${chain.toUpperCase()}: ${i + batch.length}/${wallets.length} wallets polled, ${totalNew} new trades`);

      // Rate limit
      await new Promise((r) => setTimeout(r, POLL_DELAY_MS));
    }

    console.log(`\n  ${chain.toUpperCase()} done: ${totalNew} trades ingested`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  const mode = process.argv[2] || "import";

  try {
    if (mode === "import") {
      await runImport();
    } else if (mode === "poll") {
      await runPoll();
    } else {
      console.error(`Unknown mode: ${mode}. Use "import" or "poll".`);
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
