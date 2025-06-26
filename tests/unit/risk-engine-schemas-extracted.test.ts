/**
 * Test Suite for Extracted Risk Engine Schemas
 * 
 * Following TDD approach: writing tests before extracting risk-related
 * types and interfaces from advanced-risk-engine.ts
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  MarketConditionsSchema,
  PositionRiskProfileSchema,
  PortfolioRiskMetricsSchema,
  RiskEngineConfigSchema,
  RiskAlertSchema,
  StressTestScenarioSchema,
} from '@/src/schemas/risk-engine-schemas-extracted';

describe('Risk Engine Schemas - TDD Extraction Tests', () => {
  describe('MarketConditionsSchema', () => {
    it('should validate valid market conditions', () => {
      const validConditions = {
        volatilityIndex: 65.5,
        liquidityIndex: 85.2,
        orderBookDepth: 500000,
        bidAskSpread: 0.05,
        tradingVolume24h: 2500000,
        priceChange24h: 2.5,
        correlationRisk: 0.35,
        marketSentiment: 'bullish' as const,
        timestamp: new Date().toISOString()
      };

      expect(() => {
        MarketConditionsSchema.parse(validConditions);
      }).not.toThrow();
    });

    it('should validate market conditions with different sentiment', () => {
      const volatileConditions = {
        volatilityIndex: 95,
        liquidityIndex: 45,
        orderBookDepth: 50000,
        bidAskSpread: 0.8,
        tradingVolume24h: 800000,
        priceChange24h: -15.3,
        correlationRisk: 0.75,
        marketSentiment: 'volatile' as const,
        timestamp: new Date().toISOString()
      };

      expect(() => {
        MarketConditionsSchema.parse(volatileConditions);
      }).not.toThrow();
    });

    it('should reject invalid market conditions with out-of-range values', () => {
      const invalidConditions = {
        volatilityIndex: 150, // invalid > 100
        liquidityIndex: -10, // invalid negative
        orderBookDepth: -5000, // invalid negative
        bidAskSpread: 0.05,
        tradingVolume24h: 2500000,
        priceChange24h: 2.5,
        correlationRisk: 1.5, // invalid > 1
        marketSentiment: 'unknown', // invalid enum
        timestamp: 'invalid-date'
      };

      expect(() => {
        MarketConditionsSchema.parse(invalidConditions);
      }).toThrow();
    });
  });

  describe('PositionRiskProfileSchema', () => {
    it('should validate valid position risk profile', () => {
      const validProfile = {
        symbol: 'BTCUSDT',
        size: 1000,
        exposure: 15.5,
        leverage: 2.0,
        unrealizedPnL: 50.25,
        valueAtRisk: 75.50,
        maxDrawdown: 25.75,
        timeHeld: 12.5,
        stopLossDistance: 5.0,
        takeProfitDistance: 15.0,
        correlationScore: 0.45
      };

      expect(() => {
        PositionRiskProfileSchema.parse(validProfile);
      }).not.toThrow();
    });

    it('should validate position with negative PnL', () => {
      const lossProfile = {
        symbol: 'ETHUSDT',
        size: 500,
        exposure: 8.2,
        leverage: 1.5,
        unrealizedPnL: -125.75,
        valueAtRisk: 200.0,
        maxDrawdown: 35.5,
        timeHeld: 48.0,
        stopLossDistance: 10.0,
        takeProfitDistance: 20.0,
        correlationScore: 0.25
      };

      expect(() => {
        PositionRiskProfileSchema.parse(lossProfile);
      }).not.toThrow();
    });

    it('should reject invalid position risk profile', () => {
      const invalidProfile = {
        symbol: '', // invalid empty string
        size: -1000, // invalid negative
        exposure: 150, // invalid > 100
        leverage: 0, // invalid zero
        unrealizedPnL: 'not-a-number', // invalid type
        valueAtRisk: 75.50,
        maxDrawdown: 25.75,
        timeHeld: -5, // invalid negative
        stopLossDistance: 5.0,
        takeProfitDistance: 15.0,
        correlationScore: 1.5 // invalid > 1
      };

      expect(() => {
        PositionRiskProfileSchema.parse(invalidProfile);
      }).toThrow();
    });
  });

  describe('PortfolioRiskMetricsSchema', () => {
    it('should validate complete portfolio risk metrics', () => {
      const validMetrics = {
        totalValue: 50000,
        totalExposure: 35000,
        diversificationScore: 75,
        concentrationRisk: 35,
        correlationMatrix: [[1, 0.5, 0.3], [0.5, 1, 0.2], [0.3, 0.2, 1]],
        valueAtRisk95: 2500,
        expectedShortfall: 3500,
        sharpeRatio: 1.25,
        maxDrawdownRisk: 15.5,
        liquidityRisk: 25.0
      };

      expect(() => {
        PortfolioRiskMetricsSchema.parse(validMetrics);
      }).not.toThrow();
    });

    it('should validate high-risk portfolio metrics', () => {
      const highRiskMetrics = {
        totalValue: 25000,
        totalExposure: 22000,
        diversificationScore: 25,
        concentrationRisk: 85,
        correlationMatrix: [[1, 0.9], [0.9, 1]],
        valueAtRisk95: 5000,
        expectedShortfall: 7500,
        sharpeRatio: 0.5,
        maxDrawdownRisk: 35.0,
        liquidityRisk: 65.0
      };

      expect(() => {
        PortfolioRiskMetricsSchema.parse(highRiskMetrics);
      }).not.toThrow();
    });

    it('should reject invalid portfolio metrics', () => {
      const invalidMetrics = {
        totalValue: -50000, // invalid negative
        totalExposure: 35000,
        diversificationScore: 150, // invalid > 100
        concentrationRisk: -10, // invalid negative
        correlationMatrix: 'not-an-array', // invalid type
        valueAtRisk95: 'invalid', // invalid type
        expectedShortfall: 3500,
        sharpeRatio: 1.25,
        maxDrawdownRisk: 15.5,
        liquidityRisk: 25.0
      };

      expect(() => {
        PortfolioRiskMetricsSchema.parse(invalidMetrics);
      }).toThrow();
    });
  });

  describe('RiskEngineConfigSchema', () => {
    it('should validate complete risk engine configuration', () => {
      const validConfig = {
        maxPortfolioValue: 100000,
        maxSinglePositionSize: 10000,
        maxConcurrentPositions: 10,
        maxDailyLoss: 5000,
        maxDrawdown: 20.0,
        confidenceLevel: 0.95,
        lookbackPeriod: 30,
        correlationThreshold: 0.7,
        volatilityMultiplier: 1.5,
        adaptiveRiskScaling: true,
        marketRegimeDetection: true,
        stressTestingEnabled: true,
        emergencyVolatilityThreshold: 80.0,
        emergencyLiquidityThreshold: 20.0,
        emergencyCorrelationThreshold: 0.9
      };

      expect(() => {
        RiskEngineConfigSchema.parse(validConfig);
      }).not.toThrow();
    });

    it('should validate minimal risk engine configuration', () => {
      const minimalConfig = {
        maxPortfolioValue: 50000,
        maxSinglePositionSize: 5000,
        maxConcurrentPositions: 5,
        maxDailyLoss: 2500,
        maxDrawdown: 15.0,
        confidenceLevel: 0.99,
        lookbackPeriod: 14,
        correlationThreshold: 0.5,
        volatilityMultiplier: 1.0,
        adaptiveRiskScaling: false,
        marketRegimeDetection: false,
        stressTestingEnabled: false,
        emergencyVolatilityThreshold: 90.0,
        emergencyLiquidityThreshold: 10.0,
        emergencyCorrelationThreshold: 0.95
      };

      expect(() => {
        RiskEngineConfigSchema.parse(minimalConfig);
      }).not.toThrow();
    });

    it('should reject invalid risk engine configuration', () => {
      const invalidConfig = {
        maxPortfolioValue: -100000, // invalid negative
        maxSinglePositionSize: 0, // invalid zero
        maxConcurrentPositions: -5, // invalid negative
        maxDailyLoss: 'unlimited', // invalid type
        maxDrawdown: 150.0, // invalid > 100
        confidenceLevel: 1.5, // invalid > 1
        lookbackPeriod: 0, // invalid zero
        correlationThreshold: -0.5, // invalid negative
        volatilityMultiplier: -1.0, // invalid negative
        adaptiveRiskScaling: 'yes', // invalid type
        marketRegimeDetection: true,
        stressTestingEnabled: true,
        emergencyVolatilityThreshold: 80.0,
        emergencyLiquidityThreshold: 20.0,
        emergencyCorrelationThreshold: 0.9
      };

      expect(() => {
        RiskEngineConfigSchema.parse(invalidConfig);
      }).toThrow();
    });
  });

  describe('RiskAlertSchema', () => {
    it('should validate valid risk alert', () => {
      const validAlert = {
        id: 'alert-risk-001',
        type: 'portfolio' as const,
        severity: 'high' as const,
        message: 'Portfolio risk threshold exceeded',
        details: {
          riskScore: 85,
          threshold: 80,
          portfolioValue: 75000,
          exposure: 65000
        },
        recommendations: [
          'Reduce position sizes',
          'Increase diversification',
          'Consider hedging strategies'
        ],
        timestamp: new Date().toISOString(),
        resolved: false
      };

      expect(() => {
        RiskAlertSchema.parse(validAlert);
      }).not.toThrow();
    });

    it('should validate resolved risk alert', () => {
      const resolvedAlert = {
        id: 'alert-risk-002',
        type: 'position' as const,
        severity: 'medium' as const,
        message: 'Position correlation risk detected',
        details: {
          symbol: 'BTCUSDT',
          correlationScore: 0.85,
          threshold: 0.7
        },
        recommendations: ['Reduce correlated positions'],
        timestamp: new Date().toISOString(),
        resolved: true,
        resolvedAt: new Date().toISOString()
      };

      expect(() => {
        RiskAlertSchema.parse(resolvedAlert);
      }).not.toThrow();
    });

    it('should reject invalid risk alert', () => {
      const invalidAlert = {
        id: 123, // invalid type
        type: 'unknown', // invalid enum
        severity: 'extreme', // invalid enum
        message: '', // invalid empty
        details: 'not-an-object', // invalid type
        recommendations: 'single-string', // should be array
        timestamp: 'invalid-date',
        resolved: 'yes', // invalid type
        resolvedAt: 12345 // invalid type
      };

      expect(() => {
        RiskAlertSchema.parse(invalidAlert);
      }).toThrow();
    });
  });

  describe('StressTestScenarioSchema', () => {
    it('should validate complete stress test scenario', () => {
      const validScenario = {
        name: 'Market Crash Scenario',
        description: 'Simulates a 30% market decline with increased volatility',
        marketShock: {
          priceChange: -30.0,
          volatilityIncrease: 3.0,
          liquidityReduction: 50.0
        },
        expectedLoss: 15000,
        recoveryTime: 72
      };

      expect(() => {
        StressTestScenarioSchema.parse(validScenario);
      }).not.toThrow();
    });

    it('should validate positive scenario', () => {
      const bullScenario = {
        name: 'Bull Market Rally',
        description: 'Simulates a 50% market rally with increased trading volume',
        marketShock: {
          priceChange: 50.0,
          volatilityIncrease: 1.5,
          liquidityReduction: -25.0 // increased liquidity
        },
        expectedLoss: -10000, // negative loss = profit
        recoveryTime: 24
      };

      expect(() => {
        StressTestScenarioSchema.parse(bullScenario);
      }).not.toThrow();
    });

    it('should reject invalid stress test scenario', () => {
      const invalidScenario = {
        name: '', // invalid empty
        description: 123, // invalid type
        marketShock: {
          priceChange: 'huge', // invalid type
          volatilityIncrease: -1.0, // invalid negative
          liquidityReduction: 150.0 // invalid > 100
        },
        expectedLoss: 'unknown', // invalid type
        recoveryTime: -5 // invalid negative
      };

      expect(() => {
        StressTestScenarioSchema.parse(invalidScenario);
      }).toThrow();
    });
  });

  describe('Schema Integration Tests', () => {
    it('should validate complete risk engine workflow data', () => {
      const workflowData = {
        config: {
          maxPortfolioValue: 100000,
          maxSinglePositionSize: 10000,
          maxConcurrentPositions: 8,
          maxDailyLoss: 5000,
          maxDrawdown: 20.0,
          confidenceLevel: 0.95,
          lookbackPeriod: 30,
          correlationThreshold: 0.7,
          volatilityMultiplier: 1.5,
          adaptiveRiskScaling: true,
          marketRegimeDetection: true,
          stressTestingEnabled: true,
          emergencyVolatilityThreshold: 80.0,
          emergencyLiquidityThreshold: 20.0,
          emergencyCorrelationThreshold: 0.9
        },
        marketConditions: {
          volatilityIndex: 65,
          liquidityIndex: 75,
          orderBookDepth: 250000,
          bidAskSpread: 0.08,
          tradingVolume24h: 1500000,
          priceChange24h: 5.2,
          correlationRisk: 0.45,
          marketSentiment: 'bullish' as const,
          timestamp: new Date().toISOString()
        },
        portfolioMetrics: {
          totalValue: 85000,
          totalExposure: 65000,
          diversificationScore: 70,
          concentrationRisk: 40,
          correlationMatrix: [[1, 0.6, 0.3], [0.6, 1, 0.4], [0.3, 0.4, 1]],
          valueAtRisk95: 4250,
          expectedShortfall: 6375,
          sharpeRatio: 1.15,
          maxDrawdownRisk: 18.5,
          liquidityRisk: 30.0
        }
      };

      expect(() => {
        RiskEngineConfigSchema.parse(workflowData.config);
        MarketConditionsSchema.parse(workflowData.marketConditions);
        PortfolioRiskMetricsSchema.parse(workflowData.portfolioMetrics);
      }).not.toThrow();
    });
  });
});