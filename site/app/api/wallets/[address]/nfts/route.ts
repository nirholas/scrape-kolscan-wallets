import { NextRequest, NextResponse } from "next/server";
import { fetchWalletNFTs } from "@/lib/wallet-aggregator";

export async function GET(
  req: NextRequest,
  { params }: { params: { address: string } }
) {
  const { searchParams } = req.nextUrl;
  const chain = searchParams.get("chain") as "ethereum" | "bsc" | "polygon" | undefined;

  try {
    const nfts = await fetchWalletNFTs(params.address, chain || "ethereum");
    return NextResponse.json(nfts);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
