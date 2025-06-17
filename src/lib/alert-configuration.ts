import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  type InsertAlertRule,
  type InsertNotificationChannel,
  type SelectAlertRule,
  type SelectNotificationChannel,
  alertRules,
  escalationPolicies,
  notificationChannels,
} from "../db/schemas/alerts";

// ==========================================
// VALIDATION SCHEMAS
// ==========================================

export const AlertRuleConfigSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  category: z.enum(["trading", "safety", "performance", "system", "agent"]),
  severity: z.enum(["critical", "high", "medium", "low", "info"]),

  // Rule Configuration
  metricName: z.string().min(1),
  operator: z.enum(["gt", "lt", "eq", "gte", "lte", "anomaly"]),
  threshold: z.number().optional(),
  aggregationWindow: z.number().min(60).max(86400).default(300), // 1 minute to 24 hours
  evaluationInterval: z.number().min(30).max(3600).default(60), // 30 seconds to 1 hour

  // ML Anomaly Detection
  useAnomalyDetection: z.boolean().default(false),
  anomalyThreshold: z.number().min(1.0).max(5.0).default(2.0),
  learningWindow: z.number().min(3600).max(604800).default(86400), // 1 hour to 1 week

  // Alert Behavior
  suppressionDuration: z.number().min(60).max(86400).default(300), // 1 minute to 24 hours
  escalationDelay: z.number().min(300).max(86400).default(1800), // 5 minutes to 24 hours
  maxAlerts: z.number().min(1).max(1000).default(10),

  // Correlation
  correlationKey: z.string().optional(),
  parentRuleId: z.string().optional(),

  // Metadata
  tags: z.array(z.string()).default([]),
  customFields: z.record(z.string(), z.unknown()).default({}),
});

export const NotificationChannelConfigSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(["email", "slack", "webhook", "sms", "teams"]),
  config: z.record(z.string(), z.unknown()),

  // Routing
  severityFilter: z.array(z.enum(["critical", "high", "medium", "low", "info"])).optional(),
  categoryFilter: z
    .array(z.enum(["trading", "safety", "performance", "system", "agent"]))
    .optional(),
  tagFilter: z.array(z.string()).optional(),

  // Behavior
  isDefault: z.boolean().default(false),
  rateLimitPerHour: z.number().min(1).max(10000).default(100),

  // Formatting
  messageTemplate: z.string().optional(),
  titleTemplate: z.string().optional(),
});

export const EscalationPolicyConfigSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  steps: z.array(
    z.object({
      delay: z.number().min(60).max(86400), // 1 minute to 24 hours
      channels: z.array(z.string()),
      condition: z.enum(["unresolved", "unacknowledged"]).optional(),
    })
  ),
});

export const AlertSuppressionConfigSchema = z.object({
  name: z.string().min(1).max(255),
  reason: z.string().min(1),

  // Suppression Rules
  ruleIds: z.array(z.string()).optional(),
  categoryFilter: z
    .array(z.enum(["trading", "safety", "performance", "system", "agent"]))
    .optional(),
  severityFilter: z.array(z.enum(["critical", "high", "medium", "low", "info"])).optional(),
  sourceFilter: z.array(z.string()).optional(),
  tagFilter: z.array(z.string()).optional(),

  // Schedule
  startsAt: z.number().or(z.date()),
  endsAt: z.number().or(z.date()),
});

// ==========================================
// BUILT-IN RULE TEMPLATES
// ==========================================

