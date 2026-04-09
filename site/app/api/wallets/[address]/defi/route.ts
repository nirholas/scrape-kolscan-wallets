import { NextRequest, NextResponse } from "next/server";
import { fetchWalletDefi } from "@/lib/wallet-aggregator";

export async function GET(
  req: NextRequest,
  { params }: { params: { address: string } }
) {
  const { searchParams } = req.nextUrl;
  const chain = searchParams.get("chain") as "ethereum" | "bsc" | "polygon" | undefined;

  try {
    const positions = await fetchWalletDefi(params.address, chain || "ethereum");
    return NextResponse.json(positions);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
