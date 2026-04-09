import { unstable_cache } from "next/cache";
import { db } from "@/drizzle/db";
import { smartMoneyActivity, smartMoneySignal } from "@/drizzle/db/schema";
import { desc, and, eq, sql } from "drizzle-orm";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────
export interface SmartMoneyActivity {
  id: string;
  walletAddress: string;
  walletLabel: string | null;
  walletAvatar: string | null;
  walletCategory: string | null;
  chain: string;
  txHash: string;
  action: string;
  tokenAddress: string | null;
  tokenSymbol: string | null;
  tokenName: string | null;
  tokenLogo: string | null;
  amount: number | null;
  usdValue: number | null;
  priceUsd: number | null;
  realizedPnl: number | null;
  realizedPnlPercent: number | null;
  source: string;
  timestamp: Date;
}

export interface SmartMoneySignal {
  id: string;
  tokenAddress: string;
  tokenSymbol: string | null;
  tokenName: string | null;
  tokenLogo: string | null;
  chain: string;
  signalType: string;
  walletCount: number;
  totalBuyUsd: number | null;
  totalSellUsd: number | null;
  netFlowUsd: number | null;
  period: string;
  topWallets: string[] | null;
}

export interface ActivityFeedOptions {
  chain?: string;
  type?: "buy" | "sell" | "transfer";
  minValue?: number;
  walletCategory?: string;
  limit?: number;
  cursor?: string; // ISO timestamp
}

export interface AccumulationOptions {
  chain?: string;
  period?: "1h" | "24h" | "7d";
  limit?: number;
}

// ────────────────────────────────────────────────────────────
// Functions
// ────────────────────────────────────────────────────────────

export async function getSmartMoneyFeed(options: ActivityFeedOptions = {}): Promise<{
  activities: SmartMoneyActivity[];
  nextCursor: string | null;
}> {
  const { chain, type, minValue, walletCategory, limit = 50, cursor } = options;

  const conditions = [];
  if (chain) conditions.push(eq(smartMoneyActivity.chain, chain));
  if (type) conditions.push(eq(smartMoneyActivity.action, type));
  if (minValue) conditions.push(sql`${smartMoneyActivity.usdValue} >= ${minValue}`);
  if (walletCategory) conditions.push(eq(smartMoneyActivity.walletCategory, walletCategory));
  if (cursor) conditions.push(sql`${smartMoneyActivity.timestamp} < ${new Date(cursor)}`);

  const rows = await db
    .select()
    .from(smartMoneyActivity)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(smartMoneyActivity.timestamp))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? data[data.length - 1].timestamp.toISOString() : null;

  return {
    activities: data.map((row) => ({
      ...row,
      amount: row.amount ?? undefined,
      usdValue: row.usdValue ?? undefined,
      priceUsd: row.priceUsd ?? undefined,
      realizedPnl: row.realizedPnl ?? undefined,
      realizedPnlPercent: row.realizedPnlPercent ?? undefined,
    })),
    nextCursor,
  };
}

export async function getAccumulationSignals(options: AccumulationOptions = {}): Promise<SmartMoneySignal[]> {
  const { chain, period = "24h", limit = 20 } = options;

  const conditions = [eq(smartMoneySignal.period, period)];
  if (chain) conditions.push(eq(smartMoneySignal.chain, chain));

  const rows = await db
    .select()
    .from(smartMoneySignal)
    .where(and(...conditions))
    .orderBy(desc(sql`ABS(${smartMoneySignal.netFlowUsd})`))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    topWallets: row.topWallets ? JSON.parse(row.topWallets) : null,
    totalBuyUsd: row.totalBuyUsd ?? undefined,
    totalSellUsd: row.totalSellUsd ?? undefined,
    netFlowUsd: row.netFlowUsd ?? undefined,
  }));
}

export const getCachedSmartMoneyFeed = unstable_cache(getSmartMoneyFeed, ["smart-money-feed"], {
  revalidate: 15, // Cache for 15 seconds
});

export const getCachedAccumulationSignals = unstable_cache(
  getAccumulationSignals,
  ["smart-money-accumulation"],
  {
    revalidate: 60, // Cache for 60 seconds
  }
);
