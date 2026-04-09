import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/drizzle/db";
import { apiKey as apiKeyTable } from "@/drizzle/db/schema";
import { checkOrigin } from "@/lib/assert-origin";

const MAX_KEYS_PER_USER = 5;

const createKeySchema = z.object({
  name: z.string().min(1).max(64).optional(),
  tier: z.enum(["free", "pro"]).default("free"),
});

/**
 * Generate a cryptographically random API key with a "kq_" prefix.
 * Returns { rawKey, keyHash, keyPrefix } where rawKey is shown once.
 */
async function generateApiKey(): Promise<{
  rawKey: string;
  keyHash: string;
  keyPrefix: string;
}> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const rawKey = `kq_${hex}`;
  const keyPrefix = rawKey.slice(0, 11); // "kq_" + first 8 hex chars

  const encoder = new TextEncoder();
  const data = encoder.encode(rawKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const keyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return { rawKey, keyHash, keyPrefix };
}

/** List all active API keys for the authenticated user */
export async function GET(_req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keys = await db
    .select({
      id: apiKeyTable.id,
      name: apiKeyTable.name,
      keyPrefix: apiKeyTable.keyPrefix,
      tier: apiKeyTable.tier,
      createdAt: apiKeyTable.createdAt,
      expiresAt: apiKeyTable.expiresAt,
      lastUsedAt: apiKeyTable.lastUsedAt,
      revokedAt: apiKeyTable.revokedAt,
    })
    .from(apiKeyTable)
    .where(eq(apiKeyTable.userId, session.user.id))
    .orderBy(apiKeyTable.createdAt);

  return NextResponse.json({ success: true, data: keys });
}

/** Create a new API key for the authenticated user */
export async function POST(req: NextRequest) {
  const originError = checkOrigin(req);
  if (originError) return originError as Response;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = createKeySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Enforce per-user key limit
  const existingKeys = await db
    .select({ id: apiKeyTable.id })
    .from(apiKeyTable)
    .where(
      and(
        eq(apiKeyTable.userId, session.user.id),
        // Only count non-revoked keys
      )
    );

  const activeKeys = existingKeys.length;
  if (activeKeys >= MAX_KEYS_PER_USER) {
    return NextResponse.json(
      {
        error: `You can have at most ${MAX_KEYS_PER_USER} API keys. Revoke an existing key first.`,
      },
      { status: 422 }
    );
  }

  const { rawKey, keyHash, keyPrefix } = await generateApiKey();
  const { name, tier } = parsed.data;

  const id = crypto.randomUUID();
  await db.insert(apiKeyTable).values({
    id,
    userId: session.user.id,
    keyHash,
    keyPrefix,
    name: name ?? null,
    tier,
    rateLimit: tier === "pro" ? 300 : 60,
    createdAt: new Date(),
  });

  return NextResponse.json(
    {
      success: true,
      data: {
        id,
        key: rawKey, // Shown exactly once – the caller must store this
        keyPrefix,
        name: name ?? null,
        tier,
        createdAt: new Date().toISOString(),
        message: "Store this key securely – it will not be shown again.",
      },
    },
    { status: 201 }
  );
}
