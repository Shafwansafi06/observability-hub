/**
 * ObservAI Hub - Shared Edge Function Utilities
 * Redis Cache Client (Upstash)
 */

// Upstash Redis REST API client for Edge Functions
const UPSTASH_REDIS_REST_URL = Deno.env.get('UPSTASH_REDIS_REST_URL');
const UPSTASH_REDIS_REST_TOKEN = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');

/**
 * Simple Redis cache interface
 */
export interface CacheClient {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  incr(key: string): Promise<number>;
  expire(key: string, ttlSeconds: number): Promise<void>;
  exists(key: string): Promise<boolean>;
  setNx(key: string, value: unknown, ttlSeconds?: number): Promise<boolean>;
}

/**
 * Execute Redis command via Upstash REST API
 */
async function executeCommand<T>(command: string[]): Promise<T> {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('Redis configuration missing');
  }
  
  const response = await fetch(UPSTASH_REDIS_REST_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  
  if (!response.ok) {
    throw new Error(`Redis error: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.result as T;
}

/**
 * Create a cache client
 */
export function createCacheClient(): CacheClient {
  return {
    async get<T>(key: string): Promise<T | null> {
      try {
        const result = await executeCommand<string | null>(['GET', key]);
        if (result === null) return null;
        return JSON.parse(result) as T;
      } catch {
        return null;
      }
    },
    
    async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await executeCommand(['SET', key, serialized, 'EX', ttlSeconds.toString()]);
      } else {
        await executeCommand(['SET', key, serialized]);
      }
    },
    
    async del(key: string): Promise<void> {
      await executeCommand(['DEL', key]);
    },
    
    async incr(key: string): Promise<number> {
      return executeCommand<number>(['INCR', key]);
    },
    
    async expire(key: string, ttlSeconds: number): Promise<void> {
      await executeCommand(['EXPIRE', key, ttlSeconds.toString()]);
    },
    
    async exists(key: string): Promise<boolean> {
      const result = await executeCommand<number>(['EXISTS', key]);
      return result === 1;
    },
    
    async setNx(key: string, value: unknown, ttlSeconds?: number): Promise<boolean> {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        const result = await executeCommand<string | null>(['SET', key, serialized, 'NX', 'EX', ttlSeconds.toString()]);
        return result === 'OK';
      } else {
        const result = await executeCommand<number>(['SETNX', key, serialized]);
        return result === 1;
      }
    },
  };
}

/**
 * Rate limiter using Redis
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export async function checkRateLimit(
  cache: CacheClient,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const windowKey = `ratelimit:${key}:${Math.floor(now / windowSeconds)}`;
  
  const count = await cache.incr(windowKey);
  
  // Set expiry on first request in window
  if (count === 1) {
    await cache.expire(windowKey, windowSeconds);
  }
  
  const resetAt = new Date((Math.floor(now / windowSeconds) + 1) * windowSeconds * 1000);
  
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt,
  };
}

/**
 * Sliding window rate limiter
 */
export async function checkSlidingWindowRateLimit(
  cache: CacheClient,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;
  const sortedSetKey = `ratelimit:sliding:${key}`;
  
  // For simplicity with REST API, use fixed window
  // A proper implementation would use Redis ZSET with pipeline
  return checkRateLimit(cache, key, limit, windowSeconds);
}

/**
 * Cache key generators
 */
export const cacheKeys = {
  apiKey: (hash: string) => `apikey:${hash}`,
  orgLimits: (orgId: string) => `org:limits:${orgId}`,
  dashboardOverview: (orgId: string, projectId?: string) => 
    `dashboard:overview:${orgId}:${projectId || 'all'}`,
  metricsAgg: (orgId: string, projectId: string, period: string) =>
    `metrics:agg:${orgId}:${projectId}:${period}`,
  alertsCount: (orgId: string) => `alerts:count:${orgId}`,
  userSession: (userId: string) => `user:session:${userId}`,
  rateLimit: (type: string, id: string) => `ratelimit:${type}:${id}`,
};

/**
 * Cache TTLs (in seconds)
 */
export const cacheTTL = {
  apiKey: 300,           // 5 minutes
  orgLimits: 60,         // 1 minute
  dashboardOverview: 30, // 30 seconds
  metricsAgg: 60,        // 1 minute
  alertsCount: 10,       // 10 seconds
  userSession: 3600,     // 1 hour
};
