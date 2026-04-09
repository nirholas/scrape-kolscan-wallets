import { NextRequest, NextResponse } from "next/server";
import { getDuneExecutionStatus } from "@/lib/proxy/sources/dune";

export async function GET(
  req: NextRequest,
  { params }: { params: { executionId: string } }
) {
  try {
    const data = await getDuneExecutionStatus(params.executionId);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
