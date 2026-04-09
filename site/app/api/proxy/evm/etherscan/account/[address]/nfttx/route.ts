import { NextRequest, NextResponse } from "next/server";
import { etherscanProxy } from "@/lib/proxy/sources/etherscan";
import { getCacheHeaders, CACHE_TTL, CACHE_STALE } from "@/lib/proxy/types";

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    const chainid = request.nextUrl.searchParams.get("chainid") || "1";
    const data = await etherscanProxy.getAccountNftTx(params.address, chainid);
    return NextResponse.json(data, {
      headers: getCacheHeaders(CACHE_TTL.nfts, CACHE_STALE.nfts),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
