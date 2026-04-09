import { NextResponse } from "next/server";
import { executeDuneQuery, DUNE_QUERIES } from "@/lib/proxy/sources/dune";
import { executeFlipsideQuery, FLIPSIDE_QUERIES } from "@/lib/proxy/sources/flipside";

export async function GET(req: Request) {
  // Ensure this is called by Vercel cron
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const results = await Promise.allSettled([
      // Top solana traders
      executeDuneQuery(DUNE_QUERIES["solana-top-traders"]),
      // ETH smart money
      executeDuneQuery(DUNE_QUERIES["eth-smart-money"]),
      // Flipside equivalent
      executeFlipsideQuery(FLIPSIDE_QUERIES["solana-top-traders-7d"]),
      executeFlipsideQuery(FLIPSIDE_QUERIES["eth-smart-money-30d"]),
    ]);

    return NextResponse.json({
      success: true,
      results: results.map(r => r.status),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
