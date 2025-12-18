/**
 * Advanced Rate Limiter
 * Implements token bucket algorithm with Redis support
 */

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

/**
 * In-memory rate limiter (for development)
 * In production, use Redis or Vercel KV
 */
class InMemoryRateLimiter {
  private store = new Map<string, { count: number; resetTime: number }>();

  async checkLimit(
    key: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const record = this.store.get(key);

    // No record or window expired
    if (!record || now > record.resetTime) {
      const resetTime = now + config.windowMs;
      this.store.set(key, { count: 1, resetTime });
      
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime,
      };
    }

    // Within window
    if (record.count >= config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.resetTime,
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
      };
    }

    // Increment count
    record.count++;
    
    return {
      allowed: true,
      remaining: config.maxRequests - record.count,
      resetTime: record.resetTime,
    };
  }

  /**
   * Reset limit for a key
   */
  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (now > record.resetTime) {
        this.store.delete(key);
      }
    }
  }
}

/**
 * Redis-based rate limiter (for production)
 */
class RedisRateLimiter {
  constructor(private redis: any) {}

  async checkLimit(
    key: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowKey = `ratelimit:${key}`;

    // Get current count
    const count = await this.redis.get(windowKey);
    const currentCount = count ? parseInt(count) : 0;

    // Get TTL
    const ttl = await this.redis.ttl(windowKey);
    const resetTime = ttl > 0 ? now + (ttl * 1000) : now + config.windowMs;

    // Check limit
    if (currentCount >= config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime,
        retryAfter: Math.ceil(ttl),
      };
    }

    // Increment count
    await this.redis.incr(windowKey);
    
    // Set expiry if new key
    if (currentCount === 0) {
      await this.redis.expire(windowKey, Math.ceil(config.windowMs / 1000));
    }

    return {
      allowed: true,
      remaining: config.maxRequests - currentCount - 1,
      resetTime,
    };
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(`ratelimit:${key}`);
  }
}

/**
 * Rate limiter factory
 */
export class RateLimiter {
  private limiter: InMemoryRateLimiter | RedisRateLimiter;

  constructor(redis?: any) {
    this.limiter = redis 
      ? new RedisRateLimiter(redis)
      : new InMemoryRateLimiter();
  }

  /**
   * Check if request is allowed
   */
  async checkLimit(
    identifier: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    return this.limiter.checkLimit(identifier, config);
  }

  /**
   * Reset limit for identifier
   */
  async reset(identifier: string): Promise<void> {
    return this.limiter.reset(identifier);
  }

  /**
   * Cleanup (for in-memory only)
   */
  cleanup(): void {
    if (this.limiter instanceof InMemoryRateLimiter) {
      this.limiter.cleanup();
    }
  }
}

/**
 * Rate limit configurations for different tiers
 */
export const RATE_LIMITS = {
  free: {
    windowMs: 3600000, // 1 hour
    maxRequests: 10,
    message: 'Free tier limit: 10 requests per hour',
  },
  pro: {
    windowMs: 3600000, // 1 hour
    maxRequests: 100,
    message: 'Pro tier limit: 100 requests per hour',
  },
  enterprise: {
    windowMs: 3600000, // 1 hour
    maxRequests: 1000,
    message: 'Enterprise tier limit: 1000 requests per hour',
  },
  anonymous: {
    windowMs: 900000, // 15 minutes
    maxRequests: 5,
    message: 'Anonymous limit: 5 requests per 15 minutes',
  },
} as const;

/**
 * Get rate limit config for user tier
 */
export function getRateLimitConfig(
  tier: 'free' | 'pro' | 'enterprise' | 'anonymous' = 'free'
): RateLimitConfig {
  return RATE_LIMITS[tier];
}

// Global rate limiter instance
export const rateLimiter = new RateLimiter();

// Cleanup every 10 minutes
setInterval(() => rateLimiter.cleanup(), 600000);
