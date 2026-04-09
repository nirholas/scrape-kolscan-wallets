import { NextRequest } from 'next/server';
import { proxyHandler } from '@/lib/proxy/handler';

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  return proxyHandler({
    source: 'solscan',
    endpoint: `/account/detail`,
    params: { address: params.address },
    cache: { ttl: 60 },
  }, request);
}
