/**
 * Extracted Agent Cache Schemas
 *
 * This file contains all agent cache-related Zod schemas extracted from the
 * enhanced-agent-cache.ts file as part of the TDD refactoring process.
 *
 * Extracted schemas provide type safety and validation for agent caching
 * configurations, metrics, responses, workflow entries, health monitoring, and analytics.
 */

import { z } from "zod";

// ============================================================================
// Agent Cache Configuration Schema
// ============================================================================

/**
 * Agent Cache Configuration Schema
 */
export const AgentCacheConfigSchema = z.object({
  // TTL and retry settings (positive values)
  defaultTTL: z.number().positive(),
  maxRetries: z.number().positive().int(),

  // Feature toggles
  enablePerformanceTracking: z.boolean(),
  enableWorkflowCaching: z.boolean(),
  enableHealthCaching: z.boolean(),
  cacheWarmupEnabled: z.boolean(),
});

// ============================================================================
// Agent Cache Metrics Schema
// ============================================================================

/**
 * Agent Cache Metrics Schema
 */
export const AgentCacheMetricsSchema = z.object({
  // Agent identification
  agentId: z.string().min(1),

  // Execution counters (non-negative)
  totalExecutions: z.number().min(0).int(),
  successfulExecutions: z.number().min(0).int(),
  failedExecutions: z.number().min(0).int(),

  // Performance metrics
  avgResponseTime: z.number().min(0),
  errorRate: z.number().min(0).max(100), // percentage
  lastActivity: z.number().min(0), // timestamp

  // Cache performance
  cacheHits: z.number().min(0).int(),
  cacheSets: z.number().min(0).int(),
  throughput: z.number().min(0), // requests per second
});

// ============================================================================
// Cached Agent Response Schema
// ============================================================================

/**
 * Base Agent Response Schema (for extension)
 */
export const BaseAgentResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  metadata: z
    .object({
      agentId: z.string().min(1),
      timestamp: z.string(),
      executionTime: z.number().min(0),
      fromCache: z.boolean().optional(),
      cached: z.boolean().optional(),
    })
    .passthrough(), // Allow additional metadata fields
});

/**
 * Cache Metadata Schema
 */
export const CacheMetadataSchema = z.object({
  cacheKey: z.string().min(1),
  cacheLevel: z.enum(["L1", "L2", "L3"]),
  cacheTimestamp: z.number().min(0),
  originalTimestamp: z.number().min(0),
  hitCount: z.number().min(0).int(),
  performanceScore: z.number().min(0).max(100).optional(),
});

/**
 * Cached Agent Response Schema
 */
export const CachedAgentResponseSchema = BaseAgentResponseSchema.extend({
  cacheMetadata: CacheMetadataSchema,
});

// ============================================================================
// Workflow Cache Entry Schema
// ============================================================================

/**
 * Workflow Metadata Schema
 */
export const WorkflowMetadataSchema = z.object({
  success: z.boolean(),
  errorCount: z.number().min(0).int(),
  handoffCount: z.number().min(0).int(),
  confidence: z.number().min(0).max(100),
});

/**
 * Workflow Cache Entry Schema
 */
export const WorkflowCacheEntrySchema = z.object({
  // Workflow identification
  workflowId: z.string().min(1),
  agentSequence: z.array(z.string().min(1)),

  // Results (using record instead of Map for JSON serialization)
  results: z.record(z.unknown()).optional(), // Map serialized as object
  finalResult: z.unknown(),

  // Timing and dependencies
  executionTime: z.number().min(0),
  timestamp: z.number().min(0),
  dependencies: z.array(z.string()),

  // Workflow metadata
  metadata: WorkflowMetadataSchema,
});

// ============================================================================
// Agent Health Cache Schema
// ============================================================================

/**
 * Agent Health Metadata Schema
 */
export const AgentHealthMetadataSchema = z.object({
  uptime: z.number().min(0).max(100), // percentage
  totalRequests: z.number().min(0).int(),
  successfulRequests: z.number().min(0).int(),
  averageResponseTime: z.number().min(0),
});

/**
 * Agent Health Cache Schema
 */
export const AgentHealthCacheSchema = z.object({
  // Agent identification
  agentId: z.string().min(1),
  status: z.enum(["healthy", "degraded", "unhealthy"]),

  // Health metrics
  lastCheck: z.number().min(0), // timestamp
  responseTime: z.number().min(0),
  errorRate: z.number().min(0).max(100), // percentage
  cacheHitRate: z.number().min(0).max(100), // percentage

  // Additional health metadata
  metadata: AgentHealthMetadataSchema,
});

// ============================================================================
// Agent Cache Analytics Schema
// ============================================================================

/**
 * Agent Performance Metrics Schema
 */
export const AgentPerformanceMetricsSchema = z.object({
  hitRate: z.number().min(0).max(100),
  averageResponseTime: z.number().min(0),
  errorRate: z.number().min(0).max(100),
  cacheEfficiency: z.number().min(0).max(100),
  totalRequests: z.number().min(0).int(),
});

/**
 * Workflow Efficiency Metrics Schema
 */
