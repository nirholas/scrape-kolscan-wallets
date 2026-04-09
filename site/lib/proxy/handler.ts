import { NextRequest, NextResponse } from "next/server";
import { checkApiRateLimit, addRateLimitHeaders, createRateLimitResponse, getTierFromApiKey, trackRequest } from "@/lib/rate-limit/index";

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
  const userIp = req.headers.get("x-forwarded-for") || "127.0.0.1";
  
  // Extract API key from headers
  const apiKey = req.headers.get("x-api-key") || req.headers.get("authorization")?.replace("Bearer ", "") || null;
  
  const tier = await getTierFromApiKey(apiKey);
  
  // Enforce API key if tier is public but we expect an authenticated user? 
  // Let's rely on the rate limit tier. "public" has very low limits.
  
  const result = await checkApiRateLimit(req, apiKey, userIp, tier);

  if (!result.success || !result.quotaAllowed) {
    await trackRequest(apiKey || userIp, req.nextUrl.pathname, true);
    return createRateLimitResponse(result);
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
      const resp = NextResponse.json(cached.data);
      addRateLimitHeaders(resp, result);
      await trackRequest(apiKey || userIp, req.nextUrl.pathname, false);
      return resp;
    }
    if (cached && now < cached.timestamp + config.cache.stale * 1000) {
        // Return stale data but revalidate in background
        fetchWithTimeout(url.toString()).then(async res => {
            if(res.ok) {
                const data = await res.json();
                cache.set(url.toString(), { data, timestamp: now, staleTimestamp: now });
            }
        });
        const resp = NextResponse.json(cached.data);
        addRateLimitHeaders(resp, result);
        await trackRequest(apiKey || userIp, req.nextUrl.pathname, false);
        return resp;
    }
  }

  const response = await fetchWithTimeout(url.toString());

  if (!response.ok) {
    await trackRequest(apiKey || userIp, req.nextUrl.pathname, true);
    const errorBody = await response.text();
    const resp = NextResponse.json({ error: `Upstream API error: ${errorBody}` }, { status: response.status });
    addRateLimitHeaders(resp, result);
    return resp;
  }

  const data = await response.json();

  if (config.cache) {
    cache.set(url.toString(), { data, timestamp: Date.now(), staleTimestamp: Date.now() });
  }

  const resp = NextResponse.json(data);
  addRateLimitHeaders(resp, result);
  await trackRequest(apiKey || userIp, req.nextUrl.pathname, false);
  return resp;
}

export interface UnifiedProxyConfig {
  source: string;
  endpoint: string;
  params?: Record<string, string | undefined>;
  cache?: { ttl: number; staleWhileRevalidate?: number };
  transform?: (data: any) => any;
  method?: 'GET' | 'POST';
  body?: any;
}

export async function proxyHandler(config: UnifiedProxyConfig, req?: Request | NextRequest): Promise<NextResponse | Response> {
  let userIp = "127.0.0.1";
  let apiKey: string | null = null;
  let pathname = "/api/proxy/solana/unified";

  if (req instanceof NextRequest) {
    userIp = req.headers.get("x-forwarded-for") || "127.0.0.1";
    apiKey = req.headers.get("x-api-key") || req.headers.get("authorization")?.replace("Bearer ", "") || null;
    pathname = req.nextUrl.pathname;
  } else if (req) {
    userIp = req.headers.get("x-forwarded-for") || "127.0.0.1";
    apiKey = req.headers.get("x-api-key") || req.headers.get("authorization")?.replace("Bearer ", "") || null;
    const url = new URL(req.url);
    pathname = url.pathname;
  }

  const tier = await getTierFromApiKey(apiKey);
  const result = await checkApiRateLimit(req as any, apiKey, userIp, tier);

  if (!result.success || !result.quotaAllowed) {
    await trackRequest(apiKey || userIp, pathname, true);
    return createRateLimitResponse(result);
  }

  const sourcesModule = await import('./sources');
  const sourceConfig = sourcesModule.sources[config.source];
  
  if (!sourceConfig) {
    return NextResponse.json({ error: `Source ${config.source} not configured` }, { status: 400 });
  }

  try {
    let url = new URL(`${sourceConfig.baseUrl}${config.endpoint}`);
    
    if (config.params) {
      for (const [k, v] of Object.entries(config.params)) {
        if (v !== undefined && v !== null) {
          url.searchParams.append(k, v);
        }
      }
    }
    
    if (sourceConfig.appendKey) {
      url.searchParams.append(sourceConfig.appendKey.param, sourceConfig.appendKey.value);
    }

    const headers: Record<string, string> = { ...sourceConfig.headers };
    if (config.method === 'POST') {
      headers['Content-Type'] = 'application/json';
    }

    const cacheKey = url.toString() + (config.method === 'POST' ? JSON.stringify(config.body) : '');
    const now = Date.now();
    
    if (config.cache && config.method !== 'POST') {
      const cached = cache.get(cacheKey);
      if (cached && now < cached.timestamp + config.cache.ttl * 1000) {
        let responseData = cached.data;
        if (config.transform) responseData = config.transform(responseData);
        const resp = NextResponse.json(responseData);
        addRateLimitHeaders(resp, result);
        await trackRequest(apiKey || userIp, pathname, false);
        return resp;
      }
    }

    const fetchOptions: RequestInit = {
      method: config.method || 'GET',
      headers,
    };

    if (config.body && config.method === 'POST') {
      fetchOptions.body = JSON.stringify(config.body);
    }

    const upstreamRes = await fetchWithTimeout(url.toString(), 15000);

    if (!upstreamRes.ok) {
      throw new Error(`Upstream error: ${upstreamRes.status} ${upstreamRes.statusText}`);
    }

    let data = await upstreamRes.json();
    
    if (config.cache && config.method !== 'POST') {
      cache.set(cacheKey, { data, timestamp: now, staleTimestamp: now });
    }

    if (config.transform) {
      data = config.transform(data);
    }

    const resp = NextResponse.json(data);
    addRateLimitHeaders(resp, result);
    await trackRequest(apiKey || userIp, pathname, false);
    return resp;

  } catch (error: any) {
    await trackRequest(apiKey || userIp, pathname, true);
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
}
