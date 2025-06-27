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
  currentDrawdown: z.number().finite().min(0).default(0),
  maxDrawdown: z.number().finite().min(0).default(0),
  portfolioValue: z.number().finite().min(0).default(10000),
  totalExposure: z.number().finite().min(0).default(0),
  concentrationRisk: z.number().finite().min(0).max(100).default(0),

  // Performance risk
  successRate: z.number().finite().min(0).max(100).default(0),
  consecutiveLosses: z.number().int().min(0).default(0),
  averageSlippage: z.number().finite().min(0).default(0),

  // System risk
  apiLatency: z.number().finite().min(0).default(0),
  apiSuccessRate: z.number().finite().min(0).max(100).default(100),
  memoryUsage: z.number().finite().min(0).max(100).default(0),

  // Pattern risk
  patternAccuracy: z.number().finite().min(0).max(100).default(0),
  detectionFailures: z.number().int().min(0).default(0),
  falsePositiveRate: z.number().finite().min(0).max(100).default(0),
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
    "emergency_coordination",
    "limit_exposure",
    "notify_admin",
    "circuit_breaker",
  ]),
  description: z.string().min(1),
  executed: z.boolean(),
  executedAt: z.string().optional(),
  result: z.enum(["success", "failed", "partial"]).optional(),
  details: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
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
  // First, sanitize any NaN values before validation
  const sanitizedData = sanitizeRiskMetricsData(data);
  return RiskMetricsSchema.parse(sanitizedData);
}

/**
 * Sanitize risk metrics data to convert NaN and invalid values to safe defaults
 */
function sanitizeRiskMetricsData(data: unknown): any {
  if (!data || typeof data !== 'object') {
    return {};
  }

  const sanitized = { ...data as any };
  
  // List of numeric fields that should be sanitized
  const numericFields = [
    'currentDrawdown', 'maxDrawdown', 'portfolioValue', 'totalExposure', 
    'concentrationRisk', 'successRate', 'consecutiveLosses', 'averageSlippage',
    'apiLatency', 'apiSuccessRate', 'memoryUsage', 'patternAccuracy', 
    'detectionFailures', 'falsePositiveRate'
  ];

  // Sanitize each numeric field
  for (const field of numericFields) {
    if (field in sanitized) {
      const value = sanitized[field];
      
      // Convert NaN, Infinity, or non-numeric values to appropriate defaults
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        sanitized[field] = getDefaultValueForField(field);
      }
      // Ensure values are within reasonable bounds
      else if (value < 0) {
        sanitized[field] = 0;
      }
      // Special handling for percentage fields
      else if (['concentrationRisk', 'successRate', 'apiSuccessRate', 'memoryUsage', 'patternAccuracy', 'falsePositiveRate'].includes(field) && value > 100) {
        sanitized[field] = 100;
      }
    }
  }

  return sanitized;
}

/**
 * Get default value for a specific risk metrics field
 */
function getDefaultValueForField(field: string): number {
  const defaults: Record<string, number> = {
    currentDrawdown: 0,
    maxDrawdown: 0,
    portfolioValue: 10000,
    totalExposure: 0,
    concentrationRisk: 0,
    successRate: 0,
    consecutiveLosses: 0,
    averageSlippage: 0,
    apiLatency: 0,
    apiSuccessRate: 100,
    memoryUsage: 0,
    patternAccuracy: 0,
    detectionFailures: 0,
    falsePositiveRate: 0,
  };
  
  return defaults[field] ?? 0;
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
