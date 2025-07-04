import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Monitoring and Performance Schema
 * Contains tables for system health metrics, performance baselines,
 * performance alerts, and system snapshots
 */

export const systemHealthMetrics = pgTable("system_health_metrics", {
  id: serial().primaryKey().notNull(),
  timestamp: timestamp({ mode: "string" }).notNull(),
  cpuUsage: real("cpu_usage").notNull(),
  memoryUsage: real("memory_usage").notNull(),
  diskUsage: real("disk_usage").notNull(),
  networkLatency: real("network_latency"),
  activeConnections: integer("active_connections").notNull(),
  throughput: real().notNull(),
  errorRate: real("error_rate").notNull(),
  responseTime: real("response_time").notNull(),
  heapUsage: real("heap_usage"),
  gcPauseTime: real("gc_pause_time"),
  dbConnectionPoolSize: integer("db_connection_pool_size"),
  queueSize: integer("queue_size"),
  cacheHitRate: real("cache_hit_rate"),
  uptimeSeconds: integer("uptime_seconds"),
  componentStatus: text("component_status"),
  alertsActive: integer("alerts_active"),
  metadata: text(),
  createdAt: timestamp("created_at", { mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const performanceBaselines = pgTable("performance_baselines", {
  id: serial().primaryKey().notNull(),
  metricName: text("metric_name").notNull(),
  baseline: real().notNull(),
  threshold: real().notNull(),
  direction: text().notNull(),
  timeWindow: integer("time_window").notNull(),
  isActive: boolean("is_active").default(true),
  updatedAt: timestamp("updated_at", { mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  createdAt: timestamp("created_at", { mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const performanceAlerts = pgTable("performance_alerts", {
  id: text().primaryKey().notNull(),
  metricName: text("metric_name").notNull(),
  currentValue: real("current_value").notNull(),
  baselineValue: real("baseline_value").notNull(),
  threshold: real().notNull(),
  severity: text().notNull(),
  message: text().notNull(),
  isResolved: boolean("is_resolved").default(false),
  triggeredAt: timestamp("triggered_at", { mode: "string" }).notNull(),
  resolvedAt: timestamp("resolved_at", { mode: "string" }),
  duration: integer(),
  additionalData: text("additional_data"),
  createdAt: timestamp("created_at", { mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const systemPerformanceSnapshots = pgTable(
  "system_performance_snapshots",
  {
    id: serial().primaryKey().notNull(),
    snapshotId: text("snapshot_id").notNull(),
    timestamp: timestamp({ mode: "string" }).notNull(),
    overallHealth: text("overall_health").notNull(),
    cpuUtilization: real("cpu_utilization").notNull(),
    memoryUtilization: real("memory_utilization").notNull(),
    diskUtilization: real("disk_utilization").notNull(),
    networkUtilization: real("network_utilization").notNull(),
    databasePerformance: real("database_performance").notNull(),
    cachePerformance: real("cache_performance").notNull(),
    queuePerformance: real("queue_performance").notNull(),
    apiResponseTime: real("api_response_time").notNull(),
    errorRate: real("error_rate").notNull(),
    throughput: real().notNull(),
    activeUsers: integer("active_users"),
    backgroundJobs: integer("background_jobs"),
    pendingTasks: integer("pending_tasks"),
    criticalAlerts: integer("critical_alerts"),
    warningAlerts: integer("warning_alerts"),
    serviceStatus: text("service_status"),
    metadata: text(),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  }
);

export const agentPerformanceMetrics = pgTable("agent_performance_metrics", {
  id: serial().primaryKey().notNull(),
  agentId: text("agent_id").notNull(),
  timestamp: timestamp({ mode: "string" }).notNull(),
  responseTime: real("response_time").notNull(),
  successRate: real("success_rate").notNull(),
  errorRate: real("error_rate").notNull(),
  throughput: real().notNull(),
  memoryUsage: real("memory_usage").notNull(),
  cpuUsage: real("cpu_usage").notNull(),
  cacheHitRate: real("cache_hit_rate").notNull(),
  totalRequests: integer("total_requests").notNull(),
  totalErrors: integer("total_errors").notNull(),
  averageResponseTime: real("average_response_time").notNull(),
  p95ResponseTime: real("p95_response_time").notNull(),
  p99ResponseTime: real("p99_response_time").notNull(),
  uptime: real().notNull(),
  lastError: text("last_error"),
  metadata: text(),
  createdAt: timestamp("created_at", { mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});
