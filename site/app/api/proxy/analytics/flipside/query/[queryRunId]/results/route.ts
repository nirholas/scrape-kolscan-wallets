import { NextRequest, NextResponse } from "next/server";
import { getFlipsideQueryResults } from "@/lib/proxy/sources/flipside";

export async function GET(
  req: NextRequest,
  { params }: { params: { queryRunId: string } }
) {
  try {
    const data = await getFlipsideQueryResults(params.queryRunId);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
