/**
 * Extracted Agent Registry Schemas
 * 
 * This file contains all agent registry-related Zod schemas extracted from the 
 * agent-registry.ts file as part of the TDD refactoring process.
 * 
 * Extracted schemas provide type safety and validation for agent coordination,
 * health monitoring, registry management, and recovery operations.
 */

import { z } from "zod";

// ============================================================================
// Agent Status and Health Schemas
// ============================================================================

/**
 * Agent Status Schema - Enumeration of possible agent states
 */
export const AgentStatusSchema = z.enum([
  "healthy",
  "degraded", 
  "unhealthy",
  "unknown",
  "recovering"
]);

/**
 * Health Trend Schema - Performance trend indicators
 */
export const HealthTrendSchema = z.enum([
  "improving",
  "degrading",
  "stable"
]);

/**
 * Health Threshold Pair Schema - Warning and critical thresholds
 */
export const HealthThresholdPairSchema = z.object({
  warning: z.number().min(0),
  critical: z.number().min(0),
});

/**
 * Health Thresholds Schema - Complete threshold configuration
 */
export const HealthThresholdsSchema = z.object({
  // Response time thresholds (milliseconds)
  responseTime: HealthThresholdPairSchema,
  
  // Error rate thresholds (0-1 scale)
  errorRate: z.object({
    warning: z.number().min(0).max(1),
    critical: z.number().min(0).max(1),
  }),
  
  // Consecutive error count thresholds
  consecutiveErrors: z.object({
    warning: z.number().positive().int(),
    critical: z.number().positive().int(),
  }),
  
  // Uptime percentage thresholds (0-100 scale)
  uptime: z.object({
    warning: z.number().min(0).max(100),
    critical: z.number().min(0).max(100),
  }),
  
  // Memory usage thresholds (MB)
  memoryUsage: HealthThresholdPairSchema,
  
  // CPU usage percentage thresholds (0-100 scale)
  cpuUsage: z.object({
    warning: z.number().min(0).max(100),
    critical: z.number().min(0).max(100),
  }),
});

/**
 * Agent Load Schema - Current load metrics
 */
export const AgentLoadSchema = z.object({
  current: z.number().min(0),
  peak: z.number().min(0),
  average: z.number().min(0),
});

/**
 * Agent Health Trends Schema - Performance trend tracking
 */
export const AgentHealthTrendsSchema = z.object({
  responseTime: HealthTrendSchema,
  errorRate: HealthTrendSchema,
  throughput: HealthTrendSchema,
});

/**
 * Agent Health Schema - Comprehensive health information
 */
export const AgentHealthSchema = z.object({
  // Core health status
  status: AgentStatusSchema,
  lastChecked: z.date(),
  lastResponse: z.date().nullable(),
  
  // Performance metrics
  responseTime: z.number().min(0),
  errorCount: z.number().min(0).int(),
  errorRate: z.number().min(0).max(1),
  consecutiveErrors: z.number().min(0).int(),
  uptime: z.number().min(0).max(100), // percentage
  
  // Optional error information
  lastError: z.string().optional(),
  
  // Agent capabilities and load
  capabilities: z.array(z.string()),
  load: AgentLoadSchema,
  
  // Resource usage metrics
  memoryUsage: z.number().min(0), // MB
  cpuUsage: z.number().min(0).max(100), // percentage
  cacheHitRate: z.number().min(0).max(100), // percentage
  
  // Request tracking
  requestCount: z.number().min(0).int(),
  successCount: z.number().min(0).int(),
  
  // Recovery tracking
  lastRecoveryAttempt: z.date().optional(),
  recoveryAttempts: z.number().min(0).int(),
  
  // Composite health score (0-100)
  healthScore: z.number().min(0).max(100),
  
  // Performance trends
  trends: AgentHealthTrendsSchema,
});

// ============================================================================
// Registered Agent Schema
// ============================================================================

/**
 * Registered Agent Schema - Complete agent registration information
 */
