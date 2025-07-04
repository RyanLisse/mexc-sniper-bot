import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Workflow Management Schema
 * Contains tables for workflow activities, performance metrics, and system status
 */

export const workflowActivity = pgTable(
  "workflow_activity",
  {
    id: serial().primaryKey().notNull(),
    userId: text("user_id").default("default").notNull(),
    activityId: text("activity_id").notNull(),
    type: text().notNull(),
    message: text().notNull(),
    details: text(),
    status: text().default("active").notNull(),
    priority: text().default("medium").notNull(),
    workflowStep: text("workflow_step"),
    parentActivityId: text("parent_activity_id"),
    estimatedDuration: integer("estimated_duration"),
    actualDuration: integer("actual_duration"),
    retryCount: integer("retry_count").default(0),
    maxRetries: integer("max_retries").default(3),
    metadata: text(),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    completedAt: timestamp("completed_at", { mode: "string" }),
  },
  (table) => [
    index("workflow_activity_user_status_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.status.asc().nullsLast()
    ),
    index("workflow_activity_type_priority_idx").using(
      "btree",
      table.type.asc().nullsLast(),
      table.priority.asc().nullsLast()
    ),
  ]
);

export const workflowPerformanceMetrics = pgTable(
  "workflow_performance_metrics",
  {
    id: serial().primaryKey().notNull(),
    workflowId: text("workflow_id").notNull(),
    workflowType: text("workflow_type").notNull(),
    timestamp: timestamp({ mode: "string" }).notNull(),
    executionTime: real("execution_time").notNull(),
    successRate: real("success_rate").notNull(),
    errorRate: real("error_rate").notNull(),
    throughput: real().notNull(),
    stepCount: integer("step_count").notNull(),
    completedSteps: integer("completed_steps").notNull(),
    failedSteps: integer("failed_steps").notNull(),
    averageStepDuration: real("average_step_duration").notNull(),
    longestStepDuration: real("longest_step_duration").notNull(),
    shortestStepDuration: real("shortest_step_duration").notNull(),
    resourceUtilization: real("resource_utilization").notNull(),
    memoryUsage: real("memory_usage").notNull(),
    cpuUsage: real("cpu_usage").notNull(),
    metadata: text(),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("workflow_performance_metrics_type_time_idx").using(
      "btree",
      table.workflowType.asc().nullsLast(),
      table.timestamp.desc().nullsLast()
    ),
  ]
);

export const workflowSystemStatus = pgTable(
  "workflow_system_status",
  {
    id: serial().primaryKey().notNull(),
    systemComponent: text("system_component").notNull(),
    status: text().default("operational").notNull(),
    lastHealthCheck: timestamp("last_health_check", {
      mode: "string",
    }).notNull(),
    uptime: real().notNull(),
    version: text().notNull(),
    activeWorkflows: integer("active_workflows").default(0),
    queuedWorkflows: integer("queued_workflows").default(0),
    completedWorkflows: integer("completed_workflows").default(0),
    failedWorkflows: integer("failed_workflows").default(0),
    averageExecutionTime: real("average_execution_time").default(0),
    peakMemoryUsage: real("peak_memory_usage").default(0),
    currentMemoryUsage: real("current_memory_usage").default(0),
    peakCpuUsage: real("peak_cpu_usage").default(0),
    currentCpuUsage: real("current_cpu_usage").default(0),
    diskUsage: real("disk_usage").default(0),
    networkLatency: real("network_latency").default(0),
    lastError: text("last_error"),
    errorCount: integer("error_count").default(0),
    warningCount: integer("warning_count").default(0),
    configurationHash: text("configuration_hash"),
    dependencies: text(),
    alerts: text(),
    metadata: text(),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("workflow_system_status_component_status_idx").using(
      "btree",
      table.systemComponent.asc().nullsLast(),
      table.status.asc().nullsLast()
    ),
  ]
);
