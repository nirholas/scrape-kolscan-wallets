import { NextRequest, NextResponse } from 'next/server';
import { checkApiRateLimit, addRateLimitHeaders, createRateLimitResponse, getTierFromApiKey, trackRequest } from '@/lib/rate-limit/index';

// Cache TTLs (seconds)
const CACHE_TTL = 60;
const cache = new Map<string, { data: unknown; timestamp: number }>();

async function fetchUpstream(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json', ...headers } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ address: string }> }
) {
  const params = await context.params;
  const { address } = params;
  const userIp = request.headers.get('x-forwarded-for') || '127.0.0.1';
  const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '') || null;

  const tier = await getTierFromApiKey(apiKey);
  const result = await checkApiRateLimit(request, apiKey, userIp, tier);

  if (!result.success || !result.quotaAllowed) {
    await trackRequest(apiKey || userIp, request.nextUrl.pathname, true);
    return createRateLimitResponse(result);
  }

  const cacheKey = `unified-solana-wallet:${address}`;
  const cached = cache.get(cacheKey);
  const now = Date.now();
  if (cached && now < cached.timestamp + CACHE_TTL * 1000) {
    const resp = NextResponse.json(cached.data);
    addRateLimitHeaders(resp, result);
    await trackRequest(apiKey || userIp, request.nextUrl.pathname, false);
    return resp;
  }

  const heliusKey = process.env.HELIUS_API_KEY || '';
  const birdeyeKey = process.env.BIRDEYE_API_KEY || '';
  const solscanKey = process.env.SOLSCAN_API_KEY || '';

  const [heliusTx, heliusBalances, birdeyeHoldings, solscanAccount] = await Promise.allSettled([
    fetchUpstream(
      `https://api.helius.xyz/v0/addresses/${address}/transactions?limit=20&api-key=${heliusKey}`
    ),
    fetchUpstream(
      `https://api.helius.xyz/v0/addresses/${address}/balances?api-key=${heliusKey}`
    ),
    fetchUpstream(
      `https://public-api.birdeye.so/v1/wallet/token_list?wallet=${address}&limit=50`,
      { 'X-API-KEY': birdeyeKey, 'x-chain': 'solana' }
    ),
    fetchUpstream(
      `https://pro-api.solscan.io/v2.0/account/detail?address=${address}`,
      solscanKey ? { token: solscanKey } : {}
    ),
  ]);

  const txData = heliusTx.status === 'fulfilled' ? heliusTx.value : null;
  const balData = heliusBalances.status === 'fulfilled' ? heliusBalances.value : null;
  const birdeyeData = birdeyeHoldings.status === 'fulfilled' ? birdeyeHoldings.value : null;
  const solscanData = solscanAccount.status === 'fulfilled' ? solscanAccount.value : null;

  const txArray = Array.isArray(txData) ? txData : [];
  const holdings: unknown[] = (birdeyeData as any)?.data?.items ?? [];
  const portfolioValue: number = (birdeyeData as any)?.data?.totalUsd ?? 0;
  const solBalance: number = (balData as any)?.nativeBalance ?? (solscanData as any)?.data?.lamports / 1e9 ?? 0;
  const txCount: number = (solscanData as any)?.data?.txs ?? 0;

  const response = {
    address,
    // Helius data
    recentTransactions: txArray,
    nativeBalance: solBalance,
    tokenAccounts: (balData as any)?.tokens ?? [],
    // Birdeye data
    holdings,
    portfolioValue,
    portfolioChange24h: (birdeyeData as any)?.data?.change24hPercent ?? null,
    // Solscan data
    solBalance,
    transactionCount: txCount,
    accountType: (solscanData as any)?.data?.accountType ?? null,
    // Metadata
    sources: {
      helius: heliusTx.status === 'fulfilled' && heliusTx.value !== null,
      birdeye: birdeyeHoldings.status === 'fulfilled' && birdeyeHoldings.value !== null,
      solscan: solscanAccount.status === 'fulfilled' && solscanAccount.value !== null,
    },
    fetchedAt: new Date().toISOString(),
  };

  cache.set(cacheKey, { data: response, timestamp: now });

  const resp = NextResponse.json(response);
  addRateLimitHeaders(resp, result);
  await trackRequest(apiKey || userIp, request.nextUrl.pathname, false);
  return resp;
}
