import { sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

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

export const anomalyModels = pgTable("anomaly_models", {
  id: text().primaryKey().notNull(),
  metricName: text("metric_name").notNull(),
  modelType: text("model_type").notNull(),
  parameters: text().notNull(),
  trainingDataFrom: timestamp("training_data_from", {
    mode: "string",
  }).notNull(),
  trainingDataTo: timestamp("training_data_to", { mode: "string" }).notNull(),
  sampleCount: integer("sample_count").notNull(),
  accuracy: real(),
  precision: real(),
  recall: real(),
  f1Score: real("f1_score"),
  falsePositiveRate: real("false_positive_rate"),
  modelData: text("model_data"),
  features: text(),
  isActive: boolean("is_active").default(true),
  lastTrainedAt: timestamp("last_trained_at", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
});

export const errorIncidents = pgTable(
  "error_incidents",
  {
    id: text().primaryKey().notNull(),
    type: text().notNull(),
    severity: text().notNull(),
    service: text().notNull(),
    errorMessage: text("error_message").notNull(),
    stackTrace: text("stack_trace"),
    context: text().notNull(),
    firstOccurrence: timestamp("first_occurrence", {
      mode: "string",
    }).notNull(),
    lastOccurrence: timestamp("last_occurrence", { mode: "string" }).notNull(),
    occurrenceCount: integer("occurrence_count").default(1).notNull(),
    recovered: boolean().default(false).notNull(),
    recoveryAttempts: integer("recovery_attempts").default(0).notNull(),
    resolution: text(),
    preventionStrategy: text("prevention_strategy"),
    lastRecoveryAttempt: timestamp("last_recovery_attempt", { mode: "string" }),
    averageRecoveryTime: integer("average_recovery_time"),
    successfulRecoveries: integer("successful_recoveries").default(0).notNull(),
    failedRecoveries: integer("failed_recoveries").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("error_incidents_first_occurrence_idx").using(
      "btree",
      table.firstOccurrence.asc().nullsLast().op("timestamp_ops")
    ),
    index("error_incidents_last_occurrence_idx").using(
      "btree",
      table.lastOccurrence.asc().nullsLast().op("timestamp_ops")
    ),
    index("error_incidents_recovered_idx").using(
      "btree",
      table.recovered.asc().nullsLast().op("bool_ops")
    ),
    index("error_incidents_service_idx").using(
      "btree",
      table.service.asc().nullsLast().op("text_ops")
    ),
    index("error_incidents_service_severity_idx").using(
      "btree",
      table.service.asc().nullsLast().op("text_ops"),
      table.severity.asc().nullsLast().op("text_ops")
    ),
    index("error_incidents_severity_idx").using(
      "btree",
      table.severity.asc().nullsLast().op("text_ops")
    ),
    index("error_incidents_type_idx").using(
      "btree",
      table.type.asc().nullsLast().op("text_ops")
    ),
    index("error_incidents_type_occurrence_idx").using(
      "btree",
      table.type.asc().nullsLast().op("text_ops"),
      table.lastOccurrence.asc().nullsLast().op("text_ops")
    ),
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

export const monitoredListings = pgTable(
  "monitored_listings",
  {
    id: serial().primaryKey().notNull(),
    vcoinId: text("vcoin_id").notNull(),
    symbolName: text("symbol_name").notNull(),
    projectName: text("project_name"),
    firstOpenTime: integer("first_open_time").notNull(),
    estimatedLaunchTime: integer("estimated_launch_time"),
    status: text().default("monitoring").notNull(),
    confidence: real().default(0).notNull(),
    patternSts: integer("pattern_sts"),
    patternSt: integer("pattern_st"),
    patternTt: integer("pattern_tt"),
    hasReadyPattern: boolean("has_ready_pattern").default(false).notNull(),
    discoveredAt: timestamp("discovered_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    lastChecked: timestamp("last_checked", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    tradingPairs: text("trading_pairs"),
    priceData: text("price_data"),
    volumeData: text("volume_data"),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("idx_monitored_listings_pattern_ready")
      .using(
        "btree",
        table.hasReadyPattern.asc().nullsLast().op("text_ops"),
        table.status.asc().nullsLast().op("bool_ops"),
        table.confidence.asc().nullsLast().op("float4_ops")
      )
      .where(sql`(has_ready_pattern = true)`),
    unique("monitored_listings_vcoin_id_unique").on(table.vcoinId),
  ]
);

export const performanceAlerts = pgTable("performance_alerts", {
  id: serial().primaryKey().notNull(),
  alertType: text("alert_type").notNull(),
  severity: text().notNull(),
  targetId: text("target_id").notNull(),
  targetType: text("target_type").notNull(),
  message: text().notNull(),
  threshold: real(),
  actualValue: real("actual_value"),
  isResolved: boolean("is_resolved").default(false).notNull(),
  resolvedAt: timestamp("resolved_at", { mode: "string" }),
  resolvedBy: text("resolved_by"),
  metadata: text(),
  createdAt: timestamp("created_at", { mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const performanceBaselines = pgTable("performance_baselines", {
  id: serial().primaryKey().notNull(),
  targetId: text("target_id").notNull(),
  targetType: text("target_type").notNull(),
  metricName: text("metric_name").notNull(),
  baselineValue: real("baseline_value").notNull(),
  calculationPeriod: integer("calculation_period").notNull(),
  sampleCount: integer("sample_count").notNull(),
  standardDeviation: real("standard_deviation"),
  confidenceInterval: real("confidence_interval"),
  calculatedAt: timestamp("calculated_at", { mode: "string" }).notNull(),
  validUntil: timestamp("valid_until", { mode: "string" }),
  metadata: text(),
  createdAt: timestamp("created_at", { mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const reconciliationReports = pgTable(
  "reconciliation_reports",
  {
    id: text().primaryKey().notNull(),
    userId: text("user_id").default("default").notNull(),
    startTime: timestamp("start_time", { mode: "string" }).notNull(),
    endTime: timestamp("end_time", { mode: "string" }).notNull(),
    totalChecks: integer("total_checks").notNull(),
    discrepanciesFound: integer("discrepancies_found").notNull(),
    criticalIssues: integer("critical_issues").notNull(),
    autoResolved: integer("auto_resolved").notNull(),
    manualReviewRequired: integer("manual_review_required").notNull(),
    overallStatus: text("overall_status").notNull(),
    discrepancies: text().notNull(),
    recommendations: text().notNull(),
    triggeredBy: text("triggered_by").default("scheduled").notNull(),
    processingTimeMs: integer("processing_time_ms"),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("reconciliation_reports_critical_issues_idx").using(
      "btree",
      table.criticalIssues.asc().nullsLast().op("int4_ops")
    ),
    index("reconciliation_reports_overall_status_idx").using(
      "btree",
      table.overallStatus.asc().nullsLast().op("text_ops")
    ),
    index("reconciliation_reports_start_time_idx").using(
      "btree",
      table.startTime.asc().nullsLast().op("timestamp_ops")
    ),
    index("reconciliation_reports_user_id_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops")
    ),
  ]
);

export const riskEvents = pgTable(
  "risk_events",
  {
    id: text().primaryKey().notNull(),
    userId: text("user_id").default("default").notNull(),
    eventType: text("event_type").notNull(),
    severity: text().notNull(),
    description: text().notNull(),
    circuitBreakerId: text("circuit_breaker_id"),
    totalExposure: real("total_exposure"),
    dailyPnl: real("daily_pnl"),
    openPositions: integer("open_positions"),
    riskPercentage: real("risk_percentage"),
    volatilityIndex: real("volatility_index"),
    actionTaken: text("action_taken").notNull(),
    actionDetails: text("action_details"),
    resolved: boolean().default(false).notNull(),
    resolvedAt: timestamp("resolved_at", { mode: "string" }),
    resolution: text(),
    timestamp: timestamp({ mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("risk_events_event_type_idx").using(
      "btree",
      table.eventType.asc().nullsLast().op("text_ops")
    ),
    index("risk_events_resolved_idx").using(
      "btree",
      table.resolved.asc().nullsLast().op("bool_ops")
    ),
    index("risk_events_severity_idx").using(
      "btree",
      table.severity.asc().nullsLast().op("text_ops")
    ),
    index("risk_events_timestamp_idx").using(
      "btree",
      table.timestamp.asc().nullsLast().op("timestamp_ops")
    ),
    index("risk_events_type_timestamp_idx").using(
      "btree",
      table.eventType.asc().nullsLast().op("text_ops"),
      table.timestamp.asc().nullsLast().op("timestamp_ops")
    ),
    index("risk_events_user_id_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops")
    ),
    index("risk_events_user_severity_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops"),
      table.severity.asc().nullsLast().op("text_ops")
    ),
  ]
);

export const systemHealthMetrics = pgTable(
  "system_health_metrics",
  {
    id: serial().primaryKey().notNull(),
    service: text().notNull(),
    status: text().notNull(),
    responseTime: integer("response_time"),
    errorRate: real("error_rate"),
    uptime: real(),
    throughput: real(),
    cpuUsage: real("cpu_usage"),
    memoryUsage: real("memory_usage"),
    diskUsage: real("disk_usage"),
    totalErrors: integer("total_errors").default(0).notNull(),
    criticalErrors: integer("critical_errors").default(0).notNull(),
    circuitBreakerOpen: boolean("circuit_breaker_open")
      .default(false)
      .notNull(),
    circuitBreakerFailures: integer("circuit_breaker_failures")
      .default(0)
      .notNull(),
    metadata: text(),
    alertsActive: integer("alerts_active").default(0).notNull(),
    timestamp: timestamp({ mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("system_health_metrics_service_idx").using(
      "btree",
      table.service.asc().nullsLast().op("text_ops")
    ),
    index("system_health_metrics_service_status_idx").using(
      "btree",
      table.service.asc().nullsLast().op("text_ops"),
      table.status.asc().nullsLast().op("text_ops")
    ),
    index("system_health_metrics_service_timestamp_idx").using(
      "btree",
      table.service.asc().nullsLast().op("text_ops"),
      table.timestamp.asc().nullsLast().op("text_ops")
    ),
    index("system_health_metrics_status_idx").using(
      "btree",
      table.status.asc().nullsLast().op("text_ops")
    ),
    index("system_health_metrics_timestamp_idx").using(
      "btree",
      table.timestamp.asc().nullsLast().op("timestamp_ops")
    ),
  ]
);

export const systemPerformanceSnapshots = pgTable(
  "system_performance_snapshots",
  {
    id: serial().primaryKey().notNull(),
    timestamp: timestamp({ mode: "string" }).notNull(),
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
    throughput: real().notNull(),
    errorRate: real("error_rate").notNull(),
    uptime: integer().notNull(),
    metadata: text(),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  }
);

export const verification = pgTable("verification", {
  id: text().primaryKey().notNull(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: integer().notNull(),
  createdAt: timestamp({ mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp({ mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const workflowActivity = pgTable(
  "workflow_activity",
  {
    id: serial().primaryKey().notNull(),
    userId: text("user_id").default("default").notNull(),
    activityId: text("activity_id").notNull(),
    type: text().notNull(),
    message: text().notNull(),
    workflowId: text("workflow_id"),
    symbolName: text("symbol_name"),
    vcoinId: text("vcoin_id"),
    level: text().default("info").notNull(),
    timestamp: timestamp({ mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("idx_workflow_activity_user_timestamp").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops"),
      table.timestamp.asc().nullsLast().op("text_ops"),
      table.type.asc().nullsLast().op("timestamp_ops")
    ),
    index("workflow_activity_activity_id_idx").using(
      "btree",
      table.activityId.asc().nullsLast().op("text_ops")
    ),
    index("workflow_activity_timestamp_idx").using(
      "btree",
      table.timestamp.asc().nullsLast().op("timestamp_ops")
    ),
    unique("workflow_activity_activity_id_unique").on(table.activityId),
  ]
);

export const workflowPerformanceMetrics = pgTable(
  "workflow_performance_metrics",
  {
    id: serial().primaryKey().notNull(),
    workflowId: text("workflow_id").notNull(),
    executionId: text("execution_id").notNull(),
    timestamp: timestamp({ mode: "string" }).notNull(),
    duration: integer().notNull(),
    status: text().notNull(),
    stepsExecuted: integer("steps_executed").notNull(),
    stepsSkipped: integer("steps_skipped").notNull(),
    stepsFailed: integer("steps_failed").notNull(),
    agentsUsed: text("agents_used").notNull(),
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
    metadata: text(),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  }
);

export const workflowSystemStatus = pgTable(
  "workflow_system_status",
  {
    id: serial().primaryKey().notNull(),
    userId: text("user_id").default("default").notNull(),
    systemStatus: text("system_status").default("stopped").notNull(),
    lastUpdate: timestamp("last_update", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    activeWorkflows: text("active_workflows").default("[]").notNull(),
    readyTokens: integer("ready_tokens").default(0).notNull(),
    totalDetections: integer("total_detections").default(0).notNull(),
    successfulSnipes: integer("successful_snipes").default(0).notNull(),
    totalProfit: real("total_profit").default(0).notNull(),
    successRate: real("success_rate").default(0).notNull(),
    averageRoi: real("average_roi").default(0).notNull(),
    bestTrade: real("best_trade").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("workflow_system_status_user_id_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops")
    ),
  ]
);

export const user = pgTable(
  "user",
  {
    id: text().primaryKey().notNull(),
    email: text().notNull(),
    name: text().notNull(),
    username: text(),
    emailVerified: boolean().default(false).notNull(),
    image: text(),
    legacyBetterAuthId: text(),
    createdAt: timestamp({ mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    unique("user_email_unique").on(table.email),
    unique("user_username_unique").on(table.username),
    unique("user_legacyBetterAuthId_unique").on(table.legacyBetterAuthId),
  ]
);

export const account = pgTable(
  "account",
  {
    id: text().primaryKey().notNull(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text().notNull(),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: integer(),
    refreshTokenExpiresAt: integer(),
    scope: text(),
    password: text(),
    createdAt: timestamp({ mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "account_userId_user_id_fk",
    }).onDelete("cascade"),
  ]
);

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

export const apiCredentials = pgTable(
  "api_credentials",
  {
    id: serial().primaryKey().notNull(),
    userId: text("user_id").notNull(),
    provider: text().notNull(),
    encryptedApiKey: text("encrypted_api_key").notNull(),
    encryptedSecretKey: text("encrypted_secret_key").notNull(),
    encryptedPassphrase: text("encrypted_passphrase"),
    isActive: boolean("is_active").default(true).notNull(),
    lastUsed: timestamp("last_used", { mode: "string" }),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("api_credentials_user_provider_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops"),
      table.provider.asc().nullsLast().op("text_ops")
    ),
    index("idx_api_credentials_user_active")
      .using(
        "btree",
        table.userId.asc().nullsLast().op("text_ops"),
        table.isActive.asc().nullsLast().op("text_ops"),
        table.updatedAt.asc().nullsLast().op("text_ops")
      )
      .where(sql`(is_active = true)`),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "api_credentials_user_id_user_id_fk",
    }).onDelete("cascade"),
  ]
);

export const executionHistory = pgTable(
  "execution_history",
  {
    id: serial().primaryKey().notNull(),
    userId: text("user_id").notNull(),
    snipeTargetId: integer("snipe_target_id"),
    vcoinId: text("vcoin_id").notNull(),
    symbolName: text("symbol_name").notNull(),
    action: text().notNull(),
    orderType: text("order_type").notNull(),
    orderSide: text("order_side").notNull(),
    requestedQuantity: real("requested_quantity").notNull(),
    requestedPrice: real("requested_price"),
    executedQuantity: real("executed_quantity"),
    executedPrice: real("executed_price"),
    totalCost: real("total_cost"),
    fees: real(),
    exchangeOrderId: text("exchange_order_id"),
    exchangeStatus: text("exchange_status"),
    exchangeResponse: text("exchange_response"),
    executionLatencyMs: integer("execution_latency_ms"),
    slippagePercent: real("slippage_percent"),
    status: text().notNull(),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    requestedAt: timestamp("requested_at", { mode: "string" }).notNull(),
    executedAt: timestamp("executed_at", { mode: "string" }),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("execution_history_snipe_target_action_status_idx").using(
      "btree",
      table.snipeTargetId.asc().nullsLast().op("int4_ops"),
      table.action.asc().nullsLast().op("text_ops"),
      table.status.asc().nullsLast().op("text_ops")
    ),
    index("execution_history_user_status_action_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops"),
      table.status.asc().nullsLast().op("text_ops"),
      table.action.asc().nullsLast().op("text_ops")
    ),
    index("execution_history_user_symbol_time_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops"),
      table.symbolName.asc().nullsLast().op("timestamp_ops"),
      table.executedAt.asc().nullsLast().op("text_ops")
    ),
    index("idx_execution_history_user_symbol").using(
      "btree",
      table.userId.asc().nullsLast().op("timestamp_ops"),
      table.symbolName.asc().nullsLast().op("timestamp_ops"),
      table.executedAt.asc().nullsLast().op("text_ops")
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "execution_history_user_id_user_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.snipeTargetId],
      foreignColumns: [snipeTargets.id],
      name: "execution_history_snipe_target_id_snipe_targets_id_fk",
    }).onDelete("set null"),
  ]
);

export const snipeTargets = pgTable(
  "snipe_targets",
  {
    id: serial().primaryKey().notNull(),
    userId: text("user_id").notNull(),
    vcoinId: text("vcoin_id").notNull(),
    symbolName: text("symbol_name").notNull(),
    entryStrategy: text("entry_strategy").default("market").notNull(),
    entryPrice: real("entry_price"),
    positionSizeUsdt: real("position_size_usdt").notNull(),
    takeProfitLevel: integer("take_profit_level").default(2).notNull(),
    takeProfitCustom: real("take_profit_custom"),
    stopLossPercent: real("stop_loss_percent").notNull(),
    status: text().default("pending").notNull(),
    priority: integer().default(1).notNull(),
    maxRetries: integer("max_retries").default(3).notNull(),
    currentRetries: integer("current_retries").default(0).notNull(),
    targetExecutionTime: timestamp("target_execution_time", { mode: "string" }),
    actualExecutionTime: timestamp("actual_execution_time", { mode: "string" }),
    executionPrice: real("execution_price"),
    actualPositionSize: real("actual_position_size"),
    executionStatus: text("execution_status"),
    errorMessage: text("error_message"),
    confidenceScore: real("confidence_score").default(0).notNull(),
    riskLevel: text("risk_level").default("medium").notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("idx_snipe_targets_complex_lookup").using(
      "btree",
      table.userId.asc().nullsLast().op("int4_ops"),
      table.symbolName.asc().nullsLast().op("timestamp_ops"),
      table.status.asc().nullsLast().op("text_ops"),
      table.priority.asc().nullsLast().op("text_ops"),
      table.createdAt.asc().nullsLast().op("text_ops")
    ),
    index("idx_snipe_targets_user_status").using(
      "btree",
      table.userId.asc().nullsLast().op("timestamp_ops"),
      table.status.asc().nullsLast().op("timestamp_ops"),
      table.createdAt.asc().nullsLast().op("text_ops")
    ),
    index("snipe_targets_status_execution_time_idx").using(
      "btree",
      table.status.asc().nullsLast().op("text_ops"),
      table.targetExecutionTime.asc().nullsLast().op("text_ops")
    ),
    index("snipe_targets_user_status_priority_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("int4_ops"),
      table.status.asc().nullsLast().op("text_ops"),
      table.priority.asc().nullsLast().op("text_ops")
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "snipe_targets_user_id_user_id_fk",
    }).onDelete("cascade"),
  ]
);

export const patternEmbeddings = pgTable(
  "pattern_embeddings",
  {
    id: serial().primaryKey().notNull(),
    patternId: text("pattern_id").notNull(),
    patternType: text("pattern_type").notNull(),
    symbolName: text("symbol_name").notNull(),
    vcoinId: text("vcoin_id"),
    patternData: text("pattern_data").notNull(),
    embedding: text().notNull(),
    embeddingDimension: integer("embedding_dimension").default(1536).notNull(),
    embeddingModel: text("embedding_model")
      .default("text-embedding-ada-002")
      .notNull(),
    confidence: real().notNull(),
    occurrences: integer().default(1).notNull(),
    successRate: real("success_rate"),
    avgProfit: real("avg_profit"),
    discoveredAt: timestamp("discovered_at", { mode: "string" }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { mode: "string" }).notNull(),
    similarityThreshold: real("similarity_threshold").default(0.85).notNull(),
    falsePositives: integer("false_positives").default(0).notNull(),
    truePositives: integer("true_positives").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("idx_pattern_embeddings_analysis_composite").using(
      "btree",
      table.symbolName.asc().nullsLast().op("timestamp_ops"),
      table.patternType.asc().nullsLast().op("text_ops"),
      table.confidence.asc().nullsLast().op("timestamp_ops"),
      table.isActive.asc().nullsLast().op("bool_ops"),
      table.createdAt.asc().nullsLast().op("float4_ops")
    ),
    index("idx_pattern_embeddings_confidence_active")
      .using(
        "btree",
        table.confidence.asc().nullsLast().op("text_ops"),
        table.isActive.asc().nullsLast().op("text_ops"),
        table.patternType.asc().nullsLast().op("float4_ops")
      )
      .where(
        sql`((confidence > (0.7)::double precision) AND (is_active = true))`
      ),
    index("idx_pattern_embeddings_symbol_timestamp").using(
      "btree",
      table.symbolName.asc().nullsLast().op("text_ops"),
      table.createdAt.asc().nullsLast().op("timestamp_ops"),
      table.confidence.asc().nullsLast().op("timestamp_ops")
    ),
    index("pattern_embeddings_symbol_type_idx").using(
      "btree",
      table.symbolName.asc().nullsLast().op("text_ops"),
      table.patternType.asc().nullsLast().op("text_ops")
    ),
    index("pattern_embeddings_type_confidence_idx").using(
      "btree",
      table.patternType.asc().nullsLast().op("text_ops"),
      table.confidence.asc().nullsLast().op("text_ops")
    ),
    unique("pattern_embeddings_pattern_id_unique").on(table.patternId),
  ]
);

export const patternSimilarityCache = pgTable(
  "pattern_similarity_cache",
  {
    id: serial().primaryKey().notNull(),
    patternId1: text("pattern_id_1").notNull(),
    patternId2: text("pattern_id_2").notNull(),
    cosineSimilarity: real("cosine_similarity").notNull(),
    euclideanDistance: real("euclidean_distance").notNull(),
    calculatedAt: timestamp("calculated_at", { mode: "string" }).notNull(),
    expiresAt: timestamp("expires_at", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("idx_pattern_similarity_cache_pattern_similarity").using(
      "btree",
      table.patternId1.asc().nullsLast().op("text_ops"),
      table.cosineSimilarity.asc().nullsLast().op("text_ops"),
      table.createdAt.asc().nullsLast().op("float4_ops")
    ),
    index("pattern_similarity_cache_unique_pair_idx").using(
      "btree",
      table.patternId1.asc().nullsLast().op("text_ops"),
      table.patternId2.asc().nullsLast().op("text_ops")
    ),
    foreignKey({
      columns: [table.patternId1],
      foreignColumns: [patternEmbeddings.patternId],
      name: "pattern_similarity_cache_pattern_id_1_pattern_embeddings_patter",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.patternId2],
      foreignColumns: [patternEmbeddings.patternId],
      name: "pattern_similarity_cache_pattern_id_2_pattern_embeddings_patter",
    }).onDelete("cascade"),
  ]
);

export const positionSnapshots = pgTable(
  "position_snapshots",
  {
    id: serial().primaryKey().notNull(),
    userId: text("user_id").notNull(),
    snapshotId: text("snapshot_id").notNull(),
    source: text().notNull(),
    symbol: text().notNull(),
    quantity: real().notNull(),
    averagePrice: real("average_price").notNull(),
    marketValue: real("market_value").notNull(),
    unrealizedPnl: real("unrealized_pnl").notNull(),
    currency: text(),
    totalBalance: real("total_balance"),
    availableBalance: real("available_balance"),
    lockedBalance: real("locked_balance"),
    snapshotType: text("snapshot_type").notNull(),
    reconciliationId: text("reconciliation_id"),
    timestamp: timestamp({ mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("position_snapshots_reconciliation_id_idx").using(
      "btree",
      table.reconciliationId.asc().nullsLast().op("text_ops")
    ),
    index("position_snapshots_snapshot_id_idx").using(
      "btree",
      table.snapshotId.asc().nullsLast().op("text_ops")
    ),
    index("position_snapshots_source_idx").using(
      "btree",
      table.source.asc().nullsLast().op("text_ops")
    ),
    index("position_snapshots_source_timestamp_idx").using(
      "btree",
      table.source.asc().nullsLast().op("timestamp_ops"),
      table.timestamp.asc().nullsLast().op("timestamp_ops")
    ),
    index("position_snapshots_symbol_idx").using(
      "btree",
      table.symbol.asc().nullsLast().op("text_ops")
    ),
    index("position_snapshots_timestamp_idx").using(
      "btree",
      table.timestamp.asc().nullsLast().op("timestamp_ops")
    ),
    index("position_snapshots_user_id_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops")
    ),
    index("position_snapshots_user_symbol_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops"),
      table.symbol.asc().nullsLast().op("text_ops")
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "position_snapshots_user_id_user_id_fk",
    }).onDelete("cascade"),
    unique("position_snapshots_snapshot_id_unique").on(table.snapshotId),
  ]
);

export const session = pgTable(
  "session",
  {
    id: text().primaryKey().notNull(),
    expiresAt: integer().notNull(),
    token: text().notNull(),
    createdAt: timestamp({ mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    ipAddress: text(),
    userAgent: text(),
    userId: text().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "session_userId_user_id_fk",
    }).onDelete("cascade"),
    unique("session_token_unique").on(table.token),
  ]
);

export const simulationSessions = pgTable(
  "simulation_sessions",
  {
    id: text().primaryKey().notNull(),
    userId: text("user_id").notNull(),
    startTime: timestamp("start_time", { mode: "string" }).notNull(),
    endTime: timestamp("end_time", { mode: "string" }),
    virtualBalance: real("virtual_balance").notNull(),
    currentBalance: real("current_balance").notNull(),
    finalBalance: real("final_balance"),
    totalTrades: integer("total_trades").default(0).notNull(),
    profitLoss: real("profit_loss").default(0).notNull(),
    winRate: real("win_rate").default(0).notNull(),
    maxDrawdown: real("max_drawdown").default(0).notNull(),
    bestTrade: real("best_trade").default(0).notNull(),
    worstTrade: real("worst_trade").default(0).notNull(),
    status: text().default("active").notNull(),
    tradingFees: real("trading_fees").default(0.001).notNull(),
    slippage: real().default(0.0005).notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("simulation_sessions_start_time_idx").using(
      "btree",
      table.startTime.asc().nullsLast().op("timestamp_ops")
    ),
    index("simulation_sessions_status_idx").using(
      "btree",
      table.status.asc().nullsLast().op("text_ops")
    ),
    index("simulation_sessions_user_id_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops")
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "simulation_sessions_user_id_user_id_fk",
    }).onDelete("cascade"),
  ]
);

export const simulationTrades = pgTable(
  "simulation_trades",
  {
    id: text().primaryKey().notNull(),
    sessionId: text("session_id").notNull(),
    symbol: text().notNull(),
    type: text().notNull(),
    quantity: real().notNull(),
    price: real().notNull(),
    value: real().notNull(),
    fees: real().notNull(),
    timestamp: timestamp({ mode: "string" }).notNull(),
    strategy: text().notNull(),
    realized: boolean().default(false).notNull(),
    profitLoss: real("profit_loss"),
    exitPrice: real("exit_price"),
    exitTimestamp: timestamp("exit_timestamp", { mode: "string" }),
    slippagePercent: real("slippage_percent"),
    marketImpactPercent: real("market_impact_percent"),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("simulation_trades_realized_idx").using(
      "btree",
      table.realized.asc().nullsLast().op("bool_ops")
    ),
    index("simulation_trades_session_id_idx").using(
      "btree",
      table.sessionId.asc().nullsLast().op("text_ops")
    ),
    index("simulation_trades_symbol_idx").using(
      "btree",
      table.symbol.asc().nullsLast().op("text_ops")
    ),
    index("simulation_trades_timestamp_idx").using(
      "btree",
      table.timestamp.asc().nullsLast().op("timestamp_ops")
    ),
    index("simulation_trades_type_idx").using(
      "btree",
      table.type.asc().nullsLast().op("text_ops")
    ),
    foreignKey({
      columns: [table.sessionId],
      foreignColumns: [simulationSessions.id],
      name: "simulation_trades_session_id_simulation_sessions_id_fk",
    }).onDelete("cascade"),
  ]
);

export const tradingStrategies = pgTable(
  "trading_strategies",
  {
    id: serial().primaryKey().notNull(),
    userId: text("user_id").notNull(),
    strategyTemplateId: integer("strategy_template_id"),
    name: text().notNull(),
    description: text(),
    symbol: text().notNull(),
    vcoinId: text("vcoin_id"),
    entryPrice: real("entry_price").notNull(),
    positionSize: real("position_size").notNull(),
    positionSizeUsdt: real("position_size_usdt").notNull(),
    levels: text().notNull(),
    stopLossPercent: real("stop_loss_percent").notNull(),
    status: text().default("pending").notNull(),
    currentPrice: real("current_price"),
    unrealizedPnl: real("unrealized_pnl").default(0),
    unrealizedPnlPercent: real("unrealized_pnl_percent").default(0),
    realizedPnl: real("realized_pnl").default(0),
    realizedPnlPercent: real("realized_pnl_percent").default(0),
    totalPnl: real("total_pnl").default(0),
    totalPnlPercent: real("total_pnl_percent").default(0),
    executedPhases: integer("executed_phases").default(0).notNull(),
    totalPhases: integer("total_phases").notNull(),
    remainingPosition: real("remaining_position"),
    maxDrawdown: real("max_drawdown").default(0),
    riskRewardRatio: real("risk_reward_ratio").default(0),
    confidenceScore: real("confidence_score").default(0),
    aiInsights: text("ai_insights"),
    lastAiAnalysis: timestamp("last_ai_analysis", { mode: "string" }),
    activatedAt: timestamp("activated_at", { mode: "string" }),
    completedAt: timestamp("completed_at", { mode: "string" }),
    lastExecutionAt: timestamp("last_execution_at", { mode: "string" }),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("idx_trading_strategies_active_user").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops"),
      table.status.asc().nullsLast().op("text_ops"),
      table.updatedAt.asc().nullsLast().op("timestamp_ops")
    ),
    index("trading_strategies_status_idx").using(
      "btree",
      table.status.asc().nullsLast().op("text_ops")
    ),
    index("trading_strategies_symbol_idx").using(
      "btree",
      table.symbol.asc().nullsLast().op("text_ops")
    ),
    index("trading_strategies_symbol_status_idx").using(
      "btree",
      table.symbol.asc().nullsLast().op("text_ops"),
      table.status.asc().nullsLast().op("text_ops")
    ),
    index("trading_strategies_template_idx").using(
      "btree",
      table.strategyTemplateId.asc().nullsLast().op("int4_ops")
    ),
    index("trading_strategies_user_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops")
    ),
    index("trading_strategies_user_status_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops"),
      table.status.asc().nullsLast().op("text_ops")
    ),
    index("trading_strategies_user_symbol_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops"),
      table.symbol.asc().nullsLast().op("text_ops")
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "trading_strategies_user_id_user_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.strategyTemplateId],
      foreignColumns: [strategyTemplates.id],
      name: "trading_strategies_strategy_template_id_strategy_templates_id_f",
    }).onDelete("set null"),
  ]
);

export const strategyConfigBackups = pgTable(
  "strategy_config_backups",
  {
    id: serial().primaryKey().notNull(),
    strategyId: integer("strategy_id").notNull(),
    backupReason: text("backup_reason").notNull(),
    configSnapshot: text("config_snapshot").notNull(),
    version: integer().notNull(),
    isActive: boolean("is_active").default(false).notNull(),
    performanceSnapshot: text("performance_snapshot"),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("strategy_config_backups_active_idx").using(
      "btree",
      table.isActive.asc().nullsLast().op("bool_ops")
    ),
    index("strategy_config_backups_reason_idx").using(
      "btree",
      table.backupReason.asc().nullsLast().op("text_ops")
    ),
    index("strategy_config_backups_strategy_idx").using(
      "btree",
      table.strategyId.asc().nullsLast().op("int4_ops")
    ),
    index("strategy_config_backups_version_idx").using(
      "btree",
      table.version.asc().nullsLast().op("int4_ops")
    ),
    foreignKey({
      columns: [table.strategyId],
      foreignColumns: [tradingStrategies.id],
      name: "strategy_config_backups_strategy_id_trading_strategies_id_fk",
    }).onDelete("cascade"),
  ]
);

export const strategyPerformanceMetrics = pgTable(
  "strategy_performance_metrics",
  {
    id: serial().primaryKey().notNull(),
    userId: text("user_id").notNull(),
    strategyId: integer("strategy_id").notNull(),
    periodStart: timestamp("period_start", { mode: "string" }).notNull(),
    periodEnd: timestamp("period_end", { mode: "string" }).notNull(),
    periodType: text("period_type").notNull(),
    highestPrice: real("highest_price"),
    lowestPrice: real("lowest_price"),
    avgPrice: real("avg_price"),
    priceVolatility: real("price_volatility"),
    pnl: real(),
    pnlPercent: real("pnl_percent"),
    maxDrawdown: real("max_drawdown"),
    maxDrawdownPercent: real("max_drawdown_percent"),
    sharpeRatio: real("sharpe_ratio"),
    sortRatio: real("sort_ratio"),
    calmarRatio: real("calmar_ratio"),
    valueAtRisk: real("value_at_risk"),
    phasesExecuted: integer("phases_executed"),
    avgExecutionTime: real("avg_execution_time"),
    totalSlippage: real("total_slippage"),
    totalFees: real("total_fees"),
    marketTrend: text("market_trend"),
    marketVolatility: text("market_volatility"),
    calculatedAt: timestamp("calculated_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("strategy_performance_metrics_period_idx").using(
      "btree",
      table.periodStart.asc().nullsLast().op("timestamp_ops"),
      table.periodEnd.asc().nullsLast().op("timestamp_ops")
    ),
    index("strategy_performance_metrics_period_type_idx").using(
      "btree",
      table.periodType.asc().nullsLast().op("text_ops")
    ),
    index("strategy_performance_metrics_strategy_idx").using(
      "btree",
      table.strategyId.asc().nullsLast().op("int4_ops")
    ),
    index("strategy_performance_metrics_strategy_period_idx").using(
      "btree",
      table.strategyId.asc().nullsLast().op("timestamp_ops"),
      table.periodStart.asc().nullsLast().op("int4_ops")
    ),
    index("strategy_performance_metrics_user_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops")
    ),
    index("strategy_performance_metrics_user_period_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops"),
      table.periodStart.asc().nullsLast().op("text_ops")
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "strategy_performance_metrics_user_id_user_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.strategyId],
      foreignColumns: [tradingStrategies.id],
      name: "strategy_performance_metrics_strategy_id_trading_strategies_id_",
    }).onDelete("cascade"),
  ]
);

export const strategyPhaseExecutions = pgTable(
  "strategy_phase_executions",
  {
    id: serial().primaryKey().notNull(),
    userId: text("user_id").notNull(),
    strategyId: integer("strategy_id").notNull(),
    phaseNumber: integer("phase_number").notNull(),
    targetPercentage: real("target_percentage").notNull(),
    targetPrice: real("target_price").notNull(),
    targetMultiplier: real("target_multiplier").notNull(),
    plannedSellPercentage: real("planned_sell_percentage").notNull(),
    executionStatus: text("execution_status").default("pending").notNull(),
    triggerPrice: real("trigger_price"),
    executionPrice: real("execution_price"),
    executedQuantity: real("executed_quantity"),
    executedValue: real("executed_value"),
    profit: real(),
    profitPercent: real("profit_percent"),
    fees: real(),
    slippage: real(),
    exchangeOrderId: text("exchange_order_id"),
    exchangeResponse: text("exchange_response"),
    triggeredAt: timestamp("triggered_at", { mode: "string" }),
    executedAt: timestamp("executed_at", { mode: "string" }),
    errorMessage: text("error_message"),
    retryCount: integer("retry_count").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("strategy_phase_executions_phase_idx").using(
      "btree",
      table.phaseNumber.asc().nullsLast().op("int4_ops")
    ),
    index("strategy_phase_executions_status_idx").using(
      "btree",
      table.executionStatus.asc().nullsLast().op("text_ops")
    ),
    index("strategy_phase_executions_strategy_idx").using(
      "btree",
      table.strategyId.asc().nullsLast().op("int4_ops")
    ),
    index("strategy_phase_executions_strategy_phase_idx").using(
      "btree",
      table.strategyId.asc().nullsLast().op("int4_ops"),
      table.phaseNumber.asc().nullsLast().op("int4_ops")
    ),
    index("strategy_phase_executions_strategy_status_idx").using(
      "btree",
      table.strategyId.asc().nullsLast().op("int4_ops"),
      table.executionStatus.asc().nullsLast().op("int4_ops")
    ),
    index("strategy_phase_executions_user_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops")
    ),
    index("strategy_phase_executions_user_strategy_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("int4_ops"),
      table.strategyId.asc().nullsLast().op("int4_ops")
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "strategy_phase_executions_user_id_user_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.strategyId],
      foreignColumns: [tradingStrategies.id],
      name: "strategy_phase_executions_strategy_id_trading_strategies_id_fk",
    }).onDelete("cascade"),
  ]
);

export const strategyTemplates = pgTable(
  "strategy_templates",
  {
    id: serial().primaryKey().notNull(),
    strategyId: text("strategy_id").notNull(),
    name: text().notNull(),
    description: text(),
    type: text().notNull(),
    riskLevel: text("risk_level").notNull(),
    defaultSettings: text("default_settings").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    isBuiltIn: boolean("is_built_in").default(false).notNull(),
    usageCount: integer("usage_count").default(0).notNull(),
    successRate: real("success_rate").default(0),
    avgProfitPercent: real("avg_profit_percent").default(0),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("strategy_templates_risk_level_idx").using(
      "btree",
      table.riskLevel.asc().nullsLast().op("text_ops")
    ),
    index("strategy_templates_strategy_id_idx").using(
      "btree",
      table.strategyId.asc().nullsLast().op("text_ops")
    ),
    index("strategy_templates_type_idx").using(
      "btree",
      table.type.asc().nullsLast().op("text_ops")
    ),
    index("strategy_templates_usage_count_idx").using(
      "btree",
      table.usageCount.asc().nullsLast().op("int4_ops")
    ),
    unique("strategy_templates_strategy_id_unique").on(table.strategyId),
  ]
);

export const transactionLocks = pgTable(
  "transaction_locks",
  {
    id: serial().primaryKey().notNull(),
    lockId: text("lock_id").notNull(),
    resourceId: text("resource_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    ownerId: text("owner_id").notNull(),
    ownerType: text("owner_type").notNull(),
    acquiredAt: timestamp("acquired_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    expiresAt: timestamp("expires_at", { mode: "string" }).notNull(),
    releasedAt: timestamp("released_at", { mode: "string" }),
    status: text().default("active").notNull(),
    lockType: text("lock_type").default("exclusive").notNull(),
    transactionType: text("transaction_type").notNull(),
    transactionData: text("transaction_data").notNull(),
    maxRetries: integer("max_retries").default(3).notNull(),
    currentRetries: integer("current_retries").default(0).notNull(),
    timeoutMs: integer("timeout_ms").default(30000).notNull(),
    result: text(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("idx_transaction_locks_resource_status")
      .using(
        "btree",
        table.resourceId.asc().nullsLast().op("timestamp_ops"),
        table.status.asc().nullsLast().op("timestamp_ops"),
        table.expiresAt.asc().nullsLast().op("timestamp_ops")
      )
      .where(sql`(status = 'active'::text)`),
    index("transaction_locks_owner_status_idx").using(
      "btree",
      table.ownerId.asc().nullsLast().op("text_ops"),
      table.status.asc().nullsLast().op("text_ops")
    ),
    index("transaction_locks_resource_status_idx").using(
      "btree",
      table.resourceId.asc().nullsLast().op("text_ops"),
      table.status.asc().nullsLast().op("text_ops")
    ),
    unique("transaction_locks_lock_id_unique").on(table.lockId),
    unique("transaction_locks_idempotency_key_unique").on(table.idempotencyKey),
  ]
);

export const transactionQueue = pgTable(
  "transaction_queue",
  {
    id: serial().primaryKey().notNull(),
    queueId: text("queue_id").notNull(),
    lockId: text("lock_id"),
    resourceId: text("resource_id").notNull(),
    priority: integer().default(5).notNull(),
    transactionType: text("transaction_type").notNull(),
    transactionData: text("transaction_data").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: text().default("pending").notNull(),
    queuedAt: timestamp("queued_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    processingStartedAt: timestamp("processing_started_at", { mode: "string" }),
    completedAt: timestamp("completed_at", { mode: "string" }),
    result: text(),
    errorMessage: text("error_message"),
    attempts: integer().default(0).notNull(),
    ownerId: text("owner_id").notNull(),
    ownerType: text("owner_type").notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("transaction_queue_resource_status_idx").using(
      "btree",
      table.resourceId.asc().nullsLast().op("text_ops"),
      table.status.asc().nullsLast().op("text_ops")
    ),
    index("transaction_queue_status_priority_idx").using(
      "btree",
      table.status.asc().nullsLast().op("timestamp_ops"),
      table.priority.asc().nullsLast().op("timestamp_ops"),
      table.queuedAt.asc().nullsLast().op("int4_ops")
    ),
    foreignKey({
      columns: [table.lockId],
      foreignColumns: [transactionLocks.lockId],
      name: "transaction_queue_lock_id_transaction_locks_lock_id_fk",
    }).onDelete("set null"),
    unique("transaction_queue_queue_id_unique").on(table.queueId),
  ]
);

export const transactions = pgTable(
  "transactions",
  {
    id: serial().primaryKey().notNull(),
    userId: text("user_id").notNull(),
    transactionType: text("transaction_type").notNull(),
    symbolName: text("symbol_name").notNull(),
    vcoinId: text("vcoin_id"),
    buyPrice: real("buy_price"),
    buyQuantity: real("buy_quantity"),
    buyTotalCost: real("buy_total_cost"),
    buyTimestamp: timestamp("buy_timestamp", { mode: "string" }),
    buyOrderId: text("buy_order_id"),
    sellPrice: real("sell_price"),
    sellQuantity: real("sell_quantity"),
    sellTotalRevenue: real("sell_total_revenue"),
    sellTimestamp: timestamp("sell_timestamp", { mode: "string" }),
    sellOrderId: text("sell_order_id"),
    profitLoss: real("profit_loss"),
    profitLossPercentage: real("profit_loss_percentage"),
    fees: real(),
    status: text().default("pending").notNull(),
    snipeTargetId: integer("snipe_target_id"),
    notes: text(),
    transactionTime: timestamp("transaction_time", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("idx_transactions_user_timestamp").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops"),
      table.createdAt.asc().nullsLast().op("timestamp_ops"),
      table.status.asc().nullsLast().op("timestamp_ops")
    ),
    index("transactions_symbol_time_idx").using(
      "btree",
      table.symbolName.asc().nullsLast().op("text_ops"),
      table.transactionTime.asc().nullsLast().op("text_ops")
    ),
    index("transactions_user_status_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops"),
      table.status.asc().nullsLast().op("text_ops")
    ),
    index("transactions_user_time_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("timestamp_ops"),
      table.transactionTime.asc().nullsLast().op("text_ops")
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "transactions_user_id_user_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.snipeTargetId],
      foreignColumns: [snipeTargets.id],
      name: "transactions_snipe_target_id_snipe_targets_id_fk",
    }).onDelete("set null"),
  ]
);

export const userPreferences = pgTable(
  "user_preferences",
  {
    id: serial().primaryKey().notNull(),
    userId: text("user_id").notNull(),
    defaultBuyAmountUsdt: real("default_buy_amount_usdt")
      .default(100)
      .notNull(),
    maxConcurrentSnipes: integer("max_concurrent_snipes").default(3).notNull(),
    takeProfitLevel1: real("take_profit_level_1").default(5).notNull(),
    takeProfitLevel2: real("take_profit_level_2").default(10).notNull(),
    takeProfitLevel3: real("take_profit_level_3").default(15).notNull(),
    takeProfitLevel4: real("take_profit_level_4").default(25).notNull(),
    takeProfitCustom: real("take_profit_custom"),
    defaultTakeProfitLevel: integer("default_take_profit_level")
      .default(2)
      .notNull(),
    stopLossPercent: real("stop_loss_percent").default(5).notNull(),
    riskTolerance: text("risk_tolerance").default("medium").notNull(),
    readyStatePattern: text("ready_state_pattern").default("2,2,4").notNull(),
    targetAdvanceHours: real("target_advance_hours").default(3.5).notNull(),
    autoSnipeEnabled: boolean("auto_snipe_enabled").default(true).notNull(),
    selectedExitStrategy: text("selected_exit_strategy")
      .default("balanced")
      .notNull(),
    customExitStrategy: text("custom_exit_strategy"),
    autoBuyEnabled: boolean("auto_buy_enabled").default(true).notNull(),
    autoSellEnabled: boolean("auto_sell_enabled").default(true).notNull(),
    calendarPollIntervalSeconds: integer("calendar_poll_interval_seconds")
      .default(300)
      .notNull(),
    symbolsPollIntervalSeconds: integer("symbols_poll_interval_seconds")
      .default(30)
      .notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    takeProfitStrategy: text("take_profit_strategy")
      .default("balanced")
      .notNull(),
    takeProfitLevelsConfig: text("take_profit_levels_config"),
    sellQuantityLevel1: real("sell_quantity_level_1").default(25).notNull(),
    sellQuantityLevel2: real("sell_quantity_level_2").default(25).notNull(),
    sellQuantityLevel3: real("sell_quantity_level_3").default(25).notNull(),
    sellQuantityLevel4: real("sell_quantity_level_4").default(25).notNull(),
    sellQuantityCustom: real("sell_quantity_custom").default(100),
  },
  (table) => [
    index("idx_user_preferences_user_key").using(
      "btree",
      table.userId.asc().nullsLast().op("timestamp_ops"),
      table.updatedAt.asc().nullsLast().op("text_ops")
    ),
    index("user_preferences_user_id_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops")
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "user_preferences_user_id_user_id_fk",
    }).onDelete("cascade"),
    unique("user_preferences_user_id_unique").on(table.userId),
  ]
);

export const coinActivities = pgTable(
  "coin_activities",
  {
    id: serial().primaryKey().notNull(),
    vcoinId: text("vcoin_id").notNull(),
    currency: text().notNull(),
    activityId: text("activity_id").notNull(),
    currencyId: text("currency_id"),
    activityType: text("activity_type").notNull(),
    discoveredAt: timestamp("discovered_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    lastChecked: timestamp("last_checked", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    confidenceBoost: real("confidence_boost").default(0).notNull(),
    priorityScore: real("priority_score").default(0).notNull(),
    activityDetails: text("activity_details"),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("coin_activities_active_currency_idx").using(
      "btree",
      table.isActive.asc().nullsLast().op("bool_ops"),
      table.currency.asc().nullsLast().op("text_ops")
    ),
    index("coin_activities_activity_type_idx").using(
      "btree",
      table.activityType.asc().nullsLast().op("text_ops")
    ),
    index("coin_activities_currency_idx").using(
      "btree",
      table.currency.asc().nullsLast().op("text_ops")
    ),
    index("coin_activities_discovered_at_idx").using(
      "btree",
      table.discoveredAt.asc().nullsLast().op("timestamp_ops")
    ),
    index("coin_activities_is_active_idx").using(
      "btree",
      table.isActive.asc().nullsLast().op("bool_ops")
    ),
    index("coin_activities_type_discovered_idx").using(
      "btree",
      table.activityType.asc().nullsLast().op("text_ops"),
      table.discoveredAt.asc().nullsLast().op("text_ops")
    ),
    index("coin_activities_vcoin_id_idx").using(
      "btree",
      table.vcoinId.asc().nullsLast().op("text_ops")
    ),
    unique("coin_activities_activity_id_unique").on(table.activityId),
  ]
);
