import { NextRequest } from 'next/server';
import { proxyHandler } from '@/lib/proxy/handler';

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  return proxyHandler({
    source: 'solscan',
    endpoint: `/account/token-accounts`,
    params: {
      address: params.address,
      type: request.nextUrl.searchParams.get('type') || 'token',
      page: request.nextUrl.searchParams.get('page') || '1',
      page_size: request.nextUrl.searchParams.get('page_size') || '40',
    },
    cache: { ttl: 60 },
  }, request);
}
