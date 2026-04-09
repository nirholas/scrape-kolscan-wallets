// site/app/api/proxy/market/coingecko/coins/[id]/route.ts
import { NextRequest } from "next/server";
import { createProxyRoute } from "@/lib/proxy/handler";
import { COINGECKO_BASE_URL } from "@/lib/proxy/sources/coingecko";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  return createProxyRoute(req, params, {
    baseUrl: `${COINGECKO_BASE_URL}/coins`,
    apiKey: process.env.COINGECKO_API_KEY,
    rateLimit: {
      limit: 25,
      windowMs: 60000,
    },
    cache: {
      ttl: 3600,
      stale: 86400,
    },
    forwardedSearchParams: true,
  });
}
