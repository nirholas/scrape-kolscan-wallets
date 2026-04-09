import { NextRequest, NextResponse } from "next/server";
import { executeGraphQuery, SUBGRAPHS } from "@/lib/proxy/sources/thegraph";
import { assertOrigin } from "@/lib/assert-origin";

export async function POST(
  req: NextRequest,
  { params }: { params: { subgraph: string } }
) {
  try {
    assertOrigin(req);
    const body = await req.json();
    if (!body.query) {
      return NextResponse.json({ error: "Missing 'query' in request body" }, { status: 400 });
    }

    if (!SUBGRAPHS[params.subgraph]) {
       return NextResponse.json({ error: `Unknown subgraph: ${params.subgraph}` }, { status: 400 });
    }

    const data = await executeGraphQuery(params.subgraph, body.query, body.variables);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
