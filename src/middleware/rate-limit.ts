/**
 * Rate Limiting Middleware
 * 
 * Client-side rate limiting utilities with configurable limits.
 * Note: Production rate limiting should be enforced on the server/edge.
 */

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitState {
  count: number;
  windowStart: number;
}

const rateLimitStore = new Map<string, RateLimitState>();

// Default rate limit configurations
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  default: { windowMs: 60000, maxRequests: 100 },
  ingest: { windowMs: 60000, maxRequests: 1000 },
  auth: { windowMs: 60000, maxRequests: 10 },
  search: { windowMs: 60000, maxRequests: 30 },
};

/**
 * Check if request is rate limited
 */
export function isRateLimited(
  key: string,
  config: RateLimitConfig = RATE_LIMITS.default
): { limited: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const state = rateLimitStore.get(key);
  
  // New window
  if (!state || now - state.windowStart > config.windowMs) {
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return {
      limited: false,
      remaining: config.maxRequests - 1,
      resetIn: config.windowMs,
    };
  }
  
  // Check limit
  if (state.count >= config.maxRequests) {
    const resetIn = config.windowMs - (now - state.windowStart);
    return {
      limited: true,
      remaining: 0,
      resetIn,
    };
  }
  
  // Increment counter
  state.count++;
  rateLimitStore.set(key, state);
  
  return {
    limited: false,
    remaining: config.maxRequests - state.count,
    resetIn: config.windowMs - (now - state.windowStart),
  };
}

/**
 * Create rate limiter for specific endpoint
 */
export function createRateLimiter(configName: string = 'default') {
  const config = RATE_LIMITS[configName] || RATE_LIMITS.default;
  
  return {
    check: (key: string) => isRateLimited(key, config),
    reset: (key: string) => rateLimitStore.delete(key),
  };
}

/**
 * Rate limit decorator for async functions
 */
export function withRateLimit<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  key: string,
  configName: string = 'default'
): (...args: T) => Promise<R> {
  const limiter = createRateLimiter(configName);
  
  return async (...args: T): Promise<R> => {
    const { limited, resetIn } = limiter.check(key);
    
    if (limited) {
      throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(resetIn / 1000)} seconds.`);
    }
    
    return fn(...args);
  };
}

/**
 * Cleanup old entries periodically
 */
export function startRateLimitCleanup(intervalMs: number = 300000): () => void {
  const interval = setInterval(() => {
    const now = Date.now();
    const maxWindow = Math.max(...Object.values(RATE_LIMITS).map(c => c.windowMs));
    
    for (const [key, state] of rateLimitStore.entries()) {
      if (now - state.windowStart > maxWindow) {
        rateLimitStore.delete(key);
      }
    }
  }, intervalMs);
  
  return () => clearInterval(interval);
}
