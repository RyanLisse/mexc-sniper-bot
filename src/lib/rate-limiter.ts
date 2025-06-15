/**
 * Enhanced rate limiter for authentication endpoints with audit logging
 * In production, consider using Redis or a distributed cache
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
  firstAttempt: number;
  lastAttempt: number;
}

interface SecurityEvent {
  type: "RATE_LIMIT_EXCEEDED" | "AUTH_ATTEMPT" | "SUSPICIOUS_ACTIVITY";
  ip: string;
  endpoint: string;
  timestamp: number;
  userAgent?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

// In-memory stores (use Redis in production)
const requestCounts = new Map<string, RateLimitEntry>();
const securityEvents: SecurityEvent[] = [];

// Rate limit configuration
const RATE_LIMITS = {
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 minutes
  },
  authStrict: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10, // 10 attempts per hour for repeated failures
  },
  general: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
  },
};

// Security event logging
export function logSecurityEvent(event: Omit<SecurityEvent, "timestamp">): void {
  const securityEvent: SecurityEvent = {
    ...event,
    timestamp: Date.now(),
  };

  securityEvents.push(securityEvent);

  // Keep only last 1000 events to prevent memory bloat
  if (securityEvents.length > 1000) {
    securityEvents.splice(0, securityEvents.length - 1000);
  }

  // Log to console for monitoring (in production, send to logging service)
  console.log(`[SECURITY] ${event.type}: ${event.ip} -> ${event.endpoint}`, {
    timestamp: new Date(securityEvent.timestamp).toISOString(),
    ...event.metadata,
  });
}

// Get security events for monitoring
export function getSecurityEvents(limit = 100, type?: SecurityEvent["type"]): SecurityEvent[] {
  let events = securityEvents.slice(-limit);

  if (type) {
    events = events.filter((event) => event.type === type);
  }

  return events.reverse(); // Most recent first
}

export function getRateLimitKey(ip: string, endpoint: string): string {
  return `${ip}:${endpoint}`;
}

export function checkRateLimit(
  ip: string,
  endpoint: string,
  limitType: keyof typeof RATE_LIMITS = "general",
  userAgent?: string,
  userId?: string
): { success: boolean; remaining: number; resetTime: number; isFirstViolation: boolean } {
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
      firstAttempt: now,
      lastAttempt: now,
    };
    requestCounts.set(key, newEntry);

    // Log authentication attempts for security monitoring
    if (limitType === "auth" || limitType === "authStrict") {
      logSecurityEvent({
        type: "AUTH_ATTEMPT",
        ip,
        endpoint,
        userAgent,
        userId,
        metadata: { attemptNumber: 1, windowStart: now },
      });
    }

    return {
      success: true,
      remaining: limit.maxRequests - 1,
      resetTime: newEntry.resetTime,
      isFirstViolation: false,
    };
  }

  // Increment counter first to get accurate violation detection
  entry.count += 1;
  entry.lastAttempt = now;
  requestCounts.set(key, entry);

  if (entry.count > limit.maxRequests) {
    // Rate limit exceeded
    const isFirstViolation = entry.count === limit.maxRequests + 1;

    // Log every violation, not just the first one, for accurate security monitoring
    logSecurityEvent({
      type: "RATE_LIMIT_EXCEEDED",
      ip,
      endpoint,
      userAgent,
      userId,
      metadata: {
        attemptCount: entry.count,
        windowDuration: now - entry.firstAttempt,
        limitType,
        isFirstViolation,
      },
    });

    // Check for suspicious activity (many attempts in short time)
    if (limitType === "auth" && entry.count > limit.maxRequests * 2) {
      logSecurityEvent({
        type: "SUSPICIOUS_ACTIVITY",
        ip,
        endpoint,
        userAgent,
        userId,
        metadata: {
          attemptCount: entry.count,
          pattern: "excessive_auth_attempts",
          severity: "high",
        },
      });
    }

    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
      isFirstViolation,
    };
  }

  // Log authentication attempts for security monitoring
  if (limitType === "auth" || limitType === "authStrict") {
    logSecurityEvent({
      type: "AUTH_ATTEMPT",
      ip,
      endpoint,
      userAgent,
      userId,
      metadata: { attemptNumber: entry.count, windowStart: entry.firstAttempt },
    });
  }

  return {
    success: true,
    remaining: limit.maxRequests - entry.count,
    resetTime: entry.resetTime,
    isFirstViolation: false,
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

// Test utilities - Clear all state for testing
export function clearAllRateLimitData(): void {
  requestCounts.clear();
  securityEvents.length = 0;
}

export function clearSecurityEvents(): void {
  securityEvents.length = 0;
}

// Enhanced monitoring and analysis functions
export function getRateLimitStats(): {
  activeEntries: number;
  totalSecurityEvents: number;
  recentViolations: number;
  topOffenders: Array<{ ip: string; violations: number }>;
} {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  // Count recent violations
  const recentViolations = securityEvents.filter(
    (event) => event.type === "RATE_LIMIT_EXCEEDED" && event.timestamp > oneHourAgo
  ).length;

  // Find top offenders
  const violationsByIP = new Map<string, number>();
  securityEvents
    .filter((event) => event.type === "RATE_LIMIT_EXCEEDED" && event.timestamp > oneHourAgo)
    .forEach((event) => {
      violationsByIP.set(event.ip, (violationsByIP.get(event.ip) || 0) + 1);
    });

  const topOffenders = Array.from(violationsByIP.entries())
    .map(([ip, violations]) => ({ ip, violations }))
    .sort((a, b) => b.violations - a.violations)
    .slice(0, 10);

  return {
    activeEntries: requestCounts.size,
    totalSecurityEvents: securityEvents.length,
    recentViolations,
    topOffenders,
  };
}

export function isIPSuspicious(ip: string): boolean {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  const recentEvents = securityEvents.filter(
    (event) => event.ip === ip && event.timestamp > oneHourAgo
  );

  const violations = recentEvents.filter((event) => event.type === "RATE_LIMIT_EXCEEDED").length;

  const suspiciousActivity = recentEvents.filter(
    (event) => event.type === "SUSPICIOUS_ACTIVITY"
  ).length;

  // Consider IP suspicious if:
  // - More than 3 rate limit violations in the last hour
  // - Any suspicious activity events
  return violations > 3 || suspiciousActivity > 0;
}

export function getIPAnalysis(ip: string): {
  totalAttempts: number;
  violations: number;
  lastActivity: number | null;
  riskLevel: "low" | "medium" | "high";
  isCurrentlyLimited: boolean;
} {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  const recentEvents = securityEvents.filter(
    (event) => event.ip === ip && event.timestamp > oneHourAgo
  );

  const totalAttempts = recentEvents.filter((event) => event.type === "AUTH_ATTEMPT").length;

  const violations = recentEvents.filter((event) => event.type === "RATE_LIMIT_EXCEEDED").length;

  const lastActivity =
    recentEvents.length > 0 ? Math.max(...recentEvents.map((e) => e.timestamp)) : null;

  // Check if currently rate limited (check common auth endpoints)
  const authEndpoints = ["/api/auth", "/auth", "/login"];
  let isCurrentlyLimited = false;

  for (const endpoint of authEndpoints) {
    const authKey = getRateLimitKey(ip, endpoint);
    const entry = requestCounts.get(authKey);
    if (entry && entry.count > RATE_LIMITS.auth.maxRequests && now < entry.resetTime) {
      isCurrentlyLimited = true;
      break;
    }
  }

  // Determine risk level
  let riskLevel: "low" | "medium" | "high" = "low";
  if (violations > 5 || recentEvents.some((e) => e.type === "SUSPICIOUS_ACTIVITY")) {
    riskLevel = "high";
  } else if (violations > 2 || totalAttempts > 20) {
    riskLevel = "medium";
  }

  return {
    totalAttempts,
    violations,
    lastActivity,
    riskLevel,
    isCurrentlyLimited,
  };
}

// Auto-cleanup every 5 minutes
if (typeof window === "undefined") {
  setInterval(
    () => {
      cleanupExpiredEntries();

      // Also cleanup old security events (keep only last 24 hours)
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const eventsToKeep = securityEvents.filter((event) => event.timestamp > oneDayAgo);
      securityEvents.length = 0;
      securityEvents.push(...eventsToKeep);
    },
    5 * 60 * 1000
  );
}

// Default export for backward compatibility
export const rateLimiter = {
  checkRateLimit,
  getClientIP,
  createRateLimitResponse,
  logSecurityEvent,
  getSecurityEvents,
  getRateLimitStats,
  isIPSuspicious,
  getIPAnalysis,
  cleanupExpiredEntries,
  clearAllRateLimitData,
  clearSecurityEvents,
};
