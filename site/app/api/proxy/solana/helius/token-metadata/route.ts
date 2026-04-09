import { NextRequest } from 'next/server';
import { proxyHandler } from '@/lib/proxy/handler';

export async function POST(request: NextRequest) {
  const body = await request.json();
  return proxyHandler({
    source: 'helius',
    endpoint: `/v0/tokens/metadata`,
    method: 'POST',
    body,
    cache: { ttl: 3600 },
  }, request);
}
