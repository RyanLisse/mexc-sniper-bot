/**
 * Adaptive Rate Limiter - Legacy Export
 * 
 * This file is maintained for backward compatibility.
 * All rate limiting functionality has been moved to modular components in src/services/rate-limiter/
 */

// Re-export everything from the new modular rate limiter system
export * from "./rate-limiter";

// Maintain backward compatibility with the main service export
export { AdaptiveRateLimiterService, adaptiveRateLimiter } from "./rate-limiter";

// Legacy export for backward compatibility
export { adaptiveRateLimiter as default } from "./rate-limiter";