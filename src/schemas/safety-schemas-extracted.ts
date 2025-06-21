/**
 * Extracted Safety Schemas
 *
 * This file contains all safety-related Zod schemas extracted from the
 * comprehensive-safety-coordinator.ts file as part of the TDD refactoring process.
 *
 * Extracted schemas provide type safety and validation for safety system
 * configurations, status monitoring, alerts, actions, and metrics.
 */

import { z } from "zod";

// ============================================================================
// Safety Configuration Schemas
// ============================================================================

/**
 * Safety Coordinator Configuration Schema
 */
export const SafetyCoordinatorConfigSchema = z.object({
  // Monitoring intervals (must be positive)
  agentMonitoringInterval: z.number().positive(),
  riskAssessmentInterval: z.number().positive(),
  systemHealthCheckInterval: z.number().positive(),

  // Safety thresholds (0-100 range for scores)
  criticalViolationThreshold: z.number().min(0),
  riskScoreThreshold: z.number().min(0).max(100),
  agentAnomalyThreshold: z.number().min(0).max(100),

  // Emergency protocols
  autoEmergencyShutdown: z.boolean(),
  emergencyContactEnabled: z.boolean(),
  safetyOverrideRequired: z.boolean(),

  // Integration settings
  websocketEnabled: z.boolean(),
  realTimeAlertsEnabled: z.boolean(),
  consensusEnforcementEnabled: z.boolean(),

  // Operational limits (optional)
  maxConcurrentPositions: z.number().positive().optional(),
});

// ============================================================================
// Safety Status Schemas
// ============================================================================

/**
 * Comprehensive Safety Status Schema
 */
export const ComprehensiveSafetyStatusSchema = z.object({
  overall: z.object({
    safetyLevel: z.enum(["safe", "warning", "critical", "emergency"]),
    safetyScore: z.number().min(0).max(100),
    lastUpdate: z.string(),
    systemStatus: z.enum(["operational", "degraded", "critical", "emergency"]),
  }),

  agents: z.object({
    totalMonitored: z.number().min(0),
    healthyCount: z.number().min(0),
    degradedCount: z.number().min(0),
    criticalCount: z.number().min(0),
    offlineCount: z.number().min(0),
    averagePerformance: z.number().min(0).max(100),
    recentViolations: z.number().min(0),
  }),

  risk: z.object({
    overallRiskScore: z.number().min(0).max(100),
    portfolioValue: z.number().min(0),
    exposureLevel: z.number().min(0).max(1),
    valueAtRisk: z.number().min(0),
    activeAlerts: z.number().min(0),
    riskTrend: z.enum(["improving", "stable", "deteriorating"]),
  }),

  emergency: z.object({
    systemActive: z.boolean(),
    activeIncidents: z.number().min(0),
    tradingHalted: z.boolean(),
    lastEmergencyAction: z.string().nullable(),
    emergencyLevel: z.enum(["none", "low", "medium", "high", "critical"]),
  }),

  consensus: z.object({
    pendingRequests: z.number().min(0),
    recentDecisions: z.number().min(0),
    averageApprovalRate: z.number().min(0).max(100),
    consensusEfficiency: z.number().min(0).max(100),
  }),

  realTime: z.object({
    websocketConnected: z.boolean(),
    activeSubscriptions: z.number().min(0),
    messageRate: z.number().min(0),
    alertsInLast5Min: z.number().min(0),
  }),
});

// ============================================================================
// Safety Alert and Action Schemas
// ============================================================================

/**
 * Safety Alert Schema
 */
