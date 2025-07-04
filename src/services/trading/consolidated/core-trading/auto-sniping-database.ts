/**
 * Auto-Sniping Database Operations
 *
 * Database operations for auto-sniping functionality.
 * Extracted from auto-sniping.ts for better modularity.
 */

import { and, eq, isNull, lt, or } from "drizzle-orm";
import { db } from "@/src/db";
import { snipeTargets } from "@/src/db/schemas/trading";
import { toSafeError } from "@/src/lib/error-type-utils";
import type { AutoSnipeTarget, ModuleContext } from "./auto-sniping-types";

export class AutoSnipingDatabase {
  private context: ModuleContext;

  constructor(context: ModuleContext) {
    this.context = context;
  }

  /**
   * Get ready snipe targets from database
   */
  async getReadySnipeTargets(): Promise<AutoSnipeTarget[]> {
    try {
      const now = new Date();
      const targets = await db
        .select({
          id: snipeTargets.id,
          vcoinId: snipeTargets.vcoinId,
          symbolName: snipeTargets.symbolName,
          targetPrice: snipeTargets.targetPrice,
          positionSizeUsdt: snipeTargets.positionSizeUsdt,
          status: snipeTargets.status,
          priority: snipeTargets.priority,
          riskLevel: snipeTargets.riskLevel,
          createdAt: snipeTargets.createdAt,
          updatedAt: snipeTargets.updatedAt,
          entryPrice: snipeTargets.entryPrice,
          executionStatus: snipeTargets.executionStatus,
          executionPrice: snipeTargets.executionPrice,
          confidenceScore: snipeTargets.confidenceScore,
          takeProfitLevel: snipeTargets.takeProfitLevel,
          errorMessage: snipeTargets.errorMessage,
          targetExecutionTime: snipeTargets.targetExecutionTime,
          actualExecutionTime: snipeTargets.actualExecutionTime,
          actualPositionSize: snipeTargets.actualPositionSize,
          entryStrategy: snipeTargets.entryStrategy,
          maxRetries: snipeTargets.maxRetries,
          currentRetries: snipeTargets.currentRetries,
          takeProfitCustom: snipeTargets.takeProfitCustom,
          stopLossPercent: snipeTargets.stopLossPercent,
        })
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
        .limit(10);

      return targets;
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error(
        "Failed to fetch ready snipe targets",
        safeError
      );
      return [];
    }
  }

