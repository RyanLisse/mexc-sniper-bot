import { boolean, integer, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";
import type { z } from "zod";

// ==========================================
// ALERT SYSTEM SCHEMAS
// ==========================================

// Alert Rules Configuration
export const alertRules = pgTable("alert_rules", {
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
  useAnomalyDetection: boolean("use_anomaly_detection").default(false),
  anomalyThreshold: real("anomaly_threshold").default(2.0), // standard deviations
  learningWindow: integer("learning_window").default(86400), // seconds

  // Alert Behavior
  isEnabled: boolean("is_enabled").default(true),
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
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  createdBy: text("created_by").notNull(),
});

// Alert Instances
export const alertInstances = pgTable("alert_instances", {
  id: text("id").primaryKey(),
  ruleId: text("rule_id")
    .notNull()
    .references(() => alertRules.id),

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
  lastEscalatedAt: timestamp("last_escalated_at"),

  // Resolution
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: text("resolved_by"),
  resolutionNotes: text("resolution_notes"),

  // Timestamps
  firstTriggeredAt: timestamp("first_triggered_at").notNull(),
  lastTriggeredAt: timestamp("last_triggered_at").notNull(),

  // Metadata
  additionalData: text("additional_data"), // JSON object
  labels: text("labels"), // JSON object
});

// Notification Channels
export const notificationChannels = pgTable("notification_channels", {
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
  isEnabled: boolean("is_enabled").default(true),
  isDefault: boolean("is_default").default(false),
  rateLimitPerHour: integer("rate_limit_per_hour").default(100),

  // Formatting
  messageTemplate: text("message_template"),
  titleTemplate: text("title_template"),

  // Timestamps
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  createdBy: text("created_by").notNull(),
});

// Escalation Policies
export const escalationPolicies = pgTable("escalation_policies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),

  // Policy Configuration
  steps: text("steps").notNull(), // JSON array of escalation steps

  // Behavior
  isEnabled: boolean("is_enabled").default(true),

  // Timestamps
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  createdBy: text("created_by").notNull(),
});

// Alert Notifications (tracking sent notifications)
export const alertNotifications = pgTable("alert_notifications", {
  id: text("id").primaryKey(),
  alertId: text("alert_id")
    .notNull()
    .references(() => alertInstances.id),
  channelId: text("channel_id")
    .notNull()
    .references(() => notificationChannels.id),

  // Notification Details
  status: text("status").notNull(), // pending, sent, failed, rate_limited
  attempts: integer("attempts").default(0),
  lastAttemptAt: timestamp("last_attempt_at"),
  sentAt: timestamp("sent_at"),

  // Content
  subject: text("subject"),
  message: text("message").notNull(),

  // Response
  response: text("response"), // response from notification service
  errorMessage: text("error_message"),

  // Timestamps
  createdAt: timestamp("created_at").notNull(),
});

// Alert Correlations (for grouping related alerts)
export const alertCorrelations = pgTable("alert_correlations", {
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
  firstAlertAt: timestamp("first_alert_at").notNull(),
  lastAlertAt: timestamp("last_alert_at").notNull(),
  resolvedAt: timestamp("resolved_at"),
});

// Alert Suppressions (for planned maintenance, etc.)
export const alertSuppressions = pgTable("alert_suppressions", {
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
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),

  // Status
  isActive: boolean("is_active").default(true),

  // Timestamps
  createdAt: timestamp("created_at").notNull(),
  createdBy: text("created_by").notNull(),
});

