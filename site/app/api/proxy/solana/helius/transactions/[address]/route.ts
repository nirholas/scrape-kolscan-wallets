import { NextRequest } from 'next/server';
import { proxyHandler } from '@/lib/proxy/handler';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ address: string }> }
) {
  const params = await context.params;
  return proxyHandler({
    source: 'helius',
    endpoint: `/v0/addresses/${params.address}/transactions`,
    params: {
      limit: request.nextUrl.searchParams.get('limit') || '50',
      type: request.nextUrl.searchParams.get('type') || undefined,
    },
    cache: { ttl: 30 },
    transform: (data) => ({
      transactions: data,
      count: data?.length || 0,
    }),
  }, request);
}
