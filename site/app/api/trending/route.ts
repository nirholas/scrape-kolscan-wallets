import { NextRequest, NextResponse } from "next/server";
import { and, desc, sql, gte, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { trade } from "@/drizzle/db/schema";
import { fetchTrendingTokens, type TrendingFilters } from "@/lib/trending-aggregator";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const source = searchParams.get("source") ?? "aggregated";

  // New aggregated trending from multiple external sources
  if (source === "aggregated") {
    const filters: TrendingFilters = {
      chain: searchParams.get("chain") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      timeframe: (searchParams.get("timeframe") as "1h" | "24h" | "7d") ?? "24h",
      limit: Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 100),
      minLiquidity: parseInt(searchParams.get("minLiquidity") ?? "0", 10) || 0,
      hideRugs: searchParams.get("hideRugs") === "true",
    };

    try {
      const result = await fetchTrendingTokens(filters);
      return NextResponse.json(result, {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      });
    } catch (err) {
      console.error("Trending aggregation error:", err);
      return NextResponse.json(
        { error: "Failed to fetch trending data", tokens: [], sources: {} },
        { status: 500 },
      );
    }
  }

  // Legacy: DB-based trending from tracked wallet activity
  const hoursParam = parseFloat(searchParams.get("hours") ?? "24");
  const hours = isFinite(hoursParam) && hoursParam > 0 ? Math.min(hoursParam, 168) : 24;
  const chainParam = searchParams.get("chain");
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  // Aggregate: which tokens are being bought most by tracked wallets
  const rows = await db
    .select({
      tokenAddress: trade.tokenAddress,
      tokenSymbol: trade.tokenSymbol,
      tokenName: trade.tokenName,
      tokenLogo: trade.tokenLogo,
      chain: trade.chain,
      buyCount: sql<number>`count(*) filter (where ${trade.type} = 'buy')`,
      sellCount: sql<number>`count(*) filter (where ${trade.type} = 'sell')`,
      uniqueBuyers: sql<number>`count(distinct ${trade.walletAddress}) filter (where ${trade.type} = 'buy')`,
      totalBuyUsd: sql<number>`coalesce(sum(${trade.amountUsd}) filter (where ${trade.type} = 'buy'), 0)`,
      totalSellUsd: sql<number>`coalesce(sum(${trade.amountUsd}) filter (where ${trade.type} = 'sell'), 0)`,
      totalPnl: sql<number>`coalesce(sum(${trade.realizedProfit}), 0)`,
      firstSeen: sql<string>`min(${trade.tradedAt})`,
      lastSeen: sql<string>`max(${trade.tradedAt})`,
    })
    .from(trade)
    .where(
      chainParam === "sol" || chainParam === "bsc"
        ? and(gte(trade.tradedAt, since), eq(trade.chain, chainParam))
        : gte(trade.tradedAt, since),
    )
    .groupBy(trade.tokenAddress, trade.tokenSymbol, trade.tokenName, trade.tokenLogo, trade.chain)
    .orderBy(desc(sql`count(distinct ${trade.walletAddress}) filter (where ${trade.type} = 'buy')`))
    .limit(50);

  return NextResponse.json(
    {
      tokens: rows.map((r) => ({
        tokenAddress: r.tokenAddress,
        tokenSymbol: r.tokenSymbol,
        tokenName: r.tokenName,
        tokenLogo: r.tokenLogo,
        chain: r.chain,
        buyCount: Number(r.buyCount),
        sellCount: Number(r.sellCount),
        uniqueBuyers: Number(r.uniqueBuyers),
        totalBuyUsd: Number(r.totalBuyUsd),
        totalSellUsd: Number(r.totalSellUsd),
        netFlow: Number(r.totalBuyUsd) - Number(r.totalSellUsd),
        totalPnl: Number(r.totalPnl),
        firstSeen: r.firstSeen,
        lastSeen: r.lastSeen,
      })),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    }
  );
}
