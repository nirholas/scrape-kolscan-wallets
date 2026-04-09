import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { detectChains, getPortfolioSummary } from "@/lib/portfolio-aggregator";

const paramsSchema = z.object({
  address: z.string().min(1).max(128),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { address: string } },
) {
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const { address } = parsed.data;
  const chains = detectChains(address);

  if (chains.length === 0) {
    return NextResponse.json(
      { error: "Unrecognized address format. Provide a Solana or EVM (0x...) address." },
      { status: 400 },
    );
  }

  try {
    const summary = await getPortfolioSummary(address);
    return NextResponse.json(
      { address, chains, summary },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (err) {
    console.error("[api/portfolio] error:", err);
    return NextResponse.json({ error: "Failed to fetch portfolio data" }, { status: 500 });
  }
}
