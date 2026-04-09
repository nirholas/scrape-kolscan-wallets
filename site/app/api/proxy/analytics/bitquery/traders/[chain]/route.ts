import { NextRequest, NextResponse } from "next/server";
import { BITQUERY_QUERIES, executeBitquery } from "@/lib/proxy/sources/bitquery";

export async function GET(
  req: NextRequest,
  { params }: { params: { chain: string } }
) {
  try {
    const chain = params.chain.toLowerCase();
    
    let queryKey: string | undefined;
    let variables: any = {};
    
    if (chain === "solana") {
      queryKey = "solana-top-dex-traders";
      // E.g. since 7 days ago
      const date = new Date();
      date.setDate(date.getDate() - 7);
      variables = { since: date.toISOString() };
    }

    if (!queryKey || !BITQUERY_QUERIES[queryKey]) {
      return NextResponse.json({ error: `No pre-built trader query for chain: ${chain}` }, { status: 400 });
    }

    const query = BITQUERY_QUERIES[queryKey];
    const data = await executeBitquery(query, variables);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
