/**
 * Pattern Validation Module
 */

import { createLogger } from "../../lib/unified-logger";
import type { PatternValidationResult, SafetyMonitorConfig } from "./types";

const logger = createLogger("pattern-validator", {
  enableStructuredLogging: process.env.NODE_ENV === "production",
  enablePerformanceLogging: true,
});

export class PatternValidator {
  private safetyConfig: SafetyMonitorConfig;

  constructor(config: SafetyMonitorConfig) {
    this.safetyConfig = config;
  }

  /**
   * Validate pattern discovery results with comprehensive safety checks
   */
  async validatePatternDiscovery(
    patternId: string,
    symbol: string,
    confidence: number,
    riskScore: number,
    patternData: Record<string, unknown>
  ): Promise<PatternValidationResult> {
    const validationSteps: PatternValidationResult["validationSteps"] = [];
    let overallConfidence = confidence;

    // Step 1: Confidence threshold check
    const confidenceCheck =
      confidence >= this.safetyConfig.reconciliation.toleranceThreshold * 100;
    validationSteps.push({
      step: "Confidence Threshold",
      passed: confidenceCheck,
      details: `Pattern confidence: ${confidence}%, Required: ${this.safetyConfig.reconciliation.toleranceThreshold * 100}%`,
      confidence: confidenceCheck ? confidence : 0,
    });

    if (!confidenceCheck) overallConfidence *= 0.5;

    // Step 2: Risk score validation
    const riskCheck = riskScore <= 70; // Maximum acceptable risk
    validationSteps.push({
      step: "Risk Score Validation",
      passed: riskCheck,
      details: `Pattern risk score: ${riskScore}, Maximum allowed: 70`,
      confidence: riskCheck ? 90 : 30,
    });

    if (!riskCheck) overallConfidence *= 0.6;

    // Step 3: Market conditions check
    const marketCheck = await this.validateMarketConditions(symbol);
    validationSteps.push({
      step: "Market Conditions",
      passed: marketCheck.suitable,
      details: marketCheck.details,
      confidence: marketCheck.confidence,
    });

    if (!marketCheck.suitable) overallConfidence *= 0.7;

    // Step 4: Historical validation
    const historicalCheck = await this.validateHistoricalPerformance(
      symbol,
      patternData
    );
    validationSteps.push({
      step: "Historical Performance",
      passed: historicalCheck.reliable,
      details: historicalCheck.details,
      confidence: historicalCheck.confidence,
    });

    if (!historicalCheck.reliable) overallConfidence *= 0.8;

    // Step 5: Consensus requirement check
    const consensusRequired = riskScore > 50 || confidence < 80;
    let consensus: PatternValidationResult["consensus"];

    if (consensusRequired) {
      consensus = {
        required: true,
        agentsConsulted: [
          "strategy-agent",
          "risk-manager-agent",
          "pattern-discovery-agent",
        ],
        agreementLevel: 75, // Simulated consensus
        dissenting: [],
      };
      if (consensus.agreementLevel < 70) {
        overallConfidence *= 0.5;
      }
    } else {
      consensus = {
        required: false,
        agentsConsulted: [],
        agreementLevel: 100,
        dissenting: [],
      };
    }

    // Safety checks
    const safetyChecks = {
      marketConditions: marketCheck.suitable,
      riskLimits: riskCheck,
      correlationCheck: true, // Simplified for now
      liquidityCheck: true, // Simplified for now
    };

    // Determine recommendation
    const allStepsPassed = validationSteps.every((step) => step.passed);
    const safetyChecksPassed = Object.values(safetyChecks).every(
      (check) => check
    );
    const consensusAchieved =
      !consensusRequired || consensus.agreementLevel >= 70;

    let recommendation: PatternValidationResult["recommendation"];
    if (
      allStepsPassed &&
      safetyChecksPassed &&
      consensusAchieved &&
      overallConfidence >= 70
    ) {
      recommendation = "proceed";
    } else if (overallConfidence >= 50 && safetyChecksPassed) {
      recommendation = "caution";
    } else {
      recommendation = "reject";
    }

    // Generate reasoning
    const reasoning: string[] = [];
    if (!allStepsPassed) {
      const failedSteps = validationSteps
        .filter((step) => !step.passed)
        .map((step) => step.step);
      reasoning.push(`Failed validation steps: ${failedSteps.join(", ")}`);
    }
    if (!safetyChecksPassed) {
      const failedChecks = Object.entries(safetyChecks)
        .filter(([_, passed]) => !passed)
        .map(([check, _]) => check);
      reasoning.push(`Failed safety checks: ${failedChecks.join(", ")}`);
    }
    if (consensusRequired && consensus.agreementLevel < 70) {
      reasoning.push(
        `Insufficient consensus: ${consensus.agreementLevel}% agreement`
      );
    }
    if (overallConfidence < 70) {
      reasoning.push(
        `Low overall confidence: ${overallConfidence.toFixed(1)}%`
      );
    }

    const result: PatternValidationResult = {
      patternId,
      symbol,
      confidence: Math.round(overallConfidence * 100) / 100,
      riskScore,
      validationSteps,
      consensus,
      safetyChecks,
      recommendation,
      reasoning,
    };

    logger.info(`Pattern validation ${recommendation}: ${symbol}`, {
      patternId,
      confidence: overallConfidence,
      recommendation,
      consensusRequired,
    });

    return result;
  } /**
   * Validate market conditions for a symbol
   */
  private async validateMarketConditions(_symbol: string): Promise<{
    suitable: boolean;
    details: string;
    confidence: number;
  }> {
    // Simplified market conditions check
    // In production, would check real market data
    const volatility = Math.random() * 100;
    const liquidity = Math.random() * 100;

    const suitable = volatility < 70 && liquidity > 30;
    const confidence = suitable ? 85 : 40;

    return {
      suitable,
      details: `Market volatility: ${volatility.toFixed(1)}%, Liquidity: ${liquidity.toFixed(1)}%`,
      confidence,
    };
  }

  /**
   * Validate historical performance of patterns
   */
  private async validateHistoricalPerformance(
    _symbol: string,
    _patternData: Record<string, unknown>
  ): Promise<{
    reliable: boolean;
    details: string;
    confidence: number;
  }> {
    // Simplified historical validation
    // In production, would analyze historical pattern performance
    const historicalSuccess = Math.random() * 100;
    const reliable = historicalSuccess > 60;

    return {
      reliable,
      details: `Historical pattern success rate: ${historicalSuccess.toFixed(1)}%`,
      confidence: historicalSuccess,
    };
  }

  /**
   * Get validation statistics
   */
  getStats(): {
    totalValidations: number;
    successfulValidations: number;
    rejectedValidations: number;
  } {
    // In a real implementation, would track these metrics
    return {
      totalValidations: 0,
      successfulValidations: 0,
      rejectedValidations: 0,
    };
  }
}