  /**
   * Update snipe target status in database
   */
  async updateSnipeTargetStatus(
    targetId: number,
    status: string,
    errorMessage?: string
  ): Promise<void> {
    try {
      const updateData: {
        status: string;
        updatedAt: Date;
        actualExecutionTime?: Date;
        errorMessage?: string;
      } = {
        status,
        updatedAt: new Date(),
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
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to update snipe target status", {
        targetId,
        status,
        error: safeError,
      });
    }
  }

  /**
   * Get snipe target by ID
   */
  async getSnipeTargetById(targetId: number): Promise<AutoSnipeTarget | null> {
    try {
      const targets = await db
        .select({
          id: snipeTargets.id,
          vcoinId: snipeTargets.vcoinId,
          symbolName: snipeTargets.symbolName,
          targetPrice: snipeTargets.targetPrice,
          positionSizeUsdt: snipeTargets.positionSizeUsdt,
          status: snipeTargets.status,
          priority: snipeTargets.priority,
          riskLevel: snipeTargets.riskLevel,
          createdAt: snipeTargets.createdAt,
          updatedAt: snipeTargets.updatedAt,
          entryPrice: snipeTargets.entryPrice,
          executionStatus: snipeTargets.executionStatus,
          executionPrice: snipeTargets.executionPrice,
          confidenceScore: snipeTargets.confidenceScore,
          takeProfitLevel: snipeTargets.takeProfitLevel,
          errorMessage: snipeTargets.errorMessage,
          targetExecutionTime: snipeTargets.targetExecutionTime,
          actualExecutionTime: snipeTargets.actualExecutionTime,
          actualPositionSize: snipeTargets.actualPositionSize,
          entryStrategy: snipeTargets.entryStrategy,
          maxRetries: snipeTargets.maxRetries,
          currentRetries: snipeTargets.currentRetries,
          takeProfitCustom: snipeTargets.takeProfitCustom,
          stopLossPercent: snipeTargets.stopLossPercent,
        })
        .from(snipeTargets)
        .where(eq(snipeTargets.id, targetId))
        .limit(1);

      return targets[0] || null;
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to fetch snipe target by ID", {
        targetId,
        error: safeError,
      });
      return null;
    }
  }

  /**
   * Update target execution details
   */
  async updateTargetExecution(
    targetId: number,
    executionPrice: number,
    actualPositionSize: number,
    orderId?: string
  ): Promise<void> {
    try {
      const updateData: {
        executionPrice: number;
        actualPositionSize: number;
        actualExecutionTime: Date;
        updatedAt: Date;
        orderId?: string;
      } = {
        executionPrice,
        actualPositionSize,
        actualExecutionTime: new Date(),
        updatedAt: new Date(),
      };

      if (orderId) {
        (updateData as any).orderId = orderId;
      }

      await db
        .update(snipeTargets)
        .set(updateData)
        .where(eq(snipeTargets.id, targetId));
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to update target execution details", {
        targetId,
        executionPrice,
        actualPositionSize,
        error: safeError,
      });
    }
  }

  /**
   * Get targets by status
   */
  async getTargetsByStatus(status: string): Promise<AutoSnipeTarget[]> {
    try {
      const targets = await db
        .select({
          id: snipeTargets.id,
          vcoinId: snipeTargets.vcoinId,
          symbolName: snipeTargets.symbolName,
          targetPrice: snipeTargets.targetPrice,
          positionSizeUsdt: snipeTargets.positionSizeUsdt,
          status: snipeTargets.status,
          priority: snipeTargets.priority,
          riskLevel: snipeTargets.riskLevel,
          createdAt: snipeTargets.createdAt,
          updatedAt: snipeTargets.updatedAt,
          entryPrice: snipeTargets.entryPrice,
          executionStatus: snipeTargets.executionStatus,
          executionPrice: snipeTargets.executionPrice,
          confidenceScore: snipeTargets.confidenceScore,
          takeProfitLevel: snipeTargets.takeProfitLevel,
          errorMessage: snipeTargets.errorMessage,
          targetExecutionTime: snipeTargets.targetExecutionTime,
          actualExecutionTime: snipeTargets.actualExecutionTime,
          actualPositionSize: snipeTargets.actualPositionSize,
          entryStrategy: snipeTargets.entryStrategy,
          maxRetries: snipeTargets.maxRetries,
          currentRetries: snipeTargets.currentRetries,
          takeProfitCustom: snipeTargets.takeProfitCustom,
          stopLossPercent: snipeTargets.stopLossPercent,
        })
        .from(snipeTargets)
        .where(eq(snipeTargets.status, status))
        .orderBy(snipeTargets.priority, snipeTargets.createdAt);

      return targets;
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to fetch targets by status", {
        status,
        error: safeError,
      });
      return [];
    }
  }

  /**
   * Increment retry count for a target
   */
  async incrementRetryCount(targetId: number): Promise<void> {
    try {
      await db
        .update(snipeTargets)
        .set({
          currentRetries: snipeTargets.currentRetries + 1,
          updatedAt: new Date(),
        })
        .where(eq(snipeTargets.id, targetId));
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to increment retry count", {
        targetId,
        error: safeError,
      });
    }
  }

  /**
   * Mark target as failed with retry exhausted
   */
  async markTargetRetryExhausted(
    targetId: number,
    errorMessage: string
  ): Promise<void> {
    try {
      await db
        .update(snipeTargets)
        .set({
          status: "failed",
          errorMessage: `Retry exhausted: ${errorMessage}`,
          updatedAt: new Date(),
        })
        .where(eq(snipeTargets.id, targetId));
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to mark target as retry exhausted", {
        targetId,
        error: safeError,
      });
    }
  }
}
