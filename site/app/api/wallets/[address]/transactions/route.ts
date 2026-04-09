import { NextRequest, NextResponse } from "next/server";
import { fetchWalletTransactions } from "@/lib/wallet-aggregator";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ address:string }> }
) {
  const params = await context.params;
  const { searchParams } = req.nextUrl;
  const chain = searchParams.get("chain") as "solana" | "ethereum" | undefined;
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  try {
    const transactions = await fetchWalletTransactions(
      params.address,
      chain || "solana",
      limit
    );
    return NextResponse.json(transactions);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
