/**
 * Rate Limiter Types and Interfaces
 */

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  burstAllowance: number; // Additional requests allowed in burst
  adaptiveEnabled: boolean; // Enable adaptive rate limiting
  circuitBreakerEnabled: boolean; // Enable circuit breaker integration
  userSpecific: boolean; // Different limits per user
  endpointSpecific: boolean; // Different limits per endpoint
  tokenBucketEnabled: boolean; // Use token bucket algorithm
}

export interface RateLimitResult {
  allowed: boolean;
  remainingRequests: number;
  resetTime: number;
  retryAfter?: number; // Seconds to wait before retry
  adaptiveDelay?: number; // Suggested delay based on performance
  circuitBreakerStatus?: string;
  metadata: {
    algorithm: string;
    currentWindowRequests: number;
    averageResponseTime: number;
    successRate: number;
    adaptationFactor: number;
    burstTokens: number;
  };
}

export interface EndpointMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastResponseTime: number;
  successRate: number;
  adaptationFactor: number; // Current adaptation factor (0.1 - 2.0)
  lastAdaptation: number;
  circuitBreakerState: string;
}

export interface TokenBucket {
  tokens: number;
  lastRefill: number;
  capacity: number;
  refillRate: number; // Tokens per second
}

export interface SlidingWindow {
  requests: number[];
  windowStart: number;
  windowSize: number;
}

export interface UserLimits {
  userId: string;
  customLimits: Record<string, RateLimitConfig>;
  priorityLevel: "low" | "medium" | "high" | "premium";
  adaptationHistory: Array<{
    timestamp: number;
    factor: number;
    reason: string;
  }>;
}
