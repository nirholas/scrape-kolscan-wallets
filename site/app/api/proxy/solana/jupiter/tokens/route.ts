import { NextRequest } from 'next/server';
import { proxyHandler } from '@/lib/proxy/handler';

export async function GET(request: NextRequest) {
  return proxyHandler({
    source: 'jupiter_tokens',
    endpoint: `/all`,
    cache: { ttl: 3600 },
  }, request);
}
