import type {
  PatternAnalysisResult as EngineResult,
  PatternMatch,
} from "../core/pattern-detection/interfaces";
import { createSafeLogger } from "../lib/structured-logger";
import type { CalendarEntry, SymbolEntry } from "../services/mexc-unified-exports";
import {
  type PatternWorkflowRequest,
  patternStrategyOrchestrator,
} from "../services/pattern-strategy-orchestrator";
import type { AgentResponse } from "./base-agent";

export interface PatternAnalysisResult {
  patterns: ActionablePattern[];
  signals: PatternSignal[];
  confidence: number;
  recommendation: {
    action: "execute" | "prepare" | "monitor" | "skip";
    priority: "high" | "medium" | "low";
    timing: string;
    reasoning: string;
  };
  metadata: {
    analysisTimestamp: string;
    patternsFound: number;
    signalsDetected: number;
  };
  // Enhanced fields from centralized engine
  engineResult?: EngineResult;
  strategicRecommendations?: any[];
}

export interface ActionablePattern {
  type: string;
  confidence: number;
  timeframe: string;
  indicators: string[];
  significance: "high" | "medium" | "low";
}

export interface PatternSignal {
  name: string;
  strength: number;
  direction: "bullish" | "bearish" | "neutral";
  timeToExecution: string;
  reliability: number;
}

export class PatternAnalysisWorkflow {
  private logger = createSafeLogger("pattern-analysis-workflow");

  /**
   * Enhanced Pattern Analysis using Centralized Detection Engine
   * This method integrates with our core competitive advantage system
   */
  async analyzePatternsWithEngine(
    input: {
      calendarEntries?: CalendarEntry[];
      symbolData?: SymbolEntry[];
      vcoinId?: string;
      symbols?: string[];
    },
    analysisType: "discovery" | "monitoring" | "execution" = "discovery",
    options?: {
      confidenceThreshold?: number;
      includeAgentAnalysis?: boolean;
      enableAdvanceDetection?: boolean;
    }
  ): Promise<PatternAnalysisResult> {
    logger.info(`[PatternAnalysisWorkflow] Enhanced pattern analysis for ${analysisType}`);

    try {
      // Use the centralized pattern strategy orchestrator
      const workflowRequest: PatternWorkflowRequest = {
        type: analysisType === "execution" ? "validation" : analysisType,
        input,
        options: {
          confidenceThreshold: options?.confidenceThreshold || 70,
          includeAdvanceDetection: options?.enableAdvanceDetection ?? true,
          enableAgentAnalysis: options?.includeAgentAnalysis ?? true,
          maxExecutionTime: 30000, // 30 second timeout
        },
      };

      const workflowResult =
        await patternStrategyOrchestrator.executePatternWorkflow(workflowRequest);

      if (!workflowResult.success) {
        throw new Error(workflowResult.error || "Pattern workflow failed");
      }

      // Transform engine results to workflow format
      const engineResult = workflowResult.results.patternAnalysis;
      const strategicRecommendations = workflowResult.results.strategicRecommendations;

      const actionablePatterns = this.transformEngineMatches(engineResult?.matches || []);
      const patternSignals = this.extractSignalsFromMatches(engineResult?.matches || []);
      const confidence = engineResult?.summary.averageConfidence || 0;
      const recommendation = this.generateEnhancedRecommendation(
        actionablePatterns,
        strategicRecommendations || [],
        confidence,
        analysisType
      );

      return {
        patterns: actionablePatterns,
        signals: patternSignals,
        confidence,
        recommendation,
        metadata: {
          analysisTimestamp: new Date().toISOString(),
          patternsFound: actionablePatterns.length,
          signalsDetected: patternSignals.length,
        },
        engineResult,
        strategicRecommendations,
      };
    } catch (error) {
      logger.error("[PatternAnalysisWorkflow] Enhanced analysis failed:", error);

      // Fallback to legacy analysis
      return await this.analyzePatternsLegacy(
        {
          content: `Analysis failed: ${error}`,
          metadata: { agent: "pattern-analysis-workflow", timestamp: new Date().toISOString() },
        },
        [],
        analysisType
      );
    }
  }

