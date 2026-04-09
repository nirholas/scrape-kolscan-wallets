import { NextRequest } from 'next/server';
import { proxyHandler } from '@/lib/proxy/handler';

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  return proxyHandler({
    source: 'solscan',
    endpoint: `/account/transactions`,
    params: {
      address: params.address,
      before: request.nextUrl.searchParams.get('before') || undefined,
      limit: request.nextUrl.searchParams.get('limit') || '40',
    },
    cache: { ttl: 30 },
  }, request);
}
