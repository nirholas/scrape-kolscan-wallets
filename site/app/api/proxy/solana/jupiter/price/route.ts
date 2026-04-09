import { NextRequest } from 'next/server';
import { proxyHandler } from '@/lib/proxy/handler';

export async function GET(request: NextRequest) {
  const ids = request.nextUrl.searchParams.get('ids');
  if (!ids) {
    const { NextResponse } = await import('next/server');
    return NextResponse.json({ error: 'ids parameter is required' }, { status: 400 });
  }

  return proxyHandler({
    source: 'jupiter_price',
    endpoint: `/price`,
    params: {
      ids,
      vsToken: request.nextUrl.searchParams.get('vsToken') || undefined,
    },
    cache: { ttl: 15 },
  }, request);
}