  /**
   * Legacy Pattern Analysis (for backward compatibility)
   * Preserved for fallback scenarios
   */
  async analyzePatterns(
    patternAnalysis: AgentResponse,
    _symbols?: string[],
    analysisType: "discovery" | "monitoring" | "execution" = "discovery"
  ): Promise<PatternAnalysisResult> {
    return await this.analyzePatternsLegacy(patternAnalysis, _symbols, analysisType);
  }

  private async analyzePatternsLegacy(
    patternAnalysis: AgentResponse,
    _symbols?: string[],
    analysisType: "discovery" | "monitoring" | "execution" = "discovery"
  ): Promise<PatternAnalysisResult> {
    logger.info(`[PatternAnalysisWorkflow] Legacy pattern analysis for ${analysisType}`);

    const actionablePatterns = this.extractActionablePatterns(patternAnalysis, analysisType);
    const patternSignals = this.extractPatternSignals(patternAnalysis);
    const confidence = this.calculatePatternConfidence(actionablePatterns, patternSignals);
    const recommendation = this.generatePatternRecommendation(
      actionablePatterns,
      patternSignals,
      confidence,
      analysisType
    );

    return {
      patterns: actionablePatterns,
      signals: patternSignals,
      confidence,
      recommendation,
      metadata: {
        analysisTimestamp: new Date().toISOString(),
        patternsFound: actionablePatterns.length,
        signalsDetected: patternSignals.length,
      },
    };
  }

  private extractActionablePatterns(
    analysis: AgentResponse,
    _analysisType: string
  ): ActionablePattern[] {
    const content = analysis.content || "";
    const patterns: ActionablePattern[] = [];

    // Ready state pattern (sts:2, st:2, tt:4)
    if (/sts:\s*2,\s*st:\s*2,\s*tt:\s*4/i.test(content)) {
      patterns.push({
        type: "ready_state",
        confidence: 90,
        timeframe: "immediate",
        indicators: ["sts:2", "st:2", "tt:4"],
        significance: "high",
      });
    }

    // Volume spike pattern
    const volumeMatch = content.match(/volume\s+spike[:\s]*(\d+(?:\.\d+)?)/i);
    if (volumeMatch) {
      const volumeLevel = Number.parseFloat(volumeMatch[1]);
      patterns.push({
        type: "volume_spike",
        confidence: Math.min(volumeLevel * 10, 95),
        timeframe: "short_term",
        indicators: [`volume_increase_${volumeLevel}x`],
        significance: volumeLevel >= 3 ? "high" : "medium",
      });
    }

    // Price consolidation pattern
    if (/price\s+consolidation/i.test(content) || /sideways\s+movement/i.test(content)) {
      patterns.push({
        type: "price_consolidation",
        confidence: 75,
        timeframe: "medium_term",
        indicators: ["price_stability", "low_volatility"],
        significance: "medium",
      });
    }

    // Breakout preparation pattern
    if (/breakout\s+potential/i.test(content) || /accumulation\s+phase/i.test(content)) {
      patterns.push({
        type: "breakout_preparation",
        confidence: 80,
        timeframe: "short_term",
        indicators: ["accumulation", "resistance_test"],
        significance: "high",
      });
    }

    // Momentum building pattern
    if (/momentum\s+building/i.test(content) || /increasing\s+interest/i.test(content)) {
      patterns.push({
        type: "momentum_building",
        confidence: 70,
        timeframe: "medium_term",
        indicators: ["social_buzz", "volume_increase", "price_uptick"],
        significance: "medium",
      });
    }

    // Early entry pattern
    if (/early\s+entry/i.test(content) || /pre.{0,10}launch/i.test(content)) {
      const confidenceMatch = content.match(/confidence[:\s]*(\d+)/i);
      const confidence = confidenceMatch ? Number.parseInt(confidenceMatch[1]) : 65;

      patterns.push({
        type: "early_entry",
        confidence,
        timeframe: "immediate",
        indicators: ["pre_launch_signal", "timing_advantage"],
        significance: confidence >= 80 ? "high" : "medium",
      });
    }

    // Risk warning patterns
    if (/high\s+risk/i.test(content) || /caution/i.test(content)) {
      patterns.push({
        type: "risk_warning",
        confidence: 85,
        timeframe: "immediate",
        indicators: ["risk_factors", "volatility_warning"],
        significance: "high",
      });
    }

    return patterns;
  }

