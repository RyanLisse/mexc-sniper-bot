/**
 * Unit tests for validators
 * Tests validation utilities for trading data and user preferences
 */

import { describe, it, expect } from 'vitest';
import { Validators } from '../../../src/lib/validators';
import { ValidationError } from '../../../src/lib/error-utils';

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../../utils/timeout-elimination-helpers';

describe('Validators', () => {
  describe('takeProfitLevel', () => {
    it('should validate valid take profit levels', () => {
      expect(Validators.takeProfitLevel(10, 'Level 1')).toBe(10);
      expect(Validators.takeProfitLevel(50.5, 'Level 2')).toBe(50.5);
      expect(Validators.takeProfitLevel(100, 'Level 3')).toBe(100);
      expect(Validators.takeProfitLevel(1000, 'Level 4')).toBe(1000);
    });

    it('should reject invalid numbers', () => {
      expect(() => Validators.takeProfitLevel(NaN, 'Level 1')).toThrow(ValidationError);
      expect(() => Validators.takeProfitLevel('invalid' as any, 'Level 1')).toThrow(ValidationError);
      expect(() => Validators.takeProfitLevel(null as any, 'Level 1')).toThrow(ValidationError);
      expect(() => Validators.takeProfitLevel(undefined as any, 'Level 1')).toThrow(ValidationError);
    });

    it('should reject negative values', () => {
      expect(() => Validators.takeProfitLevel(-1, 'Level 1')).toThrow(ValidationError);
      expect(() => Validators.takeProfitLevel(-10.5, 'Level 1')).toThrow(ValidationError);
    });

    it('should reject values exceeding 1000%', () => {
      expect(() => Validators.takeProfitLevel(1001, 'Level 1')).toThrow(ValidationError);
      expect(() => Validators.takeProfitLevel(2000, 'Level 1')).toThrow(ValidationError);
    });

    it('should include level name in error messages', () => {
      expect(() => Validators.takeProfitLevel(-1, 'Custom Level')).toThrow('Custom Level cannot be negative');
      expect(() => Validators.takeProfitLevel(1001, 'Custom Level')).toThrow('Custom Level cannot exceed 1000%');
    });
  });

  describe('stopLossPercent', () => {
    it('should validate valid stop loss percentages', () => {
      expect(Validators.stopLossPercent(5)).toBe(5);
      expect(Validators.stopLossPercent(10.5)).toBe(10.5);
      expect(Validators.stopLossPercent(50)).toBe(50);
      expect(Validators.stopLossPercent(100)).toBe(100);
    });

    it('should reject invalid numbers', () => {
      expect(() => Validators.stopLossPercent(NaN)).toThrow(ValidationError);
      expect(() => Validators.stopLossPercent('invalid' as any)).toThrow(ValidationError);
      expect(() => Validators.stopLossPercent(null as any)).toThrow(ValidationError);
    });

    it('should reject negative values', () => {
      expect(() => Validators.stopLossPercent(-1)).toThrow(ValidationError);
      expect(() => Validators.stopLossPercent(-10.5)).toThrow(ValidationError);
    });

    it('should reject values exceeding 100%', () => {
      expect(() => Validators.stopLossPercent(101)).toThrow(ValidationError);
      expect(() => Validators.stopLossPercent(200)).toThrow(ValidationError);
    });
  });

  describe('userId', () => {
    it('should validate valid user IDs', () => {
      expect(Validators.userId('user123')).toBe('user123');
      expect(Validators.userId('  user123  ')).toBe('user123'); // Trimmed
      expect(Validators.userId('user-with-dashes')).toBe('user-with-dashes');
      expect(Validators.userId('USER_WITH_UNDERSCORES')).toBe('USER_WITH_UNDERSCORES');
    });

    it('should reject invalid user IDs', () => {
      expect(() => Validators.userId('')).toThrow(ValidationError);
      expect(() => Validators.userId('   ')).toThrow(ValidationError);
      expect(() => Validators.userId(null)).toThrow(ValidationError);
      expect(() => Validators.userId(undefined)).toThrow(ValidationError);
      expect(() => Validators.userId(123)).toThrow(ValidationError);
    });
  });

  describe('buyAmountUsdt', () => {
    it('should validate valid buy amounts', () => {
      expect(Validators.buyAmountUsdt(10)).toBe(10);
      expect(Validators.buyAmountUsdt(100.5)).toBe(100.5);
      expect(Validators.buyAmountUsdt(1000)).toBe(1000);
      expect(Validators.buyAmountUsdt(1000000)).toBe(1000000);
    });

    it('should reject invalid numbers', () => {
      expect(() => Validators.buyAmountUsdt(NaN)).toThrow(ValidationError);
      expect(() => Validators.buyAmountUsdt('invalid' as any)).toThrow(ValidationError);
      expect(() => Validators.buyAmountUsdt(null as any)).toThrow(ValidationError);
    });

    it('should reject non-positive values', () => {
      expect(() => Validators.buyAmountUsdt(0)).toThrow(ValidationError);
      expect(() => Validators.buyAmountUsdt(-1)).toThrow(ValidationError);
      expect(() => Validators.buyAmountUsdt(-100.5)).toThrow(ValidationError);
    });

    it('should reject values exceeding $1,000,000', () => {
      expect(() => Validators.buyAmountUsdt(1000001)).toThrow(ValidationError);
      expect(() => Validators.buyAmountUsdt(2000000)).toThrow(ValidationError);
    });
  });

  describe('maxConcurrentSnipes', () => {
    it('should validate valid max concurrent snipes', () => {
      expect(Validators.maxConcurrentSnipes(1)).toBe(1);
      expect(Validators.maxConcurrentSnipes(5)).toBe(5);
      expect(Validators.maxConcurrentSnipes(50)).toBe(50);
      expect(Validators.maxConcurrentSnipes(100)).toBe(100);
    });

    it('should reject invalid numbers', () => {
      expect(() => Validators.maxConcurrentSnipes(NaN)).toThrow(ValidationError);
      expect(() => Validators.maxConcurrentSnipes('invalid' as any)).toThrow(ValidationError);
      expect(() => Validators.maxConcurrentSnipes(null as any)).toThrow(ValidationError);
    });

    it('should reject non-integers', () => {
      expect(() => Validators.maxConcurrentSnipes(1.5)).toThrow(ValidationError);
      expect(() => Validators.maxConcurrentSnipes(5.1)).toThrow(ValidationError);
    });

    it('should reject values less than 1', () => {
      expect(() => Validators.maxConcurrentSnipes(0)).toThrow(ValidationError);
      expect(() => Validators.maxConcurrentSnipes(-1)).toThrow(ValidationError);
    });

    it('should reject values exceeding 100', () => {
      expect(() => Validators.maxConcurrentSnipes(101)).toThrow(ValidationError);
      expect(() => Validators.maxConcurrentSnipes(200)).toThrow(ValidationError);
    });
  });

  describe('riskTolerance', () => {
    it('should validate valid risk tolerance values', () => {
      expect(Validators.riskTolerance('low')).toBe('low');
      expect(Validators.riskTolerance('medium')).toBe('medium');
      expect(Validators.riskTolerance('high')).toBe('high');
    });

    it('should reject invalid risk tolerance values', () => {
      expect(() => Validators.riskTolerance('invalid')).toThrow(ValidationError);
      expect(() => Validators.riskTolerance('LOW')).toThrow(ValidationError);
      expect(() => Validators.riskTolerance('Medium')).toThrow(ValidationError);
      expect(() => Validators.riskTolerance('')).toThrow(ValidationError);
      expect(() => Validators.riskTolerance('extreme')).toThrow(ValidationError);
    });
  });

  describe('readyStatePattern', () => {
    it('should validate valid ready state patterns', () => {
      expect(Validators.readyStatePattern([1, 2, 3])).toEqual([1, 2, 3]);
      expect(Validators.readyStatePattern([0, 0, 0])).toEqual([0, 0, 0]);
      expect(Validators.readyStatePattern([10, 10, 10])).toEqual([10, 10, 10]);
    });

    it('should reject non-arrays', () => {
      expect(() => Validators.readyStatePattern('not array')).toThrow(ValidationError);
      expect(() => Validators.readyStatePattern(123)).toThrow(ValidationError);
      expect(() => Validators.readyStatePattern(null)).toThrow(ValidationError);
      expect(() => Validators.readyStatePattern(undefined)).toThrow(ValidationError);
    });

    it('should reject arrays with wrong length', () => {
      expect(() => Validators.readyStatePattern([1, 2])).toThrow(ValidationError);
      expect(() => Validators.readyStatePattern([1, 2, 3, 4])).toThrow(ValidationError);
      expect(() => Validators.readyStatePattern([])).toThrow(ValidationError);
    });

    it('should reject non-integer values', () => {
      expect(() => Validators.readyStatePattern([1.5, 2, 3])).toThrow(ValidationError);
      expect(() => Validators.readyStatePattern([1, 2.5, 3])).toThrow(ValidationError);
      expect(() => Validators.readyStatePattern([1, 2, 3.5])).toThrow(ValidationError);
    });

    it('should reject values outside 0-10 range', () => {
      expect(() => Validators.readyStatePattern([-1, 2, 3])).toThrow(ValidationError);
      expect(() => Validators.readyStatePattern([1, -1, 3])).toThrow(ValidationError);
      expect(() => Validators.readyStatePattern([1, 2, -1])).toThrow(ValidationError);
      expect(() => Validators.readyStatePattern([11, 2, 3])).toThrow(ValidationError);
      expect(() => Validators.readyStatePattern([1, 11, 3])).toThrow(ValidationError);
      expect(() => Validators.readyStatePattern([1, 2, 11])).toThrow(ValidationError);
    });
  });

  describe('targetAdvanceHours', () => {
    it('should validate valid target advance hours', () => {
      expect(Validators.targetAdvanceHours(0.5)).toBe(0.5);
      expect(Validators.targetAdvanceHours(1)).toBe(1);
      expect(Validators.targetAdvanceHours(24)).toBe(24);
      expect(Validators.targetAdvanceHours(168)).toBe(168);
    });

    it('should reject invalid numbers', () => {
      expect(() => Validators.targetAdvanceHours(NaN)).toThrow(ValidationError);
      expect(() => Validators.targetAdvanceHours('invalid' as any)).toThrow(ValidationError);
      expect(() => Validators.targetAdvanceHours(null as any)).toThrow(ValidationError);
    });

    it('should reject values less than 0.5 hours', () => {
      expect(() => Validators.targetAdvanceHours(0.4)).toThrow(ValidationError);
      expect(() => Validators.targetAdvanceHours(0)).toThrow(ValidationError);
      expect(() => Validators.targetAdvanceHours(-1)).toThrow(ValidationError);
    });

    it('should reject values exceeding 168 hours', () => {
      expect(() => Validators.targetAdvanceHours(169)).toThrow(ValidationError);
      expect(() => Validators.targetAdvanceHours(200)).toThrow(ValidationError);
    });
  });

  describe('pollInterval', () => {
    it('should validate valid poll intervals with defaults', () => {
      expect(Validators.pollInterval(10)).toBe(10);
      expect(Validators.pollInterval(60)).toBe(60);
      expect(Validators.pollInterval(3600)).toBe(3600);
    });

    it('should validate valid poll intervals with custom limits', () => {
      expect(Validators.pollInterval(30, 30, 300)).toBe(30);
      expect(Validators.pollInterval(300, 30, 300)).toBe(300);
    });

    it('should reject invalid numbers', () => {
      expect(() => Validators.pollInterval(NaN)).toThrow(ValidationError);
      expect(() => Validators.pollInterval('invalid' as any)).toThrow(ValidationError);
      expect(() => Validators.pollInterval(null as any)).toThrow(ValidationError);
    });

    it('should reject non-integers', () => {
      expect(() => Validators.pollInterval(10.5)).toThrow(ValidationError);
      expect(() => Validators.pollInterval(60.1)).toThrow(ValidationError);
    });

    it('should reject values outside range with defaults', () => {
      expect(() => Validators.pollInterval(9)).toThrow(ValidationError);
      expect(() => Validators.pollInterval(3601)).toThrow(ValidationError);
    });

    it('should reject values outside custom range', () => {
      expect(() => Validators.pollInterval(29, 30, 300)).toThrow(ValidationError);
      expect(() => Validators.pollInterval(301, 30, 300)).toThrow(ValidationError);
    });
  });

  describe('validateTakeProfitLevels', () => {
    it('should validate valid take profit levels', () => {
      const data = {
        takeProfitLevel1: 10,
        takeProfitLevel2: 20,
        takeProfitLevel3: 30,
        takeProfitLevel4: 40,
        takeProfitCustom: 50,
      };

      const result = Validators.validateTakeProfitLevels(data);

      expect(result).toEqual({
        takeProfitLevel1: 10,
        takeProfitLevel2: 20,
        takeProfitLevel3: 30,
        takeProfitLevel4: 40,
        takeProfitCustom: 50,
      });
    });

    it('should handle partial take profit levels', () => {
      const data = {
        takeProfitLevel1: 10,
        takeProfitLevel3: 30,
      };

      const result = Validators.validateTakeProfitLevels(data);

      expect(result).toEqual({
        takeProfitLevel1: 10,
        takeProfitLevel3: 30,
      });
    });

    it('should handle empty data', () => {
      const result = Validators.validateTakeProfitLevels({});
      expect(result).toEqual({});
    });

    it('should collect validation errors', () => {
      const data = {
        takeProfitLevel1: -10, // Invalid
        takeProfitLevel2: 20,  // Valid
        takeProfitLevel3: 1001, // Invalid
      };

      expect(() => Validators.validateTakeProfitLevels(data)).toThrow(ValidationError);
    });
  });

  describe('validateUserPreferences', () => {
    it('should validate complete user preferences', () => {
      const data = {
        userId: 'user123',
        defaultBuyAmountUsdt: 100,
        maxConcurrentSnipes: 5,
        stopLossPercent: 10,
        riskTolerance: 'medium',
        readyStatePattern: [1, 2, 3],
        targetAdvanceHours: 4,
        calendarPollIntervalSeconds: 300,
        symbolsPollIntervalSeconds: 60,
        takeProfitLevel1: 10,
        takeProfitLevel2: 20,
      };

      const result = Validators.validateUserPreferences(data);

      expect(result).toEqual({
        userId: 'user123',
        defaultBuyAmountUsdt: 100,
        maxConcurrentSnipes: 5,
        stopLossPercent: 10,
        riskTolerance: 'medium',
        readyStatePattern: [1, 2, 3],
        targetAdvanceHours: 4,
        calendarPollIntervalSeconds: 300,
        symbolsPollIntervalSeconds: 60,
        takeProfitLevel1: 10,
        takeProfitLevel2: 20,
      });
    });

    it('should validate minimal user preferences', () => {
      const data = {
        userId: 'user123',
      };

      const result = Validators.validateUserPreferences(data);

      expect(result).toEqual({
        userId: 'user123',
      });
    });

    it('should handle optional fields', () => {
      const data = {
        userId: 'user123',
        defaultBuyAmountUsdt: 50,
        riskTolerance: 'high',
      };

      const result = Validators.validateUserPreferences(data);

      expect(result).toEqual({
        userId: 'user123',
        defaultBuyAmountUsdt: 50,
        riskTolerance: 'high',
      });
    });

    it('should require userId', () => {
      const data = {
        defaultBuyAmountUsdt: 100,
      };

      expect(() => Validators.validateUserPreferences(data)).toThrow(ValidationError);
    });

    it('should collect multiple validation errors', () => {
      const data = {
        userId: '', // Invalid
        defaultBuyAmountUsdt: -100, // Invalid
        maxConcurrentSnipes: 0, // Invalid
        stopLossPercent: 101, // Invalid
        riskTolerance: 'invalid', // Invalid
        readyStatePattern: [1, 2], // Invalid
        targetAdvanceHours: 0.1, // Invalid
        calendarPollIntervalSeconds: 30, // Invalid (min 60)
        symbolsPollIntervalSeconds: 5, // Invalid (min 10)
        takeProfitLevel1: -10, // Invalid
      };

      expect(() => Validators.validateUserPreferences(data)).toThrow(ValidationError);
    });

    it('should validate poll intervals with correct ranges', () => {
      const data = {
        userId: 'user123',
        calendarPollIntervalSeconds: 60, // Valid (min 60)
        symbolsPollIntervalSeconds: 10, // Valid (min 10)
      };

      const result = Validators.validateUserPreferences(data);

      expect(result).toEqual({
        userId: 'user123',
        calendarPollIntervalSeconds: 60,
        symbolsPollIntervalSeconds: 10,
      });
    });

    it('should handle undefined optional fields', () => {
      const data = {
        userId: 'user123',
        defaultBuyAmountUsdt: undefined,
        maxConcurrentSnipes: undefined,
        stopLossPercent: undefined,
        riskTolerance: undefined,
        readyStatePattern: undefined,
        targetAdvanceHours: undefined,
        calendarPollIntervalSeconds: undefined,
        symbolsPollIntervalSeconds: undefined,
      };

      const result = Validators.validateUserPreferences(data);

      expect(result).toEqual({
        userId: 'user123',
      });
    });
  });

  describe('Error handling', () => {
    it('should preserve field names in validation errors', () => {
      try {
        Validators.validateUserPreferences({
          userId: 'user123',
          defaultBuyAmountUsdt: -100,
          maxConcurrentSnipes: 'invalid',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        // Error should contain field information
        expect(error.message).toBeDefined();
      }
    });

    it('should handle edge cases in validation', () => {
      expect(() => Validators.takeProfitLevel(0, 'Zero Level')).not.toThrow();
      expect(() => Validators.buyAmountUsdt(0.01)).not.toThrow();
      expect(() => Validators.maxConcurrentSnipes(1)).not.toThrow();
    });
  });
});