import type { AgentResponse } from "../agents/base-agent";

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
  async analyzePatterns(
    patternAnalysis: AgentResponse,
    _symbols?: string[],
    analysisType: "discovery" | "monitoring" | "execution" = "discovery"
  ): Promise<PatternAnalysisResult> {
    console.log(`[PatternAnalysisWorkflow] Analyzing patterns for ${analysisType}`);

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
}
