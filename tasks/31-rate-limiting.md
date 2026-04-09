# Task: Rate Limiting System

## Context
Implement per-user rate limiting with tiered limits for the proxy API.

## Requirements

### 1. Rate Limit Tiers

| Tier | Requests/Minute | Requests/Day | Price |
|------|-----------------|--------------|-------|
| Public (no key) | 10 | 100 | Free |
| Free (with key) | 60 | 10,000 | Free |
| Pro | 300 | 100,000 | $29/mo |
| Enterprise | 1,000 | Unlimited | Custom |

### 2. Implementation with Upstash

```typescript
// site/lib/rate-limit/index.ts

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

// Sliding window rate limiters per tier
const rateLimiters = {
  public: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    prefix: 'ratelimit:public',
  }),
  
  free: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, '1 m'),
    prefix: 'ratelimit:free',
  }),
  
  pro: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(300, '1 m'),
    prefix: 'ratelimit:pro',
  }),
  
  enterprise: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1000, '1 m'),
    prefix: 'ratelimit:enterprise',
  }),
};

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  tier: string;
}

export async function checkRateLimit(
  apiKey: string | null,
  ip: string
): Promise<RateLimitResult> {
  // Determine tier from API key
  const tier = await getTierFromApiKey(apiKey);
  const identifier = apiKey || ip;
  
  const { success, limit, remaining, reset } = await rateLimiters[tier].limit(identifier);
  
  return { success, limit, remaining, reset, tier };
}
```

### 3. Daily Quota Tracking

```typescript
// site/lib/rate-limit/quota.ts

async function checkDailyQuota(apiKey: string): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
}> {
  const key = `quota:daily:${apiKey}:${getDateKey()}`;
  const used = await redis.incr(key);
  
  // Set expiry on first use
  if (used === 1) {
    await redis.expire(key, 86400); // 24 hours
  }
  
  const limit = await getDailyLimit(apiKey);
  
  return {
    allowed: used <= limit,
    used,
    limit,
  };
}

function getDateKey(): string {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}
```

### 4. Rate Limit Headers

```typescript
// Include in all proxy responses
function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult + QuotaResult
): void {
  response.headers.set('X-RateLimit-Limit', result.limit.toString());
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
  response.headers.set('X-RateLimit-Reset', result.reset.toString());
  response.headers.set('X-RateLimit-Tier', result.tier);
  response.headers.set('X-Quota-Limit', result.quotaLimit.toString());
  response.headers.set('X-Quota-Remaining', result.quotaRemaining.toString());
}
```

### 5. Rate Limit Response

When rate limited:

```typescript
// HTTP 429 Too Many Requests
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded. Try again in 45 seconds.",
    "retryAfter": 45
  },
  "meta": {
    "limit": 60,
    "remaining": 0,
    "reset": 1680000000,
    "tier": "free"
  }
}
```

When quota exceeded:

```typescript
// HTTP 429 Too Many Requests
{
  "success": false,
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "Daily quota exceeded. Upgrade to Pro for higher limits.",
    "upgradeUrl": "https://kolquest.com/pricing"
  },
  "meta": {
    "quotaLimit": 10000,
    "quotaUsed": 10000,
    "resetsAt": "2026-04-10T00:00:00Z"
  }
}
```

### 6. Per-Endpoint Limits

Some endpoints cost more:

```typescript
const ENDPOINT_COSTS: Record<string, number> = {
  // Expensive (count as 5 requests)
  'proxy/analytics/dune/query/*/execute': 5,
  'proxy/analytics/flipside/query': 5,
  'proxy/evm/wallet/*/defi': 3,
  
  // Standard (count as 1)
  default: 1,
};

function getEndpointCost(path: string): number {
  for (const [pattern, cost] of Object.entries(ENDPOINT_COSTS)) {
    if (matchPath(pattern, path)) return cost;
  }
  return 1;
}
```

### 7. Abuse Prevention

```typescript
// site/lib/rate-limit/abuse.ts

// Track suspicious patterns
async function checkAbuse(apiKey: string, ip: string): Promise<boolean> {
  // Too many 4xx errors = potential abuse
  const errorRate = await getErrorRate(apiKey);
  if (errorRate > 0.5) {
    await flagForReview(apiKey);
    return true;
  }
  
  // Too many unique endpoints = scraping
  const uniqueEndpoints = await getUniqueEndpoints(apiKey);
  if (uniqueEndpoints > 100) {
    await flagForReview(apiKey);
    return true;
  }
  
  return false;
}
```

### 8. Rate Limit Bypass

For internal services and testing:

```typescript
const BYPASS_KEYS = new Set([
  process.env.INTERNAL_API_KEY,
  process.env.TEST_API_KEY,
]);

function shouldBypass(apiKey: string): boolean {
  return BYPASS_KEYS.has(apiKey);
}
```

## Files to Create

```
site/lib/rate-limit/
├── index.ts        # Main checkRateLimit function
├── quota.ts        # Daily quota tracking
├── tiers.ts        # Tier configurations
├── abuse.ts        # Abuse detection
└── bypass.ts       # Bypass for internal keys

site/app/api/
└── usage/
    └── route.ts    # User can check their usage
```

## Database Tables

```sql
-- API keys with tiers
ALTER TABLE api_keys ADD COLUMN tier TEXT DEFAULT 'free';

-- Usage tracking
CREATE TABLE api_usage (
  id SERIAL PRIMARY KEY,
  api_key_id UUID REFERENCES api_keys(id),
  date DATE NOT NULL,
  request_count INTEGER DEFAULT 0,
  quota_limit INTEGER NOT NULL,
  PRIMARY KEY (api_key_id, date)
);
```

## Acceptance Criteria
- [ ] Rate limiting works per minute
- [ ] Daily quota enforced
- [ ] Headers included in responses
- [ ] 429 responses formatted correctly
- [ ] Per-endpoint costs work
- [ ] Abuse detection flags suspicious keys
- [ ] Usage endpoint shows remaining quota
- [ ] Bypass works for internal keys
