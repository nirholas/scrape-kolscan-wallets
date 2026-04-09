import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/drizzle/db";
import { feedback, user } from "@/drizzle/db/schema";
import { eq } from "drizzle-orm";
import { checkOrigin } from "@/lib/assert-origin";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const originErr = checkOrigin(request);
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

  await db
    .update(feedback)
    .set({ status: "resolved" })
    .where(eq(feedback.id, params.id));

  return NextResponse.json({ success: true });
}
