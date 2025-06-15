import { integer, text, sqliteTable, real, blob } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

// ==========================================
// ALERT SYSTEM SCHEMAS
// ==========================================

// Alert Rules Configuration
export const alertRules = sqliteTable("alert_rules", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(), // trading, safety, performance, system, agent
  severity: text("severity").notNull(), // critical, high, medium, low, info
  
  // Rule Configuration
  metricName: text("metric_name").notNull(),
  operator: text("operator").notNull(), // gt, lt, eq, gte, lte, anomaly
  threshold: real("threshold"),
  aggregationWindow: integer("aggregation_window").default(300), // seconds
  evaluationInterval: integer("evaluation_interval").default(60), // seconds
  
  // ML Anomaly Detection
  useAnomalyDetection: integer("use_anomaly_detection", { mode: "boolean" }).default(false),
  anomalyThreshold: real("anomaly_threshold").default(2.0), // standard deviations
  learningWindow: integer("learning_window").default(86400), // seconds
  
  // Alert Behavior
  isEnabled: integer("is_enabled", { mode: "boolean" }).default(true),
  suppressionDuration: integer("suppression_duration").default(300), // seconds
  escalationDelay: integer("escalation_delay").default(1800), // seconds
  maxAlerts: integer("max_alerts").default(10), // per hour
  
  // Correlation
  correlationKey: text("correlation_key"), // group related alerts
  parentRuleId: text("parent_rule_id"),
  
  // Metadata
  tags: text("tags"), // JSON array of tags
  customFields: text("custom_fields"), // JSON object
  
  // Timestamps
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  createdBy: text("created_by").notNull(),
});

// Alert Instances
export const alertInstances = sqliteTable("alert_instances", {
  id: text("id").primaryKey(),
  ruleId: text("rule_id").notNull().references(() => alertRules.id),
  
  // Alert Details
  status: text("status").notNull(), // firing, resolved, suppressed, escalated
  severity: text("severity").notNull(),
  message: text("message").notNull(),
  description: text("description"),
  
  // Metric Data
  metricValue: real("metric_value"),
  threshold: real("threshold"),
  anomalyScore: real("anomaly_score"),
  
  // Context
  source: text("source").notNull(), // agent name, service, etc.
  sourceId: text("source_id"), // specific entity ID
  environment: text("environment").default("production"),
  
  // Correlation
  correlationId: text("correlation_id"), // groups related alerts
  parentAlertId: text("parent_alert_id"),
  
  // Escalation
  escalationLevel: integer("escalation_level").default(0),
  lastEscalatedAt: integer("last_escalated_at"),
  
  // Resolution
  resolvedAt: integer("resolved_at"),
  resolvedBy: text("resolved_by"),
  resolutionNotes: text("resolution_notes"),
  
  // Timestamps
  firstTriggeredAt: integer("first_triggered_at").notNull(),
  lastTriggeredAt: integer("last_triggered_at").notNull(),
  
  // Metadata
  additionalData: text("additional_data"), // JSON object
  labels: text("labels"), // JSON object
});

// Notification Channels
export const notificationChannels = sqliteTable("notification_channels", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // email, slack, webhook, sms, teams
  
  // Configuration
  config: text("config").notNull(), // JSON object with channel-specific settings
  headers: text("headers"), // JSON object for webhook headers
  
  // Routing
  severityFilter: text("severity_filter"), // JSON array of severities
  categoryFilter: text("category_filter"), // JSON array of categories
  tagFilter: text("tag_filter"), // JSON array of tags
  
  // Behavior
  isEnabled: integer("is_enabled", { mode: "boolean" }).default(true),
  isDefault: integer("is_default", { mode: "boolean" }).default(false),
  rateLimitPerHour: integer("rate_limit_per_hour").default(100),
  
  // Formatting
  messageTemplate: text("message_template"),
  titleTemplate: text("title_template"),
  
  // Timestamps
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  createdBy: text("created_by").notNull(),
});

// Escalation Policies
export const escalationPolicies = sqliteTable("escalation_policies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  
  // Policy Configuration
  steps: text("steps").notNull(), // JSON array of escalation steps
  
  // Behavior
  isEnabled: integer("is_enabled", { mode: "boolean" }).default(true),
  
  // Timestamps
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  createdBy: text("created_by").notNull(),
});

// Alert Notifications (tracking sent notifications)
export const alertNotifications = sqliteTable("alert_notifications", {
  id: text("id").primaryKey(),
  alertId: text("alert_id").notNull().references(() => alertInstances.id),
  channelId: text("channel_id").notNull().references(() => notificationChannels.id),
  
  // Notification Details
  status: text("status").notNull(), // pending, sent, failed, rate_limited
  attempts: integer("attempts").default(0),
  lastAttemptAt: integer("last_attempt_at"),
  sentAt: integer("sent_at"),
  
  // Content
  subject: text("subject"),
  message: text("message").notNull(),
  
  // Response
  response: text("response"), // response from notification service
  errorMessage: text("error_message"),
  
  // Timestamps
  createdAt: integer("created_at").notNull(),
});

// Alert Correlations (for grouping related alerts)
export const alertCorrelations = sqliteTable("alert_correlations", {
  id: text("id").primaryKey(),
  correlationKey: text("correlation_key").notNull(),
  
  // Correlation Details
  title: text("title").notNull(),
  description: text("description"),
  severity: text("severity").notNull(), // highest severity of correlated alerts
  
  // Status
  status: text("status").notNull(), // active, resolved
  alertCount: integer("alert_count").default(1),
  
  // Pattern Recognition
  pattern: text("pattern"), // JSON object describing the pattern
  confidence: real("confidence"), // 0-1 confidence score
  
  // Timestamps
  firstAlertAt: integer("first_alert_at").notNull(),
  lastAlertAt: integer("last_alert_at").notNull(),
  resolvedAt: integer("resolved_at"),
});

