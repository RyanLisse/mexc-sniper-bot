import { and, eq, gte, lte, or } from "drizzle-orm";
import { db } from "@/src/db";
import { transactionLocks, transactionQueue } from "@/src/db/schema";
import { UniversalCrypto as crypto } from "@/src/lib/browser-compatible-events";
export interface TransactionLockConfig {
  resourceId: string;
  ownerId: string;
  ownerType: "user" | "system" | "workflow";
  transactionType: "trade" | "cancel" | "update";
  transactionData: Record<string, unknown>;
  timeoutMs?: number;
  maxRetries?: number;
  priority?: number;
  idempotencyKey?: string;
}

export interface LockResult {
  success: boolean;
  lockId?: string;
  queuePosition?: number;
  error?: string;
  isRetry?: boolean;
  existingResult?: Record<string, unknown>;
}

export interface TransactionResult {
  success: boolean;
  result?: Record<string, unknown>;
  error?: string;
  lockId: string;
  executionTimeMs: number;
}

export class TransactionLockService {
  private _logger?: {
    info: (message: string, context?: any) => void;
    warn: (message: string, context?: any) => void;
    error: (message: string, context?: any, error?: Error) => void;
    debug: (message: string, context?: any) => void;
  };
  private getLogger() {
    if (!this._logger) {
      this._logger = {
        info: (message: string, context?: any) =>
          console.info("[transaction-lock-service]", message, context || ""),
        warn: (message: string, context?: any) =>
          console.warn("[transaction-lock-service]", message, context || ""),
        error: (message: string, context?: any, error?: Error) =>
          console.error(
            "[transaction-lock-service]",
            message,
            context || "",
            error || ""
          ),
        debug: (message: string, context?: any) =>
          console.debug("[transaction-lock-service]", message, context || ""),
      };
    }
    return this._logger;
  }

