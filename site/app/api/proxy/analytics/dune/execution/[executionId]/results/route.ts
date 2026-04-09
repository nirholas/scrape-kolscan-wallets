import { NextRequest, NextResponse } from "next/server";
import { getDuneExecutionResults } from "@/lib/proxy/sources/dune";

export async function GET(
  req: NextRequest,
  { params }: { params: { executionId: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "1000", 10);
    
    const data = await getDuneExecutionResults(params.executionId, limit);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
