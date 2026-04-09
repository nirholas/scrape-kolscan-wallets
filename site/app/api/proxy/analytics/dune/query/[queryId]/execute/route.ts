import { NextRequest, NextResponse } from "next/server";
import { executeDuneQuery } from "@/lib/proxy/sources/dune";
import { checkOrigin } from "@/lib/assert-origin";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ queryId: string }> }
) {
  const params = await context.params;
  try {
    const originError = checkOrigin(req);
    if (originError) return originError;
    const queryId = parseInt(params.queryId, 10);
    
    if (isNaN(queryId)) {
      return NextResponse.json({ error: "Invalid queryId" }, { status: 400 });
    }

    let body = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional
    }

    const data = await executeDuneQuery(queryId, body);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
