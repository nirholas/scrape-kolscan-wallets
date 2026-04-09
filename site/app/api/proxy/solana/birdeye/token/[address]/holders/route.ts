import { NextRequest } from 'next/server';
import { proxyHandler } from '@/lib/proxy/handler';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  return proxyHandler({
    source: 'birdeye',
    endpoint: `/defi/v3/token/holder`,
    params: {
      address,
      offset: request.nextUrl.searchParams.get('offset') || '0',
      limit: request.nextUrl.searchParams.get('limit') || '50',
    },
    cache: { ttl: 3600 },
  }, request);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ address: string }> }
) {
  const params = await context.params;
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
