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

// Types
export type {
  CacheEntry,
  CacheConfig,
  CacheMetrics,
  CacheAnalytics,
  CacheDataType,
  CacheInvalidationStrategy,
  TTLConfig,
  CacheSetOptions,
} from "./types";

// Utilities
export {
  generateCacheKey,
  withCache,
  warmUpCache,
  cleanupLevel,
  estimateSize,
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