// Alert Suppressions (for planned maintenance, etc.)
export const alertSuppressions = sqliteTable("alert_suppressions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  reason: text("reason").notNull(),
  
  // Suppression Rules
  ruleIds: text("rule_ids"), // JSON array of rule IDs to suppress
  categoryFilter: text("category_filter"), // JSON array
  severityFilter: text("severity_filter"), // JSON array
  sourceFilter: text("source_filter"), // JSON array of sources
  tagFilter: text("tag_filter"), // JSON array of tags
  
  // Schedule
  startsAt: integer("starts_at").notNull(),
  endsAt: integer("ends_at").notNull(),
  
  // Status
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  
  // Timestamps
  createdAt: integer("created_at").notNull(),
  createdBy: text("created_by").notNull(),
});

// ML Anomaly Models (for storing trained models)
export const anomalyModels = sqliteTable("anomaly_models", {
  id: text("id").primaryKey(),
  metricName: text("metric_name").notNull(),
  
  // Model Configuration
  modelType: text("model_type").notNull(), // isolation_forest, autoencoder, statistical
  parameters: text("parameters").notNull(), // JSON object
  
  // Training Data
  trainingDataFrom: integer("training_data_from").notNull(),
  trainingDataTo: integer("training_data_to").notNull(),
  sampleCount: integer("sample_count").notNull(),
  
  // Performance Metrics
  accuracy: real("accuracy"),
  precision: real("precision"),
  recall: real("recall"),
  f1Score: real("f1_score"),
  falsePositiveRate: real("false_positive_rate"),
  
  // Model Data
  modelData: blob("model_data"), // serialized model
  features: text("features"), // JSON array of feature names
  
  // Status
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  lastTrainedAt: integer("last_trained_at").notNull(),
  
  // Timestamps
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// Alert Analytics (for tracking performance and trends)
export const alertAnalytics = sqliteTable("alert_analytics", {
  id: text("id").primaryKey(),
  
  // Time Bucket
  bucket: text("bucket").notNull(), // hourly, daily, weekly
  timestamp: integer("timestamp").notNull(),
  
  // Metrics
  totalAlerts: integer("total_alerts").default(0),
  criticalAlerts: integer("critical_alerts").default(0),
  highAlerts: integer("high_alerts").default(0),
  mediumAlerts: integer("medium_alerts").default(0),
  lowAlerts: integer("low_alerts").default(0),
  
  // Resolution Metrics
  resolvedAlerts: integer("resolved_alerts").default(0),
  averageResolutionTime: real("average_resolution_time"), // seconds
  mttr: real("mttr"), // mean time to resolution
  
  // False Positive Tracking
  falsePositives: integer("false_positives").default(0),
  falsePositiveRate: real("false_positive_rate"),
  
  // Channel Metrics
  emailNotifications: integer("email_notifications").default(0),
  slackNotifications: integer("slack_notifications").default(0),
  webhookNotifications: integer("webhook_notifications").default(0),
  smsNotifications: integer("sms_notifications").default(0),
  
  // Failure Metrics
  failedNotifications: integer("failed_notifications").default(0),
  
  // Category Breakdown
  tradingAlerts: integer("trading_alerts").default(0),
  safetyAlerts: integer("safety_alerts").default(0),
  performanceAlerts: integer("performance_alerts").default(0),
  systemAlerts: integer("system_alerts").default(0),
  agentAlerts: integer("agent_alerts").default(0),
});

// ==========================================
// ZOD SCHEMAS FOR VALIDATION
// ==========================================

export const insertAlertRuleSchema = createInsertSchema(alertRules);
export const selectAlertRuleSchema = createSelectSchema(alertRules);
export type InsertAlertRule = z.infer<typeof insertAlertRuleSchema>;
export type SelectAlertRule = z.infer<typeof selectAlertRuleSchema>;

export const insertAlertInstanceSchema = createInsertSchema(alertInstances);
export const selectAlertInstanceSchema = createSelectSchema(alertInstances);
export type InsertAlertInstance = z.infer<typeof insertAlertInstanceSchema>;
export type SelectAlertInstance = z.infer<typeof selectAlertInstanceSchema>;

export const insertNotificationChannelSchema = createInsertSchema(notificationChannels);
export const selectNotificationChannelSchema = createSelectSchema(notificationChannels);
export type InsertNotificationChannel = z.infer<typeof insertNotificationChannelSchema>;
export type SelectNotificationChannel = z.infer<typeof selectNotificationChannelSchema>;

export const insertEscalationPolicySchema = createInsertSchema(escalationPolicies);
export const selectEscalationPolicySchema = createSelectSchema(escalationPolicies);
export type InsertEscalationPolicy = z.infer<typeof insertEscalationPolicySchema>;
export type SelectEscalationPolicy = z.infer<typeof selectEscalationPolicySchema>;

export const insertAlertSuppressionSchema = createInsertSchema(alertSuppressions);
export const selectAlertSuppressionSchema = createSelectSchema(alertSuppressions);
export type InsertAlertSuppression = z.infer<typeof insertAlertSuppressionSchema>;
export type SelectAlertSuppression = z.infer<typeof selectAlertSuppressionSchema>;

export const insertAnomalyModelSchema = createInsertSchema(anomalyModels);
export const selectAnomalyModelSchema = createSelectSchema(anomalyModels);
export type InsertAnomalyModel = z.infer<typeof insertAnomalyModelSchema>;
export type SelectAnomalyModel = z.infer<typeof selectAnomalyModelSchema>;