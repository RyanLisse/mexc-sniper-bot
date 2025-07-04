import {
  boolean,
  foreignKey,
  integer,
  pgTable,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Alert Management Schema
 * Contains tables for alert rules, instances, analytics, correlations, suppressions,
 * escalation policies, and notification channels
 */

export const alertAnalytics = pgTable("alert_analytics", {
  id: text().primaryKey().notNull(),
  bucket: text().notNull(),
  timestamp: timestamp({ mode: "string" }).notNull(),
  totalAlerts: integer("total_alerts").default(0),
  criticalAlerts: integer("critical_alerts").default(0),
  highAlerts: integer("high_alerts").default(0),
  mediumAlerts: integer("medium_alerts").default(0),
  lowAlerts: integer("low_alerts").default(0),
  resolvedAlerts: integer("resolved_alerts").default(0),
  averageResolutionTime: real("average_resolution_time"),
  mttr: real(),
  falsePositives: integer("false_positives").default(0),
  falsePositiveRate: real("false_positive_rate"),
  emailNotifications: integer("email_notifications").default(0),
  slackNotifications: integer("slack_notifications").default(0),
  webhookNotifications: integer("webhook_notifications").default(0),
  smsNotifications: integer("sms_notifications").default(0),
  failedNotifications: integer("failed_notifications").default(0),
  tradingAlerts: integer("trading_alerts").default(0),
  safetyAlerts: integer("safety_alerts").default(0),
  performanceAlerts: integer("performance_alerts").default(0),
  systemAlerts: integer("system_alerts").default(0),
  agentAlerts: integer("agent_alerts").default(0),
});

export const alertCorrelations = pgTable("alert_correlations", {
  id: text().primaryKey().notNull(),
  correlationKey: text("correlation_key").notNull(),
  title: text().notNull(),
  description: text(),
  severity: text().notNull(),
  status: text().notNull(),
  alertCount: integer("alert_count").default(1),
  pattern: text(),
  confidence: real(),
  firstAlertAt: timestamp("first_alert_at", { mode: "string" }).notNull(),
  lastAlertAt: timestamp("last_alert_at", { mode: "string" }).notNull(),
  resolvedAt: timestamp("resolved_at", { mode: "string" }),
});

export const alertSuppressions = pgTable("alert_suppressions", {
  id: text().primaryKey().notNull(),
  name: text().notNull(),
  reason: text().notNull(),
  ruleIds: text("rule_ids"),
  categoryFilter: text("category_filter"),
  severityFilter: text("severity_filter"),
  sourceFilter: text("source_filter"),
  tagFilter: text("tag_filter"),
  startsAt: timestamp("starts_at", { mode: "string" }).notNull(),
  endsAt: timestamp("ends_at", { mode: "string" }).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "string" }).notNull(),
  createdBy: text("created_by").notNull(),
});

export const alertRules = pgTable("alert_rules", {
  id: text().primaryKey().notNull(),
  name: text().notNull(),
  description: text(),
  category: text().notNull(),
  severity: text().notNull(),
  metricName: text("metric_name").notNull(),
  operator: text().notNull(),
  threshold: real(),
  aggregationWindow: integer("aggregation_window").default(300),
  evaluationInterval: integer("evaluation_interval").default(60),
  useAnomalyDetection: boolean("use_anomaly_detection").default(false),
  anomalyThreshold: real("anomaly_threshold").default(2),
  learningWindow: integer("learning_window").default(86400),
  isEnabled: boolean("is_enabled").default(true),
  suppressionDuration: integer("suppression_duration").default(300),
  escalationDelay: integer("escalation_delay").default(1800),
  maxAlerts: integer("max_alerts").default(10),
  correlationKey: text("correlation_key"),
  parentRuleId: text("parent_rule_id"),
  tags: text(),
  customFields: text("custom_fields"),
  createdAt: timestamp("created_at", { mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
  createdBy: text("created_by").notNull(),
});

export const alertInstances = pgTable(
  "alert_instances",
  {
    id: text().primaryKey().notNull(),
    ruleId: text("rule_id").notNull(),
    status: text().notNull(),
    severity: text().notNull(),
    message: text().notNull(),
    description: text(),
    metricValue: real("metric_value"),
    threshold: real(),
    anomalyScore: real("anomaly_score"),
    source: text().notNull(),
    sourceId: text("source_id"),
    environment: text().default("production"),
    correlationId: text("correlation_id"),
    parentAlertId: text("parent_alert_id"),
    escalationLevel: integer("escalation_level").default(0),
    lastEscalatedAt: timestamp("last_escalated_at", { mode: "string" }),
    resolvedAt: timestamp("resolved_at", { mode: "string" }),
    resolvedBy: text("resolved_by"),
    resolutionNotes: text("resolution_notes"),
    firstTriggeredAt: timestamp("first_triggered_at", {
      mode: "string",
    }).notNull(),
    lastTriggeredAt: timestamp("last_triggered_at", {
      mode: "string",
    }).notNull(),
    additionalData: text("additional_data"),
    labels: text(),
  },
  (table) => [
    foreignKey({
      columns: [table.ruleId],
      foreignColumns: [alertRules.id],
      name: "alert_instances_rule_id_alert_rules_id_fk",
    }),
  ]
);

export const notificationChannels = pgTable("notification_channels", {
  id: text().primaryKey().notNull(),
  name: text().notNull(),
  type: text().notNull(),
  config: text().notNull(),
  headers: text(),
  severityFilter: text("severity_filter"),
  categoryFilter: text("category_filter"),
  tagFilter: text("tag_filter"),
  isEnabled: boolean("is_enabled").default(true),
  isDefault: boolean("is_default").default(false),
  rateLimitPerHour: integer("rate_limit_per_hour").default(100),
  messageTemplate: text("message_template"),
  titleTemplate: text("title_template"),
  createdAt: timestamp("created_at", { mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
  createdBy: text("created_by").notNull(),
});

export const alertNotifications = pgTable(
  "alert_notifications",
  {
    id: text().primaryKey().notNull(),
    alertId: text("alert_id").notNull(),
    channelId: text("channel_id").notNull(),
    status: text().notNull(),
    attempts: integer().default(0),
    lastAttemptAt: timestamp("last_attempt_at", { mode: "string" }),
    sentAt: timestamp("sent_at", { mode: "string" }),
    subject: text(),
    message: text().notNull(),
    response: text(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.alertId],
      foreignColumns: [alertInstances.id],
      name: "alert_notifications_alert_id_alert_instances_id_fk",
    }),
    foreignKey({
      columns: [table.channelId],
      foreignColumns: [notificationChannels.id],
      name: "alert_notifications_channel_id_notification_channels_id_fk",
    }),
  ]
);

export const escalationPolicies = pgTable("escalation_policies", {
  id: text().primaryKey().notNull(),
  name: text().notNull(),
  description: text(),
  steps: text().notNull(),
  isEnabled: boolean("is_enabled").default(true),
  createdAt: timestamp("created_at", { mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
  createdBy: text("created_by").notNull(),
});
