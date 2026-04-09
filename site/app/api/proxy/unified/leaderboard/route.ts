import { NextRequest, NextResponse } from "next/server";
import {
  checkApiRateLimit,
  addRateLimitHeaders,
  createRateLimitResponse,
  getTierFromApiKey,
  trackRequest,
} from "@/lib/rate-limit/index";
import { getData, getSolGmgnData } from "@/lib/data";

const CACHE_TTL = 300; // 5 minutes
const cache = new Map<string, { data: unknown; timestamp: number }>();

// GET /api/proxy/unified/leaderboard?source=all|kolscan|gmgn&limit=50&offset=0
export async function GET(request: NextRequest) {
  const userIp = request.headers.get("x-forwarded-for") || "127.0.0.1";
  const apiKey =
    request.headers.get("x-api-key") ||
    request.headers.get("authorization")?.replace("Bearer ", "") ||
    null;

  const tier = await getTierFromApiKey(apiKey);
  const result = await checkApiRateLimit(request, apiKey, userIp, tier);
  if (!result.success || !result.quotaAllowed) {
    await trackRequest(apiKey || userIp, request.nextUrl.pathname, true);
    return createRateLimitResponse(result);
  }

  const source = request.nextUrl.searchParams.get("source") || "all";
  const limit = Math.min(
    parseInt(request.nextUrl.searchParams.get("limit") || "50"),
    200
  );
  const offset = Math.max(
    parseInt(request.nextUrl.searchParams.get("offset") || "0"),
    0
  );
  const sortBy = request.nextUrl.searchParams.get("sortBy") || "rank";

  const cacheKey = `unified:leaderboard:${source}:${sortBy}:${limit}:${offset}`;
  const cached = cache.get(cacheKey);
  const now = Date.now();
  if (cached && now < cached.timestamp + CACHE_TTL * 1000) {
    const resp = NextResponse.json(cached.data);
    addRateLimitHeaders(resp, result);
    await trackRequest(apiKey || userIp, request.nextUrl.pathname, false);
    return resp;
  }

  type Entry = {
    rank: number | null;
    address: string;
    name: string | null;
    twitter: string | null;
    chain: string;
    source: string;
    winRate?: number | null;
    pnl?: number | null;
    volume?: number | null;
  };

  const entries: Entry[] = [];

  if (source === "all" || source === "kolscan") {
    try {
      const kolscanData = await getData();
      kolscanData.slice(0, 500).forEach((w, i) => {
        entries.push({
          rank: i + 1,
          address: w.wallet_address ?? "",
          name: w.name ?? null,
          twitter: w.twitter ?? null,
          chain: "solana",
          source: "kolscan",
          winRate:
            w.wins + w.losses > 0
              ? w.wins / (w.wins + w.losses)
              : null,
          pnl: w.profit ?? null,
          volume: null,
        });
      });
    } catch {
      // non-fatal
    }
  }

  if (source === "all" || source === "gmgn") {
    try {
      const gmgnData = await getSolGmgnData();
      gmgnData.slice(0, 500).forEach((w, i) => {
        entries.push({
          rank: i + 1,
          address: w.wallet_address ?? "",
          name: w.name ?? null,
          twitter: w.twitter_username ?? null,
          chain: "solana",
          source: "gmgn",
          winRate: w.winrate_30d ?? w.winrate_7d ?? null,
          pnl: w.realized_profit_30d ?? w.realized_profit_7d ?? null,
          volume: w.volume_30d ?? w.volume_7d ?? null,
        });
      });
    } catch {
      // non-fatal
    }
  }

  // Deduplicate by address (prefer the entry with more data)
  const deduped = new Map<string, Entry>();
  for (const e of entries) {
    const existing = deduped.get(e.address);
    if (!existing || (e.pnl !== null && e.pnl !== undefined)) {
      deduped.set(e.address, e);
    }
  }

  let sorted = Array.from(deduped.values());
  if (sortBy === "pnl") {
    sorted.sort((a, b) => (b.pnl ?? 0) - (a.pnl ?? 0));
  } else if (sortBy === "winRate") {
    sorted.sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0));
  } else if (sortBy === "volume") {
    sorted.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
  } else {
    // default: rank
    sorted.sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999));
  }

  const page = sorted.slice(offset, offset + limit);

  const response = {
    total: sorted.length,
    limit,
    offset,
    sortBy,
    source,
    data: page,
    fetchedAt: new Date().toISOString(),
  };

  cache.set(cacheKey, { data: response, timestamp: now });
  const resp = NextResponse.json(response);
  addRateLimitHeaders(resp, result);
  await trackRequest(apiKey || userIp, request.nextUrl.pathname, false);
  return resp;
}
