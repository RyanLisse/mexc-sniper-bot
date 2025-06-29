/**
 * Performance Collection System
 * 
 * Refactored from a single 923-line file into focused modules
 * 
 * Provides:
 * - Agent performance metrics collection
 * - Workflow execution tracking
 * - System resource monitoring
 * - Performance reporting and analysis
 */

// Main collector
export { PerformanceCollector } from "./performance-collector";

// Individual collectors
export { AgentMetricsCollector } from "./collectors/agent-metrics-collector";
export { SystemMetricsCollector } from "./collectors/system-metrics-collector";
export { WorkflowMetricsCollector } from "./collectors/workflow-metrics-collector";

// Report generator
export { PerformanceReportGenerator } from "./reporters/performance-report-generator";

// Types
export type {
  AgentPerformanceMetrics,
  WorkflowPerformanceMetrics,
  SystemPerformanceSnapshot,
  PerformanceReport,
  PerformanceCollectorOptions,
  MetricsStorage,
} from "./types";