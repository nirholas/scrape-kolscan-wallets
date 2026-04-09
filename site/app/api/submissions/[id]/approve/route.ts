import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/drizzle/db";
import { user, walletSubmission } from "@/drizzle/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkOrigin } from "@/lib/assert-origin";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const originErr = checkOrigin(_request);
  if (originErr) return originErr;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const [roleRow] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  if (roleRow?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const rl = await checkRateLimit(`approve:${session.user.id}`, 60, 60 * 60 * 1000);
  if (!rl.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const [updated] = await db
    .update(walletSubmission)
    .set({ status: "approved", updatedAt: new Date() })
    .where(and(eq(walletSubmission.id, params.id), eq(walletSubmission.status, "pending")))
    .returning({ id: walletSubmission.id });

  if (!updated) {
    return NextResponse.json({ error: "Submission not found or already processed" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
