/**
 * Database Transaction Helpers
 *
 * Provides robust transaction handling for database operations with
 * proper isolation, rollback, and cleanup mechanisms.
 */

import { sql } from "drizzle-orm";
import { db } from "./index";
import { getLogger } from "../lib/error-type-utils";

export interface TransactionOptions {
  timeout?: number; // Timeout in milliseconds
  isolationLevel?: 'READ_COMMITTED' | 'REPEATABLE_READ' | 'SERIALIZABLE';
  retryCount?: number;
  onRollback?: (error: unknown) => void;
  onCommit?: () => void;
}

export interface TransactionContext {
  isActive: boolean;
  startTime: number;
  operations: string[];
}

/**
 * Execute a database operation within a transaction with proper error handling
 */
export async function withTransaction<T>(
  operation: (tx: any) => Promise<T>,
  options: TransactionOptions = {}
): Promise<T> {
  const {
    timeout = 10000,
    isolationLevel = 'READ_COMMITTED',
    retryCount = 3,
    onRollback,
    onCommit
  } = options;

  const context: TransactionContext = {
    isActive: false,
    startTime: Date.now(),
    operations: []
  };

  let attempt = 0;
  let lastError: unknown;

  while (attempt < retryCount) {
    try {
      const result = await db.transaction(async (tx) => {
        context.isActive = true;
        
        // Set isolation level if specified
        if (isolationLevel !== 'READ_COMMITTED') {
          await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL ${sql.raw(isolationLevel)}`);
          context.operations.push(`SET_ISOLATION_${isolationLevel}`);
        }

        // Set transaction timeout
        await tx.execute(sql`SET statement_timeout = ${timeout}`);
        context.operations.push(`SET_TIMEOUT_${timeout}`);

        // Execute the operation
        const operationResult = await operation(tx);
        
        context.operations.push('OPERATION_COMPLETED');
        
        // Call commit callback if provided
        if (onCommit) {
          onCommit();
        }

        return operationResult;
      });

      context.isActive = false;
      return result;

    } catch (error) {
      context.isActive = false;
      lastError = error;
      attempt++;

      // Log the error
      getLogger().warn(`[Transaction] Attempt ${attempt} failed:`, error);

      // Call rollback callback if provided
      if (onRollback) {
        onRollback(error);
      }

      // If this is a serialization failure or deadlock, retry
      const errorMessage = error instanceof Error ? error.message : String(error);
      const shouldRetry = 
        errorMessage.includes('serialization failure') ||
        errorMessage.includes('deadlock') ||
        errorMessage.includes('could not serialize');

      if (!shouldRetry || attempt >= retryCount) {
        break;
      }

      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt - 1)));
    }
  }

  // If we get here, all attempts failed
  const duration = Date.now() - context.startTime;
  getLogger().error(
    `[Transaction] Failed after ${attempt} attempts (${duration}ms)`,
    {
      error: lastError,
      operations: context.operations,
      duration
    }
  );

  throw lastError;
}

/**
 * Execute multiple operations in a single transaction
 */
export async function withBatchTransaction<T>(
  operations: Array<(tx: any) => Promise<T>>,
  options: TransactionOptions = {}
): Promise<T[]> {
  return withTransaction(async (tx) => {
    const results: T[] = [];
    
    for (const operation of operations) {
      const result = await operation(tx);
      results.push(result);
    }
    
    return results;
  }, options);
}

/**
 * Safe transaction wrapper that ensures cleanup even on errors
 */
export async function safeTransaction<T>(
  operation: (tx: any) => Promise<T>,
  cleanup?: () => Promise<void>
): Promise<T> {
  try {
    return await withTransaction(operation, {
      timeout: 5000, // Shorter timeout for safety
      retryCount: 1, // No retries for safety
      onRollback: (error) => {
        getLogger().warn('[SafeTransaction] Rollback triggered:', error);
      }
    });
  } finally {
    if (cleanup) {
      try {
        await cleanup();
      } catch (cleanupError) {
        getLogger().warn('[SafeTransaction] Cleanup failed:', cleanupError);
      }
    }
  }
}

/**
 * Test transaction wrapper for unit tests
 */
export async function testTransaction<T>(
  operation: (tx: any) => Promise<T>
): Promise<T> {
  return withTransaction(operation, {
    timeout: 2000, // Short timeout for tests
    isolationLevel: 'READ_COMMITTED', // Consistent for tests
    retryCount: 1, // No retries in tests
    onRollback: (error) => {
      console.warn('[TestTransaction] Test transaction rolled back:', error);
    }
  });
}

/**
 * Check if database is in a transaction
 */
export async function isInTransaction(): Promise<boolean> {
  try {
    const result = await db.execute(sql`SELECT txid_current_if_assigned() AS txid`);
    return (result as any)[0]?.txid != null;
  } catch {
    return false;
  }
}

/**
 * Get current transaction information
 */
export async function getTransactionInfo(): Promise<{
  inTransaction: boolean;
  transactionId?: string;
  isolationLevel?: string;
  readOnly?: boolean;
}> {
  try {
    const [txInfo, isoInfo] = await Promise.all([
      db.execute(sql`SELECT txid_current_if_assigned() AS txid`),
      db.execute(sql`SHOW transaction_isolation`)
    ]);

    const txid = (txInfo as any)[0]?.txid;
    const isolationLevel = (isoInfo as any)[0]?.transaction_isolation;

    return {
      inTransaction: txid != null,
      transactionId: txid ? String(txid) : undefined,
      isolationLevel,
      readOnly: false // Would need additional query to determine
    };
  } catch (error) {
    getLogger().warn('[TransactionInfo] Failed to get transaction info:', error);
    return {
      inTransaction: false
    };
  }
}

/**
 * Emergency transaction cleanup for tests
 */
export async function emergencyTransactionCleanup(): Promise<void> {
  try {
    // Kill any long-running transactions
    await db.execute(sql`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE state = 'active'
        AND query_start < NOW() - INTERVAL '30 seconds'
        AND query NOT LIKE '%pg_stat_activity%'
        AND pid != pg_backend_pid()
    `);

    getLogger().info('[TransactionCleanup] Emergency transaction cleanup completed');
  } catch (error) {
    getLogger().warn('[TransactionCleanup] Emergency cleanup failed:', error);
  }
}