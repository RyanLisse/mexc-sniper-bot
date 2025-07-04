/**
 * Database Operations Utility
 *
 * Consolidates repetitive database operations and update patterns.
 * Provides standardized methods for common database tasks with error handling.
 */

import { and, eq, isNull, lt, or } from "drizzle-orm";
import { db } from "@/src/db";
import { snipeTargets } from "@/src/db/schemas/trading";
import { toSafeError } from "@/src/lib/error-type-utils";
import type { AutoSnipeTarget } from "../types";

export class DatabaseOperations {
  private static logger = {
    info: (message: string, context?: any) =>
      console.info("[database-operations]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[database-operations]", message, context || ""),
    error: (message: string, context?: any) =>
      console.error("[database-operations]", message, context || ""),
    debug: (message: string, context?: any) =>
      console.debug("[database-operations]", message, context || ""),
  };

  /**
   * Get ready snipe targets from database with standardized query
   */
  static async getReadySnipeTargets(
    limit: number = 10
  ): Promise<AutoSnipeTarget[]> {
    try {
      const now = new Date();
      const targets = await db
        .select()
        .from(snipeTargets)
        .where(
          and(
            eq(snipeTargets.status, "ready"),
            or(
              isNull(snipeTargets.targetExecutionTime),
              lt(snipeTargets.targetExecutionTime, now)
            )
          )
        )
        .orderBy(snipeTargets.priority, snipeTargets.createdAt)
        .limit(limit);

      return targets as AutoSnipeTarget[];
    } catch (error) {
      const safeError = toSafeError(error);
      DatabaseOperations.logger.error(
        "Failed to fetch ready snipe targets",
        safeError
      );
      return [];
    }
  }

  /**
   * Update snipe target status with standardized error handling
   */
  static async updateSnipeTargetStatus(
    targetId: number,
    status: string,
    errorMessage?: string,
    additionalFields?: Record<string, any>
  ): Promise<boolean> {
    try {
      const updateData: Record<string, any> = {
        status,
        updatedAt: new Date(),
        ...additionalFields,
      };

      if (status === "executing") {
        updateData.actualExecutionTime = new Date();
      }

      if (errorMessage) {
        updateData.errorMessage = errorMessage;
      }

      await db
        .update(snipeTargets)
        .set(updateData)
        .where(eq(snipeTargets.id, targetId));

      return true;
    } catch (error) {
      const safeError = toSafeError(error);
      DatabaseOperations.logger.error("Failed to update snipe target status", {
        targetId,
        status,
        error: safeError,
      });
      return false;
    }
  }

  /**
   * Batch update multiple snipe targets
   */
  static async batchUpdateSnipeTargets(
    updates: Array<{
      id: number;
      status: string;
      errorMessage?: string;
      additionalFields?: Record<string, any>;
    }>
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const update of updates) {
      const result = await DatabaseOperations.updateSnipeTargetStatus(
        update.id,
        update.status,
        update.errorMessage,
        update.additionalFields
      );

      if (result) {
        success++;
      } else {
        failed++;
      }
    }

    DatabaseOperations.logger.info("Batch update completed", {
      total: updates.length,
      success,
      failed,
    });

