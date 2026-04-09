import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/drizzle/db";
import { apiKey as apiKeyTable } from "@/drizzle/db/schema";
import { checkOrigin } from "@/lib/assert-origin";

/** Revoke an API key – sets revokedAt to now */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const originError = checkOrigin(req);
  if (originError) return originError as Response;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Only allow the owner to revoke their own key
  const [key] = await db
    .select({ id: apiKeyTable.id, revokedAt: apiKeyTable.revokedAt })
    .from(apiKeyTable)
    .where(and(eq(apiKeyTable.id, id), eq(apiKeyTable.userId, session.user.id)))
    .limit(1);

  if (!key) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (key.revokedAt) {
    return NextResponse.json(
      { error: "Key is already revoked" },
      { status: 409 }
    );
  }

  await db
    .update(apiKeyTable)
    .set({ revokedAt: new Date() })
    .where(eq(apiKeyTable.id, id));

  return NextResponse.json({ success: true, message: "API key revoked" });
}

/** Rename an API key */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const originError2 = checkOrigin(req);
  if (originError2) return originError2 as Response;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 64) : null;

  const [key] = await db
    .select({ id: apiKeyTable.id })
    .from(apiKeyTable)
    .where(and(eq(apiKeyTable.id, id), eq(apiKeyTable.userId, session.user.id)))
    .limit(1);

  if (!key) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db
    .update(apiKeyTable)
    .set({ name: name || null })
    .where(eq(apiKeyTable.id, id));

  return NextResponse.json({ success: true, message: "API key updated" });
}
