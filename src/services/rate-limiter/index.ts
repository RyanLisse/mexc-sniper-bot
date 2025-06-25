/**
 * Rate Limiter Module Exports
 */

// Main service
export { AdaptiveRateLimiterService } from "./adaptive-rate-limiter-service";

// Component managers
export { TokenBucketManager } from "./token-bucket";
export { SlidingWindowManager } from "./sliding-window";
export { MexcRateLimiter } from "./mexc-rate-limiter";

// Types
export type {
  RateLimitConfig,
  RateLimitResult,
  EndpointMetrics,
  TokenBucket,
  SlidingWindow,
  UserLimits,
} from "./types";

// Import and export singleton instance properly
import { AdaptiveRateLimiterService } from "./adaptive-rate-limiter-service";
export const adaptiveRateLimiter = AdaptiveRateLimiterService.getInstance();