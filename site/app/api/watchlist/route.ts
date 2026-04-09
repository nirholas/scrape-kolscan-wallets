import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/drizzle/db";
import { watchlist } from "@/drizzle/db/schema";
import { checkOrigin } from "@/lib/assert-origin";

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
      groupName: r.groupName,
      createdAt: r.createdAt,
    })),
  });
}

// POST — add a wallet to watchlist
export async function POST(req: NextRequest) {
  const originErr = checkOrigin(req);
  if (originErr) return originErr;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { walletAddress: addr, chain, label, groupName } = body as Record<string, unknown>;

  if (!addr || !chain) {
    return NextResponse.json({ error: "walletAddress and chain are required" }, { status: 400 });
  }

  if (typeof addr !== "string" || addr.length > 96) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  if (!["sol", "bsc"].includes(chain as string)) {
    return NextResponse.json({ error: "Chain must be sol or bsc" }, { status: 400 });
  }

  await db
    .insert(watchlist)
    .values({
      userId: session.user.id,
      walletAddress: addr,
      chain: chain as string,
      label: typeof label === "string" ? label.slice(0, 120) : null,
      groupName: typeof groupName === "string" ? groupName.slice(0, 60) : null,
    })
    .onConflictDoNothing();

  return NextResponse.json({ ok: true });
}

// PATCH — update wallet label or group
export async function PATCH(req: NextRequest) {
  const originErr = checkOrigin(req);
  if (originErr) return originErr;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { walletAddress: addr, label, groupName } = body as Record<string, unknown>;

  if (!addr || typeof addr !== "string") {
    return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
  }

  const updates: Record<string, string | null> = {};
  if (label !== undefined) updates.label = typeof label === "string" ? label.slice(0, 120) : null;
  if (groupName !== undefined) updates.groupName = typeof groupName === "string" ? groupName.slice(0, 60) : null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await db
    .update(watchlist)
    .set(updates)
    .where(
      and(
        eq(watchlist.userId, session.user.id),
        eq(watchlist.walletAddress, addr),
      ),
    );

  return NextResponse.json({ ok: true });
}

// DELETE — remove a wallet from watchlist
export async function DELETE(req: NextRequest) {
  const originErr = checkOrigin(req);
  if (originErr) return originErr;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { walletAddress: addr } = body as Record<string, unknown>;

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
