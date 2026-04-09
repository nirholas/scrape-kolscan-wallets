import { NextRequest } from 'next/server';
import { proxyHandler } from '@/lib/proxy/handler';

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  return proxyHandler({
    source: 'helius',
    endpoint: `/v0/addresses/${params.address}/balances`,
    cache: { ttl: 60 },
  }, request);
}
