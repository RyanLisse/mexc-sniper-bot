/**
 * Database Operation Types
 *
 * Strict type definitions for database operations to replace 'any' types.
 * Provides type safety for Drizzle ORM operations and result handling.
 */

import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgQueryResultHKT, PgTransaction } from "drizzle-orm/pg-core";

// ============================================================================
// Database Transaction Types
// ============================================================================

/**
 * Type-safe database transaction interface
 */
export type DatabaseTransaction = PgTransaction<
  PgQueryResultHKT,
  Record<string, never>,
  ExtractTablesWithRelations<Record<string, never>>
>;

/**
 * Transaction operation function type
 */
export type TransactionOperation<T> = (tx: DatabaseTransaction) => Promise<T>;

// ============================================================================
// Query Result Types
// ============================================================================

/**
 * Database row result with proper typing
 */
export interface DatabaseRow {
  [key: string]: unknown;
}

/**
 * Aggregation result structure
 */
export interface AggregationResult {
  groupKey: string;
  count: number;
  avgConfidence?: number;
  totalValue?: number;
  minTimestamp?: Date;
  maxTimestamp?: Date;
}

/**
 * Batch operation result
 */
export interface BatchOperationResult {
  insertedCount: number;
  updatedCount: number;
  failedCount: number;
  errors: BatchOperationError[];
}

/**
 * Batch operation error details
 */
export interface BatchOperationError {
  index: number;
  data: DatabaseRow;
  error: string;
  code?: string;
}

// ============================================================================
// Table-Specific Types
// ============================================================================

/**
 * Pattern embedding table row
 */
export interface PatternEmbeddingRow {
  patternId: string;
  patternType: string;
  symbolName: string;
  patternData: string;
  embedding: string;
  confidence: number;
  discoveredAt: Date;
  userId?: string;
  isActive?: boolean;
}

/**
 * Snipe target table row
 */
export interface SnipeTargetRow {
  userId: string;
  symbolName: string;
  targetPrice: number;
  currentPrice?: number;
  confidence: number;
  createdAt: Date;
  isActive: boolean;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Query Building Types
// ============================================================================

/**
 * Where condition value types
 */
export type WhereConditionValue =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined
  | string[]
  | number[];

/**
 * Where conditions object
 */
export interface WhereConditions {
  [columnName: string]: WhereConditionValue;
}

/**
 * Query parameters for prepared statements
 */
export type QueryParameter = string | number | boolean | Date | null;

/**
 * Built query with parameters
 */
export interface BuiltQuery {
  query: string;
  parameters: QueryParameter[];
}

// ============================================================================
// Update Operation Types
// ============================================================================

/**
 * Update value that can be formatted for SQL
 */
export type UpdateValue = string | number | boolean | Date | null;

/**
 * Update data object
 */
export interface UpdateData {
  [columnName: string]: UpdateValue;
}

/**
 * Bulk update operation
 */
export interface BulkUpdateOperation {
  conditions: WhereConditions;
  updates: UpdateData;
  expectedCount?: number;
}
