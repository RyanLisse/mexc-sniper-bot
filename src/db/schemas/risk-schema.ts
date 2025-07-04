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
 * Risk Management Schema
 * Contains tables for risk events and error incidents
 */

export const riskEvents = pgTable(
  "risk_events",
  {
    id: serial().primaryKey().notNull(),
    userId: text("user_id").notNull(),
    eventType: text("event_type").notNull(),
    severity: text().notNull(),
    riskScore: real("risk_score").notNull(),
    symbol: text(),
    vcoinId: text("vcoin_id"),
    positionSize: real("position_size"),
    currentPrice: real("current_price"),
    triggerPrice: real("trigger_price"),
    stopLossPrice: real("stop_loss_price"),
    portfolioImpact: real("portfolio_impact"),
    portfolioImpactPercent: real("portfolio_impact_percent"),
    drawdown: real(),
    drawdownPercent: real("drawdown_percent"),
    violatedRules: text("violated_rules"),
    riskLimits: text("risk_limits"),
    mitigationActions: text("mitigation_actions"),
    autoMitigated: boolean("auto_mitigated").default(false),
    manualIntervention: boolean("manual_intervention").default(false),
    status: text().default("active").notNull(),
    resolution: text(),
    message: text().notNull(),
    description: text(),
    source: text().notNull(),
    correlationId: text("correlation_id"),
    parentEventId: integer("parent_event_id"),
    category: text().default("trading").notNull(),
    subcategory: text(),
    environment: text().default("production").notNull(),
    detectedAt: timestamp("detected_at", { mode: "string" }).notNull(),
    acknowledgedAt: timestamp("acknowledged_at", { mode: "string" }),
    resolvedAt: timestamp("resolved_at", { mode: "string" }),
    escalatedAt: timestamp("escalated_at", { mode: "string" }),
    escalationLevel: integer("escalation_level").default(0),
    notificationsSent: integer("notifications_sent").default(0),
    lastNotificationAt: timestamp("last_notification_at", { mode: "string" }),
    metadata: text(),
    additionalData: text("additional_data"),
    tags: text(),
    assignedTo: text("assigned_to"),
    priority: text().default("medium").notNull(),
    slaDeadline: timestamp("sla_deadline", { mode: "string" }),
    businessImpact: text("business_impact"),
    customerImpact: text("customer_impact"),
    estimatedLoss: real("estimated_loss"),
    actualLoss: real("actual_loss"),
    preventable: boolean().default(true),
    lessonsLearned: text("lessons_learned"),
    actionItems: text("action_items"),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("risk_events_user_severity_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.severity.asc().nullsLast()
    ),
    index("risk_events_type_detected_idx").using(
      "btree",
      table.eventType.asc().nullsLast(),
      table.detectedAt.desc().nullsLast()
    ),
    index("risk_events_risk_score_idx").using(
      "btree",
      table.riskScore.desc().nullsLast()
    ),
  ]
);

export const errorIncidents = pgTable(
  "error_incidents",
  {
    id: text().primaryKey().notNull(),
    title: text().notNull(),
    description: text(),
    severity: text().notNull(),
    status: text().default("open").notNull(),
    category: text().notNull(),
    subcategory: text(),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    stackTrace: text("stack_trace"),
    source: text().notNull(),
    sourceId: text("source_id"),
    component: text().notNull(),
    service: text(),
    version: text(),
    environment: text().default("production").notNull(),
    userId: text("user_id"),
    sessionId: text("session_id"),
    requestId: text("request_id"),
    correlationId: text("correlation_id"),
    parentIncidentId: text("parent_incident_id"),
    frequency: integer().default(1),
    firstOccurrence: timestamp("first_occurrence", {
      mode: "string",
    }).notNull(),
    lastOccurrence: timestamp("last_occurrence", { mode: "string" }).notNull(),
    detectedAt: timestamp("detected_at", { mode: "string" }).notNull(),
    acknowledgedAt: timestamp("acknowledged_at", { mode: "string" }),
    assignedAt: timestamp("assigned_at", { mode: "string" }),
    resolvedAt: timestamp("resolved_at", { mode: "string" }),
    closedAt: timestamp("closed_at", { mode: "string" }),
    escalatedAt: timestamp("escalated_at", { mode: "string" }),
    escalationLevel: integer("escalation_level").default(0),
    assignedTo: text("assigned_to"),
    reportedBy: text("reported_by"),
    verifiedBy: text("verified_by"),
    resolution: text(),
    workaround: text(),
    rootCause: text("root_cause"),
    preventionMeasures: text("prevention_measures"),
    businessImpact: text("business_impact"),
    customerImpact: text("customer_impact"),
    affectedUsers: integer("affected_users"),
    affectedSystems: text("affected_systems"),
    downtime: integer(),
    estimatedLoss: real("estimated_loss"),
    actualLoss: real("actual_loss"),
    slaDeadline: timestamp("sla_deadline", { mode: "string" }),
    slaMet: boolean("sla_met"),
    responseTime: integer("response_time"),
    resolutionTime: integer("resolution_time"),
    notificationsSent: integer("notifications_sent").default(0),
    lastNotificationAt: timestamp("last_notification_at", { mode: "string" }),
    tags: text(),
    labels: text(),
    relatedIncidents: text("related_incidents"),
    duplicateOf: text("duplicate_of"),
    changeRequests: text("change_requests"),
    knowledgeBaseArticles: text("knowledge_base_articles"),
    postMortemRequired: boolean("post_mortem_required").default(false),
    postMortemCompleted: boolean("post_mortem_completed").default(false),
    postMortemUrl: text("post_mortem_url"),
    actionItems: text("action_items"),
    lessonsLearned: text("lessons_learned"),
    metadata: text(),
    additionalData: text("additional_data"),
    attachments: text(),
    timeline: text(),
    communicationLog: text("communication_log"),
    isRecurring: boolean("is_recurring").default(false),
    patternId: text("pattern_id"),
    priority: text().default("medium").notNull(),
    urgency: text().default("medium").notNull(),
    impact: text().default("medium").notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("error_incidents_severity_status_idx").using(
      "btree",
      table.severity.asc().nullsLast(),
      table.status.asc().nullsLast()
    ),
    index("error_incidents_component_detected_idx").using(
      "btree",
      table.component.asc().nullsLast(),
      table.detectedAt.desc().nullsLast()
    ),
  ]
);
