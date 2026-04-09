import { NextRequest, NextResponse } from "next/server";
import { getFlipsideQueryResults } from "@/lib/proxy/sources/flipside";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ queryRunId: string }> }
) {
  const params = await context.params;
  try {
    const data = await getFlipsideQueryResults(params.queryRunId);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
