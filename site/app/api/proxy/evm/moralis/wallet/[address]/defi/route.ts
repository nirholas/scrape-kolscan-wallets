import { NextResponse } from "next/server";
import { createEvmRoute } from "@/lib/proxy/evm-route";
import { moralisProxy } from "@/lib/proxy/sources/moralis";
import { MORALIS_CHAIN_NAMES, getCacheHeaders, CACHE_TTL, CACHE_STALE } from "@/lib/proxy/types";

export const GET = createEvmRoute(async (request, params) => {
  const chain = request.nextUrl.searchParams.get("chain") || "eth";
  const moralisChain = MORALIS_CHAIN_NAMES[chain] || chain;
  const data = await moralisProxy.getWalletDefi(params.address, moralisChain);
  return NextResponse.json(data, {
    headers: getCacheHeaders(CACHE_TTL.defiPositions, CACHE_STALE.defiPositions),
  });
});
