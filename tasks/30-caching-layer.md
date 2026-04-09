# Task: Caching Layer for API Proxy

## Context
Implement an efficient caching layer to reduce external API calls and improve response times.

## Requirements

### 1. Multi-tier Cache Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│  Edge Cache │────▶│   Origin    │
│   (Client)  │     │  (Vercel)   │     │   Server    │
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
              ┌─────▼─────┐           ┌───────▼───────┐         ┌───────▼───────┐
              │  Memory   │           │    Redis      │         │   External    │
              │  (LRU)    │           │   (Upstash)   │         │     APIs      │
              └───────────┘           └───────────────┘         └───────────────┘
```

### 2. Cache Implementation

```typescript
// site/lib/cache/index.ts

interface CacheOptions {
  ttl: number;           // Time to live in seconds
  stale: number;         // Serve stale while revalidating
  tags?: string[];       // For selective invalidation
  revalidate?: boolean;  // Background revalidation
}

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  expiresAt: number;
  staleAt: number;
  version: string;
}

class CacheManager {
  private memory: LRUCache<string, CacheEntry<any>>;
  private redis: Redis;
  
  async get<T>(key: string): Promise<T | null>;
  async set<T>(key: string, data: T, options: CacheOptions): Promise<void>;
  async invalidate(pattern: string): Promise<void>;
  async invalidateByTag(tag: string): Promise<void>;
}
```

### 3. Memory Cache (First Tier)

```typescript
// site/lib/cache/memory.ts

import LRU from 'lru-cache';

const memoryCache = new LRU<string, CacheEntry<any>>({
  max: 1000,           // Max entries
  maxSize: 50_000_000, // 50MB max
  sizeCalculation: (value) => JSON.stringify(value).length,
  ttl: 60_000,         // 1 minute default
});

export function getFromMemory<T>(key: string): CacheEntry<T> | undefined {
  return memoryCache.get(key);
}

export function setInMemory<T>(key: string, entry: CacheEntry<T>): void {
  memoryCache.set(key, entry);
}
```

### 4. Redis Cache (Second Tier)

```typescript
// site/lib/cache/redis.ts

import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export async function getFromRedis<T>(key: string): Promise<CacheEntry<T> | null> {
  const data = await redis.get<CacheEntry<T>>(key);
  return data;
}

export async function setInRedis<T>(
  key: string, 
  entry: CacheEntry<T>,
  ttlSeconds: number
): Promise<void> {
  await redis.set(key, entry, { ex: ttlSeconds });
}

export async function invalidatePattern(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
```

### 5. Cache Key Strategy

```typescript
// site/lib/cache/keys.ts

function generateCacheKey(
  source: string,
  endpoint: string,
  params: Record<string, string>
): string {
  // Normalize and sort params
  const sortedParams = Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');
  
  // Hash for shorter key
  const hash = crypto.createHash('md5')
    .update(`${source}:${endpoint}:${sortedParams}`)
    .digest('hex')
    .slice(0, 12);
  
  return `proxy:${source}:${hash}`;
}

// Examples:
// proxy:helius:a1b2c3d4e5f6
// proxy:birdeye:x7y8z9a0b1c2
```

### 6. Stale-While-Revalidate

```typescript
// site/lib/cache/stale.ts

async function getWithStaleRevalidate<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions
): Promise<T> {
  const cached = await cache.get<T>(key);
  
  const now = Date.now();
  
  if (cached) {
    // Fresh: return immediately
    if (now < cached.expiresAt) {
      return cached.data;
    }
    
    // Stale but within grace: return stale, revalidate in background
    if (now < cached.staleAt) {
      // Don't await - fire and forget
      revalidateInBackground(key, fetcher, options);
      return cached.data;
    }
  }
  
  // Expired or missing: fetch fresh
  const fresh = await fetcher();
  await cache.set(key, fresh, options);
  return fresh;
}

async function revalidateInBackground<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions
): Promise<void> {
  // Use lock to prevent thundering herd
  const lockKey = `lock:${key}`;
  const locked = await redis.setnx(lockKey, '1');
  if (!locked) return;
  
  try {
    await redis.expire(lockKey, 30); // 30s lock timeout
    const fresh = await fetcher();
    await cache.set(key, fresh, options);
  } finally {
    await redis.del(lockKey);
  }
}
```

### 7. Cache Configuration by Source

```typescript
// site/lib/cache/config.ts

const CACHE_CONFIGS: Record<string, CacheOptions> = {
  // Real-time data
  'helius:transactions': { ttl: 30, stale: 120 },
  'birdeye:price': { ttl: 15, stale: 60 },
  'dexscreener:pairs': { ttl: 30, stale: 120 },
  
  // Frequent updates
  'helius:balances': { ttl: 60, stale: 300 },
  'moralis:tokens': { ttl: 120, stale: 600 },
  'debank:positions': { ttl: 300, stale: 1800 },
  
  // Metadata (changes rarely)
  'coingecko:coin': { ttl: 3600, stale: 86400 },
  'geckoterminal:networks': { ttl: 86400, stale: 604800 },
  
  // Analytics (expensive, cache longer)
  'dune:results': { ttl: 900, stale: 3600 },
  'flipside:query': { ttl: 900, stale: 3600 },
};
```

### 8. Cache Warming

Pre-populate cache for popular endpoints:

```typescript
// site/lib/cache/warm.ts

const WARM_ENDPOINTS = [
  { source: 'coingecko', endpoint: '/trending' },
  { source: 'dexscreener', endpoint: '/token-boosts/top' },
  { source: 'geckoterminal', endpoint: '/networks/trending_pools' },
  { source: 'dune', endpoint: '/echo/trending/solana' },
];

async function warmCache(): Promise<void> {
  for (const { source, endpoint } of WARM_ENDPOINTS) {
    try {
      await fetchAndCache(source, endpoint);
    } catch (e) {
      console.error(`Cache warm failed: ${source}${endpoint}`);
    }
  }
}

// Run on deploy and every 5 minutes
```

### 9. Cache Metrics

Track cache performance:

```typescript
interface CacheMetrics {
  hits: number;
  misses: number;
  staleHits: number;
  errors: number;
  avgLatency: number;
}

// Store in Redis for dashboard
await redis.hincrby('cache:metrics:daily', 'hits', 1);
```

## Files to Create

```
site/lib/cache/
├── index.ts        # Main CacheManager class
├── memory.ts       # LRU memory cache
├── redis.ts        # Redis cache
├── keys.ts         # Key generation
├── stale.ts        # Stale-while-revalidate
├── config.ts       # Per-source configs
├── warm.ts         # Cache warming
└── metrics.ts      # Performance tracking

site/app/api/cache/
├── invalidate/route.ts  # Admin: invalidate cache
└── metrics/route.ts     # Admin: view metrics
```

## Environment Variables

```bash
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
CACHE_DEFAULT_TTL=300
CACHE_MAX_MEMORY_MB=50
```

## Acceptance Criteria
- [ ] Memory cache working (LRU)
- [ ] Redis cache working (Upstash)
- [ ] Stale-while-revalidate implemented
- [ ] Cache keys are deterministic
- [ ] Per-source TTL configs work
- [ ] Cache warming on deploy
- [ ] Metrics tracking
- [ ] Admin invalidation endpoint
