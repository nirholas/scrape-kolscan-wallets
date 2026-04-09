// Abuse detection for API rate limiting

import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  redis = new Redis({ url, token });
  return redis;
}

// Thresholds for abuse detection
const ERROR_RATE_THRESHOLD = 0.5; // 50% error rate triggers review
const UNIQUE_ENDPOINTS_THRESHOLD = 100; // 100+ unique endpoints in 1 hour
const ERROR_WINDOW_SIZE = 100; // Track last 100 requests
const ENDPOINT_WINDOW_SECONDS = 3600; // 1 hour window for endpoint tracking

export interface AbuseCheckResult {
  flagged: boolean;
  reason?: string;
  details?: {
    errorRate?: number;
    uniqueEndpoints?: number;
  };
}

// In-memory tracking for development
const errorTracking = new Map<string, { errors: number; total: number; lastReset: number }>();
const endpointTracking = new Map<string, Set<string>>();

/**
 * Track a request result for abuse detection.
 * Call this after processing each API request.
 */
export async function trackRequest(
  identifier: string,
  path: string,
  isError: boolean
): Promise<void> {
  const redisClient = getRedis();

  if (redisClient) {
    await trackRequestRedis(redisClient, identifier, path, isError);
  } else {
    trackRequestMemory(identifier, path, isError);
  }
}

async function trackRequestRedis(
  client: Redis,
  identifier: string,
  path: string,
  isError: boolean
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  // Track error rate using a list of recent request outcomes
  const errorKey = `abuse:errors:${identifier}`;
  await client.lpush(errorKey, isError ? "1" : "0");
  await client.ltrim(errorKey, 0, ERROR_WINDOW_SIZE - 1);
  await client.expire(errorKey, 3600); // 1 hour expiry

  // Track unique endpoints using a sorted set with timestamps
  const endpointKey = `abuse:endpoints:${identifier}`;
  await client.zadd(endpointKey, { score: now, member: path });
  // Remove entries older than the window
  await client.zremrangebyscore(endpointKey, 0, now - ENDPOINT_WINDOW_SECONDS);
  await client.expire(endpointKey, ENDPOINT_WINDOW_SECONDS + 60);
}

function trackRequestMemory(identifier: string, path: string, isError: boolean): void {
  const now = Date.now();

  // Track errors
  let errorData = errorTracking.get(identifier);
  if (!errorData || now - errorData.lastReset > 3600000) {
    errorData = { errors: 0, total: 0, lastReset: now };
    errorTracking.set(identifier, errorData);
  }
  errorData.total++;
  if (isError) errorData.errors++;
  // Keep only last 100 requests worth of data
  if (errorData.total > ERROR_WINDOW_SIZE) {
    // Rough approximation: scale down counts
    errorData.errors = Math.floor(errorData.errors * 0.5);
    errorData.total = Math.floor(errorData.total * 0.5);
  }

  // Track unique endpoints
  let endpoints = endpointTracking.get(identifier);
  if (!endpoints) {
    endpoints = new Set();
    endpointTracking.set(identifier, endpoints);
  }
  endpoints.add(path);
}

/**
 * Check if an API key or IP shows signs of abuse.
 * Returns whether the identifier should be flagged for review.
 */
export async function checkAbuse(identifier: string): Promise<AbuseCheckResult> {
  const redisClient = getRedis();

  if (redisClient) {
    return checkAbuseRedis(redisClient, identifier);
  }

  return checkAbuseMemory(identifier);
}

async function checkAbuseRedis(client: Redis, identifier: string): Promise<AbuseCheckResult> {
  const now = Math.floor(Date.now() / 1000);
  const details: AbuseCheckResult["details"] = {};

  // Check error rate
  const errorKey = `abuse:errors:${identifier}`;
  const errors = await client.lrange(errorKey, 0, ERROR_WINDOW_SIZE - 1);
  if (errors.length >= 10) {
    // Need at least 10 requests to calculate meaningful error rate
    const errorCount = errors.filter((e) => e === "1").length;
    const errorRate = errorCount / errors.length;
    details.errorRate = errorRate;

    if (errorRate > ERROR_RATE_THRESHOLD) {
      await flagForReview(client, identifier, "high_error_rate");
      return {
        flagged: true,
        reason: "High error rate indicates potential abuse or misconfiguration",
        details,
      };
    }
  }

  // Check unique endpoints (potential scraping)
  const endpointKey = `abuse:endpoints:${identifier}`;
  // Remove old entries first
  await client.zremrangebyscore(endpointKey, 0, now - ENDPOINT_WINDOW_SECONDS);
  const uniqueEndpoints = await client.zcard(endpointKey);
  details.uniqueEndpoints = uniqueEndpoints;

  if (uniqueEndpoints > UNIQUE_ENDPOINTS_THRESHOLD) {
    await flagForReview(client, identifier, "excessive_endpoint_variety");
    return {
      flagged: true,
      reason: "Unusual number of unique endpoints accessed, potential scraping",
      details,
    };
  }

  return { flagged: false, details };
}

function checkAbuseMemory(identifier: string): AbuseCheckResult {
  const details: AbuseCheckResult["details"] = {};

  // Check error rate
  const errorData = errorTracking.get(identifier);
  if (errorData && errorData.total >= 10) {
    const errorRate = errorData.errors / errorData.total;
    details.errorRate = errorRate;

    if (errorRate > ERROR_RATE_THRESHOLD) {
      return {
        flagged: true,
        reason: "High error rate indicates potential abuse or misconfiguration",
        details,
      };
    }
  }

  // Check unique endpoints
  const endpoints = endpointTracking.get(identifier);
  if (endpoints) {
    details.uniqueEndpoints = endpoints.size;

    if (endpoints.size > UNIQUE_ENDPOINTS_THRESHOLD) {
      return {
        flagged: true,
        reason: "Unusual number of unique endpoints accessed, potential scraping",
        details,
      };
    }
  }

  return { flagged: false, details };
}

async function flagForReview(client: Redis, identifier: string, reason: string): Promise<void> {
  const key = `abuse:flagged:${identifier}`;
  const now = new Date().toISOString();
  await client.hset(key, {
    flaggedAt: now,
    reason,
    identifier,
  });
  // Keep flagged entries for 7 days
  await client.expire(key, 7 * 24 * 3600);
}

/**
 * Check if an identifier is currently flagged for abuse
 */
export async function isFlagged(identifier: string): Promise<boolean> {
  const redisClient = getRedis();
  if (!redisClient) return false;

  const key = `abuse:flagged:${identifier}`;
  return (await redisClient.exists(key)) > 0;
}

/**
 * Clear abuse tracking data for an identifier (admin action)
 */
export async function clearAbuseData(identifier: string): Promise<void> {
  const redisClient = getRedis();
  if (!redisClient) {
    errorTracking.delete(identifier);
    endpointTracking.delete(identifier);
    return;
  }

  await redisClient.del(
    `abuse:errors:${identifier}`,
    `abuse:endpoints:${identifier}`,
    `abuse:flagged:${identifier}`
  );
}
