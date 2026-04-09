import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

// Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number; staleTimestamp: number }>();

async function fetchWithTimeout(url: string, ms = 5000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  const res = await fetch(url, {
    signal: controller.signal,
    headers: { Accept: "application/json" },
  });
  clearTimeout(id);
  return res;
}

interface ProxyConfig {
  baseUrl: string;
  apiKey?: string;
  rateLimit: {
    limit: number;
    windowMs: number;
  };
  cache?: {
    ttl: number;
    stale: number;
  };
  forwardedSearchParams?: boolean | string[];
}

export async function createProxyRoute(req: NextRequest, params: Record<string, string>, config: ProxyConfig) {
  const userIp = req.ip ?? "127.0.0.1";
  const { success } = await checkRateLimit(
    `proxy:${config.baseUrl}:${userIp}`,
    config.rateLimit.limit,
    config.rateLimit.windowMs,
  );

  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let path = req.nextUrl.pathname.replace(/^\/api\/proxy\/market\/[a-z-]+\/?/, "");
  Object.entries(params).forEach(([key, value]) => {
    path = path.replace(`[${key}]`, value);
  });

  const url = new URL(`${config.baseUrl}/${path}`);
  if (config.apiKey) {
    url.searchParams.set("x_cg_demo_api_key", config.apiKey);
  }
  
  if (config.forwardedSearchParams) {
    req.nextUrl.searchParams.forEach((value, key) => {
        if (Array.isArray(config.forwardedSearchParams) && !config.forwardedSearchParams.includes(key)) return;
        url.searchParams.append(key, value);
    });
  }

  // Caching logic
  if (config.cache) {
    const cached = cache.get(url.toString());
    const now = Date.now();
    if (cached && now < cached.timestamp + config.cache.ttl * 1000) {
      return NextResponse.json(cached.data);
    }
    if (cached && now < cached.timestamp + config.cache.stale * 1000) {
        // Return stale data but revalidate in background
        fetchWithTimeout(url.toString()).then(async res => {
            if(res.ok) {
                const data = await res.json();
                cache.set(url.toString(), { data, timestamp: now, staleTimestamp: now });
            }
        });
        return NextResponse.json(cached.data);
    }
  }

  const response = await fetchWithTimeout(url.toString());

  if (!response.ok) {
    const errorBody = await response.text();
    return NextResponse.json({ error: `Upstream API error: ${errorBody}` }, { status: response.status });
  }

  const data = await response.json();

  if (config.cache) {
    cache.set(url.toString(), { data, timestamp: Date.now(), staleTimestamp: Date.now() });
  }

  return NextResponse.json(data);
}
