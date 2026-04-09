import { NextRequest } from 'next/server';
import { proxyHandler } from '@/lib/proxy/handler';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ address: string }> }
) {
  const params = await context.params;
  return proxyHandler({
    source: 'birdeye',
    endpoint: `/defi/history_price`,
    params: {
      address: params.address,
      address_type: request.nextUrl.searchParams.get('address_type') || 'token',
      type: request.nextUrl.searchParams.get('type') || '1D',
      time_from: request.nextUrl.searchParams.get('time_from') || Math.floor(Date.now() / 1000 - 86400 * 30).toString(),
      time_to: request.nextUrl.searchParams.get('time_to') || Math.floor(Date.now() / 1000).toString(),
    },
    cache: { ttl: 300 },
  }, request);
}
