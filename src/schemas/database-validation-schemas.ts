import { z } from "zod";

/**
 * Optimized Database Validation Schemas
 * Consolidated Zod validation for auto-sniping database operations
 */

// ============================================================================
// Base Validation Primitives
// ============================================================================

// Shared base schemas for reusability
const BaseEntitySchema = z.object({
  id: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const UserReferenceSchema = z.object({
  userId: z.string().min(1),
});

const TimestampSchema = z.object({
  timestamp: z.date().default(() => new Date()),
});

const MetadataSchema = z.record(z.unknown()).optional();

// Status enums for consistency
const TargetStatusEnum = z.enum(["pending", "ready", "executed", "failed", "completed"]);
const TransactionStatusEnum = z.enum(["pending", "completed", "failed", "partial"]);
const ExecutionStatusEnum = z.enum(["success", "failed", "pending"]);
const PatternTypeEnum = z.enum(["ready_state", "volume_surge", "momentum_shift", "unknown"]);
const AlertSeverityEnum = z.enum(["low", "medium", "high", "critical"]);
const SystemStatusEnum = z.enum(["healthy", "warning", "critical"]);

// ============================================================================
// User and Authentication Schemas
// ============================================================================

export const UserSchema = BaseEntitySchema.extend({
  kindeId: z.string().min(1),
  email: z.string().email(),
  name: z.string().optional(),
  picture: z.string().url().optional(),
  apiCredentials: MetadataSchema,
});

// ============================================================================
// Trading Entity Schemas
// ============================================================================

export const SnipeTargetSchema = BaseEntitySchema.merge(UserReferenceSchema).extend({
  vcoinId: z.string().min(1),
  symbolName: z.string().min(1),
  projectName: z.string().min(1),
  launchTime: z.date(),
  discoveredAt: z.date().default(() => new Date()),
  confidence: z.number().min(0).max(100).default(0),
  positionSizeUsdt: z.number().positive(),
  executionPrice: z.number().positive().optional(),
  actualPositionSize: z.number().positive().optional(),
  actualExecutionTime: z.date().optional(),
  status: TargetStatusEnum.default("pending"),
  metadata: MetadataSchema,
});

export const TransactionSchema = BaseEntitySchema.merge(UserReferenceSchema).extend({
  snipeTargetId: z.string().min(1),
  symbolName: z.string().min(1),
  buyOrderId: z.string().optional(),
  sellOrderId: z.string().optional(),
  buyPrice: z.number().positive().optional(),
  sellPrice: z.number().positive().optional(),
  quantity: z.number().positive(),
  buyTotalCost: z.number().positive().optional(),
  sellTotalRevenue: z.number().positive().optional(),
  profitLoss: z.number().optional(),
  feesPaid: z.number().min(0).default(0),
  status: TransactionStatusEnum.default("pending"),
});

export const ExecutionHistorySchema = BaseEntitySchema.merge(UserReferenceSchema).extend({
  snipeTargetId: z.string().optional(),
  symbolName: z.string().min(1),
  action: z.enum(["buy", "sell"]),
  exchangeOrderId: z.string().optional(),
  executedQuantity: z.number().positive(),
  executedPrice: z.number().positive(),
  totalCost: z.number().positive(),
  status: ExecutionStatusEnum.default("pending"),
  executedAt: z.date().default(() => new Date()),
  metadata: MetadataSchema,
});

// ============================================================================
// Pattern Detection Schemas (Optimized for Auto-Sniping)
// ============================================================================

export const PatternEmbeddingSchema = BaseEntitySchema.extend({
  vcoinId: z.string().min(1),
  symbolName: z.string().min(1),
  patternType: PatternTypeEnum.default("unknown"),
  confidence: z.number().min(0).max(100).default(0),
  embedding: z.array(z.number()).min(1).max(1536), // OpenAI embedding size limit
  isActive: z.boolean().default(true),
  truePositives: z.number().min(0).default(0),
  falsePositives: z.number().min(0).default(0),
  successRate: z.number().min(0).max(100).optional(),
  lastSeenAt: z.date().default(() => new Date()),
  metadata: MetadataSchema,
});

// ============================================================================
// Portfolio and Position Schemas
// ============================================================================

export const PositionSnapshotSchema = BaseEntitySchema.merge(UserReferenceSchema).merge(TimestampSchema).extend({
  totalBalance: z.number().min(0),
  availableBalance: z.number().min(0),
  lockedBalance: z.number().min(0),
  totalPnL: z.number().default(0),
  unrealizedPnL: z.number().default(0),
  activePositions: z.number().min(0).default(0),
  metadata: MetadataSchema,
});

// ============================================================================
// System and Monitoring Schemas
// ============================================================================

export const SystemHealthSchema = BaseEntitySchema.merge(TimestampSchema).extend({
  cpuUsage: z.number().min(0).max(100),
  memoryUsage: z.number().min(0).max(100),
  diskUsage: z.number().min(0).max(100),
  apiLatency: z.number().min(0),
  dbConnections: z.number().min(0),
  queueLength: z.number().min(0),
  errorRate: z.number().min(0).max(100),
  status: SystemStatusEnum.default("healthy"),
});

export const AlertSchema = BaseEntitySchema.extend({
  type: z.enum(["error", "warning", "info", "critical"]),
  severity: AlertSeverityEnum.default("medium"),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  source: z.string().min(1),
  acknowledged: z.boolean().default(false),
  resolvedAt: z.date().optional(),
  metadata: MetadataSchema,
});

// ============================================================================
// Configuration Schemas
// ============================================================================

export const ConfigurationSchema = BaseEntitySchema.extend({
  key: z.string().min(1).max(100),
  value: z.unknown(),
  category: z.enum(["trading", "safety", "monitoring", "system", "auto-sniping"]),
  description: z.string().max(500).optional(),
  isActive: z.boolean().default(true),
});

// ============================================================================
// Cache and Performance Schemas (Optimized)
// ============================================================================

export const CacheEntrySchema = z.object({
  key: z.string().min(1).max(255),
  value: z.unknown(),
  expiresAt: z.date().optional(),
  createdAt: z.date().default(() => new Date()),
  lastAccessed: z.date().default(() => new Date()),
  hitCount: z.number().min(0).default(0),
  category: z.string().max(50).optional(),
  size: z.number().min(0).optional(), // Cache entry size in bytes
});

export const PerformanceMetricSchema = BaseEntitySchema.merge(TimestampSchema).extend({
  operation: z.string().min(1).max(100),
  duration: z.number().min(0),
  success: z.boolean(),
  errorMessage: z.string().max(500).optional(),
  executionContext: z.enum(["api", "database", "auto-sniping", "pattern-detection", "websocket"]).optional(),
  metadata: MetadataSchema,
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
