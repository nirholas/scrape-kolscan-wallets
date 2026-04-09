// Daily quota tracking with Redis

import { Redis } from "@upstash/redis";
import { getTierConfig, type RateLimitTier } from "./tiers";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  redis = new Redis({ url, token });
  return redis;
}

/**
 * Get the current date key for quota tracking (YYYY-MM-DD in UTC)
 */
function getDateKey(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Get the timestamp when the daily quota resets (midnight UTC)
 */
function getQuotaResetTime(): Date {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return tomorrow;
}

export interface QuotaResult {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
}

// In-memory fallback for development
const quotaBuckets = new Map<string, { count: number; date: string }>();

/**
 * Check and increment daily quota for an API key or IP.
 * Returns whether the request is allowed and usage stats.
 */
export async function checkDailyQuota(
  identifier: string,
  tier: RateLimitTier,
  cost: number = 1
): Promise<QuotaResult> {
  const config = getTierConfig(tier);
  const limit = config.requestsPerDay;
  const dateKey = getDateKey();
  const resetsAt = getQuotaResetTime().toISOString();

  // Enterprise tier has unlimited quota
  if (limit === Infinity) {
    return {
      allowed: true,
      used: 0,
      limit: -1, // -1 indicates unlimited
      remaining: -1,
      resetsAt,
    };
  }

  const redisClient = getRedis();

  if (redisClient) {
    return checkQuotaRedis(redisClient, identifier, limit, cost, dateKey, resetsAt);
  }

  return checkQuotaMemory(identifier, limit, cost, dateKey, resetsAt);
}

async function checkQuotaRedis(
  client: Redis,
  identifier: string,
  limit: number,
  cost: number,
  dateKey: string,
  resetsAt: string
): Promise<QuotaResult> {
  const key = `quota:daily:${identifier}:${dateKey}`;

  // Use INCRBY to increment and get new value atomically
  const used = await client.incrby(key, cost);

  // Set expiry on first use (TTL = seconds until midnight UTC + buffer)
  if (used === cost) {
    // Set expiry to 25 hours to ensure cleanup even with timezone edge cases
    await client.expire(key, 90000);
  }

  const allowed = used <= limit;
  const remaining = Math.max(0, limit - used);

  return {
    allowed,
    used,
    limit,
    remaining,
    resetsAt,
  };
}

function checkQuotaMemory(
  identifier: string,
  limit: number,
  cost: number,
  dateKey: string,
  resetsAt: string
): QuotaResult {
  const key = `${identifier}:${dateKey}`;
  const existing = quotaBuckets.get(key);

  // Reset if it's a new day
  if (!existing || existing.date !== dateKey) {
    quotaBuckets.set(key, { count: cost, date: dateKey });
    return {
      allowed: true,
      used: cost,
      limit,
      remaining: limit - cost,
      resetsAt,
    };
  }

  existing.count += cost;
  const allowed = existing.count <= limit;
  const remaining = Math.max(0, limit - existing.count);

  return {
    allowed,
    used: existing.count,
    limit,
    remaining,
    resetsAt,
  };
}

/**
 * Get current quota usage without incrementing
 */
export async function getQuotaUsage(
  identifier: string,
  tier: RateLimitTier
): Promise<QuotaResult> {
  const config = getTierConfig(tier);
  const limit = config.requestsPerDay;
  const dateKey = getDateKey();
  const resetsAt = getQuotaResetTime().toISOString();

  if (limit === Infinity) {
    return {
      allowed: true,
      used: 0,
      limit: -1,
      remaining: -1,
      resetsAt,
    };
  }

  const redisClient = getRedis();

  if (redisClient) {
    const key = `quota:daily:${identifier}:${dateKey}`;
    const used = (await redisClient.get<number>(key)) || 0;
    return {
      allowed: used < limit,
      used,
      limit,
      remaining: Math.max(0, limit - used),
      resetsAt,
    };
  }

  // In-memory fallback
  const key = `${identifier}:${dateKey}`;
  const existing = quotaBuckets.get(key);
  const used = existing?.date === dateKey ? existing.count : 0;

  return {
    allowed: used < limit,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    resetsAt,
  };
}
