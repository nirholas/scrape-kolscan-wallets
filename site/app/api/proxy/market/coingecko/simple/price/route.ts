// site/app/api/proxy/market/coingecko/simple/price/route.ts
import { NextRequest } from "next/server";
import { createProxyRoute } from "@/lib/proxy/handler";
import { COINGECKO_BASE_URL } from "@/lib/proxy/sources/coingecko";

export async function GET(req: NextRequest, { params }: { params: {} }) {
  return createProxyRoute(req, params, {
    baseUrl: `${COINGECKO_BASE_URL}/simple/price`,
    apiKey: process.env.COINGECKO_API_KEY,
    rateLimit: {
      limit: 25,
      windowMs: 60000,
    },
    cache: {
      ttl: 30,
      stale: 120,
    },
    forwardedSearchParams: true,
  });
}
