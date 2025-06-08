import type { AgentResponse } from "../agents/base-agent";
import { type AnalysisResult, AnalysisUtils, type SymbolData } from "./analysis-utils";

export interface SymbolAnalysisResult {
  readinessScore: number;
  riskAssessment: {
    level: "low" | "medium" | "high";
    factors: string[];
    confidence: number;
  };
  tradingRecommendation: {
    action: "snipe" | "prepare" | "monitor" | "skip";
    timing: string;
    reasoning: string;
  };
  marketMicrostructure: {
    liquidity: number;
    volatility: number;
    supportLevels: number[];
  };
  metadata: {
    confidence: number;
    analysisTimestamp: string;
    agentsUsed: string[];
  };
}

export class SymbolAnalysisWorkflow {
  async combineSymbolAnalysis(
    readinessAnalysis: AgentResponse,
    patternAnalysis: AgentResponse,
    marketAnalysis: AgentResponse,
    symbolData: SymbolData
  ): Promise<SymbolAnalysisResult> {
    console.log(`[SymbolAnalysisWorkflow] Combining analysis for ${symbolData.symbol}`);

    const readinessInsights = this.extractReadinessInsights(readinessAnalysis);
    const patternInsights = this.extractPatternValidationInsights(patternAnalysis);
    const marketInsights = this.extractMarketMicrostructureInsights(marketAnalysis);

    const patternData = this.analyzeSymbolDataPattern(symbolData);
    const unifiedConfidence = this.calculateUnifiedConfidence([
      readinessInsights.confidence,
      patternInsights.confidence,
      marketInsights.confidence,
    ]);

    const tradingReadiness = this.determineTradingReadiness(
      readinessInsights,
      patternInsights,
      marketInsights,
      patternData
    );

    const riskAssessment = this.generateSymbolRiskAssessment(
      readinessInsights,
      marketInsights,
      unifiedConfidence
    );

    const recommendations = this.generateSymbolRecommendations(
      tradingReadiness,
      riskAssessment,
      unifiedConfidence
    );

    return {
      readinessScore: tradingReadiness.score,
      riskAssessment,
      tradingRecommendation: recommendations,
      marketMicrostructure: marketInsights.microstructure,
      metadata: {
        confidence: unifiedConfidence,
        analysisTimestamp: new Date().toISOString(),
        agentsUsed: ["symbol-analysis", "pattern-validation", "market-microstructure"],
      },
    };
  }

  private extractReadinessInsights(analysis: AgentResponse): AnalysisResult & {
    readinessScore: number;
    readyStateDetected: boolean;
    timingAdvance: number;
  } {
    const content = analysis.content || "";
    const confidence = AnalysisUtils.extractConfidencePercentage(content);
    const readinessData = AnalysisUtils.extractReadinessIndicators(content);

    const insights: string[] = [...readinessData.reasons];

    // Extract timing advance
    const timingMatch = content.match(/(\d+(?:\.\d+)?)\s*hours?\s+advance/i);
    const timingAdvance = timingMatch ? Number.parseFloat(timingMatch[1]) : 0;

    if (timingAdvance >= 3.5) {
      insights.push("Optimal advance timing detected");
    }

    // Check for specific ready state indicators
    const readyStateDetected = /sts:\s*2,\s*st:\s*2,\s*tt:\s*4/i.test(content);
    if (readyStateDetected) {
      insights.push("Ready state pattern confirmed");
    }

    return {
      confidence,
      insights,
      actionable: readinessData.ready,
      readinessScore: readinessData.score,
      readyStateDetected,
      timingAdvance,
    };
  }

