import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSmartMoneyFeed } from "@/lib/smart-money-tracker";

const schema = z.object({
  chain: z.string().optional(),
  type: z.enum(["buy", "sell", "transfer"]).optional(),
  minValue: z.coerce.number().min(0).optional(),
  walletCategory: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).default(50),
  cursor: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const validation = schema.safeParse(params);

    if (!validation.success) {
      return NextResponse.json({ error: "Invalid parameters", details: validation.error.format() }, { status: 400 });
    }

    const { activities, nextCursor } = await getSmartMoneyFeed(validation.data);

    return NextResponse.json({
      activities,
      nextCursor,
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    console.error("Error in smart-money/feed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