export const WorkflowEfficiencyMetricsSchema = z.object({
  totalWorkflows: z.number().min(0).int(),
  cachedWorkflows: z.number().min(0).int(),
  cacheHitRate: z.number().min(0).max(100),
  averageExecutionTime: z.number().min(0),
  timesSaved: z.number().min(0),
});

/**
 * Health Monitoring Metrics Schema
 */
export const HealthMonitoringMetricsSchema = z.object({
  healthyAgents: z.number().min(0).int(),
  degradedAgents: z.number().min(0).int(),
  unhealthyAgents: z.number().min(0).int(),
  averageResponseTime: z.number().min(0),
  systemLoad: z.number().min(0).max(100), // percentage
});

/**
 * Agent Cache Analytics Schema
 */
export const AgentCacheAnalyticsSchema = z.object({
  // Per-agent performance metrics
  agentPerformance: z.record(AgentPerformanceMetricsSchema),

  // Workflow efficiency metrics
  workflowEfficiency: WorkflowEfficiencyMetricsSchema,

  // Health monitoring overview
  healthMonitoring: HealthMonitoringMetricsSchema,

  // System recommendations
  recommendations: z.array(z.string()),
});

// ============================================================================
// Type Exports
// ============================================================================

export type AgentCacheConfig = z.infer<typeof AgentCacheConfigSchema>;
export type AgentCacheMetrics = z.infer<typeof AgentCacheMetricsSchema>;
export type BaseAgentResponse = z.infer<typeof BaseAgentResponseSchema>;
export type CacheMetadata = z.infer<typeof CacheMetadataSchema>;
export type CachedAgentResponse = z.infer<typeof CachedAgentResponseSchema>;
export type WorkflowMetadata = z.infer<typeof WorkflowMetadataSchema>;
export type WorkflowCacheEntry = z.infer<typeof WorkflowCacheEntrySchema>;
export type AgentHealthMetadata = z.infer<typeof AgentHealthMetadataSchema>;
export type AgentHealthCache = z.infer<typeof AgentHealthCacheSchema>;
export type AgentPerformanceMetrics = z.infer<
  typeof AgentPerformanceMetricsSchema
>;
export type WorkflowEfficiencyMetrics = z.infer<
  typeof WorkflowEfficiencyMetricsSchema
>;
export type HealthMonitoringMetrics = z.infer<
  typeof HealthMonitoringMetricsSchema
>;
export type AgentCacheAnalytics = z.infer<typeof AgentCacheAnalyticsSchema>;

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate agent cache configuration
 */
export function validateAgentCacheConfig(data: unknown): AgentCacheConfig {
  return AgentCacheConfigSchema.parse(data);
}

/**
 * Validate agent cache metrics
 */
export function validateAgentCacheMetrics(data: unknown): AgentCacheMetrics {
  return AgentCacheMetricsSchema.parse(data);
}

/**
 * Validate cached agent response
 */
export function validateCachedAgentResponse(
  data: unknown
): CachedAgentResponse {
  return CachedAgentResponseSchema.parse(data);
}

/**
 * Validate workflow cache entry
 */
export function validateWorkflowCacheEntry(data: unknown): WorkflowCacheEntry {
  return WorkflowCacheEntrySchema.parse(data);
}

/**
 * Validate agent health cache
 */
export function validateAgentHealthCache(data: unknown): AgentHealthCache {
  return AgentHealthCacheSchema.parse(data);
}

/**
 * Validate agent cache analytics
 */
export function validateAgentCacheAnalytics(
  data: unknown
): AgentCacheAnalytics {
  return AgentCacheAnalyticsSchema.parse(data);
}

// ============================================================================
// Schema Collections
// ============================================================================

/**
 * All available agent cache schemas for bulk operations
 */
export const ALL_AGENT_CACHE_SCHEMAS = {
  AgentCacheConfigSchema,
  AgentCacheMetricsSchema,
  BaseAgentResponseSchema,
  CacheMetadataSchema,
  CachedAgentResponseSchema,
  WorkflowMetadataSchema,
  WorkflowCacheEntrySchema,
  AgentHealthMetadataSchema,
  AgentHealthCacheSchema,
  AgentPerformanceMetricsSchema,
  WorkflowEfficiencyMetricsSchema,
  HealthMonitoringMetricsSchema,
  AgentCacheAnalyticsSchema,
} as const;

/**
 * Core agent cache schemas
 */
export const CORE_AGENT_CACHE_SCHEMAS = {
  AgentCacheConfigSchema,
  AgentCacheMetricsSchema,
  CachedAgentResponseSchema,
  AgentHealthCacheSchema,
} as const;

/**
 * Workflow-related schemas
 */
export const WORKFLOW_CACHE_SCHEMAS = {
  WorkflowCacheEntrySchema,
  WorkflowMetadataSchema,
  WorkflowEfficiencyMetricsSchema,
} as const;

/**
 * Analytics and monitoring schemas
 */
export const ANALYTICS_SCHEMAS = {
  AgentCacheAnalyticsSchema,
  AgentPerformanceMetricsSchema,
  HealthMonitoringMetricsSchema,
} as const;
