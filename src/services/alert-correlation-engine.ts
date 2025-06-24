import { and, count, desc, eq, gte, isNull } from "drizzle-orm";
import {
  alertCorrelations,
  alertInstances,
  alertRules,
  type InsertAlertCorrelation,
  type InsertAlertInstance,
  type SelectAlertCorrelation,
  type SelectAlertInstance,
} from "../db/schemas/alerts";
import { createLogger } from "../lib/structured-logger";

export interface CorrelationPattern {
  id: string;
  type: "temporal" | "source" | "metric" | "severity" | "custom";
  name: string;
  description: string;
  conditions: CorrelationCondition[];
  confidence: number;
  timeWindow: number; // seconds
  minAlerts: number;
  maxAlerts?: number;
}

export interface CorrelationCondition {
  field: string;
  operator: "equals" | "contains" | "starts_with" | "regex" | "range";
  value: string | number | string[];
  weight?: number; // 0-1, importance of this condition
}

export interface CorrelationResult {
  correlationId: string;
  pattern: CorrelationPattern;
  alerts: SelectAlertInstance[];
  confidence: number;
  summary: string;
  recommendations?: string[];
}

export interface AlertSignature {
  source: string;
  severity: string;
  category?: string;
  timeWindow: number;
  frequency: number;
  labels: Record<string, string>;
}

export class AlertCorrelationEngine {
  private _logger: ReturnType<typeof createLogger> | null = null;

