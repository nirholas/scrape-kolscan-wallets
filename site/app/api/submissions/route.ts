import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/drizzle/db";
import { user, walletSubmission } from "@/drizzle/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";
import { submissionSchema } from "@/lib/validation";
import { checkOrigin } from "@/lib/assert-origin";

export async function GET() {
  const rows = await db
    .select()
    .from(walletSubmission)
    .where(eq(walletSubmission.status, "approved"))
    .orderBy(desc(walletSubmission.createdAt))
    .limit(500);

  return NextResponse.json({
    submissions: rows.map((r) => ({
      id: r.id,
      walletAddress: r.walletAddress,
      chain: r.chain,
      label: r.label,
      notes: r.notes,
      twitter: r.twitter,
      telegram: r.telegram,
      status: r.status,
      createdAt: r.createdAt,
    })),
  });
}

export async function POST(request: Request) {
  const originErr = checkOrigin(request);
  if (originErr) return originErr;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const rl = await checkRateLimit(`submit:${session.user.id}`, 12, 60 * 60 * 1000);
  if (!rl.success) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again after ${rl.reset}.` },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = submissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
  }

  // Check for duplicate wallet+chain
  const [existing] = await db
    .select({ id: walletSubmission.id })
    .from(walletSubmission)
    .where(and(eq(walletSubmission.walletAddress, parsed.data.walletAddress.trim()), eq(walletSubmission.chain, parsed.data.chain)))
    .limit(1);
  if (existing) {
    return NextResponse.json({ error: "This wallet has already been submitted" }, { status: 409 });
  }

  const [roleRow] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  const [created] = await db
    .insert(walletSubmission)
    .values({
    id: crypto.randomUUID(),
    walletAddress: parsed.data.walletAddress.trim(),
    chain: parsed.data.chain,
    label: parsed.data.label.trim(),
    notes: parsed.data.notes?.trim() || null,
    twitter: parsed.data.twitter || null,
    telegram: parsed.data.telegram || null,
      submittedBy: session.user.id,
      status: roleRow?.role === "admin" ? "approved" : "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return NextResponse.json({ ok: true, submission: created });
}
