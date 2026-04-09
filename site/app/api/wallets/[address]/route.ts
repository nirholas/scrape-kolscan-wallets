import { NextRequest, NextResponse } from "next/server";
import { getWalletDetail } from "@/lib/wallet-detail";

// GET /api/wallets/[address] — comprehensive wallet detail
// Merges data from: unified wallets, X profiles, trades, community submissions
export async function GET(
  _req: NextRequest,
  { params }: { params: { address: string } },
) {
  const detail = await getWalletDetail(params.address);

  if (!detail.hasTrackedData && !detail.isValidAddress) {
    return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}
