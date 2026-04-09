import { NextRequest, NextResponse } from "next/server";
import { getDuneQueryResults } from "@/lib/proxy/sources/dune";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ queryId: string }> }
) {
  const params = await context.params;
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "1000", 10);
    const queryId = parseInt(params.queryId, 10);
    
    if (isNaN(queryId)) {
      return NextResponse.json({ error: "Invalid queryId" }, { status: 400 });
    }

    const data = await getDuneQueryResults(queryId, limit);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
