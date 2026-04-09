import { NextResponse } from 'next/server';
import { calculateRiskScore } from '@/lib/security-scorer';

export async function GET(
  request: Request,
  context: { params: Promise<{ address: string }> }
) {
  const params = await context.params;
  const { searchParams } = new URL(request.url);
  const chain = searchParams.get('chain');
  const address = params.address;

  if (!address) {
    return NextResponse.json({ error: 'Token address is required' }, { status: 400 });
  }

  // In a real implementation, we would fetch data from various sources
  // For now, we'll use a placeholder
  const tokenData = { address, chain }; 
  const riskScore = calculateRiskScore(tokenData);

  // Fetch from other specific endpoints
  const baseUrl = request.url.split('/api/scanner/')[0];
  const securityPromise = fetch(`${baseUrl}/api/scanner/${address}/security?chain=${chain}`).then(res => res.json());
  const holdersPromise = fetch(`${baseUrl}/api/scanner/${address}/holders?chain=${chain}`).then(res => res.json());
  const kolCheckPromise = fetch(`${baseUrl}/api/scanner/${address}/kol-check?chain=${chain}`).then(res => res.json());
  
  const [security, holders, kolCheck] = await Promise.all([
    securityPromise,
    holdersPromise,
    kolCheckPromise
  ]);

  return NextResponse.json({
    riskScore,
    security,
    holders,
    kolCheck,
  });
}
