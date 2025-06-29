/**
 * API Rate Limiter
 * 
 * Comprehensive rate limiting solution to prevent excessive edge requests
 * and protect against abuse while allowing legitimate usage.
 */

import { NextRequest, NextResponse } from "next/server";

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

class MemoryRateLimitStore {
  private store: RateLimitStore = {};
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  private cleanup() {
    const now = Date.now();
    for (const key in this.store) {
      if (this.store[key].resetTime < now) {
        delete this.store[key];
      }
    }
  }

  get(key: string): { count: number; resetTime: number } | undefined {
    const entry = this.store[key];
    if (!entry || entry.resetTime < Date.now()) {
      return undefined;
    }
    return entry;
  }

  set(key: string, count: number, resetTime: number): void {
    this.store[key] = { count, resetTime };
  }

  increment(key: string, windowMs: number): { count: number; resetTime: number } {
    const now = Date.now();
    const existing = this.get(key);
    
    if (!existing) {
      const resetTime = now + windowMs;
      this.set(key, 1, resetTime);
      return { count: 1, resetTime };
    }
    
    const newCount = existing.count + 1;
    this.set(key, newCount, existing.resetTime);
    return { count: newCount, resetTime: existing.resetTime };
  }

  destroy() {
    clearInterval(this.cleanupInterval);
    this.store = {};
  }
}

// Global store instance
const store = new MemoryRateLimitStore();

// Default configurations for different endpoint types
export const RATE_LIMIT_CONFIGS = {
  // Very restrictive for expensive operations
  strict: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    message: "Too many requests. Please try again later.",
  },
  
  // Standard rate limiting for most API endpoints
  standard: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    message: "Rate limit exceeded. Please slow down.",
  },
  
  // Moderate limiting for status/health checks
  moderate: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
    message: "Too many status requests. Please reduce polling frequency.",
  },
  
  // Lenient for non-expensive reads
  lenient: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 120,
    message: "Request limit reached. Please try again in a minute.",
  },
} as const;

/**
 * Extract client identifier for rate limiting
 */
function getClientId(request: NextRequest): string {
  // Try to get IP from various headers (for proxies/load balancers)
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const clientIp = forwarded?.split(",")[0] || realIp || "unknown";
  
  // Include user agent for better fingerprinting
  const userAgent = request.headers.get("user-agent") || "unknown";
  const fingerprint = `${clientIp}:${userAgent.slice(0, 50)}`;
  
  return fingerprint;
}

/**
 * Rate limiting middleware
 */
export function rateLimit(config: RateLimitConfig = RATE_LIMIT_CONFIGS.standard) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    try {
      const clientId = getClientId(request);
      const key = `rate_limit:${clientId}:${request.nextUrl.pathname}`;
      
      const result = store.increment(key, config.windowMs);
      
      // Set rate limit headers
      const resetTime = Math.ceil(result.resetTime / 1000);
      const remaining = Math.max(0, config.maxRequests - result.count);
      
      if (result.count > config.maxRequests) {
        return NextResponse.json(
          {
            success: false,
            error: config.message || "Rate limit exceeded",
            rateLimitInfo: {
              limit: config.maxRequests,
              remaining: 0,
              reset: resetTime,
              retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
            },
          },
          {
            status: 429,
            headers: {
              "X-RateLimit-Limit": config.maxRequests.toString(),
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": resetTime.toString(),
              "Retry-After": Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
            },
          }
        );
      }
      
      // Add rate limit headers to successful responses
      // These will be merged with the actual response headers
      return null; // Continue to next middleware/handler
    } catch (error) {
      console.error("Rate limiting error:", error);
      return null; // Continue on error to avoid blocking legitimate requests
    }
  };
}

/**
 * Higher-order function to wrap API route handlers with rate limiting
 */
export function withRateLimit<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>,
  config: RateLimitConfig = RATE_LIMIT_CONFIGS.standard
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const rateLimitResponse = await rateLimit(config)(request);
    
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    
    return handler(request, ...args);
  };
}

/**
 * Apply rate limiting based on endpoint type
 */
export function getEndpointRateLimit(pathname: string): RateLimitConfig {
  // Health checks and status endpoints - moderate limiting
  if (pathname.includes("/health") || pathname.includes("/status")) {
    return RATE_LIMIT_CONFIGS.moderate;
  }
  
  // Authentication endpoints - strict limiting
  if (pathname.includes("/auth")) {
    return RATE_LIMIT_CONFIGS.strict;
  }
  
  // Trading/execution endpoints - strict limiting
  if (pathname.includes("/auto-sniping") || pathname.includes("/trading")) {
    return RATE_LIMIT_CONFIGS.strict;
  }
  
  // System/validation endpoints - moderate limiting
  if (pathname.includes("/system") || pathname.includes("/validation")) {
    return RATE_LIMIT_CONFIGS.moderate;
  }
  
  // Default to standard rate limiting
  return RATE_LIMIT_CONFIGS.standard;
}

/**
 * Cleanup function for tests
 */
export function cleanupRateLimit() {
  store.destroy();
}