  private extractPatternValidationInsights(analysis: AgentResponse): AnalysisResult & {
    patterns: string[];
    validationScore: number;
    signals: string[];
  } {
    const content = analysis.content || "";
    const confidence = AnalysisUtils.extractConfidencePercentage(content);

    const patterns: string[] = [];
    const signals: string[] = [];
    const insights: string[] = [];

    // Extract pattern types
    const patternMatches = content.match(/pattern[:\s]*([^.!?\n]+)/gi) || [];
    for (const match of patternMatches) {
      const pattern = match.replace(/pattern[:\s]*/i, "").trim();
      if (pattern) patterns.push(pattern);
    }

    // Extract signals
    if (content.includes("volume spike")) signals.push("volume_spike");
    if (content.includes("price consolidation")) signals.push("price_consolidation");
    if (content.includes("breakout potential")) signals.push("breakout_potential");
    if (content.includes("momentum building")) signals.push("momentum_building");

    insights.push(`Patterns detected: ${patterns.length}`);
    insights.push(`Signals identified: ${signals.length}`);

    const validationScore = Math.min(patterns.length * 15 + signals.length * 10, 100);

    return {
      confidence,
      insights,
      actionable: patterns.length > 0 && signals.length > 0,
      patterns,
      validationScore,
      signals,
    };
  }

  private extractMarketMicrostructureInsights(analysis: AgentResponse): AnalysisResult & {
    microstructure: {
      liquidity: number;
      volatility: number;
      supportLevels: number[];
    };
    marketQuality: string;
  } {
    const content = analysis.content || "";
    const confidence = AnalysisUtils.extractConfidencePercentage(content);
    const liquidity = AnalysisUtils.extractLiquidityScore(content);

    const insights: string[] = [];

    // Extract volatility
    const volatilityMatch = content.match(/volatility[:\s]*(\d+(?:\.\d+)?)/i);
    const volatility = volatilityMatch ? Number.parseFloat(volatilityMatch[1]) : 50;

    // Extract support levels
    const supportMatches = content.match(/support[:\s]*\$?(\d+(?:\.\d+)?)/gi) || [];
    const supportLevels = supportMatches
      .map((match) => {
        const levelMatch = match.match(/(\d+(?:\.\d+)?)/);
        return levelMatch ? Number.parseFloat(levelMatch[1]) : 0;
      })
      .filter((level) => level > 0);

    // Determine market quality
    let marketQuality = "poor";
    if (liquidity >= 80 && volatility <= 30) marketQuality = "excellent";
    else if (liquidity >= 60 && volatility <= 50) marketQuality = "good";
    else if (liquidity >= 40) marketQuality = "fair";

    insights.push(`Liquidity score: ${liquidity}`);
    insights.push(`Volatility level: ${volatility}`);
    insights.push(`Support levels found: ${supportLevels.length}`);
    insights.push(`Market quality: ${marketQuality}`);

    return {
      confidence,
      insights,
      actionable: liquidity >= 50 && volatility <= 70,
      microstructure: {
        liquidity,
        volatility,
        supportLevels,
      },
      marketQuality,
    };
  }

  private analyzeSymbolDataPattern(symbolData: SymbolData): {
    dataQuality: number;
    completeness: number;
    freshness: number;
    reliability: number;
  } {
    let dataQuality = 0;
    let completeness = 0;

    // Check data completeness
    const requiredFields = ["vcoinId", "symbol"];
    const optionalFields = ["readiness", "liquidity", "marketCap", "pattern"];

    for (const field of requiredFields) {
      if (symbolData[field]) completeness += 25;
    }

    for (const field of optionalFields) {
      if (symbolData[field]) completeness += 12.5;
    }

    // Assess data quality
    if (symbolData.readiness && symbolData.readiness > 0) dataQuality += 30;
    if (symbolData.liquidity && symbolData.liquidity > 0) dataQuality += 25;
    if (symbolData.marketCap && symbolData.marketCap > 0) dataQuality += 20;
    if (symbolData.pattern) dataQuality += 25;

    const freshness = 85; // Assume recent data for now
    const reliability = Math.min((dataQuality + completeness) / 2, 95);

    return {
      dataQuality,
      completeness,
      freshness,
      reliability,
    };
  }