export const BUILT_IN_RULE_TEMPLATES = {
  // Trading System Rules
  trading_error_rate: {
    name: "Trading Error Rate",
    description: "Monitor trading execution error rate",
    category: "trading" as const,
    severity: "high" as const,
    metricName: "trading_error_rate",
    operator: "gt" as const,
    threshold: 0.05, // 5% error rate
    aggregationWindow: 300,
    evaluationInterval: 60,
    useAnomalyDetection: true,
    anomalyThreshold: 2.5,
    tags: ["trading", "errors"],
  },

  balance_discrepancy: {
    name: "Balance Discrepancy",
    description: "Detect significant balance discrepancies",
    category: "trading" as const,
    severity: "critical" as const,
    metricName: "balance_discrepancy",
    operator: "gt" as const,
    threshold: 100, // $100 discrepancy
    aggregationWindow: 60,
    evaluationInterval: 30,
    maxAlerts: 5,
    tags: ["trading", "balance", "reconciliation"],
  },

  api_response_time: {
    name: "MEXC API Response Time",
    description: "Monitor MEXC API response time degradation",
    category: "performance" as const,
    severity: "medium" as const,
    metricName: "mexc_api_response_time",
    operator: "gt" as const,
    threshold: 5000, // 5 seconds
    aggregationWindow: 300,
    evaluationInterval: 60,
    useAnomalyDetection: true,
    tags: ["api", "performance", "mexc"],
  },

  // Safety System Rules
  risk_limit_breach: {
    name: "Risk Limit Breach",
    description: "Alert when risk limits are exceeded",
    category: "safety" as const,
    severity: "critical" as const,
    metricName: "risk_exposure",
    operator: "gt" as const,
    threshold: 0.1, // 10% of portfolio
    aggregationWindow: 60,
    evaluationInterval: 30,
    maxAlerts: 3,
    escalationDelay: 300, // 5 minutes
    tags: ["risk", "safety", "limits"],
  },

  circuit_breaker_triggered: {
    name: "Circuit Breaker Triggered",
    description: "Alert when circuit breaker is activated",
    category: "safety" as const,
    severity: "critical" as const,
    metricName: "circuit_breaker_state",
    operator: "eq" as const,
    threshold: 1, // 1 = triggered
    aggregationWindow: 60,
    evaluationInterval: 30,
    suppressionDuration: 60, // 1 minute
    tags: ["circuit-breaker", "safety"],
  },

  // Agent System Rules
  agent_failure_rate: {
    name: "AI Agent Failure Rate",
    description: "Monitor AI agent execution failures",
    category: "agent" as const,
    severity: "high" as const,
    metricName: "agent_failure_rate",
    operator: "gt" as const,
    threshold: 0.02, // 2% failure rate
    aggregationWindow: 600,
    evaluationInterval: 120,
    useAnomalyDetection: true,
    correlationKey: "agent_health",
    tags: ["agents", "ai", "failures"],
  },

  agent_response_time: {
    name: "AI Agent Response Time",
    description: "Monitor AI agent response time degradation",
    category: "agent" as const,
    severity: "medium" as const,
    metricName: "agent_response_time",
    operator: "gt" as const,
    threshold: 30000, // 30 seconds
    aggregationWindow: 300,
    evaluationInterval: 60,
    useAnomalyDetection: true,
    tags: ["agents", "performance"],
  },

  // System Health Rules
  database_connection_pool: {
    name: "Database Connection Pool",
    description: "Monitor database connection pool utilization",
    category: "system" as const,
    severity: "high" as const,
    metricName: "db_connection_pool_usage",
    operator: "gt" as const,
    threshold: 0.9, // 90% utilization
    aggregationWindow: 300,
    evaluationInterval: 60,
    tags: ["database", "connections", "performance"],
  },

  memory_usage: {
    name: "High Memory Usage",
    description: "Monitor system memory usage",
    category: "system" as const,
    severity: "medium" as const,
    metricName: "memory_usage_percent",
    operator: "gt" as const,
    threshold: 85, // 85% memory usage
    aggregationWindow: 300,
    evaluationInterval: 120,
    useAnomalyDetection: true,
    tags: ["system", "memory", "resources"],
  },

  // Performance Rules
  query_performance: {
    name: "Slow Database Queries",
    description: "Detect slow database query performance",
    category: "performance" as const,
    severity: "medium" as const,
    metricName: "slow_query_count",
    operator: "gt" as const,
    threshold: 10, // 10 slow queries in window
    aggregationWindow: 300,
    evaluationInterval: 60,
    tags: ["database", "performance", "queries"],
  },

  websocket_disconnections: {
    name: "WebSocket Disconnections",
    description: "Monitor WebSocket connection stability",
    category: "performance" as const,
    severity: "medium" as const,
    metricName: "websocket_disconnection_rate",
    operator: "gt" as const,
    threshold: 0.05, // 5% disconnection rate
    aggregationWindow: 600,
    evaluationInterval: 120,
    useAnomalyDetection: true,
    tags: ["websocket", "connectivity", "realtime"],
  },
};

// ==========================================
// NOTIFICATION CHANNEL TEMPLATES
// ==========================================

