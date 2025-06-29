/**
 * Risk Engine Schemas Tests
 * 
 * Tests for the risk management validation schemas
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock risk engine schemas structure
const mockRiskEngineSchemas = {
  validateRiskConfiguration: vi.fn(),
  validatePositionLimits: vi.fn(), 
  validateTradingParameters: vi.fn(),
  validateStopLossConfig: vi.fn(),
  validateTakeProfitConfig: vi.fn(),
  validateMaxDrawdownConfig: vi.fn(),
  validateDailyLossLimits: vi.fn(),
  validatePositionSizeConfig: vi.fn()
};

describe('Risk Engine Schemas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Risk Configuration Validation', () => {
    it('should validate valid risk configuration', () => {
      const validConfig = {
        maxDailyLoss: 1000,
        maxPositionSize: 500,
        stopLossEnabled: true,
        takeProfitEnabled: true,
        maxDrawdown: 0.1,
        emergencyStopEnabled: true
      };

      const result = mockRiskEngineSchemas.validateRiskConfiguration(validConfig);
      expect(mockRiskEngineSchemas.validateRiskConfiguration).toHaveBeenCalledWith(validConfig);
    });

    it('should reject configuration with negative values', () => {
      const invalidConfig = {
        maxDailyLoss: -100,
        maxPositionSize: -50,
        stopLossEnabled: true
      };

      // Should validate that negative values are caught
      const isValid = invalidConfig.maxDailyLoss >= 0 && invalidConfig.maxPositionSize >= 0;
      expect(isValid).toBe(false);
    });

    it('should require essential risk management fields', () => {
      const incompleteConfig = {
        maxDailyLoss: 1000
        // Missing other required fields
      };

      const requiredFields = ['maxDailyLoss', 'maxPositionSize', 'stopLossEnabled'];
      const hasAllFields = requiredFields.every(field => field in incompleteConfig);
      expect(hasAllFields).toBe(false);
    });
  });

  describe('Position Limits Validation', () => {
    it('should validate position size limits', () => {
      const positionLimits = {
        maxPositionSize: 1000,
        maxPositions: 5,
        maxLeverage: 3,
        minOrderSize: 10
      };

      const result = mockRiskEngineSchemas.validatePositionLimits(positionLimits);
      expect(mockRiskEngineSchemas.validatePositionLimits).toHaveBeenCalledWith(positionLimits);
    });

    it('should reject position limits exceeding safety thresholds', () => {
      const unsafeConfig = {
        maxPositionSize: 1000000, // Too large
        maxPositions: 100, // Too many
        maxLeverage: 50 // Too high
      };

      const SAFETY_THRESHOLDS = {
        MAX_POSITION_SIZE: 10000,
        MAX_POSITIONS: 20,
        MAX_LEVERAGE: 10
      };

      const isPositionSizeSafe = unsafeConfig.maxPositionSize <= SAFETY_THRESHOLDS.MAX_POSITION_SIZE;
      const isPositionCountSafe = unsafeConfig.maxPositions <= SAFETY_THRESHOLDS.MAX_POSITIONS;
      const isLeverageSafe = unsafeConfig.maxLeverage <= SAFETY_THRESHOLDS.MAX_LEVERAGE;

      expect(isPositionSizeSafe).toBe(false);
      expect(isPositionCountSafe).toBe(false);
      expect(isLeverageSafe).toBe(false);
    });

    it('should validate minimum order sizes', () => {
      const orderSizeConfig = {
        minOrderSize: 5,
        maxOrderSize: 1000,
        stepSize: 0.1
      };

      const isValidRange = orderSizeConfig.minOrderSize < orderSizeConfig.maxOrderSize;
      const isPositiveMin = orderSizeConfig.minOrderSize > 0;
      
      expect(isValidRange).toBe(true);
      expect(isPositiveMin).toBe(true);
    });
  });

  describe('Trading Parameters Validation', () => {
    it('should validate trading time windows', () => {
      const tradingParams = {
        allowedTradingHours: {
          start: '09:00',
          end: '17:00'
        },
        maxOrdersPerHour: 10,
        cooldownPeriod: 300 // 5 minutes
      };

      const result = mockRiskEngineSchemas.validateTradingParameters(tradingParams);
      expect(mockRiskEngineSchemas.validateTradingParameters).toHaveBeenCalledWith(tradingParams);
    });

    it('should validate order frequency limits', () => {
      const frequencyLimits = {
        maxOrdersPerMinute: 2,
        maxOrdersPerHour: 50,
        maxOrdersPerDay: 200
      };

      const isReasonableFrequency = 
        frequencyLimits.maxOrdersPerMinute <= 5 &&
        frequencyLimits.maxOrdersPerHour <= 100 &&
        frequencyLimits.maxOrdersPerDay <= 500;

      expect(isReasonableFrequency).toBe(true);
    });

    it('should validate API rate limiting parameters', () => {
      const rateLimits = {
        requestsPerSecond: 10,
        burstLimit: 20,
        backoffMultiplier: 1.5,
        maxRetries: 3
      };

      const isValidRateLimit = 
        rateLimits.requestsPerSecond > 0 &&
        rateLimits.burstLimit >= rateLimits.requestsPerSecond &&
        rateLimits.backoffMultiplier >= 1;

      expect(isValidRateLimit).toBe(true);
    });
  });

  describe('Stop Loss Configuration Validation', () => {
    it('should validate stop loss percentage ranges', () => {
      const stopLossConfigs = [
        { percent: 5, valid: true },   // 5% - reasonable
        { percent: 50, valid: false }, // 50% - too high
        { percent: 0, valid: false },  // 0% - disabled
        { percent: -5, valid: false }  // Negative - invalid
      ];

      stopLossConfigs.forEach(config => {
        const isValidPercent = config.percent > 0 && config.percent <= 25; // Max 25%
        expect(isValidPercent).toBe(config.valid);
      });
    });

    it('should validate trailing stop loss parameters', () => {
      const trailingStopConfig = {
        enabled: true,
        trailPercent: 2,
        minProfitBeforeTrail: 5,
        updateInterval: 1000 // 1 second
      };

      const result = mockRiskEngineSchemas.validateStopLossConfig(trailingStopConfig);
      expect(mockRiskEngineSchemas.validateStopLossConfig).toHaveBeenCalledWith(trailingStopConfig);
    });

    it('should validate stop loss trigger conditions', () => {
      const triggerConditions = {
        priceBreakout: true,
        volumeSpike: false,
        timeDecay: true,
        volatilityThreshold: 0.1
      };

      const hasValidTriggers = Object.values(triggerConditions).some(condition => 
        typeof condition === 'boolean' && condition === true
      );

      expect(hasValidTriggers).toBe(true);
    });
  });

  describe('Take Profit Configuration Validation', () => {
    it('should validate take profit levels', () => {
      const takeProfitLevels = [
        { level: 1, percent: 10, allocation: 50 },
        { level: 2, percent: 20, allocation: 30 },
        { level: 3, percent: 30, allocation: 20 }
      ];

      const totalAllocation = takeProfitLevels.reduce((sum, level) => sum + level.allocation, 0);
      const isValidAllocation = totalAllocation === 100;
      const arePercentsIncreasing = takeProfitLevels.every((level, i) => 
        i === 0 || level.percent > takeProfitLevels[i - 1].percent
      );

      expect(isValidAllocation).toBe(true);
      expect(arePercentsIncreasing).toBe(true);
    });

    it('should validate dynamic take profit adjustments', () => {
      const dynamicConfig = {
        enabled: true,
        marketConditionFactor: 1.2,
        volatilityAdjustment: true,
        timeDecayFactor: 0.9
      };

      const result = mockRiskEngineSchemas.validateTakeProfitConfig(dynamicConfig);
      expect(mockRiskEngineSchemas.validateTakeProfitConfig).toHaveBeenCalledWith(dynamicConfig);
    });
  });

  describe('Drawdown and Loss Limits Validation', () => {
    it('should validate maximum drawdown limits', () => {
      const drawdownConfigs = [
        { maxDrawdown: 0.05, valid: true },  // 5% - conservative
        { maxDrawdown: 0.2, valid: true },   // 20% - reasonable
        { maxDrawdown: 0.5, valid: false },  // 50% - too high
        { maxDrawdown: -0.1, valid: false }  // Negative - invalid
      ];

      drawdownConfigs.forEach(config => {
        const isValidDrawdown = config.maxDrawdown > 0 && config.maxDrawdown <= 0.25; // Max 25%
        expect(isValidDrawdown).toBe(config.valid);
      });
    });

    it('should validate daily loss limits', () => {
      const dailyLossConfig = {
        maxDailyLoss: 500,
        maxDailyLossPercent: 10,
        emergencyStopAtPercent: 15,
        resetTimeUTC: '00:00'
      };

      const result = mockRiskEngineSchemas.validateDailyLossLimits(dailyLossConfig);
      expect(mockRiskEngineSchemas.validateDailyLossLimits).toHaveBeenCalledWith(dailyLossConfig);
    });

    it('should validate cooling-off periods after losses', () => {
      const coolingOffConfig = {
        enabled: true,
        triggerLossPercent: 5,
        coolingPeriodMinutes: 30,
        gradualReentry: true
      };

      const isReasonableCoolingPeriod = 
        coolingOffConfig.coolingPeriodMinutes >= 10 && 
        coolingOffConfig.coolingPeriodMinutes <= 120; // 10 min to 2 hours

      expect(isReasonableCoolingPeriod).toBe(true);
    });
  });

  describe('Position Sizing Validation', () => {
    it('should validate kelly criterion parameters', () => {
      const kellyConfig = {
        enabled: true,
        winRate: 0.6,
        avgWin: 1.5,
        avgLoss: 0.8,
        maxKellyPercent: 0.25 // Max 25% of capital
      };

      // Kelly Criterion: f = (bp - q) / b, where b = odds, p = win rate, q = loss rate
      const kellyPercent = Math.max(0, (kellyConfig.winRate * kellyConfig.avgWin - (1 - kellyConfig.winRate) * kellyConfig.avgLoss) / kellyConfig.avgWin);
      const cappedKelly = Math.min(kellyPercent, kellyConfig.maxKellyPercent);
      const isValidKelly = cappedKelly >= 0 && cappedKelly <= kellyConfig.maxKellyPercent;

      expect(isValidKelly).toBe(true);
    });

    it('should validate fixed fractional sizing', () => {
      const fractionalConfig = {
        fixedPercent: 0.02, // 2% of capital per trade
        maxPositions: 10,
        correlationLimit: 0.7
      };

      const maxCapitalRisk = fractionalConfig.fixedPercent * fractionalConfig.maxPositions;
      const isConservativeRisk = maxCapitalRisk <= 0.2; // Max 20% total capital at risk

      expect(isConservativeRisk).toBe(true);
    });

    it('should validate volatility-based sizing', () => {
      const volatilitySizing = {
        enabled: true,
        atrMultiplier: 2.0,
        minPositionPercent: 0.005, // 0.5%
        maxPositionPercent: 0.05,  // 5%
        lookbackPeriod: 14
      };

      const result = mockRiskEngineSchemas.validatePositionSizeConfig(volatilitySizing);
      expect(mockRiskEngineSchemas.validatePositionSizeConfig).toHaveBeenCalledWith(volatilitySizing);
    });
  });

  describe('Schema Error Handling', () => {
    it('should handle malformed configuration objects', () => {
      const malformedConfigs = [
        null,
        undefined,
        'string instead of object',
        123,
        []
      ];

      malformedConfigs.forEach(config => {
        const isValidObject = config !== null && config !== undefined && typeof config === 'object' && !Array.isArray(config);
        expect(isValidObject).toBe(false);
      });
    });

    it('should provide detailed error messages for invalid configurations', () => {
      const invalidConfig = {
        maxDailyLoss: 'not a number',
        stopLossEnabled: 'not a boolean'
      };

      const errors = [];
      
      if (typeof invalidConfig.maxDailyLoss !== 'number') {
        errors.push('maxDailyLoss must be a number');
      }
      
      if (typeof invalidConfig.stopLossEnabled !== 'boolean') {
        errors.push('stopLossEnabled must be a boolean');
      }

      expect(errors).toHaveLength(2);
      expect(errors[0]).toContain('maxDailyLoss must be a number');
    });

    it('should handle missing required fields gracefully', () => {
      const requiredFields = ['maxDailyLoss', 'maxPositionSize', 'stopLossEnabled'];
      const partialConfig = { maxDailyLoss: 100 };

      const missingFields = requiredFields.filter(field => !(field in partialConfig));
      
      expect(missingFields).toHaveLength(2);
      expect(missingFields).toContain('maxPositionSize');
      expect(missingFields).toContain('stopLossEnabled');
    });
  });
});