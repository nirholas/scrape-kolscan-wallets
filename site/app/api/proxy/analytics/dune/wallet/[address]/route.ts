import { NextRequest, NextResponse } from "next/server";
import { getDuneWallet } from "@/lib/proxy/sources/dune";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ address: string }> }
) {
  const params = await context.params;
  try {
    const data = await getDuneWallet(params.address);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
