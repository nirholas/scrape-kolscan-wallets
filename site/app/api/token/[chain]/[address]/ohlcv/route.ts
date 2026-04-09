import { NextRequest, NextResponse } from "next/server";

const BIRDEYE_BASE = "https://public-api.birdeye.so";

function birdeyeHeaders(): Record<string, string> {
  const key = process.env.BIRDEYE_API_KEY;
  return key ? { "X-API-KEY": key, "x-chain": "solana" } : { "x-chain": "solana" };
}

function resolutionToSeconds(resolution: string): number {
  if (resolution.endsWith("m")) return parseInt(resolution) * 60;
  if (resolution.endsWith("h")) return parseInt(resolution) * 3600;
  if (resolution.endsWith("d")) return parseInt(resolution) * 86400;
  return 3600;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ chain: string; address: string }> }
) {
  const params = await context.params;
  const { searchParams } = req.nextUrl;
  const chain = params.chain as "sol" | "bsc";
  const address = params.address;
  const resolution = searchParams.get("resolution") || "1H"; // e.g. 5m, 15m, 1H, 4H, 1D
  const from = searchParams.get("from"); // Unix timestamp
  const to = searchParams.get("to"); // Unix timestamp

  if (chain !== "sol") {
    return NextResponse.json({ error: "OHLCV endpoint only supports Solana" }, { status: 400 });
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const from_ts = from ? parseInt(from) : now - resolutionToSeconds(resolution) * 200;
    const to_ts = to ? parseInt(to) : now;

    const url = `${BIRDEYE_BASE}/defi/history_price?address=${address}&address_type=token&type=${resolution}&time_from=${from_ts}&time_to=${to_ts}`;
    const res = await fetch(url, { headers: birdeyeHeaders() });
    if (!res.ok) {
      throw new Error(`Birdeye API error: ${res.statusText}`);
    }
    const json = await res.json();
    const ohlcv = json?.data?.items ?? [];

    return NextResponse.json({
      ohlcv,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
