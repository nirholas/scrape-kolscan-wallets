// site/app/api/proxy/market/dexscreener/token-boosts/[type]/route.ts
import { NextRequest } from "next/server";
import { createProxyRoute } from "@/lib/proxy/handler";
import { DEXSCREENER_BASE_URL } from "@/lib/proxy/sources/dexscreener";

export async function GET(req: NextRequest, { params }: { params: { type: string } }) {
  return createProxyRoute(req, params, {
    baseUrl: `${DEXSCREENER_BASE_URL.replace("/dex","")}/token-boosts`,
    rateLimit: {
      limit: 15,
      windowMs: 60000,
    },
    cache: {
      ttl: 60,
      stale: 300,
    },
  });
}
