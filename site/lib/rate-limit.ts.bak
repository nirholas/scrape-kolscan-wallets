// Rate limiter with Redis backend (Upstash) when configured,
// falling back to in-memory for local development.
//
// To enable strict enforcement in production, set:
//   UPSTASH_REDIS_REST_URL=...
//   UPSTASH_REDIS_REST_TOKEN=...

type Bucket = {
  count: number;
  resetAt: number;
};

// --- In-memory fallback ---
const buckets = new Map<string, Bucket>();
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}

function checkRateLimitMemory(key: string, limit: number, windowMs: number) {
  cleanup();
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1, reset: Math.ceil((now + windowMs) / 1000) };
  }

  if (bucket.count >= limit) {
    return { success: false, remaining: 0, reset: Math.ceil(bucket.resetAt / 1000) };
  }

  bucket.count += 1;
  return { success: true, remaining: limit - bucket.count, reset: Math.ceil(bucket.resetAt / 1000) };
}

// --- Redis-backed limiter (lazy-initialised) ---
let redisLimiter: null | ((key: string, limit: number, windowMs: number) => Promise<{ success: boolean; remaining: number; reset: number }>) = null;

async function getRedisLimiter() {
  if (redisLimiter) return redisLimiter;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const { Ratelimit } = await import("@upstash/ratelimit");
  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({ url, token });

  redisLimiter = async (key: string, limit: number, windowMs: number) => {
    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowMs}ms`),
      prefix: "rl",
    });
    const result = await limiter.limit(key);
    return {
      success: result.success,
      remaining: result.remaining,
      reset: Math.ceil(result.reset / 1000),
    };
  };

  return redisLimiter;
}

export async function checkRateLimit(key: string, limit: number, windowMs: number) {
  const redis = await getRedisLimiter();
  if (redis) return redis(key, limit, windowMs);
  return checkRateLimitMemory(key, limit, windowMs);
}
