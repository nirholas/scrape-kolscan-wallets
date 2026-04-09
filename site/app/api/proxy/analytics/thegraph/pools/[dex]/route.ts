import { NextRequest, NextResponse } from "next/server";
import { GRAPH_QUERIES, executeGraphQuery, SUBGRAPHS } from "@/lib/proxy/sources/thegraph";

export async function GET(
  req: NextRequest,
  { params }: { params: { dex: string } }
) {
  try {
    const dex = params.dex.toLowerCase();
    
    let queryKey: string | undefined;
    let subgraph: string | undefined;
    
    if (dex === "uniswap-v3") {
      queryKey = "uniswap-v3-top-pools";
      subgraph = "uniswap-v3";
    }
    // other dexes as needed...

    if (!queryKey || !GRAPH_QUERIES[queryKey] || !subgraph || !SUBGRAPHS[subgraph]) {
      return NextResponse.json({ error: `No pre-built pool query for dex: ${dex}` }, { status: 400 });
    }

    const query = GRAPH_QUERIES[queryKey];
    const data = await executeGraphQuery(subgraph, query);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