export const SafetyAlertSchema = z.object({
  id: z.string(),
  type: z.enum([
    "agent_anomaly",
    "risk_breach",
    "emergency_condition",
    "consensus_failure",
    "system_degradation",
  ]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  title: z.string(),
  message: z.string(),
  source: z.string(),
  timestamp: z.string(),
  acknowledged: z.boolean(),
  resolved: z.boolean(),
  actions: z.array(z.string()),
  metadata: z.record(z.unknown()),
});

/**
 * Safety Action Schema
 */
export const SafetyActionSchema = z.object({
  id: z.string(),
  type: z.enum(["alert", "restrict", "shutdown", "emergency_halt", "consensus_override"]),
  target: z.string(),
  reason: z.string(),
  executedAt: z.string(),
  executedBy: z.string(),
  success: z.boolean(),
  impact: z.string(),
});

// ============================================================================
// Safety Metrics Schemas
// ============================================================================

/**
 * Safety Metrics Schema
 */
export const SafetyMetricsSchema = z.object({
  agentMetrics: z.object({
    averageResponseTime: z.number().min(0),
    averageSuccessRate: z.number().min(0).max(100),
    averageConfidenceScore: z.number().min(0).max(100),
    anomalyRate: z.number().min(0).max(100),
    violationRate: z.number().min(0).max(100),
  }),

  riskMetrics: z.object({
    averageRiskScore: z.number().min(0).max(100),
    riskTrend: z.number(), // can be positive or negative
    breachFrequency: z.number().min(0), // rate, can be decimal
    recoveryTime: z.number().min(0),
  }),

  emergencyMetrics: z.object({
    incidentCount: z.number().min(0),
    responseTime: z.number().min(0),
    resolutionTime: z.number().min(0),
    falsePositiveRate: z.number().min(0).max(100),
  }),

  consensusMetrics: z.object({
    averageProcessingTime: z.number().min(0),
    approvalRate: z.number().min(0).max(100),
    timeoutRate: z.number().min(0).max(100),
    consensusEffectiveness: z.number().min(0).max(100),
  }),

  systemMetrics: z.object({
    uptime: z.number().min(0).max(100),
    availability: z.number().min(0).max(100),
    reliability: z.number().min(0).max(100),
    performanceScore: z.number().min(0).max(100),
  }),
});

// ============================================================================
// Type Exports
// ============================================================================

export type SafetyCoordinatorConfig = z.infer<typeof SafetyCoordinatorConfigSchema>;
export type ComprehensiveSafetyStatus = z.infer<typeof ComprehensiveSafetyStatusSchema>;
export type SafetyAlert = z.infer<typeof SafetyAlertSchema>;
export type SafetyAction = z.infer<typeof SafetyActionSchema>;
export type SafetyMetrics = z.infer<typeof SafetyMetricsSchema>;

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate safety coordinator configuration
 */
export function validateSafetyCoordinatorConfig(data: unknown): SafetyCoordinatorConfig {
  return SafetyCoordinatorConfigSchema.parse(data);
}

/**
 * Validate comprehensive safety status
 */
export function validateComprehensiveSafetyStatus(data: unknown): ComprehensiveSafetyStatus {
  return ComprehensiveSafetyStatusSchema.parse(data);
}

/**
 * Validate safety alert
 */
export function validateSafetyAlert(data: unknown): SafetyAlert {
  return SafetyAlertSchema.parse(data);
}

/**
 * Validate safety action
 */
export function validateSafetyAction(data: unknown): SafetyAction {
  return SafetyActionSchema.parse(data);
}

/**
 * Validate safety metrics
 */
export function validateSafetyMetrics(data: unknown): SafetyMetrics {
  return SafetyMetricsSchema.parse(data);
}

// ============================================================================
// Schema Collections
// ============================================================================

/**
 * All available safety schemas for bulk operations
 */
export const ALL_SAFETY_SCHEMAS = {
  SafetyCoordinatorConfigSchema,
  ComprehensiveSafetyStatusSchema,
  SafetyAlertSchema,
  SafetyActionSchema,
  SafetyMetricsSchema,
} as const;

/**
 * Core safety operation schemas
 */
export const CORE_SAFETY_SCHEMAS = {
  SafetyCoordinatorConfigSchema,
  ComprehensiveSafetyStatusSchema,
  SafetyAlertSchema,
  SafetyActionSchema,
} as const;

/**
 * Safety monitoring schemas
 */
export const MONITORING_SCHEMAS = {
  ComprehensiveSafetyStatusSchema,
  SafetyMetricsSchema,
  SafetyAlertSchema,
} as const;
