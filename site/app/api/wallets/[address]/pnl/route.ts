import { NextRequest, NextResponse } from "next/server";
import { fetchWalletPnl } from "@/lib/wallet-aggregator";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ address: string }> }
) {
  const params = await context.params;
  const { searchParams } = req.nextUrl;
  const chain = searchParams.get("chain") as "solana" | "ethereum" | undefined;

  try {
    const pnl = await fetchWalletPnl(params.address, chain || "solana");
    return NextResponse.json(pnl);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
