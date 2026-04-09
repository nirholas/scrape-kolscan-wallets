import { NextRequest } from 'next/server';
import { proxyHandler } from '@/lib/proxy/handler';

export async function GET(request: NextRequest) {
  return proxyHandler({
    source: 'solscan',
    endpoint: `/token/trending`,
    params: {
      limit: request.nextUrl.searchParams.get('limit') || '20',
    },
    cache: { ttl: 60 },
  }, request);
}
