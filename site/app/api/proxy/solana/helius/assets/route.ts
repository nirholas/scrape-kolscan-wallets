import { NextRequest } from 'next/server';
import { proxyHandler } from '@/lib/proxy/handler';

export async function POST(request: NextRequest) {
  const body = await request.json();
  return proxyHandler({
    source: 'helius_rpc',
    endpoint: `/`,
    method: 'POST',
    body: {
      jsonrpc: "2.0",
      id: "helius-proxy",
      method: "getAssetsByOwner",
      params: body
    },
    cache: { ttl: 60 },
  }, request);
}
