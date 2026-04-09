import { NextRequest, NextResponse } from "next/server";
import { FLIPSIDE_QUERIES, executeFlipsideQuery } from "@/lib/proxy/sources/flipside";

export async function GET(
  req: NextRequest,
  { params }: { params: { chain: string } }
) {
  try {
    const chain = params.chain.toLowerCase();
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "7d";
    
    // Determine the pre-built query ID based on chain and period
    let sqlKey: string | undefined;
    
    if (chain === "solana") {
      sqlKey = `solana-top-traders-${period}`;
      // Fallback if the specific period doesn't exist
      if (!FLIPSIDE_QUERIES[sqlKey]) sqlKey = "solana-top-traders-7d";
    } else if (chain === "ethereum" || chain === "eth") {
      sqlKey = `eth-smart-money-${period}`;
      // Fallback
      if (!FLIPSIDE_QUERIES[sqlKey]) sqlKey = "eth-smart-money-30d";
    }

    if (!sqlKey || !FLIPSIDE_QUERIES[sqlKey]) {
      return NextResponse.json({ error: `No pre-built smart money query for chain: ${chain}` }, { status: 400 });
    }

    const sql = FLIPSIDE_QUERIES[sqlKey];
    
    // For Flipside, we can just execute the query. The source implementation creates a run and returns it.
    // Wait, executeFlipsideQuery returns the queryRun info which we can use to get results. 
    // Or we could wait for it if it's fast, but usually we just return the execute result and let the client poll results.
    // Actually, to make it unified, Flipside's json-rpc `createQueryRun` returns the run ID.
    // Let's just return what `executeFlipsideQuery` returns (the QueryRun object).
    
    const data = await executeFlipsideQuery(sql);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
