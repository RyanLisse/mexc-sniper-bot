/**
 * Rate Limiter Module Exports
 */

// Main service
export { AdaptiveRateLimiterService } from "./adaptive-rate-limiter-service";
export { MexcRateLimiter } from "./mexc-rate-limiter";
export { SlidingWindowManager } from "./sliding-window";
// Component managers
export { TokenBucketManager } from "./token-bucket";

// Types
export type {
  EndpointMetrics,
  RateLimitConfig,
  RateLimitResult,
  SlidingWindow,
  TokenBucket,
  UserLimits,
} from "./types";

// Import and export singleton instance properly
import { AdaptiveRateLimiterService } from "./adaptive-rate-limiter-service";
export const adaptiveRateLimiter = AdaptiveRateLimiterService.getInstance();
