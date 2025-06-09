/**
 * Simple in-memory rate limiter for authentication endpoints
 * In production, consider using Redis or a distributed cache
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store (use Redis in production)
const requestCounts = new Map<string, RateLimitEntry>();

// Rate limit configuration
const RATE_LIMITS = {
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 minutes
  },
  general: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
  },
};

export function getRateLimitKey(ip: string, endpoint: string): string {
  return `${ip}:${endpoint}`;
}

export function checkRateLimit(
  ip: string,
  endpoint: string,
  limitType: keyof typeof RATE_LIMITS = "general"
): { success: boolean; remaining: number; resetTime: number } {
  const key = getRateLimitKey(ip, endpoint);
  const limit = RATE_LIMITS[limitType];
  const now = Date.now();

  // Clean up expired entries
  const entry = requestCounts.get(key);

  if (!entry || now > entry.resetTime) {
    // First request or window expired
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + limit.windowMs,
    };
    requestCounts.set(key, newEntry);

    return {
      success: true,
      remaining: limit.maxRequests - 1,
      resetTime: newEntry.resetTime,
    };
  }

  if (entry.count >= limit.maxRequests) {
    // Rate limit exceeded
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  // Increment counter
  entry.count += 1;
  requestCounts.set(key, entry);

  return {
    success: true,
    remaining: limit.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

export function getClientIP(request: Request): string {
  // Get IP from various headers (in order of preference)
  const forwarded = request.headers.get("x-forwarded-for");
  const realIP = request.headers.get("x-real-ip");
  const cfConnectingIP = request.headers.get("cf-connecting-ip");

  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwarded.split(",")[0].trim();
  }

  if (realIP) {
    return realIP;
  }

  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // Fallback to localhost for development
  return "127.0.0.1";
}

export function createRateLimitResponse(resetTime: number): Response {
  const resetTimeSeconds = Math.ceil((resetTime - Date.now()) / 1000);

  return new Response(
    JSON.stringify({
      error: "Too many requests",
      message: "Rate limit exceeded. Please try again later.",
      retryAfter: resetTimeSeconds,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": resetTimeSeconds.toString(),
        "X-RateLimit-Limit": RATE_LIMITS.auth.maxRequests.toString(),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": Math.ceil(resetTime / 1000).toString(),
      },
    }
  );
}

// Cleanup function to remove expired entries (call periodically)
export function cleanupExpiredEntries(): void {
  const now = Date.now();

  for (const [key, entry] of requestCounts.entries()) {
    if (now > entry.resetTime) {
      requestCounts.delete(key);
    }
  }
}

// Auto-cleanup every 5 minutes
if (typeof window === "undefined") {
  setInterval(cleanupExpiredEntries, 5 * 60 * 1000);
}
