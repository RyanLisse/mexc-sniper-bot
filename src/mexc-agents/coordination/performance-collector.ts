/**
 * Performance Collector
 * 
 * This file has been refactored for maintainability.
 * The original 923-line implementation has been split into focused modules.
 * 
 * This file now serves as a backward-compatibility layer.
 */

// Re-export everything from the new modular structure
export { 
  PerformanceCollector,
  AgentMetricsCollector,
  SystemMetricsCollector, 
  WorkflowMetricsCollector,
  PerformanceReportGenerator
} from "./performance";

export type {
  AgentPerformanceMetrics,
  WorkflowPerformanceMetrics,
  SystemPerformanceSnapshot,
  PerformanceReport,
  PerformanceCollectorOptions,
  MetricsStorage,
} from "./performance";