import type {
  AgentOrchestrationMetrics,
  MexcWorkflowResult,
} from "./orchestrator-types";

/**
 * Manages orchestration metrics and performance tracking
 * Extracted from MexcOrchestrator to follow Single Responsibility Principle
 */
export class OrchestrationMetricsManager {
  private metrics: AgentOrchestrationMetrics;

  constructor() {
    this.metrics = {
      totalExecutions: 0,
      successRate: 0,
      averageDuration: 0,
      errorRate: 0,
      lastExecution: new Date().toISOString(),
    };
  }

  /**
   * Records the result of a workflow execution and updates metrics
   */
  recordExecution(result: MexcWorkflowResult, startTime: number): void {
    const duration = Date.now() - startTime;
    this.metrics.totalExecutions++;

    // Update success/error rates using proper statistical calculation
    if (result.success) {
      const previousSuccessCount = Math.round(
        this.metrics.successRate * (this.metrics.totalExecutions - 1)
      );
      this.metrics.successRate =
        (previousSuccessCount + 1) / this.metrics.totalExecutions;
    } else {
      const previousErrorCount = Math.round(
        this.metrics.errorRate * (this.metrics.totalExecutions - 1)
      );
      this.metrics.errorRate =
        (previousErrorCount + 1) / this.metrics.totalExecutions;
    }

    // Update average duration using running average formula
    const previousTotalDuration =
      this.metrics.averageDuration * (this.metrics.totalExecutions - 1);
    this.metrics.averageDuration =
      (previousTotalDuration + duration) / this.metrics.totalExecutions;

    // Update last execution timestamp
    this.metrics.lastExecution = new Date().toISOString();
  }

  /**
   * Gets current orchestration metrics
   */
  getMetrics(): AgentOrchestrationMetrics {
    return { ...this.metrics };
  }

  /**
   * Resets all metrics to initial state
   */
  reset(): void {
    this.metrics = {
      totalExecutions: 0,
      successRate: 0,
      averageDuration: 0,
      errorRate: 0,
      lastExecution: new Date().toISOString(),
    };
  }

  /**
   * Gets performance summary for monitoring
   */
  getPerformanceSummary(): {
    totalExecutions: number;
    successRate: number;
    averageDurationMs: number;
    errorRate: number;
    isHealthy: boolean;
  } {
    const isHealthy =
      this.metrics.successRate >= 0.95 && this.metrics.errorRate <= 0.05;

    return {
      totalExecutions: this.metrics.totalExecutions,
      successRate: this.metrics.successRate,
      averageDurationMs: this.metrics.averageDuration,
      errorRate: this.metrics.errorRate,
      isHealthy,
    };
  }
}
