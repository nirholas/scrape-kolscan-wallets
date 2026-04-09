import { NextRequest } from 'next/server';
import { proxyHandler } from '@/lib/proxy/handler';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  return proxyHandler({
    source: 'birdeye',
    endpoint: `/v1/wallet/token_list`,
    params: {
      wallet: address,
      limit: request.nextUrl.searchParams.get('limit') || '50',
      offset: request.nextUrl.searchParams.get('offset') || undefined,
    },
    cache: { ttl: 60 },
  }, request);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ address: string }> }
) {
  const params = await context.params;
  return proxyHandler({
    source: 'birdeye',
    endpoint: `/v1/wallet/token_list`,
    params: {
      wallet: params.address,
      limit: request.nextUrl.searchParams.get('limit') || '50',
      offset: request.nextUrl.searchParams.get('offset') || undefined,
    },
    cache: { ttl: 60 },
  }, request);
}