  private static instance: TransactionLockService;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start cleanup process
    this.startCleanupProcess();
  }

  static getInstance(): TransactionLockService {
    if (!TransactionLockService.instance) {
      TransactionLockService.instance = new TransactionLockService();
    }
    return TransactionLockService.instance;
  }

  /**
   * Generate a unique idempotency key for a transaction
   */
  generateIdempotencyKey(
    config: Omit<TransactionLockConfig, "idempotencyKey">
  ): string {
    const data = {
      resourceId: config.resourceId,
      ownerId: config.ownerId,
      transactionType: config.transactionType,
      // Include relevant transaction data that makes this request unique
      ...this.extractIdempotencyData(config.transactionData),
    };

    return crypto
      .createHash("sha256")
      .update(JSON.stringify(data))
      .digest("hex");
  }

  /**
   * Extract data relevant for idempotency from transaction data
   */
  private extractIdempotencyData(
    transactionData: Record<string, unknown>
  ): Record<string, unknown> {
    // For trade transactions, include symbol, side, quantity, and order type
    if (transactionData.symbol && transactionData.side) {
      return {
        symbol: transactionData.symbol,
        side: transactionData.side,
        quantity: transactionData.quantity,
        type: transactionData.type,
        snipeTargetId: transactionData.snipeTargetId,
      };
    }
    return transactionData;
  }

  /**
   * Acquire a lock for a transaction
   */
  async acquireLock(config: TransactionLockConfig): Promise<LockResult> {
    const idempotencyKey =
      config.idempotencyKey || this.generateIdempotencyKey(config);
    const lockId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (config.timeoutMs || 30000));

    try {
      // Use database transaction for atomicity
      return await db.transaction(async (tx: any) => {
        // Check for existing lock with same idempotency key
        const existingLocks = await tx
          .select()
          .from(transactionLocks)
          .where(eq(transactionLocks.idempotencyKey, idempotencyKey));

        const existingLock = existingLocks[0];

        if (existingLock) {
          // If lock is still active and not expired, return existing result or retry status
          if (
            existingLock.status === "active" &&
            new Date(existingLock.expiresAt) > now
          ) {
            return {
              success: false,
              error: "Transaction already in progress",
              isRetry: true,
              lockId: existingLock.lockId,
            };
          }

          // If transaction completed successfully, return the existing result
          if (existingLock.status === "released" && existingLock.result) {
            return {
              success: false,
              error: "Transaction already completed",
              existingResult: JSON.parse(existingLock.result),
              isRetry: true,
              lockId: existingLock.lockId,
            };
          }
        }

        // Check for active locks on the same resource (but different idempotency key)
        const activeLocks = await tx
          .select()
          .from(transactionLocks)
          .where(
            and(
              eq(transactionLocks.resourceId, config.resourceId),
              eq(transactionLocks.status, "active"),
              gte(transactionLocks.expiresAt, now)
            )
          );

        if (activeLocks.length > 0) {
          // Check if any of the active locks have the same idempotency key
          const duplicateLock = activeLocks.find(
            (lock: any) => lock.idempotencyKey === idempotencyKey
          );
          if (duplicateLock) {
            return {
              success: false,
              error: "Transaction already in progress",
              isRetry: true,
              lockId: duplicateLock.lockId,
            };
          }

          // Add to queue instead of rejecting (different transaction on same resource)
          const queueItem = await this.addToQueue(config, idempotencyKey);
          return {
            success: false,
            error: "Resource locked, added to queue",
            queuePosition: queueItem.position,
          };
        }

        // Acquire the lock using INSERT ... RETURNING to ensure atomicity
        const insertedLocks = await tx
          .insert(transactionLocks)
          .values({
            lockId,
            resourceId: config.resourceId,
            idempotencyKey,
            ownerId: config.ownerId,
            ownerType: config.ownerType,
            expiresAt,
            status: "active",
            lockType: "exclusive",
            transactionType: config.transactionType,
            transactionData: JSON.stringify(config.transactionData),
            maxRetries: config.maxRetries || 3,
            timeoutMs: config.timeoutMs || 30000,
          })
          .returning({ lockId: transactionLocks.lockId });

        if (insertedLocks.length === 0) {
          throw new Error("Failed to insert lock - no rows returned");
        }

        return {
          success: true,
          lockId,
        };
      });
    } catch (error) {
      // Handle unique constraint violations (concurrent access to same idempotency key)
      if (
        error instanceof Error &&
        error.message.includes("unique") &&
        error.message.includes("idempotency_key")
      ) {
        // Race condition detected - another process acquired the lock first
        const existingLocks = await db
          .select()
          .from(transactionLocks)
          .where(eq(transactionLocks.idempotencyKey, idempotencyKey));

        const existingLock = existingLocks[0];
        if (existingLock) {
          return {
            success: false,
            error: "Transaction already in progress",
            isRetry: true,
            lockId: existingLock.lockId,
          };
        }
      }

      console.error("Failed to acquire lock:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to acquire lock",
      };
    }
  }

  /**
   * Release a lock after transaction completion
   */
  async releaseLock(
    lockId: string,
    result?: Record<string, unknown>,
    error?: string
  ): Promise<boolean> {
    try {
      await db
        .update(transactionLocks)
        .set({
          status: error ? "failed" : "released",
          releasedAt: new Date(),
          result: result ? JSON.stringify(result) : null,
          errorMessage: error,
          updatedAt: new Date(),
        })
        .where(eq(transactionLocks.lockId, lockId));

      // Process next item in queue for this resource
      const lockResults = await db
        .select()
        .from(transactionLocks)
        .where(eq(transactionLocks.lockId, lockId));

      await this.processQueueForResource(lockResults[0]?.resourceId || "");

      return true;
    } catch (err) {
      console.error("Failed to release lock:", err);
      return false;
    }
  }

  /**
   * Add transaction to queue
   */
  private async addToQueue(
    config: TransactionLockConfig,
    idempotencyKey: string
  ): Promise<{ queueId: string; position: number }> {
    const queueId = crypto.randomUUID();

    // Check current queue position
    const queuedItems = await db
      .select()
      .from(transactionQueue)
      .where(
        and(
          eq(transactionQueue.resourceId, config.resourceId),
          eq(transactionQueue.status, "pending")
        )
      );

    await db.insert(transactionQueue).values({
      queueId,
      lockId: null, // Explicitly set to null for queued items
      resourceId: config.resourceId,
      priority: config.priority || 5,
      transactionType: config.transactionType,
      transactionData: JSON.stringify(config.transactionData),
      idempotencyKey,
      status: "pending",
      ownerId: config.ownerId,
      ownerType: config.ownerType,
    });

    return {
      queueId,
      position: queuedItems.length + 1,
    };
  }

  /**
   * Process queue for a specific resource
   */
  private async processQueueForResource(resourceId: string): Promise<void> {
    if (!resourceId) return;

    // Get next pending item from queue
    const nextItems = await db
      .select()
      .from(transactionQueue)
      .where(
        and(
          eq(transactionQueue.resourceId, resourceId),
          eq(transactionQueue.status, "pending")
        )
      )
      .orderBy(transactionQueue.priority, transactionQueue.queuedAt);

    const nextItem = nextItems[0];
    if (!nextItem) return;

    // Try to acquire lock for queued item
    const lockConfig: TransactionLockConfig = {
      resourceId: nextItem.resourceId,
      ownerId: nextItem.ownerId,
      ownerType: nextItem.ownerType as "user" | "system" | "workflow",
      transactionType: nextItem.transactionType as
        | "trade"
        | "cancel"
        | "update",
      transactionData: JSON.parse(nextItem.transactionData),
      idempotencyKey: nextItem.idempotencyKey,
    };

    const lockResult = await this.acquireLock(lockConfig);

    if (lockResult.success) {
      // Update queue item with lock
      await db
        .update(transactionQueue)
        .set({
          lockId: lockResult.lockId,
          status: "processing",
          processingStartedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(transactionQueue.queueId, nextItem.queueId));
    }
  }

  /**
   * Execute a transaction with lock protection
   */
  async executeWithLock<T>(
    config: TransactionLockConfig,
    executor: () => Promise<T>
  ): Promise<TransactionResult> {
    const startTime = Date.now();
    const lockResult = await this.acquireLock(config);

    if (!lockResult.success) {
      return this.handleLockFailure(lockResult, startTime);
    }

    return this.executeTransaction(lockResult, executor, startTime);
  }

  private handleLockFailure(
    lockResult: LockResult,
    startTime: number
  ): TransactionResult {
    if (lockResult.existingResult) {
      // Transaction already completed, return existing result
      return {
        success: true,
        result: lockResult.existingResult,
        lockId: lockResult.lockId || "",
        executionTimeMs: 0,
      };
    }

    // If this is a retry (duplicate idempotency key) and it's not just queued, return failure
    if (
      lockResult.isRetry &&
      lockResult.error?.includes("Transaction already in progress")
    ) {
      return {
        success: false,
        error: lockResult.error,
        lockId: lockResult.lockId || "",
        executionTimeMs: Date.now() - startTime,
      };
    }

    return {
      success: false,
      error: lockResult.error,
      lockId: lockResult.lockId || "",
      executionTimeMs: Date.now() - startTime,
    };
  }

  private async executeTransaction<T>(
    lockResult: LockResult,
    executor: () => Promise<T>,
    startTime: number
  ): Promise<TransactionResult> {
    try {
      // Execute the transaction
      const result = await executor();

      // Convert result to Record<string, unknown> safely
      let resultRecord: Record<string, unknown> | undefined;
      if (result !== null && result !== undefined) {
        if (typeof result === "object") {
          resultRecord = result as Record<string, unknown>;
        } else {
          // For primitive values, wrap them
          resultRecord = { value: result };
        }
      }

      // Release lock with success
      if (lockResult.lockId) {
        await this.releaseLock(lockResult.lockId, resultRecord);
      }

      return {
        success: true,
        result: resultRecord,
        lockId: lockResult.lockId || "",
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return this.handleExecutionError(error, lockResult, startTime);
    }
  }

  private async handleExecutionError(
    error: unknown,
    lockResult: LockResult,
    startTime: number
  ): Promise<TransactionResult> {
    // Release lock with error
    const errorMessage =
      error instanceof Error ? error.message : "Transaction failed";
    if (lockResult.lockId) {
      await this.releaseLock(lockResult.lockId, undefined, errorMessage);
    }

    return {
      success: false,
      error: errorMessage,
      lockId: lockResult.lockId || "",
      executionTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Check if a resource is currently locked
   */
  async isResourceLocked(resourceId: string): Promise<boolean> {
    const activeLocks = await db
      .select()
      .from(transactionLocks)
      .where(
        and(
          eq(transactionLocks.resourceId, resourceId),
          eq(transactionLocks.status, "active"),
          gte(transactionLocks.expiresAt, new Date())
        )
      );

    return activeLocks.length > 0;
  }

  /**
   * Get lock status for a resource
   */
  async getLockStatus(resourceId: string): Promise<{
    isLocked: boolean;
    lockCount: number;
    queueLength: number;
    activeLocks: Array<{
      id: string;
      ownerId: string;
      resourceId: string;
      status: string;
      createdAt: Date;
      expiresAt: Date;
    }>;
  }> {
    const now = new Date();

    const activeLocks = await db
      .select()
      .from(transactionLocks)
      .where(
        and(
          eq(transactionLocks.resourceId, resourceId),
          eq(transactionLocks.status, "active"),
          gte(transactionLocks.expiresAt, now)
        )
      );

    const queuedItems = await db
      .select()
      .from(transactionQueue)
      .where(
        and(
          eq(transactionQueue.resourceId, resourceId),
          eq(transactionQueue.status, "pending")
        )
      );

    return {
      isLocked: activeLocks.length > 0,
      lockCount: activeLocks.length,
      queueLength: queuedItems.length,
      activeLocks: activeLocks.map((lock: any) => ({
        id: lock.lockId,
        ownerId: lock.ownerId,
        resourceId: lock.resourceId,
        status: lock.status,
        createdAt: lock.acquiredAt,
        expiresAt: lock.expiresAt,
      })),
    };
  }

  /**
   * Clean up expired locks and failed queue items
   */
  private async cleanupExpiredLocks(): Promise<void> {
    const now = new Date();

    try {
      // Mark expired locks as expired
      await db
        .update(transactionLocks)
        .set({
          status: "expired",
          updatedAt: now,
        })
        .where(
          and(
            eq(transactionLocks.status, "active"),
            lte(transactionLocks.expiresAt, now)
          )
        );

      // Clean up old completed/failed locks (older than 24 hours)
      const cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      await db
        .delete(transactionLocks)
        .where(
          and(
            or(
              eq(transactionLocks.status, "released"),
              eq(transactionLocks.status, "expired"),
              eq(transactionLocks.status, "failed")
            ),
            lte(transactionLocks.createdAt, cutoffTime)
          )
        );

      // Clean up old queue items
      await db
        .delete(transactionQueue)
        .where(
          and(
            or(
              eq(transactionQueue.status, "completed"),
              eq(transactionQueue.status, "failed"),
              eq(transactionQueue.status, "cancelled")
            ),
            lte(transactionQueue.createdAt, cutoffTime)
          )
        );
    } catch (error) {
      console.error("Cleanup process error:", error);
    }
  }

  /**
   * Start automatic cleanup process
   */
  private startCleanupProcess(): void {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupExpiredLocks();
      },
      5 * 60 * 1000
    );
  }

  /**
   * Stop cleanup process
   */
  stopCleanupProcess(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get queue position for a transaction
   */
  async getQueuePosition(idempotencyKey: string): Promise<number | null> {
    const queueItems = await db
      .select()
      .from(transactionQueue)
      .where(eq(transactionQueue.idempotencyKey, idempotencyKey));

    const queueItem = queueItems[0];

    if (!queueItem || queueItem.status !== "pending") {
      return null;
    }

    // Count items ahead in queue
    const itemsAhead = await db
      .select()
      .from(transactionQueue)
      .where(
        and(
          eq(transactionQueue.resourceId, queueItem.resourceId),
          eq(transactionQueue.status, "pending"),
          or(
            lte(transactionQueue.priority, queueItem.priority),
            and(
              eq(transactionQueue.priority, queueItem.priority),
              lte(transactionQueue.queuedAt, queueItem.queuedAt)
            )
          )
        )
      );

    return itemsAhead.length;
  }

  /**
   * Force release all locks for a specific owner (emergency use)
   */
  async forceReleaseOwnerLocks(ownerId: string): Promise<number> {
    const result = await db
      .update(transactionLocks)
      .set({
        status: "released",
        releasedAt: new Date(),
        errorMessage: "Force released by owner",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(transactionLocks.ownerId, ownerId),
          eq(transactionLocks.status, "active")
        )
      );

    return (result as { changes?: number }).changes || 0;
  }

  /**
   * Get all active locks
   */
  async getActiveLocks() {
    return await db
      .select()
      .from(transactionLocks)
      .where(eq(transactionLocks.status, "active"));
  }

  /**
   * Release a lock by resource ID and owner ID
   */
  async releaseLockByResource(
    resourceId: string,
    ownerId: string
  ): Promise<boolean> {
    try {
      // First, check if the lock exists
      const existingLocks = await db
        .select()
        .from(transactionLocks)
        .where(
          and(
            eq(transactionLocks.resourceId, resourceId),
            eq(transactionLocks.ownerId, ownerId),
            eq(transactionLocks.status, "active")
          )
        );

      const existingLock = existingLocks[0];

      if (!existingLock) {
        return false;
      }

      // Update the lock status
      const _result = await db
        .update(transactionLocks)
        .set({
          status: "released",
          releasedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(transactionLocks.resourceId, resourceId),
            eq(transactionLocks.ownerId, ownerId),
            eq(transactionLocks.status, "active")
          )
        );

      // For PostgreSQL with Drizzle, we need to check if the update was successful
      // by verifying the lock was actually updated
      const updatedLocks = await db
        .select()
        .from(transactionLocks)
        .where(
          and(
            eq(transactionLocks.resourceId, resourceId),
            eq(transactionLocks.ownerId, ownerId),
            eq(transactionLocks.status, "released")
          )
        );

      return updatedLocks.length > 0;
    } catch (error) {
      console.error("Error releasing lock by resource:", error);
      return false;
    }
  }
}

// Export singleton instance
export const transactionLockService = TransactionLockService.getInstance();
