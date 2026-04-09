import { NextRequest, NextResponse } from "next/server";
import { covalentProxy } from "@/lib/proxy/sources/covalent";
import { COVALENT_CHAIN_NAMES, getCacheHeaders, CACHE_TTL, CACHE_STALE } from "@/lib/proxy/types";

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    const chainParam = request.nextUrl.searchParams.get("chain") || "eth";
    const chain = COVALENT_CHAIN_NAMES[chainParam] || chainParam;
    const data = await covalentProxy.getTokenHolders(params.address, chain);
    return NextResponse.json(data, {
      headers: getCacheHeaders(CACHE_TTL.walletBalances, CACHE_STALE.walletBalances),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
