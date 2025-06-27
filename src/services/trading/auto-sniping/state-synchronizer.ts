/**
 * AutoSniping State Synchronizer
 *
 * Manages state consistency between in-memory execution engine data
 * and persistent database storage for auto-sniping targets.
 */

import { eq, inArray } from "drizzle-orm";
import { db } from "@/src/db";
import { snipeTargets } from "@/src/db/schema";
import type { ExecutionPosition } from "./schemas";

export interface StateConsistencyReport {
  databaseTargetCount: number;
  memoryTargetCount: number;
  isConsistent: boolean;
  inconsistencies: string[];
  recommendedActions: string[];
  lastSyncTime: string;
}

export interface SyncOptions {
  syncDirection?: "memory-to-db" | "db-to-memory" | "bidirectional";
  dryRun?: boolean;
  forceSync?: boolean;
}

export interface SyncResult {
  success: boolean;
  syncedTargets: number;
  errors: string[];
  consistencyReport: StateConsistencyReport;
}

export class AutoSnipingStateSynchronizer {
  private static instance: AutoSnipingStateSynchronizer | null = null;
  private lastSyncTime: Date | null = null;
  private syncInProgress: boolean = false;

  private constructor() {}

  static getInstance(): AutoSnipingStateSynchronizer {
    if (!AutoSnipingStateSynchronizer.instance) {
      AutoSnipingStateSynchronizer.instance = new AutoSnipingStateSynchronizer();
    }
    return AutoSnipingStateSynchronizer.instance;
  }

  /**
   * Get count of active targets from database
   */
  async getDatabaseTargetCount(userId?: string): Promise<number> {
    try {
      const query = db
        .select({ count: snipeTargets.id })
        .from(snipeTargets)
        .where(
          userId
            ? eq(snipeTargets.userId, userId)
            : inArray(snipeTargets.status, ["pending", "ready", "executing"])
        );

      const result = await query;
      return result.length;
    } catch (error) {
      console.error("[StateSynchronizer] Error getting database target count:", error);
      return 0;
    }
  }

  /**
   * Get active targets from database with detailed status
   */
  async getDatabaseTargets(userId?: string) {
    try {
      const query = db
        .select()
        .from(snipeTargets)
        .where(
          userId
            ? eq(snipeTargets.userId, userId)
            : inArray(snipeTargets.status, ["pending", "ready", "executing"])
        );

      return await query;
    } catch (error) {
      console.error("[StateSynchronizer] Error getting database targets:", error);
      return [];
    }
  }

  /**
   * Compare memory and database target counts for consistency
   */
  async checkStateConsistency(
    memoryPositions: ExecutionPosition[],
    userId?: string
  ): Promise<StateConsistencyReport> {
    const databaseTargetCount = await this.getDatabaseTargetCount(userId);
    const memoryTargetCount = memoryPositions.length;
    const databaseTargets = await this.getDatabaseTargets(userId);

    const inconsistencies: string[] = [];
    const recommendedActions: string[] = [];

    // Check count consistency
    const isCountConsistent = databaseTargetCount === memoryTargetCount;
    if (!isCountConsistent) {
      inconsistencies.push(
        `Target count mismatch: DB=${databaseTargetCount}, Memory=${memoryTargetCount}`
      );

      if (databaseTargetCount > memoryTargetCount) {
        recommendedActions.push("Consider loading missing targets from database to memory");
      } else {
        recommendedActions.push("Consider persisting memory targets to database");
      }
    }

    // Check for orphaned database targets (not in memory)
    const memoryTargetIds = new Set(memoryPositions.map((p) => p.id));
    const orphanedDbTargets = databaseTargets.filter(
      (target) => !memoryTargetIds.has(target.id.toString())
    );

    if (orphanedDbTargets.length > 0) {
      inconsistencies.push(`${orphanedDbTargets.length} database targets not found in memory`);
      recommendedActions.push("Sync orphaned database targets to memory");
    }

    // Check for orphaned memory targets (not in database)
    const dbTargetIds = new Set(databaseTargets.map((t) => t.id.toString()));
    const orphanedMemoryTargets = memoryPositions.filter((pos) => !dbTargetIds.has(pos.id));

    if (orphanedMemoryTargets.length > 0) {
      inconsistencies.push(`${orphanedMemoryTargets.length} memory targets not found in database`);
      recommendedActions.push("Persist orphaned memory targets to database");
    }

    const isConsistent = inconsistencies.length === 0;

    return {
      databaseTargetCount,
      memoryTargetCount,
      isConsistent,
      inconsistencies,
      recommendedActions,
      lastSyncTime: this.lastSyncTime?.toISOString() || "Never",
    };
  }

