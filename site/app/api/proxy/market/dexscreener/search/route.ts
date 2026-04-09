// site/app/api/proxy/market/dexscreener/search/route.ts
import { NextRequest } from "next/server";
import { createProxyRoute } from "@/lib/proxy/handler";
import { DEXSCREENER_BASE_URL } from "@/lib/proxy/sources/dexscreener";

export async function GET(req: NextRequest, { params }: { params: {} }) {
  return createProxyRoute(req, params, {
    baseUrl: DEXSCREENER_BASE_URL,
    rateLimit: {
      limit: 20,
      windowMs: 60000,
    },
    cache: {
      ttl: 60,
      stale: 300,
    },
    forwardedSearchParams: true,
  });
}
