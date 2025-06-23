/**
 * Safety Monitoring Schemas
 *
 * Comprehensive Zod validation schemas for the Real-time Safety Monitoring Service.
 * Provides type safety and runtime validation for all safety monitoring data structures.
 *
 * Schemas cover:
 * - Safety thresholds and configuration
 * - Risk metrics and assessments
 * - Safety alerts and actions
 * - Monitoring reports and statistics
 */

import { z } from "zod";

// ============================================================================
// Safety Thresholds Schema
// ============================================================================

export const SafetyThresholdsSchema = z.object({
  // Risk thresholds (percentage values)
  maxDrawdownPercentage: z.number().min(0).max(100),
  maxDailyLossPercentage: z.number().min(0).max(100),
  maxPositionRiskPercentage: z.number().min(0).max(100),
  maxPortfolioConcentration: z.number().min(0).max(100),

  // Performance thresholds
  minSuccessRatePercentage: z.number().min(0).max(100),
  maxConsecutiveLosses: z.number().int().min(0),
  maxSlippagePercentage: z.number().min(0).max(100),

  // System thresholds
  maxApiLatencyMs: z.number().positive(),
  minApiSuccessRate: z.number().min(0).max(100),
  maxMemoryUsagePercentage: z.number().min(0).max(100),

  // Pattern thresholds
  minPatternConfidence: z.number().min(0).max(100),
  maxPatternDetectionFailures: z.number().int().min(0),
});

// ============================================================================
// Risk Metrics Schema
// ============================================================================

export const RiskMetricsSchema = z.object({
  // Portfolio risk
  currentDrawdown: z.number().min(0),
  maxDrawdown: z.number().min(0),
  portfolioValue: z.number().min(0),
  totalExposure: z.number().min(0),
  concentrationRisk: z.number().min(0).max(100),

  // Performance risk
  successRate: z.number().min(0).max(100),
  consecutiveLosses: z.number().int().min(0),
  averageSlippage: z.number().min(0),

  // System risk
  apiLatency: z.number().min(0),
  apiSuccessRate: z.number().min(0).max(100),
  memoryUsage: z.number().min(0).max(100),

  // Pattern risk
  patternAccuracy: z.number().min(0).max(100),
  detectionFailures: z.number().int().min(0),
  falsePositiveRate: z.number().min(0).max(100),
});

// ============================================================================
// Safety Action Schema
// ============================================================================

export const SafetyActionSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "halt_trading",
    "reduce_positions",
    "emergency_close",
    "limit_exposure",
    "notify_admin",
    "circuit_breaker",
  ]),
  description: z.string().min(1),
  executed: z.boolean(),
  executedAt: z.string().optional(),
  result: z.enum(["success", "failed", "partial"]).optional(),
  details: z.string().optional(),
});

// ============================================================================
// Safety Alert Schema
// ============================================================================

export const SafetyAlertSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "risk_threshold",
    "system_failure",
    "performance_degradation",
    "emergency_condition",
    "safety_violation",
  ]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  category: z.enum(["portfolio", "system", "performance", "pattern", "api"]),
  title: z.string().min(1),
  message: z.string().min(1),
  timestamp: z.string(),
  acknowledged: z.boolean(),
  autoActions: z.array(SafetyActionSchema),
  riskLevel: z.number().min(0).max(100),
  source: z.string().min(1),
  metadata: z.record(z.unknown()),
});

// ============================================================================
// System Health Schema
// ============================================================================

export const SystemHealthSchema = z.object({
  executionService: z.boolean(),
  patternMonitoring: z.boolean(),
  emergencySystem: z.boolean(),
  mexcConnectivity: z.boolean(),
  overallHealth: z.number().min(0).max(100),
});

// ============================================================================
// Monitoring Statistics Schema
// ============================================================================

export const MonitoringStatsSchema = z.object({
  alertsGenerated: z.number().int().min(0),
  actionsExecuted: z.number().int().min(0),
  riskEventsDetected: z.number().int().min(0),
  systemUptime: z.number().min(0),
  lastRiskCheck: z.string(),
  monitoringFrequency: z.number().positive(),
});

