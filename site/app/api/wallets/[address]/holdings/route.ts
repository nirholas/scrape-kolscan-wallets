import { NextRequest, NextResponse } from "next/server";
import { fetchWalletHoldings } from "@/lib/wallet-aggregator";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ address: string }> }
) {
  const params = await context.params;
  const { searchParams } = req.nextUrl;
  const chain = searchParams.get("chain") as "solana" | "ethereum" | undefined;

  try {
    const holdings = await fetchWalletHoldings(params.address, chain || "solana");
    return NextResponse.json(holdings);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
