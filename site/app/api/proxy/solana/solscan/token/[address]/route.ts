import { NextRequest } from 'next/server';
import { proxyHandler } from '@/lib/proxy/handler';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ address: string }> }
) {
  const params = await context.params;
  return proxyHandler({
    source: 'solscan',
    endpoint: `/token/meta`,
    params: { address: params.address },
    cache: { ttl: 3600 },
  }, request);
}
