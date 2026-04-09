// site/app/api/proxy/market/dexscreener/pairs/[chainId]/[pairAddress]/route.ts
import { NextRequest } from "next/server";
import { createProxyRoute } from "@/lib/proxy/handler";
import { DEXSCREENER_BASE_URL } from "@/lib/proxy/sources/dexscreener";

export async function GET(req: NextRequest, context: { params: Promise<{ chainId: string, pairAddress: string }> }) {
  const params = await context.params;
  return createProxyRoute(req, params, {
    baseUrl: DEXSCREENER_BASE_URL,
    rateLimit: {
      limit: 30,
      windowMs: 60000,
    },
    cache: {
      ttl: 30,
      stale: 120,
    },
  });
}
