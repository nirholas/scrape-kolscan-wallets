import { NextRequest } from 'next/server';
import { proxyHandler } from '@/lib/proxy/handler';

export async function GET(request: NextRequest) {
  return proxyHandler({
    source: 'birdeye',
    endpoint: `/defi/tokenlist`,
    params: {
      sort_by: request.nextUrl.searchParams.get('sort_by') || 'v24hUSD',
      sort_type: request.nextUrl.searchParams.get('sort_type') || 'desc',
      offset: request.nextUrl.searchParams.get('offset') || '0',
      limit: request.nextUrl.searchParams.get('limit') || '50',
      min_liquidity: request.nextUrl.searchParams.get('min_liquidity') || undefined,
    },
    cache: { ttl: 60 },
  }, request);
}
