import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/drizzle/db";
import { walletSubmission, walletVouch } from "@/drizzle/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkOrigin } from "@/lib/assert-origin";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const originErr = checkOrigin(_request);
  if (originErr) return originErr;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const rl = await checkRateLimit(`vouch:${session.user.id}`, 100, 60 * 60 * 1000);
  if (!rl.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  // Verify submission exists and prevent self-vouching
  const [submission] = await db
    .select({ submittedBy: walletSubmission.submittedBy })
    .from(walletSubmission)
    .where(eq(walletSubmission.id, params.id))
    .limit(1);

  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }
  if (submission.submittedBy === session.user.id) {
    return NextResponse.json({ error: "You cannot vouch for your own submission" }, { status: 403 });
  }

  const existing = await db
    .select({ userId: walletVouch.userId })
    .from(walletVouch)
    .where(and(eq(walletVouch.userId, session.user.id), eq(walletVouch.submissionId, params.id)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .delete(walletVouch)
      .where(and(eq(walletVouch.userId, session.user.id), eq(walletVouch.submissionId, params.id)));
    return NextResponse.json({ ok: true, vouched: false });
  }

  await db
    .insert(walletVouch)
    .values({
      userId: session.user.id,
      submissionId: params.id,
      weight: 1,
      createdAt: new Date(),
    })
    .onConflictDoNothing();

  return NextResponse.json({ ok: true, vouched: true });
}
