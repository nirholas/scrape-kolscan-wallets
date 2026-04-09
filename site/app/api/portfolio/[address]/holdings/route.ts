import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPortfolioHoldings, type Chain } from "@/lib/portfolio-aggregator";

const paramsSchema = z.object({
  address: z.string().min(1).max(128),
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ address: string }> },
) {
  const params = await context.params;
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const { address } = parsed.data;
  const { searchParams } = req.nextUrl;

  const chainsParam = searchParams.get("chains");
  const chains: Chain[] | "all" =
    chainsParam && chainsParam !== "all"
      ? (chainsParam.split(",") as Chain[])
      : "all";

  const includeSmall = searchParams.get("includeSmall") !== "false";
  const minValueUsd = includeSmall ? 0 : 1;

  try {
    const holdings = await getPortfolioHoldings(address, chains);
    const filtered = holdings.filter((h) => h.valueUsd >= minValueUsd);
    return NextResponse.json(
      { address, holdings: filtered, total: filtered.length },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (err) {
    console.error("[api/portfolio/holdings] error:", err);
    return NextResponse.json({ error: "Failed to fetch holdings" }, { status: 500 });
  }
}
