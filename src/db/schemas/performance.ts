import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { z } from "zod";

// Agent Performance Metrics Table
export const agentPerformanceMetrics = sqliteTable("agent_performance_metrics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  agentId: text("agent_id").notNull(),
  timestamp: integer("timestamp").notNull(), // Unix timestamp
  responseTime: real("response_time").notNull(),
  successRate: real("success_rate").notNull(),
  errorRate: real("error_rate").notNull(),
  throughput: real("throughput").notNull(),
  memoryUsage: real("memory_usage").notNull(),
  cpuUsage: real("cpu_usage").notNull(),
  cacheHitRate: real("cache_hit_rate").notNull(),
  totalRequests: integer("total_requests").notNull(),
  totalErrors: integer("total_errors").notNull(),
  averageResponseTime: real("average_response_time").notNull(),
  p95ResponseTime: real("p95_response_time").notNull(),
  p99ResponseTime: real("p99_response_time").notNull(),
  uptime: real("uptime").notNull(),
  lastError: text("last_error"),
  metadata: text("metadata"), // JSON string
  createdAt: integer("created_at").notNull().default(Date.now()),
});

// Workflow Performance Metrics Table
export const workflowPerformanceMetrics = sqliteTable("workflow_performance_metrics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workflowId: text("workflow_id").notNull(),
  executionId: text("execution_id").notNull(),
  timestamp: integer("timestamp").notNull(), // Unix timestamp
  duration: integer("duration").notNull(),
  status: text("status").notNull(), // "completed" | "failed" | "timeout" | "cancelled"
  stepsExecuted: integer("steps_executed").notNull(),
  stepsSkipped: integer("steps_skipped").notNull(),
  stepsFailed: integer("steps_failed").notNull(),
  agentsUsed: text("agents_used").notNull(), // JSON array
  retriesPerformed: integer("retries_performed").notNull(),
  fallbacksUsed: integer("fallbacks_used").notNull(),
  totalResponseTime: real("total_response_time").notNull(),
  averageStepTime: real("average_step_time").notNull(),
  bottleneckStep: text("bottleneck_step"),
  bottleneckDuration: real("bottleneck_duration"),
  peakMemory: real("peak_memory").notNull(),
  averageMemory: real("average_memory").notNull(),
  peakCpu: real("peak_cpu").notNull(),
  averageCpu: real("average_cpu").notNull(),
  metadata: text("metadata"), // JSON string
  createdAt: integer("created_at").notNull().default(Date.now()),
});

// System Performance Snapshots Table
export const systemPerformanceSnapshots = sqliteTable("system_performance_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  timestamp: integer("timestamp").notNull(), // Unix timestamp
  totalAgents: integer("total_agents").notNull(),
  healthyAgents: integer("healthy_agents").notNull(),
  degradedAgents: integer("degraded_agents").notNull(),
  unhealthyAgents: integer("unhealthy_agents").notNull(),
  totalWorkflows: integer("total_workflows").notNull(),
  runningWorkflows: integer("running_workflows").notNull(),
  completedWorkflows: integer("completed_workflows").notNull(),
  failedWorkflows: integer("failed_workflows").notNull(),
  systemMemoryUsage: real("system_memory_usage").notNull(),
  systemCpuUsage: real("system_cpu_usage").notNull(),
  databaseConnections: integer("database_connections").notNull(),
  averageResponseTime: real("average_response_time").notNull(),
  throughput: real("throughput").notNull(),
  errorRate: real("error_rate").notNull(),
  uptime: integer("uptime").notNull(),
  metadata: text("metadata"), // JSON string
  createdAt: integer("created_at").notNull().default(Date.now()),
});

// Performance Alerts Table
export const performanceAlerts = sqliteTable("performance_alerts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  alertType: text("alert_type").notNull(), // "agent_degraded" | "workflow_failed" | "system_overload"
  severity: text("severity").notNull(), // "low" | "medium" | "high" | "critical"
  targetId: text("target_id").notNull(), // Agent ID, Workflow ID, or "system"
  targetType: text("target_type").notNull(), // "agent" | "workflow" | "system"
  message: text("message").notNull(),
  threshold: real("threshold"),
  actualValue: real("actual_value"),
  isResolved: integer("is_resolved").notNull().default(0),
  resolvedAt: integer("resolved_at"),
  resolvedBy: text("resolved_by"),
  metadata: text("metadata"), // JSON string
  createdAt: integer("created_at").notNull().default(Date.now()),
  updatedAt: integer("updated_at").notNull().default(Date.now()),
});

