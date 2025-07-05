import { db } from "@/src/db";
import { workflowActivity } from "@/src/db/schema";

export interface WorkflowExecutionLog {
  workflowId: string;
  type: string;
  message: string;
  level: "info" | "warning" | "error" | "success";
  symbolName?: string;
  vcoinId?: string;
  userId?: string;
}

/**
 * Log a workflow execution activity
 */
export async function logExecution(
  execution: WorkflowExecutionLog
): Promise<void> {
  try {
    const activityId = `${execution.workflowId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    await db.insert(workflowActivity).values({
      userId: execution.userId || "default",
      activityId,
      workflowId: execution.workflowId,
      type: execution.type,
      message: execution.message,
      level: execution.level,
      symbolName: execution.symbolName,
      vcoinId: execution.vcoinId,
    });

    console.log(
      `✅ Workflow execution logged: ${execution.workflowId} - ${execution.message}`
    );
  } catch (error) {
    console.error("❌ Failed to log workflow execution:", {
      error,
      execution,
    });
    // Don't throw - logging failures shouldn't break workflows
  }
}

/**
 * Log workflow start
 */
export async function logStart(
  workflowId: string,
  message?: string,
  metadata?: {
    symbolName?: string;
    vcoinId?: string;
    userId?: string;
  }
): Promise<void> {
  await logExecution({
    workflowId,
    type: "workflow_start",
    message: message || `Workflow ${workflowId} started`,
    level: "info",
    ...metadata,
  });
}

/**
 * Log workflow success
 */
export async function logSuccess(
  workflowId: string,
  message?: string,
  metadata?: {
    symbolName?: string;
    vcoinId?: string;
    userId?: string;
  }
): Promise<void> {
  await logExecution({
    workflowId,
    type: "workflow_success",
    message: message || `Workflow ${workflowId} completed successfully`,
    level: "success",
    ...metadata,
  });
}

/**
 * Log workflow error
 */
export async function logError(
  workflowId: string,
  error: Error | string,
  metadata?: {
    symbolName?: string;
    vcoinId?: string;
    userId?: string;
  }
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : error;
  await logExecution({
    workflowId,
    type: "workflow_error",
    message: `Workflow ${workflowId} failed: ${errorMessage}`,
    level: "error",
    ...metadata,
  });
}

/**
 * Log workflow progress/info
 */
export async function logProgress(
  workflowId: string,
  message: string,
  metadata?: {
    symbolName?: string;
    vcoinId?: string;
    userId?: string;
  }
): Promise<void> {
  await logExecution({
    workflowId,
    type: "workflow_progress",
    message,
    level: "info",
    ...metadata,
  });
}

/**
 * Log workflow warning
 */
export async function logWarning(
  workflowId: string,
  message: string,
  metadata?: {
    symbolName?: string;
    vcoinId?: string;
    userId?: string;
  }
): Promise<void> {
  await logExecution({
    workflowId,
    type: "workflow_warning",
    message,
    level: "warning",
    ...metadata,
  });
}

/**
 * Create a workflow execution context for easier logging
 */
export function createContext(
  workflowId: string,
  metadata?: {
    symbolName?: string;
    vcoinId?: string;
    userId?: string;
  }
) {
  return {
    workflowId,
    metadata,
    logStart: (message?: string) => logStart(workflowId, message, metadata),
    logSuccess: (message?: string) => logSuccess(workflowId, message, metadata),
    logError: (error: Error | string) => logError(workflowId, error, metadata),
    logProgress: (message: string) =>
      logProgress(workflowId, message, metadata),
    logWarning: (message: string) => logWarning(workflowId, message, metadata),
  };
}