  private extractPatternSignals(analysis: AgentResponse): PatternSignal[] {
    const content = analysis.content || "";
    const signals: PatternSignal[] = [];

    // Buy signal
    if (/buy\s+signal/i.test(content) || /entry\s+point/i.test(content)) {
      const strengthMatch = content.match(/strength[:\s]*(\d+)/i);
      const strength = strengthMatch ? Number.parseInt(strengthMatch[1]) : 70;

      signals.push({
        name: "buy_signal",
        strength,
        direction: "bullish",
        timeToExecution: this.extractTimeToExecution(content, "buy"),
        reliability: Math.min(strength + 10, 95),
      });
    }

    // Volume signal
    const volumeSignal = content.match(/volume\s+signal[:\s]*(\d+)/i);
    if (volumeSignal) {
      const strength = Number.parseInt(volumeSignal[1]);
      signals.push({
        name: "volume_signal",
        strength,
        direction: "bullish",
        timeToExecution: "immediate",
        reliability: strength,
      });
    }

    // Timing signal
    if (/timing\s+signal/i.test(content) || /optimal\s+timing/i.test(content)) {
      const timingMatch = content.match(/(\d+(?:\.\d+)?)\s*hours?\s+advance/i);
      const advance = timingMatch ? Number.parseFloat(timingMatch[1]) : 2;

      signals.push({
        name: "timing_signal",
        strength: advance >= 3.5 ? 90 : 60,
        direction: "neutral",
        timeToExecution: `${advance} hours`,
        reliability: advance >= 3.5 ? 85 : 65,
      });
    }

    // Liquidity signal
    const liquidityMatch = content.match(/liquidity[:\s]*(\d+)/i);
    if (liquidityMatch) {
      const liquidity = Number.parseInt(liquidityMatch[1]);
      signals.push({
        name: "liquidity_signal",
        strength: liquidity,
        direction: liquidity >= 70 ? "bullish" : "neutral",
        timeToExecution: "immediate",
        reliability: Math.min(liquidity, 90),
      });
    }

    // Risk signal
    if (/risk\s+signal/i.test(content) || /warning/i.test(content)) {
      signals.push({
        name: "risk_signal",
        strength: 80,
        direction: "bearish",
        timeToExecution: "immediate",
        reliability: 90,
      });
    }

    return signals;
  }

  private extractTimeToExecution(content: string, _signalType: string): string {
    // Look for time indicators near the signal
    const timePatterns = [
      /(\d+(?:\.\d+)?)\s*hours?/i,
      /(\d+)\s*minutes?/i,
      /immediate/i,
      /now/i,
      /soon/i,
    ];

    for (const pattern of timePatterns) {
      const match = content.match(pattern);
      if (match) {
        if (
          match[0].toLowerCase().includes("immediate") ||
          match[0].toLowerCase().includes("now")
        ) {
          return "immediate";
        }
        if (match[0].toLowerCase().includes("soon")) {
          return "within 1 hour";
        }
        if (match[0].toLowerCase().includes("minute")) {
          return `${match[1]} minutes`;
        }
        if (match[0].toLowerCase().includes("hour")) {
          return `${match[1]} hours`;
        }
      }
    }

    return "unknown";
  }

