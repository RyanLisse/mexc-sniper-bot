/**
 * Extracted Cache Manager Schemas
 *
 * This file contains all cache management-related Zod schemas extracted from the
 * cache-manager.ts file as part of the TDD refactoring process.
 *
 * Extracted schemas provide type safety and validation for cache entries,
 * configurations, metrics, analytics, and operational results.
 */

import { z } from "zod";

// ============================================================================
// Cache Data Types and Strategies
// ============================================================================

/**
 * Cache Data Type Schema - Enumeration of supported cache data types
 */
export const CacheDataTypeSchema = z.enum([
  "agent_response",
  "api_response",
  "pattern_detection",
  "query_result",
  "session_data",
  "user_preferences",
  "workflow_result",
  "performance_metrics",
  "health_status",
]);

/**
 * Cache Invalidation Strategy Schema
 */
export const CacheInvalidationStrategySchema = z.enum([
  "time_based",
  "event_based",
  "manual",
  "smart",
]);

// ============================================================================
// Cache Entry Schema
// ============================================================================

/**
 * Cache Entry Metadata Schema
 */
export const CacheEntryMetadataSchema = z
  .object({
    type: CacheDataTypeSchema.optional(),
    source: z.string().optional(),
    size: z.number().min(0).optional(),
    dependencies: z.array(z.string()).optional(),
  })
  .passthrough(); // Allow additional metadata fields

/**
 * Cache Entry Schema - Core cache entry structure
 */
export const CacheEntrySchema = z.object({
  // Core entry fields
  key: z.string().min(1),
  value: z.unknown(), // Any type of cached value

  // Timing information
  timestamp: z.number().min(0),
  expiresAt: z.number().min(0),

  // Access tracking
  accessCount: z.number().min(0).int(),
  lastAccessed: z.number().min(0),

  // Optional metadata
  metadata: CacheEntryMetadataSchema.optional(),
});

// ============================================================================
// Cache Configuration Schema
// ============================================================================

/**
 * Cache Configuration Schema
 */
export const CacheConfigSchema = z.object({
  // Size and capacity settings
  maxSize: z.number().positive().int(),

  // Timing configurations
  defaultTTL: z.number().positive(),
  cleanupInterval: z.number().min(0), // 0 = disabled

  // Feature toggles
  enableMetrics: z.boolean(),
  enablePersistence: z.boolean().optional(),

  // Optional persistence settings
  persistenceFile: z.string().optional(),
});

// ============================================================================
// TTL Configuration Schema
// ============================================================================

/**
 * TTL Configuration Schema - TTL settings per data type
 */
export const TTLConfigSchema = z
  .object({
    // Individual TTL settings for each data type (all positive values)
    agent_response: z.number().positive(),
    api_response: z.number().positive(),
    pattern_detection: z.number().positive(),
    query_result: z.number().positive(),
    session_data: z.number().positive(),
    user_preferences: z.number().positive(),
    workflow_result: z.number().positive(),
    performance_metrics: z.number().positive(),
    health_status: z.number().positive(),
  })
  .passthrough(); // Allow additional TTL configurations

// ============================================================================
// Cache Metrics Schema
// ============================================================================

/**
 * Cache Metrics Schema - Performance tracking and statistics
 */
export const CacheMetricsSchema = z.object({
  // Operation counters (non-negative integers)
  hits: z.number().min(0).int(),
  misses: z.number().min(0).int(),
  sets: z.number().min(0).int(),
  deletes: z.number().min(0).int(),
  evictions: z.number().min(0).int(),

  // Size and memory metrics
  totalSize: z.number().min(0).int(),
  memoryUsage: z.number().min(0),

  // Performance metrics
  hitRate: z.number().min(0).max(100), // percentage
  averageAccessTime: z.number().min(0),

  // Timing information
  lastCleanup: z.number().min(0), // timestamp
});

// ============================================================================
// Cache Analytics Schema
// ============================================================================

/**
 * Top Keys Schema - Most accessed cache keys
 */
export const TopKeysSchema = z.object({
  key: z.string().min(1),
  hits: z.number().min(0).int(),
  lastAccessed: z.number().min(0), // timestamp
});

/**
 * Type Breakdown Entry Schema - Statistics per cache data type
 */
export const TypeBreakdownEntrySchema = z.object({
  count: z.number().min(0).int(),
  size: z.number().min(0),
  hitRate: z.number().min(0).max(100), // percentage
});

/**
 * Cache Analytics Schema - Comprehensive analytics and insights
 */
export const CacheAnalyticsSchema = z.object({
  // Core performance metrics
  performance: CacheMetricsSchema,

  // Top accessed keys
  topKeys: z.array(TopKeysSchema),

  // Breakdown by data type
  typeBreakdown: z.record(CacheDataTypeSchema, TypeBreakdownEntrySchema),

  // System recommendations
  recommendations: z.array(z.string()),
});

// ============================================================================
// Cache Operation Result Schemas
// ============================================================================

/**
 * Cache Size Breakdown Schema - Size distribution across cache levels
 */
