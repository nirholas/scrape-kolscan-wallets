import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAccumulationSignals } from "@/lib/smart-money-tracker";

const schema = z.object({
  chain: z.string().optional(),
  period: z.enum(["1h", "24h", "7d"]).default("24h"),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const validation = schema.safeParse(params);

    if (!validation.success) {
      return NextResponse.json({ error: "Invalid parameters", details: validation.error.format() }, { status: 400 });
    }

    const signals = await getAccumulationSignals(validation.data);

    return NextResponse.json({
      signals,
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    console.error("Error in smart-money/accumulation:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
