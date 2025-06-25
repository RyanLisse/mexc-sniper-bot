/**
 * Cache Manager - Legacy Export
 *
 * This file is maintained for backward compatibility.
 * All cache functionality has been moved to modular components in src/lib/cache/
 */

// Re-export everything from the new modular cache system
export * from "./cache";
// Maintain backward compatibility with the global instance export
// Re-export the main classes for backward compatibility
export { CacheManager, globalCacheManager as default, globalCacheManager, LRUCache } from "./cache";
