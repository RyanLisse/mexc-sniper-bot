import { and, count, desc, eq, gte, isNull, lte } from "drizzle-orm";
import {
  alertAnalytics,
  alertInstances,
  alertRules,
  alertSuppressions,
  type InsertAlertInstance,
  type SelectAlertInstance,
  type SelectAlertRule,
} from "@/src/db/schemas/alerts";
import { AlertCorrelationEngine } from "./alert-correlation-engine";
import { AnomalyDetectionService } from "./anomaly-detection-service";
import { NotificationService } from "./notification-providers";

export interface AlertMetric {
  name: string;
  value: number;
  source: string;
  sourceId?: string;
  timestamp: number;
  labels?: Record<string, string>;
  additionalData?: Record<string, unknown>;
}

export interface AlertEvaluationResult {
  shouldAlert: boolean;
  alertLevel: "critical" | "high" | "medium" | "low" | "info";
  message: string;
  description?: string;
  anomalyScore?: number;
  metricValue: number;
  threshold?: number;
}

export interface AlertingConfig {
  evaluationIntervalMs: number;
  batchSize: number;
  enableAnomalyDetection: boolean;
  enableCorrelation: boolean;
  maxAlertsPerHour: number;
  defaultSuppressionDuration: number;
}

export class AutomatedAlertingService {
  private _logger: any;
  /**
   * Lazy logger initialization to prevent webpack bundling issues
   */
  private get logger(): {
    info: (message: string, context?: any) => void;
    warn: (message: string, context?: any) => void;
    error: (message: string, context?: any, error?: Error) => void;
    debug: (message: string, context?: any) => void;
  } {
    if (!this._logger) {
      try {
        this._logger = {
          info: (message: string, context?: any) =>
            console.info("[automated-alerting-service]", message, context || ""),
          warn: (message: string, context?: any) =>
            console.warn("[automated-alerting-service]", message, context || ""),
          error: (message: string, context?: any, error?: Error) =>
            console.error("[automated-alerting-service]", message, context || "", error || ""),
          debug: (message: string, context?: any) =>
            console.debug("[automated-alerting-service]", message, context || ""),
        };
      } catch (_error) {
        this._logger = {
          debug: console.debug.bind(console),
          info: console.info.bind(console),
          warn: console.warn.bind(console),
          error: console.error.bind(console),
          fatal: console.error.bind(console),
        } as any;
      }
    }
    return this._logger;
  }

  private db: any;
  private notificationService: NotificationService;
  private anomalyDetectionService: AnomalyDetectionService;
  private correlationEngine: AlertCorrelationEngine;
  private config: AlertingConfig;
  private evaluationTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private metricBuffer: Map<string, AlertMetric[]> = new Map();

  constructor(database: any, config: Partial<AlertingConfig> = {}) {
    this.db = database;
    this.config = {
      evaluationIntervalMs: 30000, // 30 seconds
      batchSize: 100,
      enableAnomalyDetection: true,
      enableCorrelation: true,
      maxAlertsPerHour: 1000,
      defaultSuppressionDuration: 300,
      ...config,
    };

    this.notificationService = new NotificationService(database);
    this.anomalyDetectionService = new AnomalyDetectionService(database);
    this.correlationEngine = new AlertCorrelationEngine(database);
  }

