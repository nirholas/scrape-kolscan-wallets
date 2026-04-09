import { NextRequest, NextResponse } from "next/server";
import { debankProxy } from "@/lib/proxy/sources/debank";
import { getCacheHeaders, CACHE_TTL, CACHE_STALE } from "@/lib/proxy/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    const data = await debankProxy.getWalletNfts(params.address.toLowerCase());
    return NextResponse.json(data, {
      headers: getCacheHeaders(CACHE_TTL.nfts, CACHE_STALE.nfts),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
