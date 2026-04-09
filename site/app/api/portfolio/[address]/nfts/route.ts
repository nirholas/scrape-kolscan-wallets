import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPortfolioNfts, type Chain } from "@/lib/portfolio-aggregator";

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

  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 200);

  try {
    const nfts = await getPortfolioNfts(address, chains);
    return NextResponse.json(
      { address, nfts: nfts.slice(0, limit), total: nfts.length },
      {
        headers: {
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
        },
      },
    );
  } catch (err) {
    console.error("[api/portfolio/nfts] error:", err);
    return NextResponse.json({ error: "Failed to fetch NFTs" }, { status: 500 });
  }
}