  private calculatePatternConfidence(
    patterns: ActionablePattern[],
    signals: PatternSignal[]
  ): number {
    if (patterns.length === 0 && signals.length === 0) return 0;

    let totalConfidence = 0;
    let weightedCount = 0;

    // Weight patterns by significance
    for (const pattern of patterns) {
      const weight =
        pattern.significance === "high" ? 3 : pattern.significance === "medium" ? 2 : 1;
      totalConfidence += pattern.confidence * weight;
      weightedCount += weight;
    }

    // Weight signals by reliability
    for (const signal of signals) {
      const weight = signal.reliability >= 80 ? 2 : 1;
      totalConfidence += signal.strength * weight;
      weightedCount += weight;
    }

    if (weightedCount === 0) return 0;

    const baseConfidence = totalConfidence / weightedCount;

    // Bonus for multiple high-significance patterns
    const highSigPatterns = patterns.filter((p) => p.significance === "high").length;
    const bonus = Math.min(highSigPatterns * 5, 15);

    return Math.min(baseConfidence + bonus, 95);
  }

  private generatePatternRecommendation(
    patterns: ActionablePattern[],
    signals: PatternSignal[],
    confidence: number,
    analysisType: string
  ): {
    action: "execute" | "prepare" | "monitor" | "skip";
    priority: "high" | "medium" | "low";
    timing: string;
    reasoning: string;
  } {
    const highSigPatterns = patterns.filter((p) => p.significance === "high");
    const readyStatePattern = patterns.find((p) => p.type === "ready_state");
    const riskPatterns = patterns.filter((p) => p.type === "risk_warning");
    const bullishSignals = signals.filter((s) => s.direction === "bullish" && s.strength >= 70);

    // Determine action
    let action: "execute" | "prepare" | "monitor" | "skip" = "skip";
    let priority: "high" | "medium" | "low" = "low";
    let timing = "Not recommended";
    let reasoning = "Insufficient pattern confidence";

    if (riskPatterns.length > 0) {
      action = "skip";
      priority = "low";
      timing = "Avoid";
      reasoning = "Risk warning patterns detected - avoid execution";
    } else if (readyStatePattern && confidence >= 85) {
      action = "execute";
      priority = "high";
      timing = "Immediate";
      reasoning = `Ready state pattern confirmed with ${confidence}% confidence`;
    } else if (highSigPatterns.length >= 2 && bullishSignals.length >= 1 && confidence >= 75) {
      action = "execute";
      priority = "high";
      timing = "Within 1 hour";
      reasoning = `Multiple high-significance patterns with strong bullish signals (${confidence}% confidence)`;
    } else if (highSigPatterns.length >= 1 && confidence >= 70) {
      action = "prepare";
      priority = "medium";
      timing = "Within 2-4 hours";
      reasoning = `High-significance pattern detected with ${confidence}% confidence`;
    } else if (confidence >= 60) {
      action = "monitor";
      priority = "medium";
      timing = "Monitor for improvements";
      reasoning = `Moderate confidence (${confidence}%) - watch for additional signals`;
    } else {
      action = "skip";
      priority = "low";
      timing = "Not recommended";
      reasoning = `Low confidence (${confidence}%) and insufficient pattern strength`;
    }

    // Adjust based on analysis type
    if (analysisType === "monitoring" && action === "execute") {
      action = "prepare";
      timing = "Prepare for execution";
    }

    return {
      action,
      priority,
      timing,
      reasoning,
    };
  }

  // ============================================================================
  // Engine Integration Methods
  // ============================================================================

  /**
   * Transform PatternMatches from engine to ActionablePatterns for workflow
   */
  private transformEngineMatches(matches: PatternMatch[]): ActionablePattern[] {
    return matches.map((match) => ({
      type: match.patternType,
      confidence: match.confidence,
      timeframe: this.mapTimeframe(match),
      indicators: this.extractIndicators(match),
      significance: this.mapSignificance(match),
    }));
  }