  /**
   * Lazy logger initialization to prevent webpack bundling issues
   */
  private get logger(): ReturnType<typeof createLogger> {
    if (!this._logger) {
      try {
        this._logger = createLogger("alert-correlation-engine");
      } catch (error) {
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
  private patterns: Map<string, CorrelationPattern> = new Map();
  private recentAlerts: Map<string, SelectAlertInstance[]> = new Map();
  private correlationCache: Map<string, CorrelationResult> = new Map();
  private maxCacheAge = 300000; // 5 minutes
  private alertRetentionWindow = 3600000; // 1 hour

  constructor(database: any) {
    this.db = database;
    this.initializeDefaultPatterns();
    this.startCacheMaintenance();
  }

  // ==========================================
  // CORRELATION DETECTION
  // ==========================================

  async findCorrelation(alert: InsertAlertInstance): Promise<string | null> {
    try {
      // Update recent alerts cache
      await this.updateRecentAlerts();

      // Check existing correlations first
      const existingCorrelation = await this.findExistingCorrelation(alert);
      if (existingCorrelation) {
        await this.addAlertToCorrelation(existingCorrelation.id, alert);
        return existingCorrelation.correlationKey;
      }

      // Look for new correlation patterns
      const correlationResult = await this.detectNewCorrelation(alert);
      if (correlationResult) {
        const correlationId = await this.createCorrelation(correlationResult);
        return correlationId;
      }

      return null;
    } catch (error) {
      logger.error("Error finding correlation:", error);
      return null;
    }
  }

  async analyzeRecentAlerts(): Promise<CorrelationResult[]> {
    try {
      const results: CorrelationResult[] = [];

      // Get recent unresolved alerts
      const recentAlerts = await this.getRecentActiveAlerts();

      // Group alerts by potential correlation patterns
      for (const pattern of this.patterns.values()) {
        const correlatedAlerts = await this.findAlertsMatchingPattern(recentAlerts, pattern);

        if (correlatedAlerts.length >= pattern.minAlerts) {
          const correlation = await this.buildCorrelationResult(pattern, correlatedAlerts);
          results.push(correlation);
        }
      }

      // Cache results
      for (const result of results) {
        this.correlationCache.set(result.correlationId, result);
      }

      return results;
    } catch (error) {
      logger.error("Error analyzing recent alerts:", error);
      return [];
    }
  }

  private async detectNewCorrelation(
    alert: InsertAlertInstance
  ): Promise<CorrelationResult | null> {
    const recentAlerts = this.getRecentAlertsFromCache();
    const selectAlert = this.convertToSelectAlert(alert);

    // Try each pattern
    for (const pattern of this.patterns.values()) {
      const candidateAlerts = [...recentAlerts, selectAlert];
      const matchingAlerts = await this.findAlertsMatchingPattern(candidateAlerts, pattern);

      if (matchingAlerts.length >= pattern.minAlerts) {
        return await this.buildCorrelationResult(pattern, matchingAlerts);
      }
    }

    // Try dynamic pattern detection
    return await this.detectDynamicCorrelation(selectAlert, recentAlerts);
  }

  private async detectDynamicCorrelation(
    alert: SelectAlertInstance,
    recentAlerts: SelectAlertInstance[]
  ): Promise<CorrelationResult | null> {
    // Time-based correlation (alerts within short time window)
    const timeWindow = 300000; // 5 minutes
    const timeCorrelated = recentAlerts.filter(
      (a) => Math.abs(a.firstTriggeredAt.getTime() - alert.firstTriggeredAt.getTime()) < timeWindow
    );

    if (timeCorrelated.length >= 2) {
      const pattern: CorrelationPattern = {
        id: `temporal_${Date.now()}`,
        type: "temporal",
        name: "Temporal Burst",
        description: "Multiple alerts triggered within short time window",
        conditions: [{ field: "timeWindow", operator: "range", value: timeWindow }],
        confidence: 0.7,
        timeWindow,
        minAlerts: 2,
      };

      return await this.buildCorrelationResult(pattern, [...timeCorrelated, alert]);
    }

    // Source-based correlation (same source, different metrics)
    const sourceCorrelated = recentAlerts.filter((a) => a.source === alert.source);
    if (sourceCorrelated.length >= 1) {
      const pattern: CorrelationPattern = {
        id: `source_${alert.source}_${Date.now()}`,
        type: "source",
        name: "Source Issues",
        description: `Multiple alerts from source: ${alert.source}`,
        conditions: [{ field: "source", operator: "equals", value: alert.source }],
        confidence: 0.8,
        timeWindow: 1800000, // 30 minutes
        minAlerts: 2,
      };

      return await this.buildCorrelationResult(pattern, [...sourceCorrelated, alert]);
    }

    // Severity escalation pattern
    const severityLevels = ["low", "medium", "high", "critical"];
    const alertSeverityIndex = severityLevels.indexOf(alert.severity);

    if (alertSeverityIndex > 0) {
      const escalationAlerts = recentAlerts.filter((a) => {
        const aSeverityIndex = severityLevels.indexOf(a.severity);
        return (
          aSeverityIndex >= 0 && aSeverityIndex < alertSeverityIndex && a.source === alert.source
        );
      });

      if (escalationAlerts.length > 0) {
        const pattern: CorrelationPattern = {
          id: `escalation_${alert.source}_${Date.now()}`,
          type: "severity",
          name: "Severity Escalation",
          description: `Alert severity escalating for source: ${alert.source}`,
          conditions: [
            { field: "source", operator: "equals", value: alert.source },
            {
              field: "severity",
              operator: "range",
              value: severityLevels.slice(0, alertSeverityIndex + 1),
            },
          ],
          confidence: 0.9,
          timeWindow: 1800000,
          minAlerts: 2,
        };

        return await this.buildCorrelationResult(pattern, [...escalationAlerts, alert]);
      }
    }

    return null;
  }

  // ==========================================
  // PATTERN MATCHING
  // ==========================================

  private convertToSelectAlert(alert: InsertAlertInstance): SelectAlertInstance {
    return {
      ...alert,
      description: alert.description || null,
    } as SelectAlertInstance;
  }

  private async findAlertsMatchingPattern(
    alerts: SelectAlertInstance[],
    pattern: CorrelationPattern
  ): Promise<SelectAlertInstance[]> {
    const matching: SelectAlertInstance[] = [];

    for (const alert of alerts) {
      if (await this.alertMatchesPattern(alert, pattern)) {
        matching.push(alert);
      }
    }

    return matching;
  }

  private async alertMatchesPattern(
    alert: SelectAlertInstance,
    pattern: CorrelationPattern
  ): Promise<boolean> {
    let totalWeight = 0;
    let matchedWeight = 0;

    for (const condition of pattern.conditions) {
      const weight = condition.weight || 1;
      totalWeight += weight;

      if (await this.evaluateCondition(alert, condition)) {
        matchedWeight += weight;
      }
    }

    const matchRatio = totalWeight > 0 ? matchedWeight / totalWeight : 0;
    return matchRatio >= 0.7; // 70% of conditions must match
  }

  private async evaluateCondition(
    alert: SelectAlertInstance,
    condition: CorrelationCondition
  ): Promise<boolean> {
    const fieldValue = await this.getAlertFieldValue(alert, condition.field);

    switch (condition.operator) {
      case "equals":
        return fieldValue === condition.value;

      case "contains":
        return typeof fieldValue === "string" && fieldValue.includes(condition.value as string);

      case "starts_with":
        return typeof fieldValue === "string" && fieldValue.startsWith(condition.value as string);

      case "regex":
        if (typeof fieldValue === "string" && typeof condition.value === "string") {
          const regex = new RegExp(condition.value);
          return regex.test(fieldValue);
        }
        return false;

      case "range":
        if (Array.isArray(condition.value)) {
          return condition.value.includes(fieldValue);
        }
        return false;

      default:
        return false;
    }
  }

  private async getAlertFieldValue(alert: SelectAlertInstance, field: string): Promise<any> {
    switch (field) {
      case "source":
        return alert.source;
      case "severity":
        return alert.severity;
      case "status":
        return alert.status;
      case "sourceId":
        return alert.sourceId;
      case "environment":
        return alert.environment;
      case "metricValue":
        return alert.metricValue;
      case "threshold":
        return alert.threshold;
      case "escalationLevel":
        return alert.escalationLevel;
      case "timeWindow":
        return Date.now() - alert.firstTriggeredAt.getTime();
      case "category": {
        // Get category from rule
        const rule = await this.db
          .select({ category: alertRules.category })
          .from(alertRules)
          .where(eq(alertRules.id, alert.ruleId))
          .limit(1);
        return rule[0]?.category;
      }
      case "labels":
        return alert.labels ? JSON.parse(alert.labels) : {};
      default:
        return null;
    }
  }

  // ==========================================
  // CORRELATION MANAGEMENT
  // ==========================================

  private async createCorrelation(correlationResult: CorrelationResult): Promise<string> {
    const correlationKey = `correlation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const correlationData: InsertAlertCorrelation = {
      id: correlationKey,
      correlationKey,
      title: correlationResult.pattern.name,
      description: correlationResult.summary,
      severity: this.getHighestSeverity(correlationResult.alerts),
      status: "active",
      alertCount: correlationResult.alerts.length,
      pattern: JSON.stringify(correlationResult.pattern),
      confidence: correlationResult.confidence,
      firstAlertAt: new Date(
        Math.min(...correlationResult.alerts.map((a) => a.firstTriggeredAt.getTime()))
      ),
      lastAlertAt: new Date(
        Math.max(...correlationResult.alerts.map((a) => a.lastTriggeredAt.getTime()))
      ),
    };

    await this.db.insert(alertCorrelations).values(correlationData);

    // Update alerts with correlation ID
    for (const alert of correlationResult.alerts) {
      await this.db
        .update(alertInstances)
        .set({ correlationId: correlationKey })
        .where(eq(alertInstances.id, alert.id));
    }

    logger.info(
      `Created correlation: ${correlationKey} with ${correlationResult.alerts.length} alerts`
    );
    return correlationKey;
  }

  private async addAlertToCorrelation(
    correlationId: string,
    alert: InsertAlertInstance
  ): Promise<void> {
    // Update correlation count and timestamp
    await this.db
      .update(alertCorrelations)
      .set({
        alertCount: this.db
          .select({ count: count() })
          .from(alertInstances)
          .where(eq(alertInstances.correlationId, correlationId)),
        lastAlertAt: alert.firstTriggeredAt,
      })
      .where(eq(alertCorrelations.correlationKey, correlationId));
  }

  private async buildCorrelationResult(
    pattern: CorrelationPattern,
    alerts: SelectAlertInstance[]
  ): Promise<CorrelationResult> {
    const correlationId = `correlation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const summary = this.generateCorrelationSummary(pattern, alerts);
    const recommendations = this.generateRecommendations(pattern, alerts);

    return {
      correlationId,
      pattern,
      alerts,
      confidence: this.calculateCorrelationConfidence(pattern, alerts),
      summary,
      recommendations,
    };
  }

  private generateCorrelationSummary(
    pattern: CorrelationPattern,
    alerts: SelectAlertInstance[]
  ): string {
    const sources = [...new Set(alerts.map((a) => a.source))];
    const severities = [...new Set(alerts.map((a) => a.severity))];
    const timeSpan =
      Math.max(...alerts.map((a) => a.lastTriggeredAt.getTime())) -
      Math.min(...alerts.map((a) => a.firstTriggeredAt.getTime()));

    let summary = `${pattern.name}: ${alerts.length} alerts`;

    if (sources.length === 1) {
      summary += ` from ${sources[0]}`;
    } else {
      summary += ` from ${sources.length} sources`;
    }

    if (severities.length === 1) {
      summary += ` (${severities[0]} severity)`;
    } else {
      summary += ` (mixed severities: ${severities.join(", ")})`;
    }

    const timeSpanMinutes = Math.floor(timeSpan / 60000);
    if (timeSpanMinutes < 60) {
      summary += ` over ${timeSpanMinutes} minutes`;
    } else {
      summary += ` over ${Math.floor(timeSpanMinutes / 60)} hours`;
    }

    return summary;
  }

  private generateRecommendations(
    pattern: CorrelationPattern,
    alerts: SelectAlertInstance[]
  ): string[] {
    const recommendations: string[] = [];

    switch (pattern.type) {
      case "temporal":
        recommendations.push("Investigate system-wide issues causing simultaneous alerts");
        recommendations.push("Check for deployment or configuration changes");
        break;

      case "source":
        recommendations.push(`Focus investigation on ${alerts[0].source} component`);
        recommendations.push("Check resource utilization and dependencies");
        break;

      case "severity":
        recommendations.push("Immediate escalation required - severity is increasing");
        recommendations.push("Implement emergency response procedures");
        break;

      case "metric":
        recommendations.push("Analyze metric relationships and dependencies");
        recommendations.push("Consider adjusting alert thresholds");
        break;

      default:
        recommendations.push("Investigate common root cause");
        recommendations.push("Review system logs and metrics");
    }

    // Add severity-specific recommendations
    const highestSeverity = this.getHighestSeverity(alerts);
    if (highestSeverity === "critical") {
      recommendations.unshift("URGENT: Critical alerts detected - immediate action required");
    }

    return recommendations;
  }

  private calculateCorrelationConfidence(
    pattern: CorrelationPattern,
    alerts: SelectAlertInstance[]
  ): number {
    let confidence = pattern.confidence;

    // Boost confidence based on alert count
    const alertCountFactor = Math.min(alerts.length / pattern.minAlerts, 2.0);
    confidence *= alertCountFactor;

    // Boost confidence for temporal clustering
    const timeSpan =
      Math.max(...alerts.map((a) => a.lastTriggeredAt.getTime())) -
      Math.min(...alerts.map((a) => a.firstTriggeredAt.getTime()));
    if (timeSpan < 300000) {
      // Within 5 minutes
      confidence *= 1.2;
    }

    // Boost confidence for same source
    const sources = [...new Set(alerts.map((a) => a.source))];
    if (sources.length === 1) {
      confidence *= 1.1;
    }

    return Math.min(confidence, 1.0);
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  private async findExistingCorrelation(
    alert: InsertAlertInstance
  ): Promise<SelectAlertCorrelation | null> {
    // Look for active correlations that might include this alert
    const activeCorrelations = await this.db
      .select()
      .from(alertCorrelations)
      .where(
        and(
          eq(alertCorrelations.status, "active"),
          gte(alertCorrelations.lastAlertAt, new Date(Date.now() - this.alertRetentionWindow))
        )
      );

    for (const correlation of activeCorrelations) {
      const pattern: CorrelationPattern = JSON.parse(correlation.pattern);
      const selectAlert = this.convertToSelectAlert(alert);

      if (await this.alertMatchesPattern(selectAlert, pattern)) {
        return correlation;
      }
    }

    return null;
  }

  private async getRecentActiveAlerts(): Promise<SelectAlertInstance[]> {
    const cutoff = new Date(Date.now() - this.alertRetentionWindow);

    return await this.db
      .select()
      .from(alertInstances)
      .where(
        and(
          eq(alertInstances.status, "firing"),
          gte(alertInstances.firstTriggeredAt, cutoff),
          isNull(alertInstances.resolvedAt)
        )
      )
      .orderBy(desc(alertInstances.firstTriggeredAt));
  }

  private getRecentAlertsFromCache(): SelectAlertInstance[] {
    const allAlerts: SelectAlertInstance[] = [];

    for (const alertList of this.recentAlerts.values()) {
      allAlerts.push(...alertList);
    }

    return allAlerts.filter(
      (a) => Date.now() - a.firstTriggeredAt.getTime() < this.alertRetentionWindow
    );
  }

  private async updateRecentAlerts(): Promise<void> {
    const recentAlerts = await this.getRecentActiveAlerts();

    // Group by source for efficient lookup
    const groupedAlerts = new Map<string, SelectAlertInstance[]>();

    for (const alert of recentAlerts) {
      if (!groupedAlerts.has(alert.source)) {
        groupedAlerts.set(alert.source, []);
      }
      groupedAlerts.get(alert.source)?.push(alert);
    }

    this.recentAlerts = groupedAlerts;
  }

  private getHighestSeverity(alerts: SelectAlertInstance[]): string {
    const severityOrder = ["info", "low", "medium", "high", "critical"];
    let highest = "info";

    for (const alert of alerts) {
      const currentIndex = severityOrder.indexOf(alert.severity);
      const highestIndex = severityOrder.indexOf(highest);

      if (currentIndex > highestIndex) {
        highest = alert.severity;
      }
    }

    return highest;
  }

  private initializeDefaultPatterns(): void {
    // Agent failure cascade pattern
    this.patterns.set("agent_cascade", {
      id: "agent_cascade",
      type: "custom",
      name: "Agent Failure Cascade",
      description: "Multiple AI agents failing in sequence",
      conditions: [
        { field: "source", operator: "contains", value: "agent", weight: 0.8 },
        { field: "severity", operator: "range", value: ["high", "critical"], weight: 0.6 },
        { field: "timeWindow", operator: "range", value: 900000, weight: 0.4 }, // 15 minutes
      ],
      confidence: 0.9,
      timeWindow: 900000,
      minAlerts: 3,
    });

    // Trading system overload pattern
    this.patterns.set("trading_overload", {
      id: "trading_overload",
      type: "custom",
      name: "Trading System Overload",
      description: "Multiple trading-related alerts indicating system stress",
      conditions: [
        { field: "category", operator: "equals", value: "trading", weight: 0.9 },
        { field: "timeWindow", operator: "range", value: 600000, weight: 0.3 }, // 10 minutes
      ],
      confidence: 0.85,
      timeWindow: 600000,
      minAlerts: 5,
    });

    // Database performance degradation
    this.patterns.set("db_performance", {
      id: "db_performance",
      type: "custom",
      name: "Database Performance Issues",
      description: "Database-related performance alerts",
      conditions: [
        { field: "source", operator: "contains", value: "database", weight: 0.7 },
        { field: "source", operator: "contains", value: "query", weight: 0.5 },
        { field: "category", operator: "equals", value: "performance", weight: 0.6 },
      ],
      confidence: 0.8,
      timeWindow: 1200000, // 20 minutes
      minAlerts: 3,
    });

    // API connectivity issues
    this.patterns.set("api_connectivity", {
      id: "api_connectivity",
      type: "custom",
      name: "API Connectivity Issues",
      description: "Multiple API or external service connectivity problems",
      conditions: [
        { field: "source", operator: "contains", value: "api", weight: 0.6 },
        { field: "source", operator: "contains", value: "mexc", weight: 0.4 },
        { field: "source", operator: "contains", value: "connectivity", weight: 0.5 },
      ],
      confidence: 0.75,
      timeWindow: 1800000, // 30 minutes
      minAlerts: 4,
    });
  }

  private startCacheMaintenance(): void {
    // Clean cache every 5 minutes
    setInterval(() => {
      this.cleanCache();
    }, 300000);
  }

  private cleanCache(): void {
    const now = Date.now();

    // Clean correlation cache
    for (const [key, result] of this.correlationCache.entries()) {
      if (now - result.alerts[0].firstTriggeredAt.getTime() > this.maxCacheAge) {
        this.correlationCache.delete(key);
      }
    }

    // Clean recent alerts cache
    for (const [source, alerts] of this.recentAlerts.entries()) {
      const filtered = alerts.filter(
        (a) => now - a.firstTriggeredAt.getTime() < this.alertRetentionWindow
      );
      if (filtered.length === 0) {
        this.recentAlerts.delete(source);
      } else {
        this.recentAlerts.set(source, filtered);
      }
    }
  }

  // ==========================================
  // PUBLIC API METHODS
  // ==========================================

  async getActiveCorrelations(): Promise<SelectAlertCorrelation[]> {
    return await this.db
      .select()
      .from(alertCorrelations)
      .where(eq(alertCorrelations.status, "active"))
      .orderBy(desc(alertCorrelations.lastAlertAt));
  }

  async getCorrelationDetails(correlationId: string): Promise<CorrelationResult | null> {
    // Check cache first
    if (this.correlationCache.has(correlationId)) {
      return this.correlationCache.get(correlationId)!;
    }

    // Load from database
    const correlation = await this.db
      .select()
      .from(alertCorrelations)
      .where(eq(alertCorrelations.correlationKey, correlationId))
      .limit(1);

    if (correlation.length === 0) {
      return null;
    }

    const alerts = await this.db
      .select()
      .from(alertInstances)
      .where(eq(alertInstances.correlationId, correlationId));

    const pattern: CorrelationPattern = JSON.parse(correlation[0].pattern);

    const result: CorrelationResult = {
      correlationId,
      pattern,
      alerts,
      confidence: correlation[0].confidence,
      summary: correlation[0].description,
      recommendations: this.generateRecommendations(pattern, alerts),
    };

    this.correlationCache.set(correlationId, result);
    return result;
  }

  async addCustomPattern(pattern: CorrelationPattern): Promise<void> {
    this.patterns.set(pattern.id, pattern);
    logger.info(`Added custom correlation pattern: ${pattern.id}`);
  }

  getHealthStatus() {
    return {
      patternsLoaded: this.patterns.size,
      recentAlertsTracked: Array.from(this.recentAlerts.values()).reduce(
        (sum, alerts) => sum + alerts.length,
        0
      ),
      cachedCorrelations: this.correlationCache.size,
    };
  }
}

export default AlertCorrelationEngine;
