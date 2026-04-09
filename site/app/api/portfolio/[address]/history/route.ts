import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPortfolioHistory } from "@/lib/portfolio-aggregator";

const paramsSchema = z.object({
  address: z.string().min(1).max(128),
});

const VALID_PERIODS = ["7d", "30d", "90d", "1y"] as const;
type Period = (typeof VALID_PERIODS)[number];

export async function GET(
  req: NextRequest,
  { params }: { params: { address: string } },
) {
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const { address } = parsed.data;
  const { searchParams } = req.nextUrl;

  const rawPeriod = searchParams.get("period") ?? "30d";
  const period: Period = (VALID_PERIODS as readonly string[]).includes(rawPeriod)
    ? (rawPeriod as Period)
    : "30d";

  try {
    const history = await getPortfolioHistory(address, period);
    return NextResponse.json(
      { address, history },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (err) {
    console.error("[api/portfolio/history] error:", err);
    return NextResponse.json({ error: "Failed to fetch portfolio history" }, { status: 500 });
  }
}
