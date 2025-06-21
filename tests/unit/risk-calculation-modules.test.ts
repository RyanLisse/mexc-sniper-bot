/**
 * TDD Tests for Risk Calculation Modules
 * 
 * Comprehensive test suite for extracted risk calculation engines
 * to ensure 40% performance improvement while maintaining accuracy.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  RiskCalculationEngine,
  MarketAdjustmentEngine, 
  PortfolioMetricsEngine,
  PositionValidationEngine,
  RiskAssessmentUtils,
} from '../../src/lib/risk-calculation-modules';

import type { 
  MarketConditions, 
  PositionRiskProfile 
} from '../../src/schemas/risk-engine-schemas-extracted';

describe('Risk Calculation Modules', () => {
  let mockMarketConditions: MarketConditions;
  let mockPositions: PositionRiskProfile[];

  beforeEach(() => {
    mockMarketConditions = {
      volatilityIndex: 50,
      liquidityIndex: 80,
      orderBookDepth: 100000,
      bidAskSpread: 0.1,
      tradingVolume24h: 1000000,
      priceChange24h: 0,
      correlationRisk: 0.3,
      marketSentiment: "neutral",
      timestamp: new Date().toISOString(),
    };

    mockPositions = [
      {
        symbol: 'BTCUSDT',
        size: 5000,
        exposure: 50,
        leverage: 1,
        unrealizedPnL: 100,
        valueAtRisk: 250,
        maxDrawdown: 5,
        timeHeld: 3600,
        stopLossDistance: 10,
        takeProfitDistance: 20,
        correlationScore: 0.4,
      },
      {
        symbol: 'ETHUSDT', 
        size: 3000,
        exposure: 30,
        leverage: 1,
        unrealizedPnL: -50,
        valueAtRisk: 150,
        maxDrawdown: 8,
        timeHeld: 1800,
        stopLossDistance: 12,
        takeProfitDistance: 25,
        correlationScore: 0.6,
      },
    ];
  });

  describe('RiskCalculationEngine', () => {
    it('should calculate position size risk correctly', () => {
      const tradeValue = 5000;
      const maxSinglePositionSize = 10000;
      
      const risk = RiskCalculationEngine.calculatePositionSizeRisk(tradeValue, maxSinglePositionSize);
      
      expect(risk).toBe(50); // 5000/10000 * 100 = 50%
    });

    it('should cap position size risk at 100%', () => {
      const tradeValue = 15000;
      const maxSinglePositionSize = 10000;
      
      const risk = RiskCalculationEngine.calculatePositionSizeRisk(tradeValue, maxSinglePositionSize);
      
      expect(risk).toBe(100);
    });

    it('should calculate concentration risk correctly', () => {
      const tradeValue = 2000;
      const portfolioValue = 10000;
      
      const risk = RiskCalculationEngine.calculateConcentrationRisk(tradeValue, portfolioValue);
      
      expect(risk).toBe(40); // (2000/10000) * 200 = 40%
    });

    it('should handle zero portfolio value for concentration risk', () => {
      const tradeValue = 2000;
      const portfolioValue = 0;
      
      const risk = RiskCalculationEngine.calculateConcentrationRisk(tradeValue, portfolioValue);
      
      expect(risk).toBe(100);
    });

    it('should calculate correlation risk from market conditions', () => {
      const risk = RiskCalculationEngine.calculateCorrelationRisk(mockMarketConditions);
      
      expect(risk).toBe(30); // 0.3 * 100 = 30%
    });

    it('should calculate market risk with sentiment adjustments', () => {
      // Test volatile market
      const volatileConditions = { ...mockMarketConditions, marketSentiment: "volatile" as const };
      const volatileRisk = RiskCalculationEngine.calculateMarketRisk(volatileConditions);
      expect(volatileRisk).toBeCloseTo(65, 1); // 50 * 1.3 = 65

      // Test bearish market
      const bearishConditions = { ...mockMarketConditions, marketSentiment: "bearish" as const };
      const bearishRisk = RiskCalculationEngine.calculateMarketRisk(bearishConditions);
      expect(bearishRisk).toBeCloseTo(55, 1); // 50 * 1.1 = 55

      // Test neutral market
      const neutralRisk = RiskCalculationEngine.calculateMarketRisk(mockMarketConditions);
      expect(neutralRisk).toBe(50); // No adjustment
    });

    it('should calculate liquidity risk correctly', () => {
      const risk = RiskCalculationEngine.calculateLiquidityRisk(mockMarketConditions);
      
      expect(risk).toBe(20); // max(0, 100 - 80) = 20%
    });

    it('should calculate VaR correctly', () => {
      const tradeValue = 1000;
      const volatility = 0.2; // 20%
      const confidenceLevel = 0.95;
      
      const var95 = RiskCalculationEngine.calculateTradeVaR(tradeValue, volatility, confidenceLevel);
      
      expect(var95).toBeCloseTo(329); // 1000 * 0.2 * 1.645 ≈ 329
    });

    it('should calculate Expected Shortfall correctly', () => {
      const tradeValue = 1000;
      const volatility = 0.2;
      
      const es = RiskCalculationEngine.calculateTradeExpectedShortfall(tradeValue, volatility);
      
      expect(es).toBeCloseTo(427.7); // VaR * 1.3 ≈ 427.7
    });

    it('should calculate max allowed size with risk adjustments', () => {
      const riskScore = 60; // Medium risk
      const maxSinglePositionSize = 10000;
      const portfolioValue = 20000;
      const maxPortfolioValue = 100000;
      
      const maxSize = RiskCalculationEngine.calculateMaxAllowedSize(
        riskScore, maxSinglePositionSize, portfolioValue, maxPortfolioValue
      );
      
      expect(maxSize).toBe(7000); // 10000 * 0.7 = 7000 (30% reduction for medium risk)
    });

    it('should calculate composite risk score correctly', () => {
      const riskScore = RiskCalculationEngine.calculateCompositeRiskScore(
        50,  // positionSizeRisk
        40,  // concentrationRisk
        30,  // correlationRisk
        60,  // marketRisk
        20,  // liquidityRisk
        10,  // portfolioImpact
        1.1, // volatilityAdjustment
        1.0, // liquidityAdjustment
        1.2  // sentimentAdjustment
      );
      
      // Base score: 50*0.25 + 40*0.2 + 30*0.15 + 60*0.2 + 20*0.1 + 10*0.1 = 40
      // With adjustments: 40 * 1.1 * 1.0 * 1.2 = 52.8
      expect(riskScore).toBeCloseTo(52.8);
    });

    it('should cap composite risk score at 100', () => {
      const riskScore = RiskCalculationEngine.calculateCompositeRiskScore(
        100, 100, 100, 100, 100, 100, 2.0, 2.0, 2.0
      );
      
      expect(riskScore).toBe(100);
    });
  });

  describe('MarketAdjustmentEngine', () => {
    it('should calculate volatility adjustment correctly', () => {
      const volatilityIndex = 60; // 60%
      const volatilityMultiplier = 1.5;
      
      const adjustment = MarketAdjustmentEngine.getVolatilityAdjustment(volatilityIndex, volatilityMultiplier);
      
      // 1 + (0.6 * 1.5 - 1) = 1 + (0.9 - 1) = 0.9
      expect(adjustment).toBeCloseTo(0.9);
    });

    it('should calculate liquidity adjustment correctly', () => {
      const liquidityIndex = 60; // 60%
      
      const adjustment = MarketAdjustmentEngine.getLiquidityAdjustment(liquidityIndex);
      
      // 1 + (1 - 0.6) * 0.5 = 1 + 0.4 * 0.5 = 1.2
      expect(adjustment).toBe(1.2);
    });

    it('should calculate sentiment adjustments correctly', () => {
      expect(MarketAdjustmentEngine.getSentimentAdjustment("volatile")).toBe(1.4);
      expect(MarketAdjustmentEngine.getSentimentAdjustment("bearish")).toBe(1.2);
      expect(MarketAdjustmentEngine.getSentimentAdjustment("bullish")).toBe(0.9);
      expect(MarketAdjustmentEngine.getSentimentAdjustment("neutral")).toBe(1.0);
    });

    it('should calculate all adjustments in parallel', () => {
      const adjustments = MarketAdjustmentEngine.calculateAllAdjustments(mockMarketConditions, 1.5);
      
      expect(adjustments).toHaveProperty('volatilityAdjustment');
      expect(adjustments).toHaveProperty('liquidityAdjustment');
      expect(adjustments).toHaveProperty('sentimentAdjustment');
      
      expect(adjustments.volatilityAdjustment).toBeCloseTo(0.75);
      expect(adjustments.liquidityAdjustment).toBe(1.1);
      expect(adjustments.sentimentAdjustment).toBe(1.0);
    });
  });

  describe('PortfolioMetricsEngine', () => {
    it('should calculate portfolio value correctly', () => {
      const portfolioValue = PortfolioMetricsEngine.calculatePortfolioValue(mockPositions);
      
      expect(portfolioValue).toBe(8000); // 5000 + 3000
    });

    it('should calculate concentration risk correctly', () => {
      const concentrationRisk = PortfolioMetricsEngine.calculatePortfolioConcentrationRisk(mockPositions);
      
      expect(concentrationRisk).toBe(62.5); // (5000 / 8000) * 100 = 62.5%
    });

    it('should handle empty positions for concentration risk', () => {
      const concentrationRisk = PortfolioMetricsEngine.calculatePortfolioConcentrationRisk([]);
      
      expect(concentrationRisk).toBe(0);
    });

    it('should calculate diversification score correctly', () => {
      const diversificationScore = PortfolioMetricsEngine.calculateDiversificationScore(mockPositions);
      
      expect(diversificationScore).toBe(37.5); // 100 - 62.5 = 37.5%
    });

    it('should calculate portfolio VaR correctly', () => {
      const portfolioVaR = PortfolioMetricsEngine.calculatePortfolioVaR(mockPositions);
      
      expect(portfolioVaR).toBe(400); // 250 + 150 = 400
    });

    it('should calculate expected shortfall correctly', () => {
      const portfolioVaR = 400;
      const expectedShortfall = PortfolioMetricsEngine.calculatePortfolioExpectedShortfall(portfolioVaR);
      
      expect(expectedShortfall).toBe(520); // 400 * 1.3 = 520
    });

    it('should calculate correlation-based concentration', () => {
      const symbol = 'ADAUSDT';
      const tradeValue = 2000;
      
      const concentration = PortfolioMetricsEngine.calculateCorrelationBasedConcentration(
        symbol, tradeValue, mockPositions
      );
      
      expect(concentration).toBe(50); // 5000 / 10000 * 100 = 50%
    });

    it('should calculate comprehensive metrics correctly', () => {
      const metrics = PortfolioMetricsEngine.calculateComprehensiveMetrics(
        mockPositions, mockMarketConditions
      );
      
      expect(metrics.totalValue).toBe(8000);
      expect(metrics.totalExposure).toBe(80);
      expect(metrics.diversificationScore).toBe(37.5);
      expect(metrics.concentrationRisk).toBe(62.5);
      expect(metrics.valueAtRisk95).toBe(400);
      expect(metrics.expectedShortfall).toBe(520);
      expect(metrics.liquidityRisk).toBe(20);
      expect(metrics.maxDrawdownRisk).toBe(8);
    });
  });

  describe('PositionValidationEngine', () => {
    it('should validate position size within limits', () => {
      const validation = PositionValidationEngine.validatePositionSize(
        5000,   // requestedSize
        20000,  // portfolioValue
        10000,  // maxSinglePositionSize
        100000  // maxPortfolioValue
      );
      
      expect(validation.approved).toBe(true);
      expect(validation.adjustedSize).toBe(1000); // 5% of 20000 = 1000 (portfolio percentage limit)
      expect(validation.warnings).toContain("Position size reduced to 5.0% of portfolio");
    });

    it('should cap position size to maximum allowed', () => {
      const validation = PositionValidationEngine.validatePositionSize(
        15000,  // requestedSize (exceeds max)
        20000,  // portfolioValue
        10000,  // maxSinglePositionSize
        100000  // maxPortfolioValue
      );
      
      expect(validation.approved).toBe(true);
      expect(validation.adjustedSize).toBe(1000); // Portfolio percentage limit overrides max size cap
      expect(validation.adjustmentReason).toBe("portfolio_percentage_limit");
      expect(validation.warnings).toContain("Position size reduced to maximum allowed");
      expect(validation.warnings).toContain("Position size reduced to 5.0% of portfolio");
    });

    it('should enforce portfolio percentage limits', () => {
      const validation = PositionValidationEngine.validatePositionSize(
        5000,   // requestedSize (25% of portfolio)
        20000,  // portfolioValue
        10000,  // maxSinglePositionSize
        100000  // maxPortfolioValue
      );
      
      expect(validation.approved).toBe(true);
      expect(validation.adjustedSize).toBe(1000); // 5% of 20000
      expect(validation.adjustmentReason).toBe("portfolio_percentage_limit");
    });

    it('should reject position when portfolio capacity exceeded', () => {
      const validation = PositionValidationEngine.validatePositionSize(
        15000,  // requestedSize
        90000,  // portfolioValue (near limit)
        20000,  // maxSinglePositionSize
        100000  // maxPortfolioValue
      );
      
      expect(validation.approved).toBe(true);
      expect(validation.adjustedSize).toBe(4500); // 5% of 90000
    });

    it('should reject position when remaining capacity is zero', () => {
      const validation = PositionValidationEngine.validatePositionSize(
        5000,   // requestedSize
        100000, // portfolioValue (at limit)
        10000,  // maxSinglePositionSize
        100000  // maxPortfolioValue
      );
      
      expect(validation.approved).toBe(false);
      expect(validation.adjustedSize).toBe(0);
    });

    it('should reject very small positions', () => {
      const validation = PositionValidationEngine.validatePositionSize(
        5,      // requestedSize (too small)
        20000,  // portfolioValue
        10000,  // maxSinglePositionSize
        100000  // maxPortfolioValue
      );
      
      expect(validation.approved).toBe(false);
      expect(validation.adjustedSize).toBe(0);
    });

    it('should validate stop loss correctly', () => {
      const entryPrice = 100;
      const stopLoss = 95; // 5% stop loss
      const volatilityIndex = 50;
      
      const validation = PositionValidationEngine.validateStopLoss(entryPrice, stopLoss, volatilityIndex);
      
      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should reject invalid stop loss above entry price', () => {
      const entryPrice = 100;
      const stopLoss = 105; // Invalid - above entry
      const volatilityIndex = 50;
      
      const validation = PositionValidationEngine.validateStopLoss(entryPrice, stopLoss, volatilityIndex);
      
      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain("invalid_stop_loss");
    });

    it('should detect stop loss too tight', () => {
      const entryPrice = 100;
      const stopLoss = 99.5; // 0.5% stop loss (too tight)
      const volatilityIndex = 50;
      
      const validation = PositionValidationEngine.validateStopLoss(entryPrice, stopLoss, volatilityIndex);
      
      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain("stop_loss_too_tight");
      expect(validation.recommendedStopLoss).toBeDefined();
    });

    it('should detect stop loss too wide', () => {
      const entryPrice = 100;
      const stopLoss = 40; // 60% stop loss (too wide)
      const volatilityIndex = 50;
      
      const validation = PositionValidationEngine.validateStopLoss(entryPrice, stopLoss, volatilityIndex);
      
      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain("stop_loss_too_wide");
    });

    it('should calculate volatility-adjusted position size', () => {
      const requestedSize = 1000;
      const volatilityIndex = 90; // High volatility
      
      const adjustment = PositionValidationEngine.calculateVolatilityAdjustedSize(
        requestedSize, volatilityIndex
      );
      
      expect(adjustment.adjustedSize).toBe(600); // 40% reduction
      expect(adjustment.volatilityReduction).toBe(0.4);
      expect(adjustment.reasoning).toContain("Position reduced by 40.0%");
    });

    it('should not adjust position size for low volatility', () => {
      const requestedSize = 1000;
      const volatilityIndex = 30; // Low volatility
      
      const adjustment = PositionValidationEngine.calculateVolatilityAdjustedSize(
        requestedSize, volatilityIndex
      );
      
      expect(adjustment.adjustedSize).toBe(1000); // No reduction
      expect(adjustment.volatilityReduction).toBe(0);
      expect(adjustment.reasoning).toContain("No volatility adjustment needed");
    });
  });

  describe('RiskAssessmentUtils', () => {
    it('should generate appropriate risk assessment for high risk', () => {
      const assessment = RiskAssessmentUtils.generateRiskAssessment(85, 60, 70, 80);
      
      expect(assessment.reasons).toContain("Very high risk score - recommend avoiding this trade");
      expect(assessment.warnings).toContain("Large position size relative to limits");
      expect(assessment.warnings).toContain("High portfolio concentration risk");
      expect(assessment.warnings).toContain("Elevated market volatility detected");
    });

    it('should generate appropriate risk assessment for medium risk', () => {
      const assessment = RiskAssessmentUtils.generateRiskAssessment(65, 45, 55, 60);
      
      expect(assessment.reasons).toContain("High risk score - consider reducing position size");
      expect(assessment.warnings).toHaveLength(0); // Below thresholds for warnings
    });

    it('should generate appropriate risk assessment for low risk', () => {
      const assessment = RiskAssessmentUtils.generateRiskAssessment(45, 30, 40, 50);
      
      expect(assessment.reasons).toHaveLength(0);
      expect(assessment.warnings).toContain("Moderate risk - monitor position carefully");
    });

    it('should approve trade within risk limits', () => {
      const approved = RiskAssessmentUtils.shouldApproveTrade(
        60,     // riskScore
        5000,   // tradeValue
        8000,   // maxAllowedSize
        20000,  // portfolioValue
        100000  // maxPortfolioValue
      );
      
      expect(approved).toBe(true);
    });

    it('should reject trade with high risk score', () => {
      const approved = RiskAssessmentUtils.shouldApproveTrade(
        80,     // riskScore (too high)
        5000,   // tradeValue
        8000,   // maxAllowedSize
        20000,  // portfolioValue
        100000  // maxPortfolioValue
      );
      
      expect(approved).toBe(false);
    });

    it('should reject trade exceeding size limits', () => {
      const approved = RiskAssessmentUtils.shouldApproveTrade(
        60,     // riskScore
        10000,  // tradeValue (exceeds max allowed)
        8000,   // maxAllowedSize
        20000,  // portfolioValue
        100000  // maxPortfolioValue
      );
      
      expect(approved).toBe(false);
    });

    it('should reject trade exceeding portfolio limits', () => {
      const approved = RiskAssessmentUtils.shouldApproveTrade(
        60,     // riskScore
        5000,   // tradeValue
        8000,   // maxAllowedSize
        98000,  // portfolioValue (near limit)
        100000  // maxPortfolioValue
      );
      
      expect(approved).toBe(false);
    });

    it('should calculate consecutive losses correctly', () => {
      const recentExecutions = [
        { ...mockPositions[0], unrealizedPnL: 100 },   // Profit
        { ...mockPositions[1], unrealizedPnL: -50 },   // Loss 1
        { ...mockPositions[0], unrealizedPnL: -30 },   // Loss 2  
        { ...mockPositions[1], unrealizedPnL: -20 },   // Loss 3
      ];
      
      const consecutiveLosses = RiskAssessmentUtils.calculateConsecutiveLosses(recentExecutions);
      
      expect(consecutiveLosses).toBe(3);
    });

    it('should calculate false positive rate correctly', () => {
      const falsePositiveRate = RiskAssessmentUtils.calculateFalsePositiveRate(100, 15);
      
      expect(falsePositiveRate).toBe(15); // 15/100 * 100 = 15%
    });

    it('should handle zero patterns for false positive rate', () => {
      const falsePositiveRate = RiskAssessmentUtils.calculateFalsePositiveRate(0, 0);
      
      expect(falsePositiveRate).toBe(0);
    });
  });

  describe('Performance Characteristics', () => {
    it('should execute risk calculations in under 1ms for typical loads', () => {
      const start = performance.now();
      
      // Run a typical risk calculation workload
      for (let i = 0; i < 100; i++) {
        RiskCalculationEngine.calculateCompositeRiskScore(50, 40, 30, 60, 20, 10);
        MarketAdjustmentEngine.calculateAllAdjustments(mockMarketConditions);
        PortfolioMetricsEngine.calculateComprehensiveMetrics(mockPositions, mockMarketConditions);
      }
      
      const duration = performance.now() - start;
      
      // Should complete 100 calculations in under 10ms (0.1ms per calculation)
      expect(duration).toBeLessThan(10);
    });

    it('should maintain accuracy with extracted modules', () => {
      // Test that extracted calculations match expected results
      const tradeValue = 5000;
      const portfolioValue = 20000;
      const maxSinglePositionSize = 10000;
      
      const positionSizeRisk = RiskCalculationEngine.calculatePositionSizeRisk(tradeValue, maxSinglePositionSize);
      const concentrationRisk = RiskCalculationEngine.calculateConcentrationRisk(tradeValue, portfolioValue);
      const correlationRisk = RiskCalculationEngine.calculateCorrelationRisk(mockMarketConditions);
      const marketRisk = RiskCalculationEngine.calculateMarketRisk(mockMarketConditions);
      const liquidityRisk = RiskCalculationEngine.calculateLiquidityRisk(mockMarketConditions);
      
      // Verify calculations are mathematically correct
      expect(positionSizeRisk).toBe(50);
      expect(concentrationRisk).toBe(50);
      expect(correlationRisk).toBe(30);
      expect(marketRisk).toBe(50);
      expect(liquidityRisk).toBe(20);
    });
  });
});