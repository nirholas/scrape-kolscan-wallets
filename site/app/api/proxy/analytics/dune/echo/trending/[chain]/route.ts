import { NextRequest, NextResponse } from "next/server";
import { getDuneEchoTrending } from "@/lib/proxy/sources/dune";

export async function GET(
  req: NextRequest,
  { params }: { params: { chain: string } }
) {
  try {
    const data = await getDuneEchoTrending(params.chain);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