  /**
   * Extract signals from PatternMatches
   */
  private extractSignalsFromMatches(matches: PatternMatch[]): PatternSignal[] {
    const signals: PatternSignal[] = [];

    for (const match of matches) {
      // Ready state signal
      if (match.patternType === "ready_state") {
        signals.push({
          name: "ready_state_signal",
          strength: match.confidence,
          direction: "bullish",
          timeToExecution: "immediate",
          reliability: match.confidence,
        });
      }

      // Advance detection signal
      if (match.patternType === "launch_sequence" && match.advanceNoticeHours >= 3.5) {
        signals.push({
          name: "advance_opportunity_signal",
          strength: Math.min(match.advanceNoticeHours * 10, 95),
          direction: "bullish",
          timeToExecution: `${match.advanceNoticeHours.toFixed(1)} hours`,
          reliability: match.confidence,
        });
      }

      // Pre-ready signal
      if (match.patternType === "pre_ready") {
        signals.push({
          name: "pre_ready_signal",
          strength: match.confidence,
          direction: "neutral",
          timeToExecution: `${match.advanceNoticeHours.toFixed(1)} hours to ready`,
          reliability: match.confidence,
        });
      }

      // Risk signals
      if (match.riskLevel === "high") {
        signals.push({
          name: "risk_warning_signal",
          strength: 80,
          direction: "bearish",
          timeToExecution: "immediate",
          reliability: 90,
        });
      }
    }

    return signals;
  }

  /**
   * Generate enhanced recommendations using strategic recommendations
   */
  private generateEnhancedRecommendation(
    patterns: ActionablePattern[],
    strategicRecommendations: any[],
    confidence: number,
    analysisType: string
  ): {
    action: "execute" | "prepare" | "monitor" | "skip";
    priority: "high" | "medium" | "low";
    timing: string;
    reasoning: string;
  } {
    // Use strategic recommendations if available
    if (strategicRecommendations.length > 0) {
      const topRecommendation = strategicRecommendations.sort(
        (a, b) => b.confidence - a.confidence
      )[0];

      return {
        action: this.mapActionFromStrategic(topRecommendation.action),
        priority: this.mapPriorityFromConfidence(topRecommendation.confidence),
        timing: this.formatTiming(topRecommendation.timing),
        reasoning: topRecommendation.reasoning,
      };
    }

    // Fallback to legacy recommendation logic
    return this.generatePatternRecommendation(patterns, [], confidence, analysisType);
  }

  // Helper methods for transformation
  private mapTimeframe(match: PatternMatch): string {
    if (match.patternType === "ready_state") return "immediate";
    if (match.patternType === "pre_ready") return "short_term";
    if (match.patternType === "launch_sequence") return "medium_term";
    return "unknown";
  }

  private extractIndicators(match: PatternMatch): string[] {
    const indicators: string[] = [];

    if (match.indicators.sts !== undefined) indicators.push(`sts:${match.indicators.sts}`);
    if (match.indicators.st !== undefined) indicators.push(`st:${match.indicators.st}`);
    if (match.indicators.tt !== undefined) indicators.push(`tt:${match.indicators.tt}`);
    if (match.advanceNoticeHours > 0)
      indicators.push(`advance:${match.advanceNoticeHours.toFixed(1)}h`);

    return indicators;
  }

  private mapSignificance(match: PatternMatch): "high" | "medium" | "low" {
    if (match.patternType === "ready_state" && match.confidence >= 85) return "high";
    if (match.confidence >= 80) return "high";
    if (match.confidence >= 60) return "medium";
    return "low";
  }

  private mapActionFromStrategic(action: string): "execute" | "prepare" | "monitor" | "skip" {
    switch (action) {
      case "immediate_trade":
      case "immediate_action":
        return "execute";
      case "prepare_position":
      case "prepare_entry":
        return "prepare";
      case "monitor_closely":
        return "monitor";
      default:
        return "skip";
    }
  }

  private mapPriorityFromConfidence(confidence: number): "high" | "medium" | "low" {
    if (confidence >= 80) return "high";
    if (confidence >= 60) return "medium";
    return "low";
  }

  private formatTiming(timing: any): string {
    if (!timing) return "Not specified";

    if (timing.optimalEntry) {
      const entryTime = new Date(timing.optimalEntry);
      const now = new Date();
      const diffMinutes = Math.round((entryTime.getTime() - now.getTime()) / (1000 * 60));

      if (diffMinutes <= 5) return "Immediate";
      if (diffMinutes <= 60) return `${diffMinutes} minutes`;
      return `${Math.round(diffMinutes / 60)} hours`;
    }

    return "Monitor timing";
  }
}
