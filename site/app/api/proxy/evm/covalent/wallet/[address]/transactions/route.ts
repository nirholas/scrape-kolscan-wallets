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
    const data = await covalentProxy.getWalletTransactions(params.address, chain);
    return NextResponse.json(data, {
      headers: getCacheHeaders(CACHE_TTL.transactions, CACHE_STALE.transactions),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
