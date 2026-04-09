// site/app/api/proxy/market/coingecko/coins/markets/route.ts
import { NextRequest } from "next/server";
import { createProxyRoute } from "@/lib/proxy/handler";
import { COINGECKO_BASE_URL } from "@/lib/proxy/sources/coingecko";

export async function GET(req: NextRequest, { params }: { params: {} }) {
  return createProxyRoute(req, params, {
    baseUrl: `${COINGECKO_BASE_URL}/coins/markets`,
    apiKey: process.env.COINGECKO_API_KEY,
    rateLimit: {
      limit: 20,
      windowMs: 60000,
    },
    cache: {
      ttl: 300,
      stale: 1800,
    },
    forwardedSearchParams: true,
  });
}
