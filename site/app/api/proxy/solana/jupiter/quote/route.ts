import { NextRequest } from 'next/server';
import { proxyHandler } from '@/lib/proxy/handler';

export async function GET(request: NextRequest) {
  const inputMint = request.nextUrl.searchParams.get('inputMint');
  const outputMint = request.nextUrl.searchParams.get('outputMint');
  const amount = request.nextUrl.searchParams.get('amount');

  if (!inputMint || !outputMint || !amount) {
    const { NextResponse } = await import('next/server');
    return NextResponse.json(
      { error: 'inputMint, outputMint, and amount are required' },
      { status: 400 }
    );
  }

  return proxyHandler({
    source: 'jupiter',
    endpoint: `/quote`,
    params: {
      inputMint,
      outputMint,
      amount,
      slippageBps: request.nextUrl.searchParams.get('slippageBps') || '50',
      swapMode: request.nextUrl.searchParams.get('swapMode') || undefined,
    },
    cache: { ttl: 15 },
  }, request);
}
