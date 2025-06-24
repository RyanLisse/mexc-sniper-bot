import { z } from "zod";

/**
 * Database Entity Validation Schemas
 * Comprehensive Zod validation for database entities and operations
 */

// ============================================================================
// User and Authentication Schemas
// ============================================================================

export const UserSchema = z.object({
  id: z.string(),
  kindeId: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  picture: z.string().url().optional(),
  apiCredentials: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// ============================================================================
// Trading Entity Schemas
// ============================================================================

export const SnipeTargetSchema = z.object({
  id: z.string(),
  userId: z.string(),
  vcoinId: z.string(),
  symbolName: z.string(),
  projectName: z.string(),
  launchTime: z.date(),
  discoveredAt: z.date(),
  confidence: z.number().min(0).max(100),
  positionSizeUsdt: z.number().positive(),
  executionPrice: z.number().positive().optional(),
  actualPositionSize: z.number().positive().optional(),
  actualExecutionTime: z.date().optional(),
  status: z.enum(["pending", "ready", "executed", "failed", "completed"]),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const TransactionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  snipeTargetId: z.string(),
  symbolName: z.string(),
  buyOrderId: z.string().optional(),
  sellOrderId: z.string().optional(),
  buyPrice: z.number().positive().optional(),
  sellPrice: z.number().positive().optional(),
  quantity: z.number().positive(),
  buyTotalCost: z.number().positive().optional(),
  sellTotalRevenue: z.number().positive().optional(),
  profitLoss: z.number().optional(),
  feesPaid: z.number().min(0).optional(),
  status: z.enum(["pending", "completed", "failed", "partial"]),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const ExecutionHistorySchema = z.object({
  id: z.string(),
  userId: z.string(),
  snipeTargetId: z.string().optional(),
  symbolName: z.string(),
  action: z.enum(["buy", "sell"]),
  exchangeOrderId: z.string().optional(),
  executedQuantity: z.number().positive(),
  executedPrice: z.number().positive(),
  totalCost: z.number().positive(),
  status: z.enum(["success", "failed", "pending"]),
  executedAt: z.date(),
  metadata: z.record(z.unknown()).optional(),
});

// ============================================================================
// Pattern Detection Schemas
// ============================================================================

export const PatternEmbeddingSchema = z.object({
  id: z.string(),
  vcoinId: z.string(),
  symbolName: z.string(),
  patternType: z.enum(["ready_state", "volume_surge", "momentum_shift", "unknown"]),
  confidence: z.number().min(0).max(100),
  embedding: z.array(z.number()),
  isActive: z.boolean(),
  truePositives: z.number().min(0),
  falsePositives: z.number().min(0),
  createdAt: z.date(),
  updatedAt: z.date(),
  metadata: z.record(z.unknown()).optional(),
});

// ============================================================================
// Portfolio and Position Schemas
// ============================================================================

export const PositionSnapshotSchema = z.object({
  id: z.string(),
  userId: z.string(),
  timestamp: z.date(),
  totalBalance: z.number().min(0),
  availableBalance: z.number().min(0),
  lockedBalance: z.number().min(0),
  totalPnL: z.number(),
  unrealizedPnL: z.number(),
  activePositions: z.number().min(0),
  metadata: z.record(z.unknown()).optional(),
});

// ============================================================================
// System and Monitoring Schemas
// ============================================================================

export const SystemHealthSchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  cpuUsage: z.number().min(0).max(100),
  memoryUsage: z.number().min(0).max(100),
  diskUsage: z.number().min(0).max(100),
  apiLatency: z.number().min(0),
  dbConnections: z.number().min(0),
  queueLength: z.number().min(0),
  errorRate: z.number().min(0).max(100),
  status: z.enum(["healthy", "warning", "critical"]),
});

export const AlertSchema = z.object({
  id: z.string(),
  type: z.enum(["error", "warning", "info", "critical"]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  title: z.string(),
  message: z.string(),
  source: z.string(),
  acknowledged: z.boolean(),
  resolvedAt: z.date().optional(),
  createdAt: z.date(),
  metadata: z.record(z.unknown()).optional(),
});

// ============================================================================
// Configuration Schemas
// ============================================================================

export const ConfigurationSchema = z.object({
  id: z.string(),
  key: z.string(),
  value: z.unknown(),
  category: z.enum(["trading", "safety", "monitoring", "system"]),
  description: z.string().optional(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// ============================================================================
// Cache and Performance Schemas
// ============================================================================

export const CacheEntrySchema = z.object({
  key: z.string(),
  value: z.unknown(),
  expiresAt: z.date().optional(),
  createdAt: z.date(),
  lastAccessed: z.date(),
  hitCount: z.number().min(0),
  category: z.string().optional(),
});

export const PerformanceMetricSchema = z.object({
  id: z.string(),
  operation: z.string(),
  duration: z.number().min(0),
  timestamp: z.date(),
  success: z.boolean(),
  errorMessage: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ============================================================================
// Insert Schemas (for database operations)
// ============================================================================

export const InsertSnipeTargetSchema = SnipeTargetSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const InsertTransactionSchema = TransactionSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const InsertExecutionHistorySchema = ExecutionHistorySchema.omit({
  id: true,
});

export const InsertPatternEmbeddingSchema = PatternEmbeddingSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const InsertPositionSnapshotSchema = PositionSnapshotSchema.omit({
  id: true,
});

export const InsertSystemHealthSchema = SystemHealthSchema.omit({
  id: true,
});

export const InsertAlertSchema = AlertSchema.omit({
  id: true,
  createdAt: true,
});

export const InsertConfigurationSchema = ConfigurationSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const InsertPerformanceMetricSchema = PerformanceMetricSchema.omit({
  id: true,
});

// ============================================================================
// Update Schemas (for partial updates)
// ============================================================================

export const UpdateSnipeTargetSchema = SnipeTargetSchema.partial().omit({
  id: true,
  createdAt: true,
});

export const UpdateTransactionSchema = TransactionSchema.partial().omit({
  id: true,
  createdAt: true,
});

export const UpdatePatternEmbeddingSchema = PatternEmbeddingSchema.partial().omit({
  id: true,
  createdAt: true,
});

export const UpdateConfigurationSchema = ConfigurationSchema.partial().omit({
  id: true,
  createdAt: true,
});

// ============================================================================
// Query Schemas (for database queries)
// ============================================================================

export const SnipeTargetQuerySchema = z.object({
  userId: z.string().optional(),
  status: z.enum(["pending", "ready", "executed", "failed", "completed"]).optional(),
  symbolName: z.string().optional(),
  minConfidence: z.number().min(0).max(100).optional(),
  limit: z.number().min(1).max(1000).default(50).optional(),
  offset: z.number().min(0).default(0).optional(),
});

export const TransactionQuerySchema = z.object({
  userId: z.string().optional(),
  status: z.enum(["pending", "completed", "failed", "partial"]).optional(),
  symbolName: z.string().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  limit: z.number().min(1).max(1000).default(50).optional(),
  offset: z.number().min(0).default(0).optional(),
});

export const AlertQuerySchema = z.object({
  type: z.enum(["error", "warning", "info", "critical"]).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  acknowledged: z.boolean().optional(),
  resolved: z.boolean().optional(),
  limit: z.number().min(1).max(1000).default(50).optional(),
  offset: z.number().min(0).default(0).optional(),
});

// ============================================================================
// Validation Helper Functions
// ============================================================================

export function validateDatabaseEntity<T extends z.ZodSchema>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");
      return { success: false, error: `Database validation failed: ${errorMessage}` };
    }
    return { success: false, error: "Unknown database validation error" };
  }
}

export function validateBatchInsert<T extends z.ZodSchema>(
  schema: T,
  data: unknown[]
): { success: true; data: z.infer<T>[] } | { success: false; error: string } {
  try {
    const results = data.map((item) => schema.parse(item));
    return { success: true, data: results };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");
      return { success: false, error: `Batch validation failed: ${errorMessage}` };
    }
    return { success: false, error: "Unknown batch validation error" };
  }
}

// ============================================================================
// Type Exports
// ============================================================================

export type User = z.infer<typeof UserSchema>;
export type SnipeTarget = z.infer<typeof SnipeTargetSchema>;
export type Transaction = z.infer<typeof TransactionSchema>;
export type ExecutionHistory = z.infer<typeof ExecutionHistorySchema>;
export type PatternEmbedding = z.infer<typeof PatternEmbeddingSchema>;
export type PositionSnapshot = z.infer<typeof PositionSnapshotSchema>;
export type SystemHealth = z.infer<typeof SystemHealthSchema>;
export type Alert = z.infer<typeof AlertSchema>;
export type Configuration = z.infer<typeof ConfigurationSchema>;
export type CacheEntry = z.infer<typeof CacheEntrySchema>;
export type PerformanceMetric = z.infer<typeof PerformanceMetricSchema>;

// Insert types
export type InsertSnipeTarget = z.infer<typeof InsertSnipeTargetSchema>;
export type InsertTransaction = z.infer<typeof InsertTransactionSchema>;
export type InsertExecutionHistory = z.infer<typeof InsertExecutionHistorySchema>;
export type InsertPatternEmbedding = z.infer<typeof InsertPatternEmbeddingSchema>;
export type InsertPositionSnapshot = z.infer<typeof InsertPositionSnapshotSchema>;
export type InsertSystemHealth = z.infer<typeof InsertSystemHealthSchema>;
export type InsertAlert = z.infer<typeof InsertAlertSchema>;
export type InsertConfiguration = z.infer<typeof InsertConfigurationSchema>;
export type InsertPerformanceMetric = z.infer<typeof InsertPerformanceMetricSchema>;

// Update types
export type UpdateSnipeTarget = z.infer<typeof UpdateSnipeTargetSchema>;
export type UpdateTransaction = z.infer<typeof UpdateTransactionSchema>;
export type UpdatePatternEmbedding = z.infer<typeof UpdatePatternEmbeddingSchema>;
export type UpdateConfiguration = z.infer<typeof UpdateConfigurationSchema>;

// Query types
export type SnipeTargetQuery = z.infer<typeof SnipeTargetQuerySchema>;
export type TransactionQuery = z.infer<typeof TransactionQuerySchema>;
export type AlertQuery = z.infer<typeof AlertQuerySchema>;
