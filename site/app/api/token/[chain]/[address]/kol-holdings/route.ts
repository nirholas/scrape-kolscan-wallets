import { NextRequest, NextResponse } from "next/server";
import { desc, eq, and } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { trade } from "@/drizzle/db/schema";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ chain: string; address: string }> },
) {
  const params = await context.params;
  const chain = params.chain as "sol" | "bsc";
  const address = params.address;
  const { searchParams } = req.nextUrl;
  const sortBy = searchParams.get("sort") ?? "bought"; // bought | pnl | date

  if (chain !== "sol" && chain !== "bsc") {
    return NextResponse.json({ error: "Invalid chain" }, { status: 400 });
  }
  if (!address || address.length < 20) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const tokenTrades = await db
    .select()
    .from(trade)
    .where(and(eq(trade.tokenAddress, address), eq(trade.chain, chain)))
    .orderBy(desc(trade.tradedAt))
    .limit(500);

  // Aggregate per KOL wallet
  const kolMap = new Map<
    string,
    {
      walletAddress: string;
      walletLabel: string | null;
      walletAvatar: string | null;
      totalBought: number;
      totalSold: number;
      realizedProfit: number;
      unrealizedProfit: number | null;
      buyCount: number;
      sellCount: number;
      avgBuyPrice: number | null;
      avgSellPrice: number | null;
      tokenAmountHeld: number;
      firstBuy: string | null;
      lastTrade: string | null;
    }
  >();

  for (const t of tokenTrades) {
    if (!kolMap.has(t.walletAddress)) {
      kolMap.set(t.walletAddress, {
        walletAddress: t.walletAddress,
        walletLabel: t.walletLabel,
        walletAvatar: t.walletAvatar,
        totalBought: 0,
        totalSold: 0,
        realizedProfit: 0,
        unrealizedProfit: null,
        buyCount: 0,
        sellCount: 0,
        avgBuyPrice: null,
        avgSellPrice: null,
        tokenAmountHeld: 0,
        firstBuy: null,
        lastTrade: null,
      });
    }
    const kol = kolMap.get(t.walletAddress)!;

    if (t.type === "buy") {
      kol.totalBought += t.amountUsd ?? 0;
      kol.buyCount++;
      kol.tokenAmountHeld += t.amountToken ?? 0;
      // Cumulative avg buy price
      if (t.priceUsd != null) {
        kol.avgBuyPrice =
          kol.avgBuyPrice == null
            ? t.priceUsd
            : (kol.avgBuyPrice * (kol.buyCount - 1) + t.priceUsd) / kol.buyCount;
      }
      if (!kol.firstBuy || (t.tradedAt && new Date(t.tradedAt) < new Date(kol.firstBuy))) {
        kol.firstBuy = t.tradedAt?.toISOString() ?? null;
      }
    } else {
      kol.totalSold += t.amountUsd ?? 0;
      kol.sellCount++;
      kol.tokenAmountHeld = Math.max(0, kol.tokenAmountHeld - (t.amountToken ?? 0));
      kol.realizedProfit += t.realizedProfit ?? 0;
      if (t.priceUsd != null) {
        kol.avgSellPrice =
          kol.avgSellPrice == null
            ? t.priceUsd
            : (kol.avgSellPrice * (kol.sellCount - 1) + t.priceUsd) / kol.sellCount;
      }
    }

    if (!kol.lastTrade || (t.tradedAt && new Date(t.tradedAt) > new Date(kol.lastTrade))) {
      kol.lastTrade = t.tradedAt?.toISOString() ?? null;
    }
  }

  let kols = Array.from(kolMap.values());

  if (sortBy === "pnl") {
    kols.sort((a, b) => b.realizedProfit - a.realizedProfit);
  } else if (sortBy === "date") {
    kols.sort((a, b) => {
      if (!a.firstBuy) return 1;
      if (!b.firstBuy) return -1;
      return new Date(a.firstBuy).getTime() - new Date(b.firstBuy).getTime();
    });
  } else {
    kols.sort((a, b) => b.totalBought - a.totalBought);
  }

  return NextResponse.json({
    kols,
    total: kols.length,
  });
}
