/**
 * Workflow Metrics Collector
 *
 * Records and processes workflow execution performance metrics
 */

import type { WorkflowExecutionResult } from "../../workflow-engine";
import type { WorkflowPerformanceMetrics } from "../types";

export class WorkflowMetricsCollector {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[workflow-metrics-collector]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[workflow-metrics-collector]", message, context || ""),
    error: (message: string, context?: any) =>
      console.error("[workflow-metrics-collector]", message, context || ""),
    debug: (message: string, context?: any) =>
      console.debug("[workflow-metrics-collector]", message, context || ""),
  };

  /**
   * Record workflow execution metrics
   */
  recordWorkflowExecution(
    result: WorkflowExecutionResult,
    workflowMetricsHistory: WorkflowPerformanceMetrics[],
    maxHistorySize: number
  ): void {
    try {
      const stepDurations = result.steps.map((step) => step.duration);
      const totalResponseTime = stepDurations.reduce(
        (sum, duration) => sum + duration,
        0
      );
      const averageStepTime =
        stepDurations.length > 0 ? totalResponseTime / stepDurations.length : 0;

      // Find bottleneck step
      const bottleneckStep = result.steps.reduce(
        (max, step) => (step.duration > max.duration ? step : max),
        result.steps[0]
      );

      const metrics: WorkflowPerformanceMetrics = {
        workflowId: result.workflowId,
        executionId: `${result.workflowId}-${result.startTime.getTime()}`, // Simplified
        timestamp: result.endTime,
        duration: result.duration,
        status: result.status,
        stepsExecuted: result.metadata.stepsExecuted,
        stepsSkipped: result.metadata.stepsSkipped,
        stepsFailed: result.metadata.stepsFailed,
        agentsUsed: result.metadata.agentsUsed,
        retriesPerformed: result.metadata.retriesPerformed,
        fallbacksUsed: result.metadata.fallbacksUsed,
        totalResponseTime,
        averageStepTime,
        bottleneckStep: bottleneckStep?.stepId,
        bottleneckDuration: bottleneckStep?.duration,
        resourceUsage: {
          peakMemory: this.estimateWorkflowMemoryUsage(result),
          averageMemory: this.estimateWorkflowMemoryUsage(result) * 0.8, // Simplified
          peakCpu: this.estimateWorkflowCpuUsage(result),
          averageCpu: this.estimateWorkflowCpuUsage(result) * 0.7, // Simplified
        },
        metadata: {
          workflowType: "mexc-trading", // Could be derived from workflowId
          startTime: result.startTime,
          endTime: result.endTime,
        },
      };

      workflowMetricsHistory.push(metrics);

      // Keep only recent history
      if (workflowMetricsHistory.length > maxHistorySize) {
        workflowMetricsHistory.splice(
          0,
          workflowMetricsHistory.length - maxHistorySize
        );
      }

      this.logger.info(`Recorded workflow metrics for ${result.workflowId}`);
    } catch (error) {
      this.logger.error(
        "Failed to record workflow metrics:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private estimateWorkflowMemoryUsage(result: WorkflowExecutionResult): number {
    // Estimate memory usage based on workflow complexity
    const baseMemory = 100; // Base 100MB
    const stepMemory = result.steps.length * 10; // 10MB per step
    const durationMemory = Math.min(200, result.duration / 1000); // 1MB per second, max 200MB

    return Math.round(baseMemory + stepMemory + durationMemory);
  }

  private estimateWorkflowCpuUsage(result: WorkflowExecutionResult): number {
    // Estimate CPU usage based on workflow characteristics
    const baseCpu = 20; // Base 20%
    const stepCpu = result.steps.length * 5; // 5% per step
    const errorPenalty = result.metadata.stepsFailed * 10; // 10% penalty per failed step

    return Math.min(100, baseCpu + stepCpu + errorPenalty);
  }
}
