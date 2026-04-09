import { NextRequest } from 'next/server';
import { proxyHandler } from '@/lib/proxy/handler';

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  return proxyHandler({
    source: 'birdeye',
    endpoint: `/defi/v3/token/holder`,
    params: {
      address: params.address,
      offset: request.nextUrl.searchParams.get('offset') || '0',
      limit: request.nextUrl.searchParams.get('limit') || '50',
    },
    cache: { ttl: 3600 },
  }, request);
}
