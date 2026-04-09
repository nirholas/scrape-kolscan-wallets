import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/drizzle/db";
import { watchlist } from "@/drizzle/db/schema";

// GET — list user's watchlisted wallets
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(watchlist)
    .where(eq(watchlist.userId, session.user.id));

  return NextResponse.json({
    watchlist: rows.map((r) => ({
      walletAddress: r.walletAddress,
      chain: r.chain,
      label: r.label,
      createdAt: r.createdAt,
    })),
  });
}

// POST — add a wallet to watchlist
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { walletAddress: addr, chain, label } = body;

  if (!addr || !chain) {
    return NextResponse.json({ error: "walletAddress and chain are required" }, { status: 400 });
  }

  if (typeof addr !== "string" || addr.length > 96) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  if (!["sol", "bsc"].includes(chain)) {
    return NextResponse.json({ error: "Chain must be sol or bsc" }, { status: 400 });
  }

  await db
    .insert(watchlist)
    .values({
      userId: session.user.id,
      walletAddress: addr,
      chain,
      label: typeof label === "string" ? label.slice(0, 120) : null,
    })
    .onConflictDoNothing();

  return NextResponse.json({ ok: true });
}

// DELETE — remove a wallet from watchlist
export async function DELETE(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { walletAddress: addr } = body;

  if (!addr || typeof addr !== "string") {
    return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
  }

  await db
    .delete(watchlist)
    .where(
      and(
        eq(watchlist.userId, session.user.id),
        eq(watchlist.walletAddress, addr),
      ),
    );

  return NextResponse.json({ ok: true });
}