// ML Anomaly Models (for storing trained models)
export const anomalyModels = pgTable("anomaly_models", {
  id: text("id").primaryKey(),
  metricName: text("metric_name").notNull(),

  // Model Configuration
  modelType: text("model_type").notNull(), // isolation_forest, autoencoder, statistical
  parameters: text("parameters").notNull(), // JSON object

  // Training Data
  trainingDataFrom: timestamp("training_data_from").notNull(),
  trainingDataTo: timestamp("training_data_to").notNull(),
  sampleCount: integer("sample_count").notNull(),

  // Performance Metrics
  accuracy: real("accuracy"),
  precision: real("precision"),
  recall: real("recall"),
  f1Score: real("f1_score"),
  falsePositiveRate: real("false_positive_rate"),

  // Model Data
  modelData: text("model_data"), // serialized model data (base64 encoded)
  features: text("features"), // JSON array of feature names

  // Status
  isActive: boolean("is_active").default(true),
  lastTrainedAt: timestamp("last_trained_at").notNull(),

  // Timestamps
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

// Alert Analytics (for tracking performance and trends)
export const alertAnalytics = pgTable("alert_analytics", {
  id: text("id").primaryKey(),

  // Time Bucket
  bucket: text("bucket").notNull(), // hourly, daily, weekly
  timestamp: timestamp("timestamp").notNull(),

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
// TYPESCRIPT TYPES
// ==========================================

export type InsertAlertRule = {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  severity: string;
  metricName: string;
  operator: string;
  threshold?: number | null;
  aggregationWindow?: number | null;
  evaluationInterval?: number | null;
  useAnomalyDetection?: boolean | null;
  anomalyThreshold?: number | null;
  learningWindow?: number | null;
  isEnabled?: boolean | null;
  suppressionDuration?: number | null;
  escalationDelay?: number | null;
  maxAlerts?: number | null;
  correlationKey?: string | null;
  parentRuleId?: string | null;
  tags?: string | null;
  customFields?: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
};

export type SelectAlertRule = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  severity: string;
  metricName: string;
  operator: string;
  threshold: number | null;
  aggregationWindow: number | null;
  evaluationInterval: number | null;
  useAnomalyDetection: boolean | null;
  anomalyThreshold: number | null;
  learningWindow: number | null;
  isEnabled: boolean | null;
  suppressionDuration: number | null;
  escalationDelay: number | null;
  maxAlerts: number | null;
  correlationKey: string | null;
  parentRuleId: string | null;
  tags: string | null;
  customFields: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
};

export type InsertAlertInstance = {
  id: string;
  ruleId: string;
  status: string;
  severity: string;
  message: string;
  description?: string | null;
  metricValue?: number | null;
  threshold?: number | null;
  anomalyScore?: number | null;
  source: string;
  sourceId?: string | null;
  environment?: string | null;
  correlationId?: string | null;
  parentAlertId?: string | null;
  escalationLevel?: number | null;
  lastEscalatedAt?: Date | null;
  resolvedAt?: Date | null;
  resolvedBy?: string | null;
  resolutionNotes?: string | null;
  firstTriggeredAt: Date;
  lastTriggeredAt: Date;
  additionalData?: string | null;
  labels?: string | null;
};

export type SelectAlertInstance = {
  id: string;
  ruleId: string;
  status: string;
  severity: string;
  message: string;
  description: string | null;
  metricValue: number | null;
  threshold: number | null;
  anomalyScore: number | null;
  source: string;
  sourceId: string | null;
  environment: string | null;
  correlationId: string | null;
  parentAlertId: string | null;
  escalationLevel: number | null;
  lastEscalatedAt: Date | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  resolutionNotes: string | null;
  firstTriggeredAt: Date;
  lastTriggeredAt: Date;
  additionalData: string | null;
  labels: string | null;
};

export type InsertNotificationChannel = {
  id: string;
  name: string;
  type: string;
  config: string;
  headers?: string | null;
  severityFilter?: string | null;
  categoryFilter?: string | null;
  tagFilter?: string | null;
  isEnabled?: boolean | null;
  isDefault?: boolean | null;
  rateLimitPerHour?: number | null;
  messageTemplate?: string | null;
  titleTemplate?: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
};

export type SelectNotificationChannel = {
  id: string;
  name: string;
  type: string;
  config: string;
  headers: string | null;
  severityFilter: string | null;
  categoryFilter: string | null;
  tagFilter: string | null;
  isEnabled: boolean | null;
  isDefault: boolean | null;
  rateLimitPerHour: number | null;
  messageTemplate: string | null;
  titleTemplate: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
};

export type InsertEscalationPolicy = {
  id: string;
  name: string;
  description?: string | null;
  steps: string;
  isEnabled?: boolean | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
};

export type SelectEscalationPolicy = {
  id: string;
  name: string;
  description: string | null;
  steps: string;
  isEnabled: boolean | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
};

export type InsertAlertSuppression = {
  id: string;
  name: string;
  reason: string;
  ruleIds?: string | null;
  categoryFilter?: string | null;
  severityFilter?: string | null;
  sourceFilter?: string | null;
  tagFilter?: string | null;
  startsAt: Date;
  endsAt: Date;
  isActive?: boolean | null;
  createdAt: Date;
  createdBy: string;
};

export type SelectAlertSuppression = {
  id: string;
  name: string;
  reason: string;
  ruleIds: string | null;
  categoryFilter: string | null;
  severityFilter: string | null;
  sourceFilter: string | null;
  tagFilter: string | null;
  startsAt: Date;
  endsAt: Date;
  isActive: boolean | null;
  createdAt: Date;
  createdBy: string;
};

export type InsertAnomalyModel = {
  id: string;
  metricName: string;
  modelType: string;
  parameters: string;
  trainingDataFrom: Date;
  trainingDataTo: Date;
  sampleCount: number;
  accuracy?: number | null;
  precision?: number | null;
  recall?: number | null;
  f1Score?: number | null;
  falsePositiveRate?: number | null;
  modelData?: string | null;
  features?: string | null;
  isActive?: boolean | null;
  lastTrainedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type SelectAnomalyModel = {
  id: string;
  metricName: string;
  modelType: string;
  parameters: string;
  trainingDataFrom: Date;
  trainingDataTo: Date;
  sampleCount: number;
  accuracy: number | null;
  precision: number | null;
  recall: number | null;
  f1Score: number | null;
  falsePositiveRate: number | null;
  modelData: string | null;
  features: string | null;
  isActive: boolean | null;
  lastTrainedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type InsertAlertCorrelation = {
  id: string;
  correlationKey: string;
  title: string;
  description?: string | null;
  severity: string;
  status: string;
  alertCount?: number | null;
  pattern?: string | null;
  confidence?: number | null;
  firstAlertAt: Date;
  lastAlertAt: Date;
  resolvedAt?: Date | null;
};

export type SelectAlertCorrelation = {
  id: string;
  correlationKey: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  alertCount: number | null;
  pattern: string | null;
  confidence: number | null;
  firstAlertAt: Date;
  lastAlertAt: Date;
  resolvedAt: Date | null;
};
