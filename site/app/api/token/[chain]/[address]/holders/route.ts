import { NextRequest, NextResponse } from "next/server";

const BIRDEYE_BASE = "https://public-api.birdeye.so";

function birdeyeHeaders(): Record<string, string> {
  const key = process.env.BIRDEYE_API_KEY;
  return key ? { "X-API-KEY": key, "x-chain": "solana" } : { "x-chain": "solana" };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { chain: string; address: string } }
) {
  const { searchParams } = req.nextUrl;
  const chain = params.chain as "sol" | "bsc";
  const address = params.address;
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  if (chain !== "sol") {
    return NextResponse.json({ error: "Holders endpoint only supports Solana" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${BIRDEYE_BASE}/defi/token_holders?address=${address}&limit=${limit}&offset=${offset}`,
      { headers: birdeyeHeaders() }
    );
    if (!res.ok) {
      throw new Error(`Birdeye API error: ${res.statusText}`);
    }
    const json = await res.json();
    const holders = json?.data?.holders ?? [];

    return NextResponse.json({
      holders,
      limit,
      offset,
      total: json?.data?.total,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
