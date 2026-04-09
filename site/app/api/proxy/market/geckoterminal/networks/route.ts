// site/app/api/proxy/market/geckoterminal/networks/route.ts
import { NextRequest } from "next/server";
import { createProxyRoute } from "@/lib/proxy/handler";
import { GECKOTERMINAL_BASE_URL } from "@/lib/proxy/sources/geckoterminal";

export async function GET(req: NextRequest, { params }: { params: {} }) {
  return createProxyRoute(req, params, {
    baseUrl: `${GECKOTERMINAL_BASE_URL}/networks`,
    rateLimit: {
      limit: 10,
      windowMs: 60000,
    },
    cache: {
      ttl: 3600,
      stale: 86400,
    },
  });
}
