import { NextRequest, NextResponse } from "next/server";
import { executeBitquery } from "@/lib/proxy/sources/bitquery";
import { assertOrigin } from "@/lib/assert-origin";

export async function POST(req: NextRequest) {
  try {
    assertOrigin(req);
    const body = await req.json();
    if (!body.query) {
      return NextResponse.json({ error: "Missing 'query' in request body" }, { status: 400 });
    }

    const data = await executeBitquery(body.query, body.variables);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
