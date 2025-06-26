/**
 * Monitoring Plan Creator
 *
 * Extracted monitoring plan creation logic from pattern-strategy-orchestrator.ts
 */

import type { PatternMatch } from "@/src/core/pattern-detection";
import type {
  AlertConfiguration,
  MonitoringPlan,
  MonitoringSchedule,
  MonitoringTarget,
  ResourceAllocation,
} from "./types";

export class MonitoringPlanCreator {
  /**
   * Create comprehensive monitoring plan from patterns
   */
  static async createMonitoringPlan(patterns: PatternMatch[]): Promise<MonitoringPlan> {
    const targets: MonitoringTarget[] = [];
    const schedules: MonitoringSchedule[] = [];
    const alerts: AlertConfiguration[] = [];

    for (const pattern of patterns) {
      // Create monitoring target
      targets.push({
        vcoinId: pattern.vcoinId || pattern.symbol,
        symbol: pattern.symbol,
        priority: MonitoringPlanCreator.determinePriority(pattern),
        expectedReadyTime:
          pattern.patternType === "launch_sequence"
            ? new Date(Date.now() + pattern.advanceNoticeHours * 60 * 60 * 1000)
            : undefined,
        currentStatus: `${pattern.patternType} (${pattern.confidence.toFixed(1)}% confidence)`,
        requiredActions: MonitoringPlanCreator.generateRequiredActions(pattern),
      });

      // Create monitoring schedule
      schedules.push({
        vcoinId: pattern.vcoinId || pattern.symbol,
        intervals: MonitoringPlanCreator.calculateMonitoringIntervals(pattern),
        escalationTriggers: MonitoringPlanCreator.generateEscalationTriggers(pattern),
      });

      // Create alert configuration
      alerts.push({
        type: "ready_state",
        condition: `sts:2 AND st:2 AND tt:4 for ${pattern.symbol}`,
        urgency: pattern.confidence >= 85 ? "immediate" : "high",
        recipients: ["trading-system", "alerts-channel"],
      });
    }

    const resources: ResourceAllocation = {
      apiCallsPerHour: targets.length * 30, // 30 calls per hour per target
      concurrentMonitoring: Math.min(targets.length, 10),
      agentUtilization: {
        "pattern-detection": 0.6,
        "symbol-analysis": 0.4,
        "calendar-monitoring": 0.2,
      },
      estimatedCosts: {
        "api-calls": targets.length * 0.001, // $0.001 per target per hour
        "agent-processing": targets.length * 0.01, // $0.01 per target per hour
      },
    };

    return { targets, schedules, alerts, resources };
  }

  /**
   * Determine monitoring priority
   */
  private static determinePriority(pattern: PatternMatch): MonitoringTarget["priority"] {
    if (pattern.patternType === "ready_state" && pattern.confidence >= 85) {
      return "critical";
    }
    if (pattern.confidence >= 80 || pattern.advanceNoticeHours <= 1) {
      return "high";
    }
    if (pattern.confidence >= 70) {
      return "medium";
    }
    return "low";
  }

  /**
   * Generate required actions for pattern
   */
  private static generateRequiredActions(pattern: PatternMatch): string[] {
    const actions: string[] = [];

    if (pattern.patternType === "ready_state") {
      actions.push("Prepare immediate trading execution");
      actions.push("Validate order book liquidity");
      actions.push("Execute sniper strategy");
    } else if (pattern.patternType === "pre_ready") {
      actions.push("Monitor status transitions closely");
      actions.push("Prepare trading infrastructure");
      actions.push("Set up ready state alerts");
    } else if (pattern.patternType === "launch_sequence") {
      actions.push("Monitor calendar updates");
      actions.push("Track symbol activation timeline");
      actions.push("Prepare monitoring escalation");
    }

    return actions;
  }

  /**
   * Calculate monitoring intervals based on pattern urgency
   */
  private static calculateMonitoringIntervals(
    pattern: PatternMatch
  ): MonitoringSchedule["intervals"] {
    if (pattern.patternType === "ready_state") {
      return { current: 1, approaching: 0.5, critical: 0.25 }; // Minutes
    }
    if (pattern.patternType === "pre_ready") {
      return { current: 5, approaching: 2, critical: 1 };
    }
    if (pattern.patternType === "launch_sequence") {
      const hours = pattern.advanceNoticeHours;
      if (hours <= 1) return { current: 5, approaching: 2, critical: 1 };
      if (hours <= 6) return { current: 15, approaching: 5, critical: 2 };
      return { current: 30, approaching: 15, critical: 5 };
    }
    return { current: 30, approaching: 15, critical: 5 };
  }

  /**
   * Generate escalation triggers
   */
  private static generateEscalationTriggers(_pattern: PatternMatch): string[] {
    return [
      "Status change detected",
      "Confidence drops below 60%",
      "Risk level increases",
      "Expected timing approaches",
      "Market conditions change significantly",
    ];
  }
}
