import { NextRequest, NextResponse } from "next/server";
import { executeFlipsideQuery } from "@/lib/proxy/sources/flipside";
import { assertOrigin } from "@/lib/assert-origin";

export async function POST(req: NextRequest) {
  try {
    assertOrigin(req);
    const body = await req.json();
    if (!body.sql) {
      return NextResponse.json({ error: "Missing 'sql' in request body" }, { status: 400 });
    }

    const data = await executeFlipsideQuery(body.sql);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
