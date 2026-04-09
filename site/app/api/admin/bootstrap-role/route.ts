import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq, ne } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/drizzle/db";
import { user } from "@/drizzle/db/schema";

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const adminUsername = process.env.ADMIN_USERNAME?.toLowerCase();
  const userUsername = ((session.user as Record<string, unknown>).username as string)?.toLowerCase();
  if (!adminUsername || !userUsername || userUsername !== adminUsername) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  await db
    .update(user)
    .set({ role: "admin", updatedAt: new Date() })
    .where(and(eq(user.id, session.user.id), ne(user.role, "admin")));

  return NextResponse.json({ ok: true });
}
