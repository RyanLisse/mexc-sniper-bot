import {
  isBrowserEnvironment,
  isNodeEnvironment,
} from "@/src/lib/browser-compatible-events";
/**
 * Agent Behavior Monitoring Module
 */

import { createLogger } from "../../lib/unified-logger";
import type {
  AgentBehaviorMetrics,
  SafetyMonitorConfig,
  SafetyProtocolViolation,
} from "./types";

const logger = createLogger("behavior-monitor", {
  enableStructuredLogging: process.env.NODE_ENV === "production",
  enablePerformanceLogging: true,
});

export class BehaviorMonitor {
  private agentBehaviorHistory: Map<string, AgentBehaviorMetrics[]> = new Map();
  private safetyConfig: SafetyMonitorConfig;
  private lastBehaviorCheck = 0;

  constructor(config: SafetyMonitorConfig) {
    this.safetyConfig = config;
  }

  /**
   * Monitor agent behavior for anomalies
   */
  async monitorAgentBehavior(agentMetrics: AgentBehaviorMetrics[]): Promise<{
    anomaliesDetected: AgentBehaviorMetrics[];
    violations: SafetyProtocolViolation[];
    recommendations: string[];
  }> {
    const anomalies: AgentBehaviorMetrics[] = [];
    const violations: SafetyProtocolViolation[] = [];
    const recommendations: string[] = [];

    for (const metrics of agentMetrics) {
      // Store historical data
      if (!this.agentBehaviorHistory.has(metrics.agentId)) {
        this.agentBehaviorHistory.set(metrics.agentId, []);
      }

      const history = this.agentBehaviorHistory.get(metrics.agentId)!;
      history.push(metrics);

      // Keep only last 100 entries per agent
      if (history.length > 100) {
        this.agentBehaviorHistory.set(metrics.agentId, history.slice(-100));
      }

      // Detect anomalies
      const anomalyResults = await this.detectBehaviorAnomalies(
        metrics,
        history
      );

      if (anomalyResults.anomalous) {
        anomalies.push(metrics);

        // Create safety violation if threshold exceeded
        if (
          metrics.anomalyScore >
          this.safetyConfig.riskManagement.circuitBreakerThreshold
        ) {
          const violation: SafetyProtocolViolation = {
            id: `violation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: "behavior_anomaly",
            severity: this.determineSeverity(metrics.anomalyScore),
            agentId: metrics.agentId,
            description: `Agent behavior anomaly detected: ${anomalyResults.reason}`,
            evidence: {
              metrics,
              anomalyScore: metrics.anomalyScore,
              threshold:
                this.safetyConfig.riskManagement.circuitBreakerThreshold,
            },
            detectedAt: new Date().toISOString(),
            resolved: false,
            action: this.determineAction(metrics.anomalyScore),
          };

          violations.push(violation);
        }
      }

      // Generate recommendations
      if (metrics.successRate < 70) {
        recommendations.push(
          `Agent ${metrics.agentId}: Low success rate (${metrics.successRate}%) - investigate and retrain`
        );
      }

      if (metrics.responseTime > 5000) {
        recommendations.push(
          `Agent ${metrics.agentId}: High response time (${metrics.responseTime}ms) - optimize performance`
        );
      }

      if (metrics.cacheHitRate < 50) {
        recommendations.push(
          `Agent ${metrics.agentId}: Low cache hit rate (${metrics.cacheHitRate}%) - review caching strategy`
        );
      }
    }

    this.lastBehaviorCheck = Date.now();

    return { anomaliesDetected: anomalies, violations, recommendations };
  } /**
   * Check agent performance degradation
   */
  async checkPerformanceDegradation(): Promise<{
    degradedAgents: string[];
    violations: SafetyProtocolViolation[];
    recommendations: string[];
  }> {
    const degradedAgents: string[] = [];
    const violations: SafetyProtocolViolation[] = [];
    const recommendations: string[] = [];

    for (const [agentId, history] of this.agentBehaviorHistory) {
      if (history.length < 5) continue; // Need sufficient history

      const recent = history.slice(-5);
      const older = history.slice(-15, -5);

      if (older.length === 0) continue;

      // Calculate performance trends
      const recentAvgSuccess =
        recent.reduce((sum, m) => sum + m.successRate, 0) / recent.length;
      const olderAvgSuccess =
        older.reduce((sum, m) => sum + m.successRate, 0) / older.length;
      const successDegradation =
        ((olderAvgSuccess - recentAvgSuccess) / olderAvgSuccess) * 100;

      const recentAvgResponse =
        recent.reduce((sum, m) => sum + m.responseTime, 0) / recent.length;
      const olderAvgResponse =
        older.reduce((sum, m) => sum + m.responseTime, 0) / older.length;
      const responseDegradation =
        ((recentAvgResponse - olderAvgResponse) / olderAvgResponse) * 100;

      // Check for significant degradation
      const significantDegradation =
        successDegradation > 20 || responseDegradation > 50;

      if (significantDegradation) {
        degradedAgents.push(agentId);

        const violation: SafetyProtocolViolation = {
          id: `perf-violation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "performance_degradation",
          severity: successDegradation > 40 ? "critical" : "high",
          agentId,
          description: `Performance degradation detected for agent ${agentId}`,
          evidence: {
            successDegradation,
            responseDegradation,
            recentAvgSuccess,
            olderAvgSuccess,
            recentAvgResponse,
            olderAvgResponse,
          },
          detectedAt: new Date().toISOString(),
          resolved: false,
          action: successDegradation > 40 ? "shutdown" : "warn",
        };

        violations.push(violation);

        recommendations.push(
          `Agent ${agentId}: Performance degraded ${successDegradation.toFixed(1)}% - investigate and potentially retrain`
        );
      }
    }

    return { degradedAgents, violations, recommendations };
  }

  /**
   * Detect behavior anomalies for a specific agent
   */
  private async detectBehaviorAnomalies(
    current: AgentBehaviorMetrics,
    history: AgentBehaviorMetrics[]
  ): Promise<{ anomalous: boolean; reason: string; score: number }> {
    if (history.length < 5) {
      return { anomalous: false, reason: "Insufficient history", score: 0 };
    }

    const recent = history.slice(-10);
    const avgSuccessRate =
      recent.reduce((sum, m) => sum + m.successRate, 0) / recent.length;
    const avgResponseTime =
      recent.reduce((sum, m) => sum + m.responseTime, 0) / recent.length;
    const avgConfidence =
      recent.reduce((sum, m) => sum + m.confidenceScore, 0) / recent.length;

    let anomalyScore = 0;
    const reasons: string[] = [];

    // Check success rate deviation
    const successDeviation = Math.abs(current.successRate - avgSuccessRate);
    if (successDeviation > 30) {
      anomalyScore += 40;
      reasons.push(`Success rate deviation: ${successDeviation.toFixed(1)}%`);
    }

    // Check response time deviation
    const responseDeviation =
      Math.abs(current.responseTime - avgResponseTime) / avgResponseTime;
    if (responseDeviation > 2) {
      anomalyScore += 30;
      reasons.push(
        `Response time spike: ${(responseDeviation * 100).toFixed(1)}%`
      );
    }

    // Check confidence deviation
    const confidenceDeviation = Math.abs(
      current.confidenceScore - avgConfidence
    );
    if (confidenceDeviation > 25) {
      anomalyScore += 20;
      reasons.push(
        `Confidence deviation: ${confidenceDeviation.toFixed(1)} points`
      );
    }

    // Check error rate spike
    if (current.errorRate > 20) {
      anomalyScore += 25;
      reasons.push(`High error rate: ${current.errorRate}%`);
    }

    return {
      anomalous: anomalyScore > 50,
      reason: reasons.join("; "),
      score: Math.min(anomalyScore, 100),
    };
  } /**
   * Determine severity level based on anomaly score
   */
  private determineSeverity(
    anomalyScore: number
  ): SafetyProtocolViolation["severity"] {
    if (anomalyScore >= 90) return "critical";
    if (anomalyScore >= 70) return "high";
    if (anomalyScore >= 50) return "medium";
    return "low";
  }

  /**
   * Determine action based on anomaly score
   */
  private determineAction(
    anomalyScore: number
  ): SafetyProtocolViolation["action"] {
    if (anomalyScore >= 90) return "shutdown";
    if (anomalyScore >= 70) return "restrict";
    if (anomalyScore >= 50) return "warn";
    return "monitor";
  }

  /**
   * Get behavior history for debugging
   */
  getBehaviorHistory(
    agentId?: string
  ): Map<string, AgentBehaviorMetrics[]> | AgentBehaviorMetrics[] | undefined {
    if (agentId) {
      return this.agentBehaviorHistory.get(agentId);
    }
    return this.agentBehaviorHistory;
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalAgentsMonitored: number;
    lastBehaviorCheck: number;
    agentsWithHistory: string[];
  } {
    return {
      totalAgentsMonitored: this.agentBehaviorHistory.size,
      lastBehaviorCheck: this.lastBehaviorCheck,
      agentsWithHistory: Array.from(this.agentBehaviorHistory.keys()),
    };
  }

  /**
   * Clear all behavior history
   */
  clearHistory(): void {
    this.agentBehaviorHistory.clear();
    logger.info("Behavior history cleared");
  }
}
