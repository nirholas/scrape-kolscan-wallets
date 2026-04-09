import { NextRequest } from 'next/server';
import { proxyHandler } from '@/lib/proxy/handler';

export async function GET(request: NextRequest) {
  return proxyHandler({
    source: 'solscan',
    endpoint: `/chaininfo`,
    cache: { ttl: 300 },
  }, request);
}