export const NOTIFICATION_CHANNEL_TEMPLATES = {
  critical_email: {
    name: "Critical Alerts Email",
    type: "email" as const,
    severityFilter: ["critical"],
    rateLimitPerHour: 50,
    titleTemplate: "🚨 CRITICAL: {{alert.message}}",
    messageTemplate:
      "URGENT: {{alert.description}}\n\nImmediate action required for {{alert.source}}.",
  },

  slack_general: {
    name: "General Slack Channel",
    type: "slack" as const,
    severityFilter: ["critical", "high", "medium"],
    rateLimitPerHour: 100,
    titleTemplate: "{{alert.severity}} Alert: {{alert.message}}",
  },

  sms_oncall: {
    name: "On-Call SMS",
    type: "sms" as const,
    severityFilter: ["critical"],
    rateLimitPerHour: 10,
    titleTemplate: "URGENT: {{alert.message}}",
  },

  webhook_monitoring: {
    name: "External Monitoring System",
    type: "webhook" as const,
    rateLimitPerHour: 1000,
  },

  teams_devops: {
    name: "DevOps Teams Channel",
    type: "teams" as const,
    categoryFilter: ["system", "performance"],
    rateLimitPerHour: 200,
  },
};

// ==========================================
// ALERT CONFIGURATION SERVICE
// ==========================================

export class AlertConfigurationService {
  private db: any;

  constructor(database: any) {
    this.db = database;
  }

  // ==========================================
  // ALERT RULES MANAGEMENT
  // ==========================================

  async createAlertRule(
    config: z.infer<typeof AlertRuleConfigSchema>,
    createdBy: string
  ): Promise<string> {
    const validated = AlertRuleConfigSchema.parse(config);
    const ruleId = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const ruleData: InsertAlertRule = {
      id: ruleId,
      name: validated.name,
      description: validated.description,
      category: validated.category,
      severity: validated.severity,
      metricName: validated.metricName,
      operator: validated.operator,
      threshold: validated.threshold,
      aggregationWindow: validated.aggregationWindow,
      evaluationInterval: validated.evaluationInterval,
      useAnomalyDetection: validated.useAnomalyDetection,
      anomalyThreshold: validated.anomalyThreshold,
      learningWindow: validated.learningWindow,
      isEnabled: true,
      suppressionDuration: validated.suppressionDuration,
      escalationDelay: validated.escalationDelay,
      maxAlerts: validated.maxAlerts,
      correlationKey: validated.correlationKey,
      parentRuleId: validated.parentRuleId,
      tags: JSON.stringify(validated.tags),
      customFields: JSON.stringify(validated.customFields),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy,
    };

    await this.db.insert(alertRules).values(ruleData);
    console.log(`Created alert rule: ${ruleId} - ${validated.name}`);
    return ruleId;
  }

  async updateAlertRule(
    ruleId: string,
    updates: Partial<z.infer<typeof AlertRuleConfigSchema>>
  ): Promise<void> {
    const updateData: Partial<InsertAlertRule> = {
      updatedAt: Date.now(),
    };

    if (updates.name) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.category) updateData.category = updates.category;
    if (updates.severity) updateData.severity = updates.severity;
    if (updates.metricName) updateData.metricName = updates.metricName;
    if (updates.operator) updateData.operator = updates.operator;
    if (updates.threshold !== undefined) updateData.threshold = updates.threshold;
    if (updates.aggregationWindow) updateData.aggregationWindow = updates.aggregationWindow;
    if (updates.evaluationInterval) updateData.evaluationInterval = updates.evaluationInterval;
    if (updates.useAnomalyDetection !== undefined)
      updateData.useAnomalyDetection = updates.useAnomalyDetection;
    if (updates.anomalyThreshold) updateData.anomalyThreshold = updates.anomalyThreshold;
    if (updates.learningWindow) updateData.learningWindow = updates.learningWindow;
    if (updates.suppressionDuration) updateData.suppressionDuration = updates.suppressionDuration;
    if (updates.escalationDelay) updateData.escalationDelay = updates.escalationDelay;
    if (updates.maxAlerts) updateData.maxAlerts = updates.maxAlerts;
    if (updates.correlationKey !== undefined) updateData.correlationKey = updates.correlationKey;
    if (updates.parentRuleId !== undefined) updateData.parentRuleId = updates.parentRuleId;
    if (updates.tags) updateData.tags = JSON.stringify(updates.tags);
    if (updates.customFields) updateData.customFields = JSON.stringify(updates.customFields);

    await this.db.update(alertRules).set(updateData).where(eq(alertRules.id, ruleId));

