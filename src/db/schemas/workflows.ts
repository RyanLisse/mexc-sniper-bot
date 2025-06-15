import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ===========================================
// WORKFLOW ORCHESTRATION SCHEMA MODULE
// ===========================================

// Workflow System Status Table
export const workflowSystemStatus = sqliteTable(
  "workflow_system_status",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull().default("default"), // Support multi-user in future

    // System Status
    systemStatus: text("system_status").notNull().default("stopped"), // "running", "stopped", "error"
    lastUpdate: integer("last_update", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),

    // Active Workflows
    activeWorkflows: text("active_workflows").notNull().default("[]"), // JSON array of workflow IDs

    // Metrics
    readyTokens: integer("ready_tokens").notNull().default(0),
    totalDetections: integer("total_detections").notNull().default(0),
    successfulSnipes: integer("successful_snipes").notNull().default(0),
    totalProfit: real("total_profit").notNull().default(0),
    successRate: real("success_rate").notNull().default(0),
    averageROI: real("average_roi").notNull().default(0),
    bestTrade: real("best_trade").notNull().default(0),

    // Timestamps
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    userIdIdx: index("workflow_system_status_user_id_idx").on(table.userId),
  })
);

// Workflow Activity Log Table
export const workflowActivity = sqliteTable(
  "workflow_activity",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull().default("default"),
    activityId: text("activity_id").notNull().unique(), // UUID

    // Activity Details
    type: text("type").notNull(), // "pattern", "calendar", "snipe", "analysis"
    message: text("message").notNull(),

    // Metadata
    workflowId: text("workflow_id"), // Associated workflow if any
    symbolName: text("symbol_name"), // Associated symbol if any
    vcoinId: text("vcoin_id"), // Associated vcoin if any

    // Status
    level: text("level").notNull().default("info"), // "info", "warning", "error", "success"

    // Timestamps
    timestamp: integer("timestamp", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    userIdIdx: index("workflow_activity_user_id_idx").on(table.userId),
    activityIdIdx: index("workflow_activity_activity_id_idx").on(table.activityId),
    typeIdx: index("workflow_activity_type_idx").on(table.type),
    timestampIdx: index("workflow_activity_timestamp_idx").on(table.timestamp),
  })
);

// Workflow Types
export type WorkflowSystemStatus = typeof workflowSystemStatus.$inferSelect;
export type NewWorkflowSystemStatus = typeof workflowSystemStatus.$inferInsert;

export type WorkflowActivity = typeof workflowActivity.$inferSelect;
export type NewWorkflowActivity = typeof workflowActivity.$inferInsert;
