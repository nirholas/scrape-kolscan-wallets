import { NextRequest, NextResponse } from "next/server";
import { desc, eq, and, inArray, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { trade } from "@/drizzle/db/schema";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const chain = searchParams.get("chain"); // "sol" | "bsc" | null=all
  const wallet = searchParams.get("wallet");
  const type = searchParams.get("type"); // "buy" | "sell" | null=all
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
  const cursor = searchParams.get("cursor"); // ISO timestamp for pagination

  const conditions = [];
  if (chain) conditions.push(eq(trade.chain, chain));
  if (wallet) conditions.push(eq(trade.walletAddress, wallet));
  if (type) conditions.push(eq(trade.type, type));
  if (cursor) conditions.push(sql`${trade.tradedAt} < ${new Date(cursor)}`);

  const rows = await db
    .select()
    .from(trade)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(trade.tradedAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;

  return NextResponse.json({
    trades: data.map((t) => ({
      id: t.id,
      walletAddress: t.walletAddress,
      walletLabel: t.walletLabel,
      walletAvatar: t.walletAvatar,
      walletTags: t.walletTags,
      chain: t.chain,
      type: t.type,
      tokenAddress: t.tokenAddress,
      tokenSymbol: t.tokenSymbol,
      tokenName: t.tokenName,
      tokenLogo: t.tokenLogo,
      tokenLaunchpad: t.tokenLaunchpad,
      amountUsd: t.amountUsd,
      amountToken: t.amountToken,
      priceUsd: t.priceUsd,
      realizedProfit: t.realizedProfit,
      realizedProfitPnl: t.realizedProfitPnl,
      txHash: t.txHash,
      source: t.source,
      tradedAt: t.tradedAt,
    })),
    nextCursor: hasMore ? data[data.length - 1].tradedAt?.toISOString() : null,
  });
}
