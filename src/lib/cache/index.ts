/**
 * Cache Module Exports
 *
 * Re-exports all cache components and provides global instance
 */

// Import classes for global instance creation
import { CacheManager } from "./cache-manager";

// Core classes
export { CacheManager } from "./cache-manager";
export { LRUCache } from "./lru-cache";
export { PerformanceCacheOptimizer, getPerformanceCacheOptimizer } from "./performance-cache-optimizer";

// Types
export type {
  CacheAnalytics,
  CacheConfig,
  CacheDataType,
  CacheEntry,
  CacheInvalidationStrategy,
  CacheMetrics,
  CacheSetOptions,
  TTLConfig,
} from "./types";

// Utilities
export {
  cleanupLevel,
  estimateSize,
  generateCacheKey,
  warmUpCache,
  withCache,
} from "./utils";

// Global cache manager instance
export const globalCacheManager = new CacheManager({
  maxSize: 10000,
  defaultTTL: 5 * 60 * 1000,
  cleanupInterval: 5 * 60 * 1000,
  enableMetrics: true,
  enablePersistence: false,
});

// Export default
export default globalCacheManager;
