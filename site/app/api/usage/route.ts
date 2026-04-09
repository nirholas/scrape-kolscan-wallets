import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/drizzle/db";
import { apiKey as apiKeyTable } from "@/drizzle/db/schema";
import { getQuotaUsage, getTierConfig, type RateLimitTier, isValidTier } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all API keys for the user
  const userKeys = await db
    .select()
    .from(apiKeyTable)
    .where(eq(apiKeyTable.userId, session.user.id));

  const usageData = await Promise.all(
    userKeys.map(async (key) => {
      // Validate tier, fallback to free
      const tier = isValidTier(key.tier) ? (key.tier as RateLimitTier) : "free";
      const config = getTierConfig(tier);
      
      // Get current daily usage from Redis
      const quota = await getQuotaUsage(key.id, tier);

      return {
        id: key.id,
        name: key.name,
        keyPrefix: key.keyPrefix,
        tier: key.tier,
        status: key.revokedAt ? "revoked" : (key.expiresAt && new Date() > new Date(key.expiresAt) ? "expired" : "active"),
        limits: {
          requestsPerMinute: config.requestsPerMinute,
          requestsPerDay: config.requestsPerDay,
        },
        usage: {
          today: quota.used,
          remaining: quota.remaining,
          resetsAt: quota.resetsAt,
        },
        createdAt: key.createdAt,
        lastUsedAt: key.lastUsedAt,
      };
    })
  );

  return NextResponse.json({
    success: true,
    data: usageData,
  });
}