export const CacheSizeBreakdownSchema = z.object({
  L1: z.number().min(0).int(),
  L2: z.number().min(0).int(),
  L3: z.number().min(0).int(),
  total: z.number().min(0).int(),
});

/**
 * Cache Cleanup Result Schema - Results of cleanup operations
 */
export const CacheCleanupResultSchema = z.object({
  L1: z.number().min(0).int(),
  L2: z.number().min(0).int(),
  L3: z.number().min(0).int(),
  total: z.number().min(0).int(),
});

/**
 * Cache Optimization Result Schema - Results of optimization operations
 */
export const CacheOptimizationResultSchema = z.object({
  evicted: z.number().min(0).int(),
  promoted: z.number().min(0).int(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CacheDataType = z.infer<typeof CacheDataTypeSchema>;
export type CacheInvalidationStrategy = z.infer<
  typeof CacheInvalidationStrategySchema
>;
export type CacheEntryMetadata = z.infer<typeof CacheEntryMetadataSchema>;
export type CacheEntry = z.infer<typeof CacheEntrySchema>;
export type CacheConfig = z.infer<typeof CacheConfigSchema>;
export type TTLConfig = z.infer<typeof TTLConfigSchema>;
export type CacheMetrics = z.infer<typeof CacheMetricsSchema>;
export type TopKeys = z.infer<typeof TopKeysSchema>;
export type TypeBreakdownEntry = z.infer<typeof TypeBreakdownEntrySchema>;
export type CacheAnalytics = z.infer<typeof CacheAnalyticsSchema>;
export type CacheSizeBreakdown = z.infer<typeof CacheSizeBreakdownSchema>;
export type CacheCleanupResult = z.infer<typeof CacheCleanupResultSchema>;
export type CacheOptimizationResult = z.infer<
  typeof CacheOptimizationResultSchema
>;

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate cache entry
 */
export function validateCacheEntry(data: unknown): CacheEntry {
  return CacheEntrySchema.parse(data);
}

/**
 * Validate cache configuration
 */
export function validateCacheConfig(data: unknown): CacheConfig {
  return CacheConfigSchema.parse(data);
}

/**
 * Validate cache metrics
 */
export function validateCacheMetrics(data: unknown): CacheMetrics {
  return CacheMetricsSchema.parse(data);
}

/**
 * Validate cache analytics
 */
export function validateCacheAnalytics(data: unknown): CacheAnalytics {
  return CacheAnalyticsSchema.parse(data);
}

/**
 * Validate TTL configuration
 */
export function validateTTLConfig(data: unknown): TTLConfig {
  return TTLConfigSchema.parse(data);
}

/**
 * Validate cache data type
 */
export function validateCacheDataType(data: unknown): CacheDataType {
  return CacheDataTypeSchema.parse(data);
}

/**
 * Validate cache invalidation strategy
 */
export function validateCacheInvalidationStrategy(
  data: unknown
): CacheInvalidationStrategy {
  return CacheInvalidationStrategySchema.parse(data);
}

/**
 * Validate cache size breakdown
 */
export function validateCacheSizeBreakdown(data: unknown): CacheSizeBreakdown {
  return CacheSizeBreakdownSchema.parse(data);
}

/**
 * Validate cache cleanup result
 */
export function validateCacheCleanupResult(data: unknown): CacheCleanupResult {
  return CacheCleanupResultSchema.parse(data);
}

/**
 * Validate cache optimization result
 */
export function validateCacheOptimizationResult(
  data: unknown
): CacheOptimizationResult {
  return CacheOptimizationResultSchema.parse(data);
}

// ============================================================================
// Schema Collections
// ============================================================================

/**
 * All available cache manager schemas for bulk operations
 */
export const ALL_CACHE_MANAGER_SCHEMAS = {
  CacheDataTypeSchema,
  CacheInvalidationStrategySchema,
  CacheEntryMetadataSchema,
  CacheEntrySchema,
  CacheConfigSchema,
  TTLConfigSchema,
  CacheMetricsSchema,
  TopKeysSchema,
  TypeBreakdownEntrySchema,
  CacheAnalyticsSchema,
  CacheSizeBreakdownSchema,
  CacheCleanupResultSchema,
  CacheOptimizationResultSchema,
} as const;

/**
 * Core cache schemas
 */
export const CORE_CACHE_SCHEMAS = {
  CacheEntrySchema,
  CacheConfigSchema,
  CacheMetricsSchema,
  CacheAnalyticsSchema,
} as const;

/**
 * Configuration-related schemas
 */
export const CACHE_CONFIG_SCHEMAS = {
  CacheConfigSchema,
  TTLConfigSchema,
  CacheDataTypeSchema,
  CacheInvalidationStrategySchema,
} as const;

/**
 * Analytics and monitoring schemas
 */
export const CACHE_ANALYTICS_SCHEMAS = {
  CacheAnalyticsSchema,
  CacheMetricsSchema,
  TopKeysSchema,
  TypeBreakdownEntrySchema,
} as const;

/**
 * Operation result schemas
 */
export const CACHE_OPERATION_SCHEMAS = {
  CacheSizeBreakdownSchema,
  CacheCleanupResultSchema,
  CacheOptimizationResultSchema,
} as const;