    return { success, failed };
  }

  /**
   * Get snipe targets by status with optional filtering
   */
  static async getSnipeTargetsByStatus(
    status: string,
    limit: number = 50,
    additionalFilters?: any
  ): Promise<AutoSnipeTarget[]> {
    try {
      let query = db
        .select()
        .from(snipeTargets)
        .where(eq(snipeTargets.status, status));

      if (additionalFilters) {
        query = query.where(
          and(eq(snipeTargets.status, status), additionalFilters)
        );
      }

      const targets = await query
        .orderBy(snipeTargets.createdAt)
        .limit(limit)
        .execute();

      return targets as AutoSnipeTarget[];
    } catch (error) {
      const safeError = toSafeError(error);
      DatabaseOperations.logger.error(
        "Failed to fetch snipe targets by status",
        {
          status,
          error: safeError,
        }
      );
      return [];
    }
  }

  /**
   * Get snipe target by ID
   */
  static async getSnipeTargetById(
    targetId: number
  ): Promise<AutoSnipeTarget | null> {
    try {
      const targets = await db
        .select()
        .from(snipeTargets)
        .where(eq(snipeTargets.id, targetId))
        .limit(1)
        .execute();

      return targets.length > 0 ? (targets[0] as AutoSnipeTarget) : null;
    } catch (error) {
      const safeError = toSafeError(error);
      DatabaseOperations.logger.error("Failed to fetch snipe target by ID", {
        targetId,
        error: safeError,
      });
      return null;
    }
  }

  /**
   * Create a new snipe target
   */
  static async createSnipeTarget(
    targetData: Partial<AutoSnipeTarget>
  ): Promise<AutoSnipeTarget | null> {
    try {
      const newTarget = {
        ...targetData,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: targetData.status || "pending",
      };

      const result = await db
        .insert(snipeTargets)
        .values(newTarget)
        .returning();

      return result.length > 0 ? (result[0] as AutoSnipeTarget) : null;
    } catch (error) {
      const safeError = toSafeError(error);
      DatabaseOperations.logger.error("Failed to create snipe target", {
        targetData: { ...targetData, id: undefined },
        error: safeError,
      });
      return null;
    }
  }

  /**
   * Delete old completed snipe targets for cleanup
   */
  static async cleanupOldSnipeTargets(
    olderThanDays: number = 30
  ): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await db
        .delete(snipeTargets)
        .where(
          and(
            or(
              eq(snipeTargets.status, "completed"),
              eq(snipeTargets.status, "failed"),
              eq(snipeTargets.status, "cancelled")
            ),
            lt(snipeTargets.updatedAt, cutoffDate)
          )
        )
        .execute();

      // For Drizzle, result contains metadata about the operation
      const deletedCount =
        typeof result === "object" && result && "rowCount" in result
          ? (result as any).rowCount
          : 0;

      DatabaseOperations.logger.info("Cleanup completed", {
        deletedTargets: deletedCount,
        olderThanDays,
      });

      return deletedCount;
    } catch (error) {
      const safeError = toSafeError(error);
      DatabaseOperations.logger.error("Failed to cleanup old snipe targets", {
        olderThanDays,
        error: safeError,
      });
      return 0;
    }
  }

  /**
   * Get snipe target statistics
   */
  static async getSnipeTargetStats(): Promise<{
    total: number;
    pending: number;
    ready: number;
    executing: number;
    completed: number;
    failed: number;
  }> {
    try {
      // For simplicity, we'll get all targets and count them
      // In a real implementation, you'd use aggregation queries for better performance
      const allTargets = await db
        .select({
          id: snipeTargets.id,
          status: snipeTargets.status,
        })
        .from(snipeTargets)
        .execute();

      const stats = {
        total: allTargets.length,
        pending: allTargets.filter((t: any) => t.status === "pending").length,
        ready: allTargets.filter((t: any) => t.status === "ready").length,
        executing: allTargets.filter((t: any) => t.status === "executing")
          .length,
        completed: allTargets.filter((t: any) => t.status === "completed")
          .length,
        failed: allTargets.filter((t: any) => t.status === "failed").length,
      };

      return stats;
    } catch (error) {
      const safeError = toSafeError(error);
      DatabaseOperations.logger.error(
        "Failed to get snipe target statistics",
        safeError
      );
      return {
        total: 0,
        pending: 0,
        ready: 0,
        executing: 0,
        completed: 0,
        failed: 0,
      };
    }
  }

  /**
   * Generic database operation with error handling
   */
  static async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    operationName: string,
    context?: Record<string, any>
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      const safeError = toSafeError(error);
      DatabaseOperations.logger.error(
        `Database operation failed: ${operationName}`,
        {
          ...context,
          error: safeError,
        }
      );
      return null;
    }
  }
}