  private calculateUnifiedConfidence(confidenceScores: number[]): number {
    return AnalysisUtils.combineConfidenceScores(confidenceScores);
  }

  private determineTradingReadiness(
    readinessInsights: any,
    patternInsights: any,
    marketInsights: any,
    patternData: any
  ): {
    ready: boolean;
    score: number;
    factors: string[];
  } {
    const factors: string[] = [];
    let score = 0;

    // Readiness factors
    if (readinessInsights.readyStateDetected) {
      score += 30;
      factors.push("Ready state pattern confirmed");
    }

    if (readinessInsights.timingAdvance >= 3.5) {
      score += 20;
      factors.push("Optimal timing advance");
    }

    // Pattern factors
    if (patternInsights.patterns.length >= 2) {
      score += 20;
      factors.push("Multiple patterns detected");
    }

    if (patternInsights.signals.length >= 2) {
      score += 15;
      factors.push("Strong signal confirmation");
    }

    // Market factors
    if (marketInsights.microstructure.liquidity >= 70) {
      score += 10;
      factors.push("High liquidity");
    }

    if (marketInsights.microstructure.volatility <= 40) {
      score += 5;
      factors.push("Controlled volatility");
    }

    const ready = score >= 60;

    return {
      ready,
      score: Math.min(score, 100),
      factors,
    };
  }

  private generateSymbolRiskAssessment(
    readinessInsights: any,
    marketInsights: any,
    confidence: number
  ): {
    level: "low" | "medium" | "high";
    factors: string[];
    confidence: number;
  } {
    const riskFactors: string[] = [];
    let riskScore = 0;

    // Assess various risk factors
    if (confidence < 60) {
      riskScore += 30;
      riskFactors.push("Low analysis confidence");
    }

    if (marketInsights.microstructure.liquidity < 50) {
      riskScore += 25;
      riskFactors.push("Poor liquidity conditions");
    }

    if (marketInsights.microstructure.volatility > 70) {
      riskScore += 20;
      riskFactors.push("High volatility risk");
    }

    if (!readinessInsights.readyStateDetected) {
      riskScore += 15;
      riskFactors.push("No ready state confirmation");
    }

    if (readinessInsights.timingAdvance < 2) {
      riskScore += 10;
      riskFactors.push("Insufficient timing advance");
    }

    let level: "low" | "medium" | "high" = "low";
    if (riskScore >= 60) level = "high";
    else if (riskScore >= 30) level = "medium";

    return {
      level,
      factors: riskFactors,
      confidence,
    };
  }

  private generateSymbolRecommendations(
    tradingReadiness: any,
    riskAssessment: any,
    confidence: number
  ): {
    action: "snipe" | "prepare" | "monitor" | "skip";
    timing: string;
    reasoning: string;
  } {
    let action: "snipe" | "prepare" | "monitor" | "skip" = "skip";
    let timing = "Not recommended";
    let reasoning = "Insufficient data or confidence";

    if (tradingReadiness.ready && riskAssessment.level === "low" && confidence >= 80) {
      action = "snipe";
      timing = "Immediate - within next hour";
      reasoning = `High readiness (${tradingReadiness.score}%) with low risk and high confidence (${confidence}%)`;
    } else if (
      tradingReadiness.score >= 50 &&
      riskAssessment.level !== "high" &&
      confidence >= 70
    ) {
      action = "prepare";
      timing = "Within 2-4 hours";
      reasoning = `Good readiness potential (${tradingReadiness.score}%) with manageable risk`;
    } else if (confidence >= 60) {
      action = "monitor";
      timing = "Monitor for improvements";
      reasoning = `Moderate confidence (${confidence}%) but missing key readiness factors`;
    } else {
      action = "skip";
      timing = "Not recommended";
      reasoning = `Low confidence (${confidence}%) and ${riskAssessment.level} risk level`;
    }

    return {
      action,
      timing,
      reasoning,
    };
  }
}