export const RegisteredAgentSchema = z.object({
  // Core identification
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  
  // Agent instance (allowing any object for BaseAgent)
  instance: z.unknown(), // BaseAgent instance
  
  // Health monitoring
  health: AgentHealthSchema,
  
  // Registration metadata
  registeredAt: z.date(),
  
  // Configuration
  dependencies: z.array(z.string()),
  priority: z.number().min(1).int(),
  tags: z.array(z.string()),
  thresholds: HealthThresholdsSchema,
  autoRecovery: z.boolean(),
});

// ============================================================================
// Health Check Result Schema
// ============================================================================

/**
 * Health Check Result Schema - Results of agent health check operations
 */
export const HealthCheckResultSchema = z.object({
  // Core result information
  success: z.boolean(),
  responseTime: z.number().min(0),
  timestamp: z.date(),
  
  // Optional error information
  error: z.string().optional(),
  
  // Optional metadata
  metadata: z.record(z.unknown()).optional(),
  
  // Enhanced metrics (optional)
  memoryUsage: z.number().min(0).optional(),
  cpuUsage: z.number().min(0).max(100).optional(),
  cacheHitRate: z.number().min(0).max(100).optional(),
  requestCount: z.number().min(0).int().optional(),
  healthScore: z.number().min(0).max(100).optional(),
});

// ============================================================================
// Agent Registry Statistics Schema
// ============================================================================

/**
 * Agent Registry Statistics Schema - Registry-wide metrics and statistics
 */
export const AgentRegistryStatsSchema = z.object({
  // Agent count by status
  totalAgents: z.number().min(0).int(),
  healthyAgents: z.number().min(0).int(),
  degradedAgents: z.number().min(0).int(),
  unhealthyAgents: z.number().min(0).int(),
  unknownAgents: z.number().min(0).int(),
  
  // Performance metrics
  averageResponseTime: z.number().min(0),
  
  // Health check statistics
  totalHealthChecks: z.number().min(0).int(),
  lastFullHealthCheck: z.date().nullable(),
});

// ============================================================================
// Agent Registry Configuration Schema
// ============================================================================

/**
 * Alert Thresholds Schema - System-wide alert configuration
 */
export const AlertThresholdsSchema = z.object({
  unhealthyAgentPercentage: z.number().min(0).max(100), // percentage
  systemResponseTime: z.number().min(0), // milliseconds
  systemErrorRate: z.number().min(0).max(1), // 0-1 scale
});

/**
 * Agent Registry Options Schema - Registry configuration options
 */
export const AgentRegistryOptionsSchema = z.object({
  // Timing configurations
  healthCheckInterval: z.number().positive().optional(),
  maxHealthHistorySize: z.number().positive().int().optional(),
  
  // Default settings
  defaultThresholds: HealthThresholdsSchema.optional(),
  autoRecoveryEnabled: z.boolean().optional(),
  
  // Alert configurations
  alertThresholds: AlertThresholdsSchema.optional(),
});

// ============================================================================
// System Alert Schema
// ============================================================================

/**
 * System Alert Schema - System-wide alerts and notifications
 */
export const SystemAlertSchema = z.object({
  type: z.enum(["warning", "critical"]),
  message: z.string().min(1),
  timestamp: z.date(),
});

// ============================================================================
// Agent Recovery Result Schema
// ============================================================================

/**
 * Agent Recovery Result Schema - Results of agent recovery operations
 */