    console.log(`Updated alert rule: ${ruleId}`);
  }

  async deleteAlertRule(ruleId: string): Promise<void> {
    await this.db
      .update(alertRules)
      .set({ isEnabled: false, updatedAt: Date.now() })
      .where(eq(alertRules.id, ruleId));

    console.log(`Disabled alert rule: ${ruleId}`);
  }

  async getAlertRule(ruleId: string): Promise<SelectAlertRule | null> {
    const rules = await this.db.select().from(alertRules).where(eq(alertRules.id, ruleId)).limit(1);

    return rules.length > 0 ? rules[0] : null;
  }

  async listAlertRules(filters?: {
    category?: string;
    severity?: string;
    enabled?: boolean;
    metricName?: string;
  }): Promise<SelectAlertRule[]> {
    let query = this.db.select().from(alertRules);

    if (filters?.category) {
      query = query.where(eq(alertRules.category, filters.category));
    }
    if (filters?.severity) {
      query = query.where(eq(alertRules.severity, filters.severity));
    }
    if (filters?.enabled !== undefined) {
      query = query.where(eq(alertRules.isEnabled, filters.enabled));
    }
    if (filters?.metricName) {
      query = query.where(eq(alertRules.metricName, filters.metricName));
    }

    return await query.orderBy(asc(alertRules.name));
  }

  // ==========================================
  // BULK OPERATIONS
  // ==========================================

  async deployBuiltInRules(createdBy: string): Promise<string[]> {
    const deployedRules: string[] = [];

    for (const [templateKey, template] of Object.entries(BUILT_IN_RULE_TEMPLATES)) {
      try {
        // Check if rule already exists
        const existing = await this.db
          .select()
          .from(alertRules)
          .where(eq(alertRules.name, template.name))
          .limit(1);

        if (existing.length === 0) {
          const ruleId = await this.createAlertRule(template, createdBy);
          deployedRules.push(ruleId);
          console.log(`Deployed built-in rule: ${template.name}`);
        } else {
          console.log(`Built-in rule already exists: ${template.name}`);
        }
      } catch (error) {
        console.error(`Failed to deploy built-in rule ${templateKey}:`, error);
      }
    }

    return deployedRules;
  }

  async exportRulesConfiguration(): Promise<object> {
    const rules = await this.listAlertRules({ enabled: true });
    const channels = await this.listNotificationChannels({ enabled: true });

    return {
      version: "1.0",
      timestamp: new Date().toISOString(),
      rules: rules.map((rule) => ({
        ...rule,
        tags: rule.tags ? JSON.parse(rule.tags) : [],
        customFields: rule.customFields ? JSON.parse(rule.customFields) : {},
      })),
      channels: channels.map((channel) => ({
        ...channel,
        config: JSON.parse(channel.config),
        severityFilter: channel.severityFilter ? JSON.parse(channel.severityFilter) : null,
        categoryFilter: channel.categoryFilter ? JSON.parse(channel.categoryFilter) : null,
        tagFilter: channel.tagFilter ? JSON.parse(channel.tagFilter) : null,
      })),
    };
  }

  async importRulesConfiguration(
    config: any,
    createdBy: string
  ): Promise<{
    imported: number;
    skipped: number;
    errors: string[];
  }> {
    const result = { imported: 0, skipped: 0, errors: [] };

    // Import rules
    if (config.rules && Array.isArray(config.rules)) {
      for (const ruleConfig of config.rules) {
        try {
          // Check if rule already exists
          const existing = await this.db
            .select()
            .from(alertRules)
            .where(eq(alertRules.name, ruleConfig.name))
            .limit(1);

          if (existing.length === 0) {
            await this.createAlertRule(ruleConfig, createdBy);
            result.imported++;
          } else {
            result.skipped++;
          }
        } catch (error) {
          result.errors.push(`Failed to import rule ${ruleConfig.name}: ${error}`);
        }
      }
    }

    // Import notification channels
    if (config.channels && Array.isArray(config.channels)) {
      for (const channelConfig of config.channels) {
        try {
          const existing = await this.db
            .select()
            .from(notificationChannels)
            .where(eq(notificationChannels.name, channelConfig.name))
            .limit(1);

          if (existing.length === 0) {
            await this.createNotificationChannel(channelConfig, createdBy);
            result.imported++;
          } else {
            result.skipped++;
          }
        } catch (error) {
          result.errors.push(`Failed to import channel ${channelConfig.name}: ${error}`);
        }
      }
    }

    return result;
  }

  // ==========================================
  // NOTIFICATION CHANNELS MANAGEMENT
  // ==========================================

  async createNotificationChannel(
    config: z.infer<typeof NotificationChannelConfigSchema>,
    createdBy: string
  ): Promise<string> {
    const validated = NotificationChannelConfigSchema.parse(config);
    const channelId = `channel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const channelData = {
      id: channelId,
      name: validated.name,
      type: validated.type,
      config: JSON.stringify(validated.config),
      severityFilter: validated.severityFilter ? JSON.stringify(validated.severityFilter) : null,
      categoryFilter: validated.categoryFilter ? JSON.stringify(validated.categoryFilter) : null,
      tagFilter: validated.tagFilter ? JSON.stringify(validated.tagFilter) : null,
      isEnabled: true,
      isDefault: validated.isDefault,
      rateLimitPerHour: validated.rateLimitPerHour,
      messageTemplate: validated.messageTemplate,
      titleTemplate: validated.titleTemplate,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy,
    };

    await this.db.insert(notificationChannels).values(channelData);
    console.log(`Created notification channel: ${channelId} - ${validated.name}`);
    return channelId;
  }

  async listNotificationChannels(filters?: {
    type?: string;
    enabled?: boolean;
  }): Promise<SelectNotificationChannel[]> {
    let query = this.db.select().from(notificationChannels);

    if (filters?.type) {
      query = query.where(eq(notificationChannels.type, filters.type));
    }
    if (filters?.enabled !== undefined) {
      query = query.where(eq(notificationChannels.isEnabled, filters.enabled));
    }

    return await query.orderBy(asc(notificationChannels.name));
  }

  // ==========================================
  // VALIDATION AND TESTING
  // ==========================================

  async validateRuleConfiguration(config: unknown): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const result = { isValid: true, errors: [], warnings: [] };

    try {
      AlertRuleConfigSchema.parse(config);
    } catch (error) {
      result.isValid = false;
      if (error instanceof z.ZodError) {
        result.errors = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
      } else {
        result.errors.push("Invalid configuration format");
      }
    }

    // Additional business logic validation
    const validatedConfig = config as z.infer<typeof AlertRuleConfigSchema>;

    if (validatedConfig.operator !== "anomaly" && !validatedConfig.threshold) {
      result.warnings.push("Threshold is required for non-anomaly operators");
    }

    if (validatedConfig.useAnomalyDetection && validatedConfig.operator !== "anomaly") {
      result.warnings.push("Consider using 'anomaly' operator when anomaly detection is enabled");
    }

    if (validatedConfig.evaluationInterval < validatedConfig.aggregationWindow / 2) {
      result.warnings.push("Evaluation interval should be at least half of aggregation window");
    }

    return result;
  }

  async getConfigurationSummary(): Promise<{
    rules: {
      total: number;
      enabled: number;
      byCategory: Record<string, number>;
      bySeverity: Record<string, number>;
    };
    channels: {
      total: number;
      enabled: number;
      byType: Record<string, number>;
    };
    policies: {
      total: number;
      enabled: number;
    };
  }> {
    const [rulesStats, channelsStats, policiesStats] = await Promise.all([
      this.getRulesStatistics(),
      this.getChannelsStatistics(),
      this.getPoliciesStatistics(),
    ]);

    return {
      rules: rulesStats,
      channels: channelsStats,
      policies: policiesStats,
    };
  }

  private async getRulesStatistics() {
    const allRules = await this.db.select().from(alertRules);
    const enabledRules = allRules.filter((r) => r.isEnabled);

    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    for (const rule of enabledRules) {
      byCategory[rule.category] = (byCategory[rule.category] || 0) + 1;
      bySeverity[rule.severity] = (bySeverity[rule.severity] || 0) + 1;
    }

    return {
      total: allRules.length,
      enabled: enabledRules.length,
      byCategory,
      bySeverity,
    };
  }

  private async getChannelsStatistics() {
    const allChannels = await this.db.select().from(notificationChannels);
    const enabledChannels = allChannels.filter((c) => c.isEnabled);

    const byType: Record<string, number> = {};

    for (const channel of enabledChannels) {
      byType[channel.type] = (byType[channel.type] || 0) + 1;
    }

    return {
      total: allChannels.length,
      enabled: enabledChannels.length,
      byType,
    };
  }

  private async getPoliciesStatistics() {
    const allPolicies = await this.db.select().from(escalationPolicies);
    const enabledPolicies = allPolicies.filter((p) => p.isEnabled);

    return {
      total: allPolicies.length,
      enabled: enabledPolicies.length,
    };
  }
}

export default AlertConfigurationService;
