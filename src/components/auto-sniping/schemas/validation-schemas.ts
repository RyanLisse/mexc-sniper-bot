/**
 * Zod Validation Schemas for Auto-Sniping Components
 *
 * Type-safe validation schemas for component props and form data
 */

import { z } from "zod";

// Base execution status schema
export const executionStatusSchema = z.enum([
  "idle",
  "running",
  "paused",
  "stopping",
  "error",
]);

// AutoSnipingConfig validation schema (matching the actual interface)
export const autoSnipingConfigSchema = z.object({
  enabled: z.boolean(),
  maxPositionSize: z.number().positive(),
  takeProfitPercentage: z.number().min(0.1).max(100),
  stopLossPercentage: z.number().min(0.1).max(100),
  patternConfidenceThreshold: z.number().min(50).max(100),
  maxConcurrentTrades: z.number().min(1).max(10),
  enableSafetyChecks: z.boolean(),
  enablePatternDetection: z.boolean(),
});

// Component props schemas
export const dashboardPropsSchema = z.object({
  className: z.string().optional(),
  autoRefresh: z.boolean().optional(),
  showControls: z.boolean().optional(),
});

export const executionControlsPropsSchema = z.object({
  isExecutionActive: z.boolean(),
  executionStatus: executionStatusSchema,
  isLoading: z.boolean(),
  isStartingExecution: z.boolean(),
  isPausingExecution: z.boolean(),
  isResumingExecution: z.boolean(),
  isStoppingExecution: z.boolean(),
  showControls: z.boolean().optional().default(true),
});

export const configEditorPropsSchema = z.object({
  configEditMode: z.boolean(),
  tempConfig: autoSnipingConfigSchema.partial(),
  isUpdatingConfig: z.boolean(),
});

// Form validation schemas (matching the actual AutoSnipingConfig)
export const configFormSchema = z.object({
  enabled: z.boolean(),
  maxPositionSize: z.coerce.number().positive("Must be greater than 0"),
  takeProfitPercentage: z.coerce
    .number()
    .min(0.1, "Minimum 0.1%")
    .max(100, "Cannot exceed 100%"),
  stopLossPercentage: z.coerce
    .number()
    .min(0.1, "Minimum 0.1%")
    .max(100, "Cannot exceed 100%"),
  patternConfidenceThreshold: z.coerce
    .number()
    .min(50, "Minimum 50%")
    .max(100, "Cannot exceed 100%"),
  maxConcurrentTrades: z.coerce
    .number()
    .min(1, "Must be at least 1")
    .max(10, "Cannot exceed 10"),
  enableSafetyChecks: z.boolean(),
  enablePatternDetection: z.boolean(),
});

// Alert severity schema
export const alertSeveritySchema = z.enum([
  "info",
  "warning",
  "error",
  "critical",
]);

// Execution alert schema
export const executionAlertSchema = z.object({
  id: z.string(),
  type: z.string(),
  severity: alertSeveritySchema,
  message: z.string(),
  timestamp: z.string().or(z.date()),
  symbol: z.string().optional(),
  acknowledged: z.boolean().default(false),
});

// Statistics schema
export const executionStatsSchema = z.object({
  totalTrades: z.number().optional(),
  successfulTrades: z.number().optional(),
  failedTrades: z.number().optional(),
  dailyTradeCount: z.number().optional(),
  averageExecutionTime: z.number().optional(),
  averageSlippage: z.number().optional(),
  maxDrawdown: z.number().optional(),
  averageTradeReturn: z.number().optional(),
});

// Position schema
export const executionPositionSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  side: z.enum(["BUY", "SELL"]),
  entryPrice: z.string().or(z.number()),
  currentPrice: z.string().or(z.number()),
  quantity: z.string().or(z.number()),
  entryTime: z.string().or(z.date()),
  status: z.string(),
  pnl: z.string().or(z.number()).optional(),
  stopLossPrice: z.string().or(z.number()).optional(),
  takeProfitPrice: z.string().or(z.number()).optional(),
  patternMatch: z.object({
    patternType: z.string(),
    confidence: z.number(),
  }),
});

// Export type definitions
export type ExecutionStatus = z.infer<typeof executionStatusSchema>;
export type AutoSnipingConfigForm = z.infer<typeof configFormSchema>;
export type ExecutionAlert = z.infer<typeof executionAlertSchema>;
export type ExecutionStats = z.infer<typeof executionStatsSchema>;
export type ExecutionPosition = z.infer<typeof executionPositionSchema>;
export type DashboardProps = z.infer<typeof dashboardPropsSchema>;
export type ExecutionControlsProps = z.infer<
  typeof executionControlsPropsSchema
>;
export type ConfigEditorProps = z.infer<typeof configEditorPropsSchema>;
