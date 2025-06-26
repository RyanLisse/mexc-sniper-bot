/**
 * Strategic Recommendation Generator
 * 
 * Extracted recommendation logic from pattern-strategy-orchestrator.ts
 */

import type { PatternMatch } from "@/src/core/pattern-detection";
import type { StrategicRecommendation } from "./types";

export class StrategicRecommendationGenerator {
  /**
   * Generate strategic recommendations from pattern matches
   */
  static async generateStrategicRecommendations(
    patterns: PatternMatch[],
    workflowType: string
  ): Promise<StrategicRecommendation[]> {
    const recommendations: StrategicRecommendation[] = [];

    for (const pattern of patterns) {
      const recommendation: StrategicRecommendation = {
        vcoinId: pattern.vcoinId || pattern.symbol,
        symbol: pattern.symbol,
        action: this.determineAction(pattern, workflowType),
        confidence: pattern.confidence,
        reasoning: this.generateReasoning(pattern),
        timing: this.calculateOptimalTiming(pattern),
        riskManagement: this.calculateRiskManagement(pattern),
      };

      recommendations.push(recommendation);
    }

    return recommendations.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Determine action based on pattern characteristics
   */
  private static determineAction(
    pattern: PatternMatch,
    _workflowType: string
  ): StrategicRecommendation["action"] {
    // Ready state patterns with high confidence
    if (pattern.patternType === "ready_state" && pattern.confidence >= 85) {
      return "immediate_trade";
    }

    // Pre-ready patterns close to ready state
    if (pattern.patternType === "pre_ready" && pattern.confidence >= 80) {
      return "prepare_position";
    }

    // Launch sequences with good advance notice
    if (
      pattern.patternType === "launch_sequence" &&
      pattern.advanceNoticeHours >= 3.5 &&
      pattern.confidence >= 75
    ) {
      return "monitor_closely";
    }

    // Low confidence or risky patterns
    if (pattern.confidence < 60 || pattern.riskLevel === "high") {
      return "avoid";
    }

    return "wait";
  }

  /**
   * Generate reasoning explanation
   */
  private static generateReasoning(pattern: PatternMatch): string {
    const reasons: string[] = [];

    if (pattern.patternType === "ready_state") {
      reasons.push(
        `Ready state pattern detected (sts:${pattern.indicators.sts}, st:${pattern.indicators.st}, tt:${pattern.indicators.tt})`
      );
    }

    if (pattern.advanceNoticeHours >= 3.5) {
      reasons.push(`Excellent advance notice: ${pattern.advanceNoticeHours.toFixed(1)} hours`);
    }

    reasons.push(`${pattern.confidence.toFixed(1)}% confidence based on pattern analysis`);
    reasons.push(`${pattern.riskLevel} risk level assessed`);

    if (pattern.historicalSuccess) {
      reasons.push(`Historical success rate: ${pattern.historicalSuccess.toFixed(1)}%`);
    }

    return reasons.join(". ");
  }

  /**
   * Calculate optimal timing
   */
  private static calculateOptimalTiming(pattern: PatternMatch): StrategicRecommendation["timing"] {
    const now = new Date();
    const timing: StrategicRecommendation["timing"] = {};

    if (pattern.patternType === "ready_state") {
      timing.optimalEntry = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes from now
    } else if (pattern.patternType === "pre_ready") {
      const estimatedHours = pattern.advanceNoticeHours || 2;
      timing.optimalEntry = new Date(now.getTime() + estimatedHours * 60 * 60 * 1000);
      timing.monitoringStart = new Date(now.getTime() + 30 * 60 * 1000); // Start monitoring in 30 min
    } else if (pattern.patternType === "launch_sequence") {
      const launchHours = pattern.advanceNoticeHours;
      timing.optimalEntry = new Date(now.getTime() + launchHours * 60 * 60 * 1000);
      timing.monitoringStart = new Date(
        now.getTime() + Math.max((launchHours - 1) * 60 * 60 * 1000, 0)
      );
    }

    return timing;
  }

  /**
   * Calculate risk management parameters
   */
  private static calculateRiskManagement(
    pattern: PatternMatch
  ): StrategicRecommendation["riskManagement"] {
    const baseRisk =
      pattern.riskLevel === "low" ? 0.02 : pattern.riskLevel === "medium" ? 0.03 : 0.05;
    const confidenceMultiplier = pattern.confidence / 100;

    return {
      positionSize: Math.min(confidenceMultiplier * 0.1, 0.05), // Max 5% position
      maxRisk: baseRisk,
      stopLoss: 0.95, // 5% stop loss
      takeProfit: pattern.patternType === "ready_state" ? 1.15 : 1.1, // 10-15% take profit
    };
  }
}