// ============================================================================
// Safety Configuration Schema
// ============================================================================

export const SafetyConfigurationSchema = z.object({
  enabled: z.boolean(),
  monitoringIntervalMs: z.number().positive(),
  riskCheckIntervalMs: z.number().positive(),
  autoActionEnabled: z.boolean(),
  emergencyMode: z.boolean(),
  alertRetentionHours: z.number().positive(),
  thresholds: SafetyThresholdsSchema,
});

// ============================================================================
// Safety Monitoring Report Schema
// ============================================================================

export const SafetyMonitoringReportSchema = z.object({
  status: z.enum(["safe", "warning", "critical", "emergency"]),
  overallRiskScore: z.number().min(0).max(100),
  riskMetrics: RiskMetricsSchema,
  thresholds: SafetyThresholdsSchema,
  activeAlerts: z.array(SafetyAlertSchema),
  recentActions: z.array(SafetyActionSchema),
  systemHealth: SystemHealthSchema,
  recommendations: z.array(z.string()),
  monitoringStats: MonitoringStatsSchema,
  lastUpdated: z.string(),
});

// ============================================================================
// Scheduled Operation Schema
// ============================================================================

export const ScheduledOperationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  intervalMs: z.number().positive(),
  lastExecuted: z.number().min(0),
  isRunning: z.boolean(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type SafetyThresholds = z.infer<typeof SafetyThresholdsSchema>;
export type RiskMetrics = z.infer<typeof RiskMetricsSchema>;
export type SafetyAction = z.infer<typeof SafetyActionSchema>;
export type SafetyAlert = z.infer<typeof SafetyAlertSchema>;
export type SystemHealth = z.infer<typeof SystemHealthSchema>;
export type MonitoringStats = z.infer<typeof MonitoringStatsSchema>;
export type SafetyConfiguration = z.infer<typeof SafetyConfigurationSchema>;
export type SafetyMonitoringReport = z.infer<typeof SafetyMonitoringReportSchema>;
export type ScheduledOperation = z.infer<typeof ScheduledOperationSchema>;

// ============================================================================
// Validation Functions
// ============================================================================

export function validateSafetyThresholds(data: unknown): SafetyThresholds {
  return SafetyThresholdsSchema.parse(data);
}

export function validateRiskMetrics(data: unknown): RiskMetrics {
  return RiskMetricsSchema.parse(data);
}

export function validateSafetyAction(data: unknown): SafetyAction {
  return SafetyActionSchema.parse(data);
}

export function validateSafetyAlert(data: unknown): SafetyAlert {
  return SafetyAlertSchema.parse(data);
}

export function validateSystemHealth(data: unknown): SystemHealth {
  return SystemHealthSchema.parse(data);
}

export function validateSafetyConfiguration(data: unknown): SafetyConfiguration {
  return SafetyConfigurationSchema.parse(data);
}

export function validateSafetyMonitoringReport(data: unknown): SafetyMonitoringReport {
  return SafetyMonitoringReportSchema.parse(data);
}

export function validateScheduledOperation(data: unknown): ScheduledOperation {
  return ScheduledOperationSchema.parse(data);
}

// ============================================================================
// Schema Collections
// ============================================================================

export const ALL_SAFETY_SCHEMAS = {
  SafetyThresholdsSchema,
  RiskMetricsSchema,
  SafetyActionSchema,
  SafetyAlertSchema,
  SystemHealthSchema,
  MonitoringStatsSchema,
  SafetyConfigurationSchema,
  SafetyMonitoringReportSchema,
  ScheduledOperationSchema,
} as const;

export const SAFETY_VALIDATION_FUNCTIONS = {
  validateSafetyThresholds,
  validateRiskMetrics,
  validateSafetyAction,
  validateSafetyAlert,
  validateSystemHealth,
  validateSafetyConfiguration,
  validateSafetyMonitoringReport,
  validateScheduledOperation,
} as const;
