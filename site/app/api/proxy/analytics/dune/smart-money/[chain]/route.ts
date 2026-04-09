import { NextRequest, NextResponse } from "next/server";
import { DUNE_QUERIES, getDuneQueryResults } from "@/lib/proxy/sources/dune";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ chain: string }> }
) {
  const params = await context.params;
  try {
    const chain = params.chain.toLowerCase();
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    
    // Determine the pre-built query ID based on chain
    let queryId: number | undefined;
    
    if (chain === "solana") {
      queryId = DUNE_QUERIES["solana-top-traders"];
    } else if (chain === "ethereum" || chain === "eth") {
      queryId = DUNE_QUERIES["eth-smart-money"];
    } else if (chain === "bsc") {
      queryId = DUNE_QUERIES["bsc-top-traders"];
    } else if (chain === "base") {
      queryId = DUNE_QUERIES["base-top-traders"];
    }

    if (!queryId) {
      return NextResponse.json({ error: `No pre-built smart money query for chain: ${chain}` }, { status: 400 });
    }

    const data = await getDuneQueryResults(queryId, limit);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