// Performance Baselines Table (for comparison and trend analysis)
export const performanceBaselines = sqliteTable("performance_baselines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  targetId: text("target_id").notNull(), // Agent ID, Workflow ID, or "system"
  targetType: text("target_type").notNull(), // "agent" | "workflow" | "system"
  metricName: text("metric_name").notNull(), // "response_time" | "success_rate" | "throughput"
  baselineValue: real("baseline_value").notNull(),
  calculationPeriod: integer("calculation_period").notNull(), // Period in milliseconds
  sampleCount: integer("sample_count").notNull(),
  standardDeviation: real("standard_deviation"),
  confidenceInterval: real("confidence_interval"), // 95% confidence interval
  calculatedAt: integer("calculated_at").notNull(),
  validUntil: integer("valid_until"), // When baseline should be recalculated
  metadata: text("metadata"), // JSON string
  createdAt: integer("created_at").notNull().default(Date.now()),
});

// Zod schemas for validation (simplified without drizzle-zod dependency)
export const insertAgentPerformanceMetricsSchema = z.object({
  agentId: z.string(),
  timestamp: z.number().positive(),
  responseTime: z.number().nonnegative(),
  successRate: z.number().min(0).max(1),
  errorRate: z.number().min(0).max(1),
  throughput: z.number().nonnegative(),
  memoryUsage: z.number().nonnegative(),
  cpuUsage: z.number().min(0).max(100),
  cacheHitRate: z.number().min(0).max(1),
  totalRequests: z.number().nonnegative(),
  totalErrors: z.number().nonnegative(),
  averageResponseTime: z.number().nonnegative(),
  p95ResponseTime: z.number().nonnegative(),
  p99ResponseTime: z.number().nonnegative(),
  uptime: z.number().min(0).max(100),
  lastError: z.string().optional(),
  metadata: z.string().optional(),
});

export const insertWorkflowPerformanceMetricsSchema = z.object({
  workflowId: z.string(),
  executionId: z.string(),
  timestamp: z.number().positive(),
  duration: z.number().nonnegative(),
  status: z.enum(["completed", "failed", "timeout", "cancelled"]),
  stepsExecuted: z.number().nonnegative(),
  stepsSkipped: z.number().nonnegative(),
  stepsFailed: z.number().nonnegative(),
  agentsUsed: z.string(), // JSON array
  retriesPerformed: z.number().nonnegative(),
  fallbacksUsed: z.number().nonnegative(),
  totalResponseTime: z.number().nonnegative(),
  averageStepTime: z.number().nonnegative(),
  bottleneckStep: z.string().optional(),
  bottleneckDuration: z.number().nonnegative().optional(),
  peakMemory: z.number().nonnegative(),
  averageMemory: z.number().nonnegative(),
  peakCpu: z.number().min(0).max(100),
  averageCpu: z.number().min(0).max(100),
  metadata: z.string().optional(),
});

export const insertSystemPerformanceSnapshotSchema = z.object({
  timestamp: z.number().positive(),
  totalAgents: z.number().nonnegative(),
  healthyAgents: z.number().nonnegative(),
  degradedAgents: z.number().nonnegative(),
  unhealthyAgents: z.number().nonnegative(),
  totalWorkflows: z.number().nonnegative(),
  runningWorkflows: z.number().nonnegative(),
  completedWorkflows: z.number().nonnegative(),
  failedWorkflows: z.number().nonnegative(),
  systemMemoryUsage: z.number().nonnegative(),
  systemCpuUsage: z.number().min(0).max(100),
  databaseConnections: z.number().nonnegative(),
  averageResponseTime: z.number().nonnegative(),
  throughput: z.number().nonnegative(),
  errorRate: z.number().min(0).max(1),
  uptime: z.number().nonnegative(),
  metadata: z.string().optional(),
});

// Type exports for TypeScript
export type AgentPerformanceMetric = typeof agentPerformanceMetrics.$inferSelect;
export type NewAgentPerformanceMetric = typeof agentPerformanceMetrics.$inferInsert;

export type WorkflowPerformanceMetric = typeof workflowPerformanceMetrics.$inferSelect;
export type NewWorkflowPerformanceMetric = typeof workflowPerformanceMetrics.$inferInsert;

export type SystemPerformanceSnapshot = typeof systemPerformanceSnapshots.$inferSelect;
export type NewSystemPerformanceSnapshot = typeof systemPerformanceSnapshots.$inferInsert;

export type PerformanceAlert = typeof performanceAlerts.$inferSelect;
export type NewPerformanceAlert = typeof performanceAlerts.$inferInsert;

export type PerformanceBaseline = typeof performanceBaselines.$inferSelect;
export type NewPerformanceBaseline = typeof performanceBaselines.$inferInsert;