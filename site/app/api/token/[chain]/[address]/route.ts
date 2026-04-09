import { NextRequest, NextResponse } from "next/server";
import { desc, eq, and } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { trade } from "@/drizzle/db/schema";
import { getTokenData } from "@/lib/token-api";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ chain: string; address: string }> },
) {
  const params = await context.params;
  const chain = params.chain as "sol" | "bsc";
  const address = params.address;

  if (chain !== "sol" && chain !== "bsc") {
    return NextResponse.json({ error: "Invalid chain" }, { status: 400 });
  }

  // Fetch KOL trades for this token from DB
  const [tokenTrades, tokenMeta] = await Promise.all([
    db
      .select()
      .from(trade)
      .where(and(eq(trade.tokenAddress, address), eq(trade.chain, chain)))
      .orderBy(desc(trade.tradedAt))
      .limit(100),
    // Get cached metadata from the most recent trade
    db
      .select({
        tokenName: trade.tokenName,
        tokenSymbol: trade.tokenSymbol,
        tokenLogo: trade.tokenLogo,
        tokenLaunchpad: trade.tokenLaunchpad,
      })
      .from(trade)
      .where(and(eq(trade.tokenAddress, address), eq(trade.chain, chain)))
      .orderBy(desc(trade.tradedAt))
      .limit(1),
  ]);

  const meta = tokenMeta[0];

  // Fetch live price data with fallbacks
  const tokenData = await getTokenData(chain, address, {
    name: meta?.tokenName,
    symbol: meta?.tokenSymbol,
    logo: meta?.tokenLogo,
  });

  // Aggregate KOL stats per wallet
  const kolMap = new Map<
    string,
    {
      walletAddress: string;
      walletLabel: string | null;
      walletAvatar: string | null;
      totalBought: number;
      totalSold: number;
      realizedProfit: number;
      buyCount: number;
      sellCount: number;
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
        buyCount: 0,
        sellCount: 0,
        firstBuy: null,
        lastTrade: null,
      });
    }
    const kol = kolMap.get(t.walletAddress)!;
    if (t.type === "buy") {
      kol.totalBought += t.amountUsd ?? 0;
      kol.buyCount++;
      if (!kol.firstBuy || (t.tradedAt && new Date(t.tradedAt) < new Date(kol.firstBuy))) {
        kol.firstBuy = t.tradedAt?.toISOString() ?? null;
      }
    } else {
      kol.totalSold += t.amountUsd ?? 0;
      kol.sellCount++;
      kol.realizedProfit += t.realizedProfit ?? 0;
    }
    if (!kol.lastTrade || (t.tradedAt && new Date(t.tradedAt) > new Date(kol.lastTrade))) {
      kol.lastTrade = t.tradedAt?.toISOString() ?? null;
    }
  }

  const kols = Array.from(kolMap.values()).sort(
    (a, b) => b.totalBought - a.totalBought,
  );

  // Serialize trades
  const trades = tokenTrades.slice(0, 50).map((t) => ({
    id: t.id,
    walletAddress: t.walletAddress,
    walletLabel: t.walletLabel,
    walletAvatar: t.walletAvatar,
    type: t.type,
    amountUsd: t.amountUsd,
    amountToken: t.amountToken,
    priceUsd: t.priceUsd,
    realizedProfit: t.realizedProfit,
    realizedProfitPnl: t.realizedProfitPnl,
    txHash: t.txHash,
    tradedAt: t.tradedAt?.toISOString() ?? null,
    source: t.source,
  }));

  return NextResponse.json({
    token: {
      ...tokenData,
      launchpad: meta?.tokenLaunchpad ?? null,
    },
    kols,
    trades,
    stats: {
      totalKols: kols.length,
      totalVolume: trades.reduce((s, t) => s + (t.amountUsd ?? 0), 0),
      buyCount: trades.filter((t) => t.type === "buy").length,
      sellCount: trades.filter((t) => t.type === "sell").length,
    },
  });
}
