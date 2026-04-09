import { NextRequest, NextResponse } from "next/server";
import { fetchWalletNFTs } from "@/lib/wallet-aggregator";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ address: string }> }
) {
  const params = await context.params;
  const { searchParams } = req.nextUrl;
  const chain = searchParams.get("chain") as "ethereum" | "bsc" | "polygon" | undefined;

  try {
    const nfts = await fetchWalletNFTs(params.address, chain || "ethereum");
    return NextResponse.json(nfts);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
