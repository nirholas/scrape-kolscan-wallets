import { NextRequest, NextResponse } from "next/server";
import { getDuneWallet } from "@/lib/proxy/sources/dune";

export async function GET(
  req: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    const data = await getDuneWallet(params.address);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
