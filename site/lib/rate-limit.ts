type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return { success: true, remaining: limit - 1, reset: Math.ceil((now + windowMs) / 1000) };
  }

  if (bucket.count >= limit) {
    return { success: false, remaining: 0, reset: Math.ceil(bucket.resetAt / 1000) };
  }

  bucket.count += 1;
  return { success: true, remaining: limit - bucket.count, reset: Math.ceil(bucket.resetAt / 1000) };
}
