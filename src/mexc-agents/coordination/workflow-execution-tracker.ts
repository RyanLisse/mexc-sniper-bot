// Build-safe imports - avoid structured logger to prevent webpack bundling issues
import type {
  WorkflowContext,
  WorkflowExecutionResult,
  WorkflowStepResult,
} from "./workflow-engine-types";

/**
 * Workflow execution tracking, metadata generation, and history management
 */
export class WorkflowExecutionTracker {
  // Simple console logger to avoid webpack bundling issues
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[workflow-execution-tracker]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[workflow-execution-tracker]", message, context || ""),
    error: (message: string, context?: any) =>
      console.error("[workflow-execution-tracker]", message, context || ""),
    debug: (message: string, context?: any) =>
      console.debug("[workflow-execution-tracker]", message, context || ""),
  };
  private executionHistory: WorkflowExecutionResult[] = [];
  private maxHistorySize = 1000;

  /**
   * Generate execution metadata from workflow context
   */
  generateExecutionMetadata(context: WorkflowContext): {
    agentsUsed: string[];
    stepsExecuted: number;
    stepsSkipped: number;
    stepsFailed: number;
    retriesPerformed: number;
    fallbacksUsed: number;
  } {
    const stepResults = Array.from(context.stepResults.values());
    const agentsUsed = [...new Set(stepResults.map((step) => step.agentId))];
    const stepsExecuted = stepResults.filter((step) => step.status === "completed").length;
    const stepsSkipped = stepResults.filter((step) => step.status === "skipped").length;
    const stepsFailed = stepResults.filter((step) => step.status === "failed").length;
    const retriesPerformed = stepResults.reduce(
      (sum, step) => sum + Math.max(0, step.attempt - 1),
      0
    );
    const fallbacksUsed = 0; // Would need to track this separately in actual implementation

    return {
      agentsUsed,
      stepsExecuted,
      stepsSkipped,
      stepsFailed,
      retriesPerformed,
      fallbacksUsed,
    };
  }

  /**
   * Create workflow execution result from context and status
   */
  createExecutionResult(
    workflowId: string,
    status: "completed" | "failed" | "timeout" | "cancelled",
    startTime: Date,
    context: WorkflowContext,
    error?: string
  ): WorkflowExecutionResult {
    const endTime = new Date();
    const finalStepResults = Array.from(context.stepResults.values());

    // Determine final output from last successful step
    const lastSuccessfulStep = finalStepResults
      .filter((step) => step.status === "completed")
      .sort((a, b) => (b.endTime?.getTime() || 0) - (a.endTime?.getTime() || 0))[0];

    return {
      workflowId,
      status,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      steps: finalStepResults,
      output: lastSuccessfulStep?.output,
      error,
      metadata: this.generateExecutionMetadata(context),
    };
  }

  /**
   * Add result to execution history
   */
  addToExecutionHistory(result: WorkflowExecutionResult): void {
    this.executionHistory.push(result);

    // Keep only the most recent entries
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory.splice(0, this.executionHistory.length - this.maxHistorySize);
    }

    this.logger.debug(
      `[ExecutionTracker] Added workflow ${result.workflowId} to history (${result.status})`
    );
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit?: number): WorkflowExecutionResult[] {
    return limit ? this.executionHistory.slice(-limit) : [...this.executionHistory];
  }

  /**
   * Get execution statistics
   */
  getExecutionStats(): {
    totalExecutions: number;
    completedExecutions: number;
    failedExecutions: number;
    averageDuration: number;
    successRate: number;
  } {
    const total = this.executionHistory.length;
    const completed = this.executionHistory.filter((r) => r.status === "completed").length;
    const failed = this.executionHistory.filter((r) => r.status === "failed").length;
    const avgDuration =
      total > 0 ? this.executionHistory.reduce((sum, r) => sum + r.duration, 0) / total : 0;
    const successRate = total > 0 ? (completed / total) * 100 : 0;

    return {
      totalExecutions: total,
      completedExecutions: completed,
      failedExecutions: failed,
      averageDuration: avgDuration,
      successRate,
    };
  }

  /**
   * Clear execution history
   */
  clearHistory(): void {
    const previousCount = this.executionHistory.length;
    this.executionHistory = [];

    this.logger.info(`[ExecutionTracker] Cleared ${previousCount} workflow execution records`);
  }

  /**
   * Set maximum history size
   */
  setMaxHistorySize(size: number): void {
    this.maxHistorySize = Math.max(1, size);

    // Trim current history if needed
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory.splice(0, this.executionHistory.length - this.maxHistorySize);
    }
  }

  /**
   * Get workflow execution by ID
   */
  getExecutionById(executionId: string): WorkflowExecutionResult | null {
    return (
      this.executionHistory.find((result) =>
        result.steps.some((step) => step.stepId.includes(executionId))
      ) || null
    );
  }

  /**
   * Get recent executions for a specific workflow
   */
  getRecentExecutionsForWorkflow(workflowId: string, limit = 10): WorkflowExecutionResult[] {
    return this.executionHistory.filter((result) => result.workflowId === workflowId).slice(-limit);
  }
}