export const AgentRecoveryResultSchema = z.object({
  // Recovery outcome
  success: z.boolean(),
  agentId: z.string().min(1),
  strategy: z.string().min(1),
  
  // Timing information
  timestamp: z.date(),
  duration: z.number().min(0), // milliseconds
  
  // Status transition
  previousStatus: AgentStatusSchema,
  newStatus: AgentStatusSchema,
  
  // Recovery tracking
  recoveryAttempt: z.number().positive().int(),
  
  // Optional error information
  error: z.string().optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type AgentStatus = z.infer<typeof AgentStatusSchema>;
export type HealthTrend = z.infer<typeof HealthTrendSchema>;
export type HealthThresholdPair = z.infer<typeof HealthThresholdPairSchema>;
export type HealthThresholds = z.infer<typeof HealthThresholdsSchema>;
export type AgentLoad = z.infer<typeof AgentLoadSchema>;
export type AgentHealthTrends = z.infer<typeof AgentHealthTrendsSchema>;
export type AgentHealth = z.infer<typeof AgentHealthSchema>;
export type RegisteredAgent = z.infer<typeof RegisteredAgentSchema>;
export type HealthCheckResult = z.infer<typeof HealthCheckResultSchema>;
export type AgentRegistryStats = z.infer<typeof AgentRegistryStatsSchema>;
export type AlertThresholds = z.infer<typeof AlertThresholdsSchema>;
export type AgentRegistryOptions = z.infer<typeof AgentRegistryOptionsSchema>;
export type SystemAlert = z.infer<typeof SystemAlertSchema>;
export type AgentRecoveryResult = z.infer<typeof AgentRecoveryResultSchema>;

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate agent status
 */
export function validateAgentStatus(data: unknown): AgentStatus {
  return AgentStatusSchema.parse(data);
}

/**
 * Validate health thresholds
 */
export function validateHealthThresholds(data: unknown): HealthThresholds {
  return HealthThresholdsSchema.parse(data);
}

/**
 * Validate agent health
 */
export function validateAgentHealth(data: unknown): AgentHealth {
  return AgentHealthSchema.parse(data);
}

/**
 * Validate registered agent
 */
export function validateRegisteredAgent(data: unknown): RegisteredAgent {
  return RegisteredAgentSchema.parse(data);
}

/**
 * Validate health check result
 */
export function validateHealthCheckResult(data: unknown): HealthCheckResult {
  return HealthCheckResultSchema.parse(data);
}

/**
 * Validate agent registry statistics
 */
export function validateAgentRegistryStats(data: unknown): AgentRegistryStats {
  return AgentRegistryStatsSchema.parse(data);
}

/**
 * Validate agent registry options
 */
export function validateAgentRegistryOptions(data: unknown): AgentRegistryOptions {
  return AgentRegistryOptionsSchema.parse(data);
}

/**
 * Validate system alert
 */
export function validateSystemAlert(data: unknown): SystemAlert {
  return SystemAlertSchema.parse(data);
}

/**
 * Validate agent recovery result
 */
export function validateAgentRecoveryResult(data: unknown): AgentRecoveryResult {
  return AgentRecoveryResultSchema.parse(data);
}

// ============================================================================
// Schema Collections
// ============================================================================

/**
 * All available agent registry schemas for bulk operations
 */
export const ALL_AGENT_REGISTRY_SCHEMAS = {
  AgentStatusSchema,
  HealthTrendSchema,
  HealthThresholdPairSchema,
  HealthThresholdsSchema,
  AgentLoadSchema,
  AgentHealthTrendsSchema,
  AgentHealthSchema,
  RegisteredAgentSchema,
  HealthCheckResultSchema,
  AgentRegistryStatsSchema,
  AlertThresholdsSchema,
  AgentRegistryOptionsSchema,
  SystemAlertSchema,
  AgentRecoveryResultSchema,
} as const;

/**
 * Core agent schemas
 */
export const CORE_AGENT_SCHEMAS = {
  AgentStatusSchema,
  AgentHealthSchema,
  RegisteredAgentSchema,
  HealthCheckResultSchema,
} as const;

/**
 * Configuration and threshold schemas
 */
export const AGENT_CONFIG_SCHEMAS = {
  HealthThresholdsSchema,
  AgentRegistryOptionsSchema,
  AlertThresholdsSchema,
} as const;

/**
 * Monitoring and analytics schemas
 */
export const AGENT_MONITORING_SCHEMAS = {
  AgentHealthSchema,
  HealthCheckResultSchema,
  AgentRegistryStatsSchema,
  SystemAlertSchema,
} as const;

/**
 * Recovery and operation schemas
 */
export const AGENT_OPERATION_SCHEMAS = {
  AgentRecoveryResultSchema,
  SystemAlertSchema,
  HealthCheckResultSchema,
} as const;