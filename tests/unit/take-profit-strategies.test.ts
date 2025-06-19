import { describe, it, expect } from 'vitest';
import {
  TakeProfitStrategy,
  TakeProfitLevel,
  TAKE_PROFIT_STRATEGIES,
  DEFAULT_CUSTOM_CONFIG,
  validateTakeProfitLevel,
  validateTakeProfitStrategy,
  getTakeProfitStrategyById,
  createCustomTakeProfitLevel,
  calculatePotentialProfit,
  convertLegacyToStrategy
} from '../../src/types/take-profit-strategies';

describe('Take Profit Strategies', () => {
  describe('Predefined Strategies', () => {
    it('should have three predefined strategies', () => {
      expect(TAKE_PROFIT_STRATEGIES).toHaveLength(3);
      expect(TAKE_PROFIT_STRATEGIES.map(s => s.id)).toEqual(['conservative', 'balanced', 'aggressive']);
    });

    it('should have balanced strategy as default', () => {
      const balancedStrategy = TAKE_PROFIT_STRATEGIES.find(s => s.id === 'balanced');
      expect(balancedStrategy?.isDefault).toBe(true);
    });

    it('should have valid risk levels', () => {
      TAKE_PROFIT_STRATEGIES.forEach(strategy => {
        expect(['low', 'medium', 'high']).toContain(strategy.riskLevel);
      });
    });

    it('should have ascending profit percentages within each strategy', () => {
      TAKE_PROFIT_STRATEGIES.forEach(strategy => {
        for (let i = 1; i < strategy.levels.length; i++) {
          expect(strategy.levels[i].profitPercentage).toBeGreaterThan(
            strategy.levels[i - 1].profitPercentage
          );
        }
      });
    });
  });

  describe('Strategy Validation', () => {
    it('should validate valid take profit level', () => {
      const validLevel: TakeProfitLevel = {
        id: 'test-1',
        profitPercentage: 10.0,
        sellQuantity: 25.0,
        isActive: true
      };

      const errors = validateTakeProfitLevel(validLevel);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid profit percentage', () => {
      const invalidLevel: TakeProfitLevel = {
        id: 'test-1',
        profitPercentage: -5.0, // Invalid: negative
        sellQuantity: 25.0,
        isActive: true
      };

      const errors = validateTakeProfitLevel(invalidLevel);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Profit percentage must be between');
    });

    it('should reject invalid sell quantity', () => {
      const invalidLevel: TakeProfitLevel = {
        id: 'test-1',
        profitPercentage: 10.0,
        sellQuantity: 150.0, // Invalid: > 100%
        isActive: true
      };

      const errors = validateTakeProfitLevel(invalidLevel);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Sell quantity must be between');
    });

    it('should validate complete strategy', () => {
      const validStrategy: TakeProfitStrategy = {
        id: 'test-strategy',
        name: 'Test Strategy',
        description: 'Test description',
        riskLevel: 'medium',
        levels: [
          {
            id: 'level-1',
            profitPercentage: 5.0,
            sellQuantity: 30.0,
            isActive: true
          },
          {
            id: 'level-2',
            profitPercentage: 15.0,
            sellQuantity: 70.0,
            isActive: true
          }
        ]
      };

      const errors = validateTakeProfitStrategy(validStrategy);
      expect(errors).toHaveLength(0);
    });

    it('should reject strategy with descending profit percentages', () => {
      const invalidStrategy: TakeProfitStrategy = {
        id: 'test-strategy',
        name: 'Test Strategy',
        description: 'Test description',
        riskLevel: 'medium',
        levels: [
          {
            id: 'level-1',
            profitPercentage: 15.0, // Higher than next level
            sellQuantity: 30.0,
            isActive: true
          },
          {
            id: 'level-2',
            profitPercentage: 5.0, // Lower than previous level
            sellQuantity: 70.0,
            isActive: true
          }
        ]
      };

      const errors = validateTakeProfitStrategy(invalidStrategy);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('profit percentage must be higher'))).toBe(true);
    });

    it('should reject strategy with total sell quantity > 100%', () => {
      const invalidStrategy: TakeProfitStrategy = {
        id: 'test-strategy',
        name: 'Test Strategy',
        description: 'Test description',
        riskLevel: 'medium',
        levels: [
          {
            id: 'level-1',
            profitPercentage: 5.0,
            sellQuantity: 60.0,
            isActive: true
          },
          {
            id: 'level-2',
            profitPercentage: 15.0,
            sellQuantity: 50.0, // Total: 110%
            isActive: true
          }
        ]
      };

      const errors = validateTakeProfitStrategy(invalidStrategy);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('Total sell quantity'))).toBe(true);
    });
  });

  describe('Helper Functions', () => {
    it('should find strategy by ID', () => {
      const strategy = getTakeProfitStrategyById('balanced');
      expect(strategy).toBeDefined();
      expect(strategy?.id).toBe('balanced');
    });

    it('should return undefined for non-existent strategy', () => {
      const strategy = getTakeProfitStrategyById('non-existent');
      expect(strategy).toBeUndefined();
    });

    it('should create custom take profit level', () => {
      const level = createCustomTakeProfitLevel(12.5, 40.0, 'Test level');

      expect(level.profitPercentage).toBe(12.5);
      expect(level.sellQuantity).toBe(40.0);
      expect(level.description).toBe('Test level');
      expect(level.isActive).toBe(true);
      expect(level.id).toMatch(/^custom-\d+-[a-z0-9]+$/);
    });

    it('should calculate potential profit correctly', () => {
      const strategy: TakeProfitStrategy = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        riskLevel: 'medium',
        levels: [
          {
            id: 'level-1',
            profitPercentage: 10.0,
            sellQuantity: 50.0,
            isActive: true
          },
          {
            id: 'level-2',
            profitPercentage: 20.0,
            sellQuantity: 50.0,
            isActive: true
          }
        ]
      };

      const results = calculatePotentialProfit(strategy, 1000);

      expect(results).toHaveLength(2);

      // Level 1: 50% of $1000 at 10% profit = $1000 * 0.5 * 0.1 = $50
      expect(results[0].profit).toBe(50);
      expect(results[0].remaining).toBe(50); // 100% - 50% = 50%

      // Level 2: 50% of $1000 at 20% profit = $1000 * 0.5 * 0.2 = $100
      expect(results[1].profit).toBe(100);
      expect(results[1].remaining).toBe(0); // 50% - 50% = 0%
    });
  });

  describe('Legacy Conversion', () => {
    it('should convert legacy take profit levels to strategy', () => {
      const legacy = {
        level1: 5.0,
        level2: 10.0,
        level3: 15.0,
        level4: 25.0,
        custom: 50.0
      };

      const sellQuantities = {
        level1: 20.0,
        level2: 30.0,
        level3: 30.0,
        level4: 20.0,
        custom: 100.0
      };

      const strategy = convertLegacyToStrategy(legacy, sellQuantities);

      expect(strategy.levels).toHaveLength(5);
      expect(strategy.levels[0].profitPercentage).toBe(5.0);
      expect(strategy.levels[0].sellQuantity).toBe(20.0);
      expect(strategy.levels[4].profitPercentage).toBe(50.0);
      expect(strategy.levels[4].sellQuantity).toBe(100.0);
      expect(strategy.isCustom).toBe(true);
    });

    it('should handle legacy conversion with default sell quantities', () => {
      const legacy = {
        level1: 5.0,
        level2: 10.0,
        level3: 15.0,
        level4: 25.0
      };

      const strategy = convertLegacyToStrategy(legacy);

      expect(strategy.levels).toHaveLength(4);
      strategy.levels.forEach(level => {
        expect(level.sellQuantity).toBe(25); // Default value
      });
    });
  });

  describe('Default Custom Config', () => {
    it('should have valid default custom configuration', () => {
      expect(DEFAULT_CUSTOM_CONFIG.strategy.id).toBe('custom');
      expect(DEFAULT_CUSTOM_CONFIG.strategy.isCustom).toBe(true);
      expect(DEFAULT_CUSTOM_CONFIG.maxLevels).toBe(6);
      expect(DEFAULT_CUSTOM_CONFIG.minProfitPercentage).toBe(0.1);
      expect(DEFAULT_CUSTOM_CONFIG.maxProfitPercentage).toBe(1000.0);
      expect(DEFAULT_CUSTOM_CONFIG.minSellQuantity).toBe(1.0);
      expect(DEFAULT_CUSTOM_CONFIG.maxSellQuantity).toBe(100.0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strategy levels', () => {
      const emptyStrategy: TakeProfitStrategy = {
        id: 'empty',
        name: 'Empty',
        description: 'Empty strategy',
        riskLevel: 'medium',
        levels: []
      };

      const errors = validateTakeProfitStrategy(emptyStrategy);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('must have at least one level');
    });

    it('should handle strategy with too many levels', () => {
      const levels: TakeProfitLevel[] = [];
      for (let i = 0; i < 7; i++) {
        levels.push({
          id: `level-${i}`,
          profitPercentage: (i + 1) * 5,
          sellQuantity: 10,
          isActive: true
        });
      }

      const tooManyLevelsStrategy: TakeProfitStrategy = {
        id: 'too-many',
        name: 'Too Many Levels',
        description: 'Strategy with too many levels',
        riskLevel: 'medium',
        levels
      };

      const errors = validateTakeProfitStrategy(tooManyLevelsStrategy);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('cannot have more than 6 levels'))).toBe(true);
    });

    it('should handle inactive levels in profit calculation', () => {
      const strategy: TakeProfitStrategy = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        riskLevel: 'medium',
        levels: [
          {
            id: 'level-1',
            profitPercentage: 10.0,
            sellQuantity: 50.0,
            isActive: true
          },
          {
            id: 'level-2',
            profitPercentage: 20.0,
            sellQuantity: 50.0,
            isActive: false // Inactive level
          }
        ]
      };

      const results = calculatePotentialProfit(strategy, 1000);

      // Should only include active levels
      expect(results).toHaveLength(1);
      expect(results[0].profit).toBe(50);
    });
  });
});