  // ==========================================
  // CORE ALERTING ENGINE
  // ==========================================

  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn("AutomatedAlertingService is already running");
      return;
    }

    console.info("Starting Automated Alerting Service...");
    this.isRunning = true;

    // Initialize ML models if anomaly detection is enabled
    if (this.config.enableAnomalyDetection) {
      await this.anomalyDetectionService.initialize();
    }

    // Start periodic evaluation
    this.evaluationTimer = setInterval(
      () => this.evaluateAlerts(),
      this.config.evaluationIntervalMs
    );

    console.info(
      `Alerting service started with ${this.config.evaluationIntervalMs}ms evaluation interval`
    );
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.info("Stopping Automated Alerting Service...");
    this.isRunning = false;

    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
      this.evaluationTimer = null;
    }

    console.info("Alerting service stopped");
  }

  // ==========================================
  // METRIC INGESTION
  // ==========================================

  async ingestMetric(metric: AlertMetric): Promise<void> {
    const metricKey = `${metric.source}:${metric.name}`;

    if (!this.metricBuffer.has(metricKey)) {
      this.metricBuffer.set(metricKey, []);
    }

    const buffer = this.metricBuffer.get(metricKey)!;
    buffer.push(metric);

    // Keep only recent metrics in buffer (last 10 minutes)
    const cutoff = Date.now() - 600000;
    this.metricBuffer.set(
      metricKey,
      buffer.filter((m) => m.timestamp > cutoff)
    );

    // Immediate evaluation for critical metrics
    if (this.isCriticalMetric(metric)) {
      await this.evaluateMetricRealtime(metric);
    }
  }

  async ingestMetricBatch(metrics: AlertMetric[]): Promise<void> {
    for (const metric of metrics) {
      await this.ingestMetric(metric);
    }
  }

  private isCriticalMetric(metric: AlertMetric): boolean {
    const criticalMetrics = [
      "trading_error_rate",
      "system_health_score",
      "agent_failure_rate",
      "api_connectivity",
      "balance_discrepancy",
      "emergency_stop_triggered",
    ];

    return criticalMetrics.includes(metric.name);
  }

  // ==========================================
  // ALERT EVALUATION
  // ==========================================

  private async evaluateAlerts(): Promise<void> {
    if (!this.isRunning) return;

    try {
      console.info("Starting alert evaluation cycle...");

      // Get all enabled alert rules
      const rules = await this.db.select().from(alertRules).where(eq(alertRules.isEnabled, true));

      console.info(`Evaluating ${rules.length} alert rules`);

      // Process rules in batches
      for (let i = 0; i < rules.length; i += this.config.batchSize) {
        const batch = rules.slice(i, i + this.config.batchSize);
        await Promise.all(batch.map((rule: any) => this.evaluateRule(rule)));
      }

      // Run correlation analysis
      if (this.config.enableCorrelation) {
        await this.correlationEngine.analyzeRecentAlerts();
      }

      // Update analytics
      await this.updateAnalytics();

      console.info("Alert evaluation cycle completed");
    } catch (error) {
      console.error("Error during alert evaluation:", error);
    }
  }

  private async evaluateMetricRealtime(metric: AlertMetric): Promise<void> {
    // Get rules for this specific metric
    const rules = await this.db
      .select()
      .from(alertRules)
      .where(and(eq(alertRules.isEnabled, true), eq(alertRules.metricName, metric.name)));

    for (const rule of rules) {
      await this.evaluateRule(rule, metric);
    }
  }

  private async evaluateRule(rule: SelectAlertRule, providedMetric?: AlertMetric): Promise<void> {
    try {
      // Get metric data
      const metrics = providedMetric
        ? [providedMetric]
        : await this.getMetricData(rule.metricName, rule.aggregationWindow);

      if (metrics.length === 0) {
        return; // No data to evaluate
      }

      // Check if rule is suppressed
      if (await this.isRuleSuppressed(rule)) {
        return;
      }

      // Check rate limiting
      if (await this.isRateLimited(rule)) {
        return;
      }

      // Evaluate each metric
      for (const metric of metrics) {
        const result = await this.evaluateMetricAgainstRule(metric, rule);

        if (result.shouldAlert) {
          await this.createAlert(rule, metric, result);
        } else {
          // Check if we should resolve any existing alerts
          await this.checkAlertResolution(rule, metric);
        }
      }
    } catch (error) {
      console.error(`Error evaluating rule ${rule.id}:`, error);
    }
  }

  private async evaluateMetricAgainstRule(
    metric: AlertMetric,
    rule: SelectAlertRule
  ): Promise<AlertEvaluationResult> {
    const result: AlertEvaluationResult = {
      shouldAlert: false,
      alertLevel: rule.severity as any,
      message: "",
      metricValue: metric.value,
      threshold: rule.threshold || 0,
    };

    // Standard threshold evaluation
    if (rule.operator && rule.threshold !== null) {
      const thresholdMet = this.evaluateThreshold(metric.value, rule.operator, rule.threshold);

      if (thresholdMet) {
        result.shouldAlert = true;
        result.message = this.generateAlertMessage(metric, rule, "threshold");
        result.description = this.generateAlertDescription(metric, rule);
      }
    }

    // Anomaly detection evaluation
    if (rule.useAnomalyDetection && this.config.enableAnomalyDetection) {
      const anomalyResult = await this.anomalyDetectionService.detectAnomaly(
        rule.metricName,
        metric.value,
        metric.timestamp
      );

      if (anomalyResult.isAnomaly) {
        result.shouldAlert = true;
        result.anomalyScore = anomalyResult.score;
        result.message = this.generateAlertMessage(metric, rule, "anomaly");
        result.description = `Anomaly detected with score ${anomalyResult.score.toFixed(2)}`;

        // Escalate severity for high anomaly scores
        if (anomalyResult.score > 3.0) {
          result.alertLevel = "critical";
        } else if (anomalyResult.score > 2.5) {
          result.alertLevel = "high";
        }
      }
    }

    return result;
  }

  private evaluateThreshold(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case "gt":
        return value > threshold;
      case "gte":
        return value >= threshold;
      case "lt":
        return value < threshold;
      case "lte":
        return value <= threshold;
      case "eq":
        return Math.abs(value - threshold) < 0.001;
      default:
        return false;
    }
  }

  // ==========================================
  // ALERT CREATION AND MANAGEMENT
  // ==========================================

  private async createAlert(
    rule: SelectAlertRule,
    metric: AlertMetric,
    evaluation: AlertEvaluationResult
  ): Promise<string> {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    // Check for existing active alert
    const existingAlert = await this.db
      .select()
      .from(alertInstances)
      .where(
        and(
          eq(alertInstances.ruleId, rule.id),
          eq(alertInstances.source, metric.source),
          eq(alertInstances.status, "firing"),
          isNull(alertInstances.resolvedAt)
        )
      )
      .limit(1);

    if (existingAlert.length > 0) {
      // Update existing alert
      await this.updateExistingAlert(existingAlert[0], evaluation, now);
      return existingAlert[0].id;
    }

    // Create new alert
    const alertData: InsertAlertInstance = {
      id: alertId,
      ruleId: rule.id,
      status: "firing",
      severity: evaluation.alertLevel,
      message: evaluation.message,
      description: evaluation.description,
      metricValue: evaluation.metricValue,
      threshold: evaluation.threshold,
      anomalyScore: evaluation.anomalyScore,
      source: metric.source,
      sourceId: metric.sourceId,
      environment: "production",
      escalationLevel: 0,
      firstTriggeredAt: now,
      lastTriggeredAt: now,
      additionalData: JSON.stringify(metric.additionalData || {}),
      labels: JSON.stringify(metric.labels || {}),
    };

    // Check for correlation
    if (this.config.enableCorrelation) {
      const correlationId = await this.correlationEngine.findCorrelation(alertData);
      if (correlationId) {
        alertData.correlationId = correlationId;
      }
    }

    await this.db.insert(alertInstances).values(alertData);

    // Get the inserted alert for notifications
    const insertedAlert = await this.db
      .select()
      .from(alertInstances)
      .where(eq(alertInstances.id, alertId))
      .limit(1);

    if (insertedAlert.length > 0) {
      // Send notifications
      await this.notificationService.sendAlertNotifications(insertedAlert[0]);
    }

    // Log alert creation
    console.info(`Created alert: ${alertId} - ${evaluation.message}`);

    return alertId;
  }

  private async updateExistingAlert(
    existingAlert: SelectAlertInstance,
    evaluation: AlertEvaluationResult,
    timestamp: Date
  ): Promise<void> {
    await this.db
      .update(alertInstances)
      .set({
        lastTriggeredAt: timestamp,
        metricValue: evaluation.metricValue,
        anomalyScore: evaluation.anomalyScore,
      })
      .where(eq(alertInstances.id, existingAlert.id));
  }

  private async checkAlertResolution(rule: SelectAlertRule, metric: AlertMetric): Promise<void> {
    const activeAlerts = await this.db
      .select()
      .from(alertInstances)
      .where(
        and(
          eq(alertInstances.ruleId, rule.id),
          eq(alertInstances.source, metric.source),
          eq(alertInstances.status, "firing"),
          isNull(alertInstances.resolvedAt)
        )
      );

    for (const alert of activeAlerts) {
      // Check if conditions are no longer met
      const evaluation = await this.evaluateMetricAgainstRule(metric, rule);

      if (!evaluation.shouldAlert) {
        await this.resolveAlert(alert.id, "auto_resolved", "Conditions no longer met");
      }
    }
  }

  async resolveAlert(alertId: string, resolvedBy: string, notes?: string): Promise<void> {
    const now = new Date();

    await this.db
      .update(alertInstances)
      .set({
        status: "resolved",
        resolvedAt: now,
        resolvedBy,
        resolutionNotes: notes,
      })
      .where(eq(alertInstances.id, alertId));

    // Send resolution notifications
    const alert = await this.db
      .select()
      .from(alertInstances)
      .where(eq(alertInstances.id, alertId))
      .limit(1);

    if (alert.length > 0) {
      await this.notificationService.sendResolutionNotifications(alert[0]);
    }

    console.info(`Resolved alert: ${alertId}`);
  }

  // ==========================================
  // SUPPRESSION MANAGEMENT
  // ==========================================

  private async isRuleSuppressed(rule: SelectAlertRule): Promise<boolean> {
    const now = new Date();

    const suppressions = await this.db
      .select()
      .from(alertSuppressions)
      .where(
        and(
          eq(alertSuppressions.isActive, true),
          lte(alertSuppressions.startsAt, now),
          gte(alertSuppressions.endsAt, now)
        )
      );

    for (const suppression of suppressions) {
      // Check if this rule is specifically suppressed
      if (suppression.ruleIds) {
        const ruleIds = JSON.parse(suppression.ruleIds);
        if (ruleIds.includes(rule.id)) {
          return true;
        }
      }

      // Check category filter
      if (suppression.categoryFilter) {
        const categories = JSON.parse(suppression.categoryFilter);
        if (categories.includes(rule.category)) {
          return true;
        }
      }

      // Check severity filter
      if (suppression.severityFilter) {
        const severities = JSON.parse(suppression.severityFilter);
        if (severities.includes(rule.severity)) {
          return true;
        }
      }
    }

    return false;
  }

  async createSuppression(
    name: string,
    reason: string,
    startsAt: number,
    endsAt: number,
    filters: {
      ruleIds?: string[];
      categories?: string[];
      severities?: string[];
      sources?: string[];
      tags?: string[];
    },
    createdBy: string
  ): Promise<string> {
    const suppressionId = `suppression_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await this.db.insert(alertSuppressions).values({
      id: suppressionId,
      name,
      reason,
      ruleIds: filters.ruleIds ? JSON.stringify(filters.ruleIds) : null,
      categoryFilter: filters.categories ? JSON.stringify(filters.categories) : null,
      severityFilter: filters.severities ? JSON.stringify(filters.severities) : null,
      sourceFilter: filters.sources ? JSON.stringify(filters.sources) : null,
      tagFilter: filters.tags ? JSON.stringify(filters.tags) : null,
      startsAt,
      endsAt,
      isActive: true,
      createdAt: Date.now(),
      createdBy,
    });

    console.info(`Created alert suppression: ${suppressionId}`);
    return suppressionId;
  }

  // ==========================================
  // RATE LIMITING
  // ==========================================

  private async isRateLimited(rule: SelectAlertRule): Promise<boolean> {
    const oneHourAgo = new Date(Date.now() - 3600000);

    const recentAlerts = await this.db
      .select({ count: count() })
      .from(alertInstances)
      .where(
        and(eq(alertInstances.ruleId, rule.id), gte(alertInstances.firstTriggeredAt, oneHourAgo))
      );

    const alertCount = recentAlerts[0]?.count || 0;
    const maxAlerts = rule.maxAlerts || this.config.maxAlertsPerHour;

    return alertCount >= maxAlerts;
  }

  // ==========================================
  // ANALYTICS AND METRICS
  // ==========================================

  private async updateAnalytics(): Promise<void> {
    const now = new Date();
    const hourBucket = Math.floor(now.getTime() / 3600000) * 3600000;

    // Calculate metrics for the current hour
    const hourStart = hourBucket;
    const hourEnd = hourBucket + 3600000;

    const metrics = await this.calculateHourlyMetrics(hourStart, hourEnd);

    // Upsert analytics record
    await this.db
      .insert(alertAnalytics)
      .values({
        id: `analytics_${hourBucket}`,
        bucket: "hourly",
        timestamp: hourBucket,
        ...metrics,
      })
      .onConflictDoUpdate({
        target: alertAnalytics.id,
        set: metrics,
      });
  }

  private async calculateHourlyMetrics(startTime: number, endTime: number) {
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    const alerts = await this.db
      .select()
      .from(alertInstances)
      .where(
        and(
          gte(alertInstances.firstTriggeredAt, startDate),
          lte(alertInstances.firstTriggeredAt, endDate)
        )
      );

    const resolved = alerts.filter((a: any) => a.resolvedAt);
    const totalResolutionTime = resolved.reduce((sum: number, alert: any) => {
      const resolvedTime = alert.resolvedAt ? alert.resolvedAt.getTime() : 0;
      const triggeredTime = alert.firstTriggeredAt.getTime();
      return sum + (resolvedTime - triggeredTime);
    }, 0);

    return {
      totalAlerts: alerts.length,
      criticalAlerts: alerts.filter((a: any) => a.severity === "critical").length,
      highAlerts: alerts.filter((a: any) => a.severity === "high").length,
      mediumAlerts: alerts.filter((a: any) => a.severity === "medium").length,
      lowAlerts: alerts.filter((a: any) => a.severity === "low").length,
      resolvedAlerts: resolved.length,
      averageResolutionTime: resolved.length > 0 ? totalResolutionTime / resolved.length : 0,
      mttr: resolved.length > 0 ? totalResolutionTime / resolved.length : 0,
      tradingAlerts: alerts.filter((a: any) => a.source.includes("trading")).length,
      safetyAlerts: alerts.filter((a: any) => a.source.includes("safety")).length,
      performanceAlerts: alerts.filter((a: any) => a.source.includes("performance")).length,
      systemAlerts: alerts.filter((a: any) => a.source.includes("system")).length,
      agentAlerts: alerts.filter((a: any) => a.source.includes("agent")).length,
    };
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  private async getMetricData(metricName: string, windowSeconds: number): Promise<AlertMetric[]> {
    const cutoff = Date.now() - windowSeconds * 1000;
    const metrics: AlertMetric[] = [];

    // Get from buffer first
    for (const [key, buffer] of this.metricBuffer.entries()) {
      if (key.endsWith(`:${metricName}`)) {
        metrics.push(...buffer.filter((m) => m.timestamp > cutoff));
      }
    }

    // Get historical metrics from database for comprehensive analysis
    try {
      const { db } = await import("@/src/db");
      const { sql } = await import("drizzle-orm");

      // Query performance snapshots for historical metrics
      const historicalData = await db.execute(sql`
        SELECT timestamp, agent_metrics, workflow_metrics, system_metrics
        FROM performance_snapshots 
        WHERE timestamp > ${cutoff.toISOString()}
        ORDER BY timestamp ASC
      `);

      // Extract specific metric from historical data
      for (const row of historicalData.rows) {
        try {
          const agentMetrics = JSON.parse(row.agent_metrics as string);
          const workflowMetrics = JSON.parse(row.workflow_metrics as string);
          const systemMetrics = JSON.parse(row.system_metrics as string);

          // Search for the metric in different metric categories
          const allMetrics = { ...agentMetrics, ...workflowMetrics, ...systemMetrics };

          if (allMetrics[metricName]) {
            metrics.push({
              timestamp: new Date(row.timestamp as string),
              value:
                typeof allMetrics[metricName] === "object"
                  ? allMetrics[metricName].value || allMetrics[metricName].average || 0
                  : allMetrics[metricName],
              source: "database",
              metadata: {
                snapshotId: row.id,
                metricCategory: Object.keys(agentMetrics).includes(metricName)
                  ? "agent"
                  : Object.keys(workflowMetrics).includes(metricName)
                    ? "workflow"
                    : "system",
              },
            });
          }
        } catch (parseError) {
          this.logger.warn(`Failed to parse historical metrics data:`, parseError);
        }
      }

      this.logger.info(
        `Retrieved ${metrics.length} metrics for ${metricName} (${historicalData.rows.length} from database)`
      );
    } catch (error) {
      this.logger.warn(`Failed to retrieve historical metrics for ${metricName}:`, error);
    }

    return metrics.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private generateAlertMessage(
    metric: AlertMetric,
    rule: SelectAlertRule,
    type: "threshold" | "anomaly"
  ): string {
    if (type === "anomaly") {
      return `Anomaly detected in ${metric.name} from ${metric.source}: ${metric.value}`;
    }

    return `${rule.name}: ${metric.name} is ${metric.value} (threshold: ${rule.operator} ${rule.threshold})`;
  }

  private generateAlertDescription(metric: AlertMetric, rule: SelectAlertRule): string {
    return (
      `Alert triggered for metric ${metric.name} from source ${metric.source}. ` +
      `Current value: ${metric.value}. Rule: ${rule.description || rule.name}`
    );
  }

  // ==========================================
  // PUBLIC API METHODS
  // ==========================================

  async getActiveAlerts(filters?: {
    severity?: string[];
    category?: string[];
    source?: string[];
    limit?: number;
  }): Promise<SelectAlertInstance[]> {
    let query = this.db
      .select()
      .from(alertInstances)
      .where(and(eq(alertInstances.status, "firing"), isNull(alertInstances.resolvedAt)))
      .orderBy(desc(alertInstances.firstTriggeredAt));

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    return await query;
  }

  async getAlertHistory(hours = 24): Promise<SelectAlertInstance[]> {
    const cutoff = new Date(Date.now() - hours * 3600000);

    return await this.db
      .select()
      .from(alertInstances)
      .where(gte(alertInstances.firstTriggeredAt, cutoff))
      .orderBy(desc(alertInstances.firstTriggeredAt));
  }

  async getAlertAnalytics(bucket: "hourly" | "daily" = "hourly", limit = 24) {
    return await this.db
      .select()
      .from(alertAnalytics)
      .where(eq(alertAnalytics.bucket, bucket))
      .orderBy(desc(alertAnalytics.timestamp))
      .limit(limit);
  }

  getHealthStatus() {
    return {
      isRunning: this.isRunning,
      evaluationInterval: this.config.evaluationIntervalMs,
      metricsInBuffer: Array.from(this.metricBuffer.values()).reduce(
        (sum, buffer) => sum + buffer.length,
        0
      ),
      anomalyDetectionEnabled: this.config.enableAnomalyDetection,
      correlationEnabled: this.config.enableCorrelation,
    };
  }
}

export default AutomatedAlertingService;
