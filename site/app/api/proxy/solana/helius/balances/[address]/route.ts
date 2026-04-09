import { NextRequest } from 'next/server';
import { proxyHandler } from '@/lib/proxy/handler';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ address: string }> }
) {
  const params = await context.params;
  return proxyHandler({
    source: 'helius',
    endpoint: `/v0/addresses/${params.address}/balances`,
    cache: { ttl: 60 },
  }, request);
}
