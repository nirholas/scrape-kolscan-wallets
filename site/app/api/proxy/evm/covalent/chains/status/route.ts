import { NextRequest, NextResponse } from "next/server";
import { covalentProxy } from "@/lib/proxy/sources/covalent";
import { getCacheHeaders, CACHE_TTL, CACHE_STALE } from "@/lib/proxy/types";

export async function GET(_request: NextRequest) {
  try {
    const data = await covalentProxy.getChainStatus();
    return NextResponse.json(data, {
      headers: getCacheHeaders(CACHE_TTL.walletBalances, CACHE_STALE.walletBalances),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