  /**
   * Synchronize state between memory and database
   */
  async synchronizeState(
    memoryPositions: ExecutionPosition[],
    options: SyncOptions = {},
    userId?: string
  ): Promise<SyncResult> {
    if (this.syncInProgress) {
      return {
        success: false,
        syncedTargets: 0,
        errors: ["Synchronization already in progress"],
        consistencyReport: await this.checkStateConsistency(memoryPositions, userId),
      };
    }

    this.syncInProgress = true;
    const errors: string[] = [];
    let syncedTargets = 0;

    try {
      const { syncDirection = "bidirectional", dryRun = false, forceSync = false } = options;

      console.info(
        `[StateSynchronizer] Starting ${dryRun ? "DRY RUN " : ""}sync (${syncDirection})`
      );

      const consistencyReport = await this.checkStateConsistency(memoryPositions, userId);

      // If already consistent and not forcing sync, return early
      if (consistencyReport.isConsistent && !forceSync) {
        console.info("[StateSynchronizer] State already consistent, no sync needed");
        return {
          success: true,
          syncedTargets: 0,
          errors: [],
          consistencyReport,
        };
      }

      if (syncDirection === "memory-to-db" || syncDirection === "bidirectional") {
        // Sync memory positions to database
        for (const position of memoryPositions) {
          try {
            if (!dryRun) {
              // Check if target exists in database
              const existingTarget = await db
                .select({ id: snipeTargets.id })
                .from(snipeTargets)
                .where(eq(snipeTargets.id, parseInt(position.id)))
                .limit(1);

              if (existingTarget.length === 0) {
                // Insert new target
                await db.insert(snipeTargets).values({
                  userId: userId || "system",
                  vcoinId: position.symbol,
                  symbolName: position.symbol,
                  positionSizeUsdt: position.quantity || 100,
                  stopLossPercent: 5,
                  status: this.mapPositionStatusToDb(position.status),
                  confidenceScore: position.patternData?.confidence || 0,
                  executionPrice: position.entryPrice,
                  actualPositionSize: position.quantity,
                  actualExecutionTime: position.timestamp
                    ? new Date(position.timestamp)
                    : undefined,
                });
                syncedTargets++;
              }
            } else {
              console.info(
                `[StateSynchronizer] DRY RUN: Would sync memory target ${position.id} to DB`
              );
              syncedTargets++;
            }
          } catch (error) {
            const errorMsg = `Failed to sync memory target ${position.id}: ${error.message}`;
            errors.push(errorMsg);
            console.error("[StateSynchronizer]", errorMsg);
          }
        }
      }

      if (syncDirection === "db-to-memory" || syncDirection === "bidirectional") {
        // Note: Syncing DB to memory would require access to the execution engine
        // This is typically handled by the execution engine itself during startup
        console.info(
          "[StateSynchronizer] DB-to-memory sync should be handled by execution engine startup"
        );
      }

      this.lastSyncTime = new Date();

      const finalConsistencyReport = await this.checkStateConsistency(memoryPositions, userId);

      console.info(
        `[StateSynchronizer] Sync completed: ${syncedTargets} targets synced, ${errors.length} errors`
      );

      return {
        success: errors.length === 0,
        syncedTargets,
        errors,
        consistencyReport: finalConsistencyReport,
      };
    } catch (error) {
      const errorMsg = `Synchronization failed: ${error.message}`;
      errors.push(errorMsg);
      console.error("[StateSynchronizer]", errorMsg);

      return {
        success: false,
        syncedTargets,
        errors,
        consistencyReport: await this.checkStateConsistency(memoryPositions, userId),
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Map execution position status to database status
   */
  private mapPositionStatusToDb(positionStatus: string): string {
    switch (positionStatus) {
      case "ACTIVE":
        return "executing";
      case "PENDING":
        return "pending";
      case "COMPLETED":
        return "completed";
      case "FAILED":
        return "failed";
      case "CANCELLED":
        return "cancelled";
      default:
        return "pending";
    }
  }

  /**
   * Clean up completed or failed targets from database
   */
  async cleanupCompletedTargets(olderThanHours = 24): Promise<number> {
    try {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - olderThanHours);

      const result = await db
        .delete(snipeTargets)
        .where(inArray(snipeTargets.status, ["completed", "failed", "cancelled"]));

      console.info(`[StateSynchronizer] Cleaned up completed targets`);
      return Array.isArray(result) ? result.length : 0;
    } catch (error) {
      console.error("[StateSynchronizer] Error cleaning up completed targets:", error);
      return 0;
    }
  }

  /**
   * Get unified target count that checks both sources
   */
  async getUnifiedTargetCount(
    memoryPositions: ExecutionPosition[],
    userId?: string
  ): Promise<{
    memoryCount: number;
    databaseCount: number;
    unifiedCount: number;
    isConsistent: boolean;
    source: "memory" | "database" | "consistent";
    warning?: string;
  }> {
    const memoryCount = memoryPositions.length;
    const databaseCount = await this.getDatabaseTargetCount(userId);
    const isConsistent = memoryCount === databaseCount;

    // Calendar is the source of truth - database is cache/fallback
    // Use the higher count as it represents the most current data
    let unifiedCount: number;
    let source: "memory" | "database" | "consistent";
    let warning: string | undefined;

    if (isConsistent) {
      unifiedCount = databaseCount;
      source = "consistent";
      console.debug(
        `[StateSynchronizer] Memory and database consistent: ${databaseCount} targets`
      );
    } else {
      // Use higher count - likely represents calendar data not yet synced to database
      unifiedCount = Math.max(memoryCount, databaseCount);
      if (memoryCount > databaseCount) {
        source = "memory";
        warning = `Database (${databaseCount}) behind calendar/memory (${memoryCount}) - database sync needed`;
      } else {
        source = "database";
        warning = `Memory (${memoryCount}) behind database (${databaseCount}) - memory refresh needed`;
      }
      console.warn(`[StateSynchronizer] ${warning}`);
    }

    return {
      memoryCount,
      databaseCount,
      unifiedCount,
      isConsistent,
      source,
      warning,
    };
  }

  /**
   * Force immediate synchronization
   */
  async forceSynchronization(
    memoryPositions: ExecutionPosition[],
    userId?: string
  ): Promise<SyncResult> {
    return this.synchronizeState(
      memoryPositions,
      { syncDirection: "bidirectional", forceSync: true },
      userId
    );
  }

  /**
   * Get synchronization status
   */
  getSyncStatus(): {
    lastSyncTime: string | null;
    syncInProgress: boolean;
  } {
    return {
      lastSyncTime: this.lastSyncTime?.toISOString() || null,
      syncInProgress: this.syncInProgress,
    };
  }
}

// Export singleton instance
export const autoSnipingStateSynchronizer = AutoSnipingStateSynchronizer.getInstance();
