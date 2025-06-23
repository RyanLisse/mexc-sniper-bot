import { randomUUID } from "node:crypto";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { db } from "../db";
import {
  type NewWorkflowActivity,
  type NewWorkflowSystemStatus,
  type WorkflowActivity,
  type WorkflowSystemStatus,
  workflowActivity,
  workflowSystemStatus,
} from "../db/schema";
import { databaseBreaker } from "./circuit-breaker";

export interface WorkflowMetrics {
  readyTokens?: number;
  totalDetections?: number;
  successfulSnipes?: number;
  totalProfit?: number;
  successRate?: number;
  averageROI?: number;
  bestTrade?: number;
}

export interface ActivityEntry {
  type: "pattern" | "calendar" | "snipe" | "analysis";
  message: string;
  level?: "info" | "warning" | "error" | "success";
  workflowId?: string;
  symbolName?: string;
  vcoinId?: string;
}

export class WorkflowStatusService {
  private userId: string;

  constructor(userId = "default") {
    this.userId = userId;
  }

  /**
   * Get current workflow system status with circuit breaker protection
   */
  async getSystemStatus(): Promise<WorkflowSystemStatus | null> {
    return databaseBreaker.execute(
      async () => {
        const maxRetries = 3;
        const baseDelay = 1000; // 1 second

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const result = await db
              .select()
              .from(workflowSystemStatus)
              .where(eq(workflowSystemStatus.userId, this.userId))
              .limit(1);

            return result.length > 0 ? result[0] : null;
          } catch (error) {
            console.error(
              `[WorkflowStatusService] Failed to get system status (attempt ${attempt}/${maxRetries}):`,
              error
            );

            if (attempt === maxRetries) {
              throw error; // Let circuit breaker handle this
            }

            // Exponential backoff: wait before retrying
            const delay = baseDelay * 2 ** (attempt - 1);
            console.log(`[WorkflowStatusService] Retrying in ${delay}ms...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }

        throw new Error("Maximum retry attempts exceeded");
      },
      async () => {
        // Fallback when database circuit breaker is open
        console.warn("[WorkflowStatusService] Database circuit breaker fallback triggered");
        return null;
      }
    );
  }

  /**
   * Initialize or get system status with defaults and error handling
   */
  async getOrCreateSystemStatus(): Promise<WorkflowSystemStatus> {
    let status = await this.getSystemStatus();

    if (!status) {
      try {
        // Create initial status
        const newStatus: NewWorkflowSystemStatus = {
          userId: this.userId,
          systemStatus: "stopped",
          lastUpdate: new Date(),
          activeWorkflows: "[]",
          readyTokens: 0,
          totalDetections: 0,
          successfulSnipes: 0,
          totalProfit: 0,
          successRate: 0,
          averageROI: 0,
          bestTrade: 0,
        };

        const result = await db.insert(workflowSystemStatus).values(newStatus).returning();
        status = result[0];
      } catch (error) {
        console.error("[WorkflowStatusService] Failed to create system status:", error);

        // Return a fallback status object to prevent total failure
        return {
          id: 0,
          userId: this.userId,
          systemStatus: "error",
          lastUpdate: new Date(),
          activeWorkflows: "[]",
          readyTokens: 0,
          totalDetections: 0,
          successfulSnipes: 0,
          totalProfit: 0,
          successRate: 0,
          averageROI: 0,
          bestTrade: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
    }

    return status;
  }

  /**
   * Update system status
   */
  async updateSystemStatus(
    systemStatusValue: "running" | "stopped" | "error"
  ): Promise<WorkflowSystemStatus> {
    const currentStatus = await this.getOrCreateSystemStatus();

    const updatedData = {
      systemStatus: systemStatusValue,
      lastUpdate: new Date(),
      updatedAt: new Date(),
      // Clear active workflows when stopping
      ...(systemStatusValue === "stopped" && { activeWorkflows: "[]" }),
    };

    const result = await db
      .update(workflowSystemStatus)
      .set(updatedData)
      .where(eq(workflowSystemStatus.id, currentStatus.id))
      .returning();

    return result[0];
  }

  /**
   * Update metrics
   */
  async updateMetrics(metrics: WorkflowMetrics): Promise<WorkflowSystemStatus> {
    const currentStatus = await this.getOrCreateSystemStatus();

    const updatedData = {
      ...metrics,
      lastUpdate: new Date(),
      updatedAt: new Date(),
    };

    const result = await db
      .update(workflowSystemStatus)
      .set(updatedData)
      .where(eq(workflowSystemStatus.id, currentStatus.id))
      .returning();

    return result[0];
  }

  /**
   * Add or remove active workflow
   */
  async updateActiveWorkflows(
    action: "add" | "remove",
    workflowId: string
  ): Promise<WorkflowSystemStatus> {
    const currentStatus = await this.getOrCreateSystemStatus();

    let activeWorkflows: string[] = [];
    try {
      activeWorkflows = JSON.parse(currentStatus.activeWorkflows);
    } catch {
      activeWorkflows = [];
    }

    if (action === "add" && !activeWorkflows.includes(workflowId)) {
      activeWorkflows.push(workflowId);
    } else if (action === "remove") {
      activeWorkflows = activeWorkflows.filter((id) => id !== workflowId);
    }

    const result = await db
      .update(workflowSystemStatus)
      .set({
        activeWorkflows: JSON.stringify(activeWorkflows),
        lastUpdate: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(workflowSystemStatus.id, currentStatus.id))
      .returning();

    return result[0];
  }

  /**
   * Add activity entry
   */
  async addActivity(activity: ActivityEntry): Promise<WorkflowActivity> {
    const activityData: NewWorkflowActivity = {
      userId: this.userId,
      activityId: randomUUID(),
      type: activity.type,
      message: activity.message,
      level: activity.level || "info",
      workflowId: activity.workflowId,
      symbolName: activity.symbolName,
      vcoinId: activity.vcoinId,
      timestamp: new Date(),
    };

    const result = await db.insert(workflowActivity).values(activityData).returning();

    // Clean up old activities (keep only last 50)
    await this.cleanupOldActivities();

    return result[0];
  }

  /**
   * Get recent activities
   */
  async getRecentActivities(limit = 10): Promise<WorkflowActivity[]> {
    try {
      const activities = await db
        .select()
        .from(workflowActivity)
        .where(eq(workflowActivity.userId, this.userId))
        .orderBy(desc(workflowActivity.timestamp))
        .limit(limit);

      return activities;
    } catch (error) {
      console.error("[WorkflowStatusService] Failed to get activities:", error);
      return [];
    }
  }

  /**
   * Clean up old activity entries
   */
  private async cleanupOldActivities(): Promise<void> {
    try {
      // Count total activities for this user
      const totalCount = await db
        .select()
        .from(workflowActivity)
        .where(eq(workflowActivity.userId, this.userId));

      if (totalCount.length > 50) {
        // Get the 50th activity timestamp to use as cutoff
        const cutoffActivity = await db
          .select()
          .from(workflowActivity)
          .where(eq(workflowActivity.userId, this.userId))
          .orderBy(desc(workflowActivity.timestamp))
          .limit(1)
          .offset(49); // 50th activity (0-indexed)

        if (cutoffActivity.length > 0) {
          // Delete activities older than the cutoff
          await db.delete(workflowActivity).where(
            and(
              eq(workflowActivity.userId, this.userId),
              // Activities older than the 50th most recent
              lt(workflowActivity.timestamp, cutoffActivity[0].timestamp)
            )
          );
        }
      }
    } catch (error) {
      console.error("[WorkflowStatusService] Failed to cleanup activities:", error);
    }
  }

  /**
   * Get full workflow status (system + recent activities)
   */
  async getFullStatus() {
    const [systemStatus, recentActivity] = await Promise.all([
      this.getOrCreateSystemStatus(),
      this.getRecentActivities(10),
    ]);

    // Parse active workflows
    let activeWorkflows: string[] = [];
    try {
      activeWorkflows = JSON.parse(systemStatus.activeWorkflows);
    } catch {
      activeWorkflows = [];
    }

    // Format activities for API response
    const formattedActivities = recentActivity.map((activity) => ({
      id: activity.activityId,
      type: activity.type,
      message: activity.message,
      timestamp: activity.timestamp.toISOString(),
      level: activity.level,
      workflowId: activity.workflowId,
      symbolName: activity.symbolName,
      vcoinId: activity.vcoinId,
    }));

    return {
      systemStatus: systemStatus.systemStatus,
      lastUpdate: systemStatus.lastUpdate.toISOString(),
      activeWorkflows,
      metrics: {
        readyTokens: systemStatus.readyTokens,
        totalDetections: systemStatus.totalDetections,
        successfulSnipes: systemStatus.successfulSnipes,
        totalProfit: systemStatus.totalProfit,
        successRate: systemStatus.successRate,
        averageROI: systemStatus.averageROI,
        bestTrade: systemStatus.bestTrade,
      },
      recentActivity: formattedActivities,
    };
  }
}
