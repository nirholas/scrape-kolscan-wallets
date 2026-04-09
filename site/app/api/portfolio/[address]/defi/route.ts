import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPortfolioDefi, type Chain } from "@/lib/portfolio-aggregator";

const paramsSchema = z.object({
  address: z.string().min(1).max(128),
});

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

  const chainsParam = searchParams.get("chains");
  const chains: Chain[] | "all" =
    chainsParam && chainsParam !== "all"
      ? (chainsParam.split(",") as Chain[])
      : "all";

  try {
    const positions = await getPortfolioDefi(address, chains);
    return NextResponse.json(
      { address, positions, total: positions.length },
      {
        headers: {
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
        },
      },
    );
  } catch (err) {
    console.error("[api/portfolio/defi] error:", err);
    return NextResponse.json({ error: "Failed to fetch DeFi positions" }, { status: 500 });
  }
}
