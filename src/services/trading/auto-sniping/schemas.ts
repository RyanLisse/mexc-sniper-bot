/**
 * Auto-Sniping Schemas
 *
 * Validation schemas for auto-sniping functionality.
 */

// Re-export types
export type {
  AutoSnipeTarget,
  CoreTradingConfig,
  PerformanceMetrics,
  ServiceStatus,
  TradeParameters,
  TradeResult,
} from "../consolidated/core-trading.types";
// Re-export core trading schemas
export {
  AutoSnipeTargetSchema,
  CoreTradingConfigSchema,
  PerformanceMetricsSchema,
  ServiceStatusSchema,
  TradeParametersSchema,
  TradeResultSchema,
} from "../consolidated/core-trading.types";

// Additional auto-sniping specific schemas
import { z } from "zod";

export const AutoSnipingConfigSchema = z.object({
  enabled: z.boolean().default(false),
  maxPositionSize: z.number().min(0).max(1000).default(100),
  takeProfitPercentage: z.number().min(0).max(100).default(25),
  stopLossPercentage: z.number().min(0).max(100).default(15),
  patternConfidenceThreshold: z.number().min(0).max(100).default(75),
  maxConcurrentTrades: z.number().min(1).max(20).default(5),
  enableSafetyChecks: z.boolean().default(true),
  enablePatternDetection: z.boolean().default(true),
});

export type AutoSnipingConfig = z.infer<typeof AutoSnipingConfigSchema>;

export const AutoSnipingMetricsSchema = z.object({
  totalTargets: z.number().default(0),
  successfulSnipes: z.number().default(0),
  failedSnipes: z.number().default(0),
  averageConfidence: z.number().min(0).max(100).default(0),
  totalProfit: z.number().default(0),
  successRate: z.number().min(0).max(100).default(0),
  lastSnipeTime: z.date().optional(),
  activeTargets: z.number().default(0),
});

export type AutoSnipingMetrics = z.infer<typeof AutoSnipingMetricsSchema>;

// Validation functions for test compatibility
export function validateAutoSnipingConfig(config: unknown): AutoSnipingConfig {
  return AutoSnipingConfigSchema.parse(config);
}

export function validateExecutionPosition(position: unknown): any {
  // Simple validation for execution position - return the position if valid
  if (typeof position === "object" && position !== null) {
    return position;
  }
  throw new Error("Invalid execution position");
}

export function validateAutoSnipingMetrics(
  metrics: unknown
): metrics is AutoSnipingMetrics {
  try {
    AutoSnipingMetricsSchema.parse(metrics);
    return true;
  } catch {
    return false;
  }
}
