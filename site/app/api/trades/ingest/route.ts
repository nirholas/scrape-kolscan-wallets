import { NextRequest, NextResponse } from "next/server";
import { db } from "@/drizzle/db";
import { trade } from "@/drizzle/db/schema";
import * as crypto from "crypto";

const INGEST_SECRET = process.env.INGEST_SECRET || "";

export async function POST(req: NextRequest) {
  // Protect with a shared secret
  const authHeader = req.headers.get("authorization");
  if (!INGEST_SECRET || authHeader !== `Bearer ${INGEST_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const trades: any[] = body.trades;

  if (!Array.isArray(trades) || trades.length === 0) {
    return NextResponse.json({ error: "trades array is required" }, { status: 400 });
  }

  if (trades.length > 500) {
    return NextResponse.json({ error: "Max 500 trades per request" }, { status: 400 });
  }

  const validChains = new Set(["sol", "bsc"]);
  const validTypes = new Set(["buy", "sell"]);

  const rows = [];
  let rejected = 0;

  for (const t of trades) {
    if (
      !t.walletAddress ||
      typeof t.walletAddress !== "string" ||
      t.walletAddress.length > 96 ||
      !validChains.has(t.chain) ||
      !validTypes.has(t.type) ||
      !t.tokenAddress ||
      typeof t.tokenAddress !== "string" ||
      t.tokenAddress.length > 96 ||
      !t.tradedAt
    ) {
      rejected++;
      continue;
    }
    rows.push({
      id: crypto.randomUUID(),
      walletAddress: t.walletAddress,
      chain: t.chain,
      type: t.type,
      tokenAddress: t.tokenAddress,
      tokenSymbol: typeof t.tokenSymbol === "string" ? t.tokenSymbol.slice(0, 32) : null,
      tokenName: typeof t.tokenName === "string" ? t.tokenName.slice(0, 120) : null,
      amountUsd: typeof t.amountUsd === "number" ? t.amountUsd : null,
      amountToken: typeof t.amountToken === "number" ? t.amountToken : null,
      priceUsd: typeof t.priceUsd === "number" ? t.priceUsd : null,
      txHash: typeof t.txHash === "string" ? t.txHash.slice(0, 128) : null,
      source: typeof t.source === "string" ? t.source : "external",
      walletLabel: typeof t.walletLabel === "string" ? t.walletLabel.slice(0, 120) : null,
      walletAvatar: typeof t.walletAvatar === "string" ? t.walletAvatar : null,
      tradedAt: new Date(t.tradedAt),
    });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "No valid trades found", rejected }, { status: 400 });
  }

  await db.insert(trade).values(rows).onConflictDoNothing();

  return NextResponse.json({ inserted: rows.length, rejected, total: trades.length });
}
