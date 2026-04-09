import { NextRequest, NextResponse } from "next/server";
import { alchemyProxy } from "@/lib/proxy/sources/alchemy";
import { getCacheHeaders, CACHE_TTL, CACHE_STALE } from "@/lib/proxy/types";

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    const chain = request.nextUrl.searchParams.get("chain") || "eth";
    const data = await alchemyProxy.getWalletNfts(params.address, chain);
    return NextResponse.json(data, {
      headers: getCacheHeaders(CACHE_TTL.nfts, CACHE_STALE.nfts),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
