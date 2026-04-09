import { NextRequest, NextResponse } from "next/server";
import { covalentProxy } from "@/lib/proxy/sources/covalent";
import { getCacheHeaders, CACHE_TTL, CACHE_STALE } from "@/lib/proxy/types";

export async function GET(_request: NextRequest) {
  try {
    const data = await covalentProxy.getChains();
    return NextResponse.json(data, {
      headers: getCacheHeaders(CACHE_TTL.chainInfo, CACHE_STALE.chainInfo),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
