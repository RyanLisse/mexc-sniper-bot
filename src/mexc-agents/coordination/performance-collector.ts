/**
 * Performance Collector
 *
 * This file has been refactored for maintainability.
 * The original 923-line implementation has been split into focused modules.
 *
 * This file now serves as a backward-compatibility layer.
 */

export type {
  AgentPerformanceMetrics,
  MetricsStorage,
  PerformanceCollectorOptions,
  PerformanceReport,
  SystemPerformanceSnapshot,
  WorkflowPerformanceMetrics,
} from "./performance";
// Re-export everything from the new modular structure
export {
  AgentMetricsCollector,
  PerformanceCollector,
  PerformanceReportGenerator,
  SystemMetricsCollector,
  WorkflowMetricsCollector,
} from "./performance";
