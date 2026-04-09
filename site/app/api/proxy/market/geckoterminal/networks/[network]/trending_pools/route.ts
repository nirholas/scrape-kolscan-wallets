// site/app/api/proxy/market/geckoterminal/networks/[network]/trending_pools/route.ts
import { NextRequest } from "next/server";
import { createProxyRoute } from "@/lib/proxy/handler";
import { GECKOTERMINAL_BASE_URL } from "@/lib/proxy/sources/geckoterminal";

export async function GET(req: NextRequest, context: { params: Promise<{ network: string }> }) {
  const params = await context.params;
  return createProxyRoute(req, params, {
    baseUrl: `${GECKOTERMINAL_BASE_URL}/networks`,
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
