/**
 * API Rate Limiter
 * Minimal implementation for build optimization
 */

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export class ApiRateLimiter {
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig = { windowMs: 60000, maxRequests: 100 }) {
    this.config = config;
  }

  async checkLimit(key: string): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Date.now();
    const limit = rateLimitMap.get(key);

    if (!limit || now > limit.resetTime) {
      const resetTime = now + this.config.windowMs;
      rateLimitMap.set(key, { count: 1, resetTime });
      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetTime
      };
    }

    if (limit.count >= this.config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: limit.resetTime
      };
    }

    limit.count++;
    return {
      allowed: true,
      remaining: this.config.maxRequests - limit.count,
      resetTime: limit.resetTime
    };
  }

  reset(key?: string): void {
    if (key) {
      rateLimitMap.delete(key);
    } else {
      rateLimitMap.clear();
    }
  }
}

export const defaultRateLimiter = new ApiRateLimiter();

// Rate limit configurations
export const RATE_LIMIT_CONFIGS = {
  DEFAULT: { windowMs: 60000, maxRequests: 100 },
  STRICT: { windowMs: 60000, maxRequests: 50 },
  LENIENT: { windowMs: 60000, maxRequests: 200 },
  API_HEAVY: { windowMs: 60000, maxRequests: 1000 },
} as const;

// Rate limit wrapper function
export function withRateLimit<T extends (...args: any[]) => any>(
  fn: T,
  config?: RateLimitConfig
): T {
  const rateLimiter = new ApiRateLimiter(config);
  
  return (async (...args: any[]) => {
    const key = `fn_${fn.name}_${Date.now()}`;
    const result = await rateLimiter.checkLimit(key);
    
    if (!result.allowed) {
      throw new Error(`Rate limit exceeded. Try again in ${Math.ceil((result.resetTime - Date.now()) / 1000)} seconds`);
    }
    
    return fn(...args);
  }) as T;
}