import { describe, it, expect, beforeEach } from 'vitest';
import { TradingStrategyManager, TRADING_STRATEGIES } from "../../src/services/trading-strategy-manager";

describe('TradingStrategyManager', () => {
  let manager: TradingStrategyManager;

  beforeEach(() => {
    manager = new TradingStrategyManager();
  });

  describe('Predefined Strategies', () => {
    it('should have all 5 predefined strategies', () => {
      expect(Object.keys(TRADING_STRATEGIES)).toEqual([
        'normal',
        'highPriceIncrease', 
        'conservative',
        'scalping',
        'diamond'
      ]);
    });

    it('should have correct normal strategy configuration', () => {
      const normal = TRADING_STRATEGIES.normal;
      expect(normal.id).toBe('normal');
      expect(normal.name).toBe('Normal Multi-Phase Strategy');
      expect(normal.levels).toEqual([
        { percentage: 50, multiplier: 1.5, sellPercentage: 25 },
        { percentage: 100, multiplier: 2.0, sellPercentage: 25 },
        { percentage: 125, multiplier: 2.25, sellPercentage: 20 },
        { percentage: 175, multiplier: 2.75, sellPercentage: 10 },
      ]);
    });

    it('should have correct highPriceIncrease strategy configuration', () => {
      const aggressive = TRADING_STRATEGIES.highPriceIncrease;
      expect(aggressive.id).toBe('highPriceIncrease');
      expect(aggressive.name).toBe('Aggressive Multi-Phase Strategy');
      expect(aggressive.levels).toEqual([
        { percentage: 100, multiplier: 2.0, sellPercentage: 15 },
        { percentage: 150, multiplier: 2.5, sellPercentage: 15 },
        { percentage: 200, multiplier: 3.0, sellPercentage: 25 },
        { percentage: 300, multiplier: 4.0, sellPercentage: 25 },
      ]);
    });

    it('should have correct conservative strategy configuration', () => {
      const conservative = TRADING_STRATEGIES.conservative;
      expect(conservative.id).toBe('conservative');
      expect(conservative.name).toBe('Conservative Multi-Phase Strategy');
      expect(conservative.levels).toEqual([
        { percentage: 10, multiplier: 1.1, sellPercentage: 30 },
        { percentage: 20, multiplier: 1.2, sellPercentage: 40 },
        { percentage: 30, multiplier: 1.3, sellPercentage: 30 },
      ]);
    });

    it('should have correct scalping strategy configuration', () => {
      const scalping = TRADING_STRATEGIES.scalping;
      expect(scalping.id).toBe('scalping');
      expect(scalping.name).toBe('Scalping Multi-Phase Strategy');
      expect(scalping.levels).toEqual([
        { percentage: 5, multiplier: 1.05, sellPercentage: 20 },
        { percentage: 10, multiplier: 1.1, sellPercentage: 30 },
        { percentage: 15, multiplier: 1.15, sellPercentage: 30 },
        { percentage: 20, multiplier: 1.2, sellPercentage: 20 },
      ]);
    });

    it('should have correct diamond strategy configuration', () => {
      const diamond = TRADING_STRATEGIES.diamond;
      expect(diamond.id).toBe('diamond');
      expect(diamond.name).toBe('Diamond Hands Multi-Phase Strategy');
      expect(diamond.levels).toEqual([
        { percentage: 200, multiplier: 3.0, sellPercentage: 10 },
        { percentage: 500, multiplier: 6.0, sellPercentage: 20 },
        { percentage: 1000, multiplier: 11.0, sellPercentage: 30 },
        { percentage: 2000, multiplier: 21.0, sellPercentage: 20 },
      ]);
    });
  });

  describe('Strategy Manager Functionality', () => {
    it('should initialize with normal strategy as default', () => {
      expect(manager.getActiveStrategy().id).toBe('normal');
    });

    it('should switch strategies correctly', () => {
      const success = manager.switchStrategy('conservative');
      expect(success).toBe(true);
      expect(manager.getActiveStrategy().id).toBe('conservative');
    });

    it('should return false for invalid strategy ID', () => {
      const success = manager.switchStrategy('invalid-strategy');
      expect(success).toBe(false);
      expect(manager.getActiveStrategy().id).toBe('normal'); // Should remain unchanged
    });

    it('should list all available strategies', () => {
      const strategies = manager.listAvailableStrategies();
      expect(strategies).toEqual([
        'normal',
        'highPriceIncrease',
        'conservative', 
        'scalping',
        'diamond'
      ]);
    });

    it('should get strategy by ID', () => {
      const strategy = manager.getStrategy('highPriceIncrease');
      expect(strategy?.id).toBe('highPriceIncrease');
      expect(strategy?.name).toBe('Aggressive Multi-Phase Strategy');
    });

    it('should return null for non-existent strategy', () => {
      const strategy = manager.getStrategy('non-existent');
      expect(strategy).toBeNull();
    });
  });

  describe('Sell Recommendations', () => {
    it('should recommend sell when price hits first phase target', () => {
      manager.switchStrategy('normal');
      const recommendation = manager.getSellRecommendation(150, 100); // 50% increase
      
      expect(recommendation.shouldSell).toBe(true);
      expect(recommendation.phases).toHaveLength(1);
      expect(recommendation.phases[0].phase).toBe(1);
      expect(recommendation.phases[0].sellPercentage).toBe(25);
    });

    it('should recommend multiple phases when price hits multiple targets', () => {
      manager.switchStrategy('normal');
      const recommendation = manager.getSellRecommendation(200, 100); // 100% increase
      
      expect(recommendation.shouldSell).toBe(true);
      expect(recommendation.phases).toHaveLength(2);
      expect(recommendation.phases[0].phase).toBe(1);
      expect(recommendation.phases[1].phase).toBe(2);
    });

    it('should not recommend sell when price is below targets', () => {
      manager.switchStrategy('normal');
      const recommendation = manager.getSellRecommendation(120, 100); // 20% increase
      
      expect(recommendation.shouldSell).toBe(false);
      expect(recommendation.phases).toHaveLength(0);
    });

    it('should calculate correct profit expectations', () => {
      manager.switchStrategy('conservative');
      const recommendation = manager.getSellRecommendation(110, 100); // 10% increase
      
      expect(recommendation.shouldSell).toBe(true);
      expect(recommendation.phases[0].expectedProfit).toBeGreaterThan(0);
      expect(recommendation.totalExpectedProfit).toBe(recommendation.phases[0].expectedProfit);
    });
  });

  describe('Strategy Import/Export', () => {
    it('should export strategy correctly', () => {
      const exported = manager.exportStrategy('normal');
      
      expect(exported.id).toBe('normal');
      expect(exported.name).toBe('Normal Multi-Phase Strategy');
      expect(exported.levels).toEqual(TRADING_STRATEGIES.normal.levels);
    });

    it('should import strategy correctly', () => {
      const customStrategy = {
        id: 'custom',
        name: 'Custom Strategy',
        description: 'Test custom strategy',
        levels: [
          { percentage: 25, multiplier: 1.25, sellPercentage: 50 },
          { percentage: 50, multiplier: 1.5, sellPercentage: 50 },
        ]
      };

      const success = manager.importStrategy(customStrategy);
      expect(success).toBe(true);
      
      const imported = manager.getStrategy('custom');
      expect(imported).toEqual(customStrategy);
    });

    it('should not import invalid strategy', () => {
      const invalidStrategy = {
        id: 'invalid',
        name: 'Invalid Strategy',
        levels: [] // Empty levels array should be invalid
      };

      const success = manager.importStrategy(invalidStrategy);
      expect(success).toBe(false);
    });

    it('should validate strategy structure on import', () => {
      const invalidStrategy = {
        id: 'invalid',
        name: 'Invalid Strategy',
        levels: [
          { percentage: -10, multiplier: 1.1, sellPercentage: 50 }, // Invalid negative percentage
        ]
      };

      const success = manager.importStrategy(invalidStrategy);
      expect(success).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero entry price gracefully', () => {
      const recommendation = manager.getSellRecommendation(100, 0);
      expect(recommendation.shouldSell).toBe(false);
      expect(recommendation.phases).toHaveLength(0);
    });

    it('should handle negative prices gracefully', () => {
      const recommendation = manager.getSellRecommendation(-10, 100);
      expect(recommendation.shouldSell).toBe(false);
      expect(recommendation.phases).toHaveLength(0);
    });

    it('should handle very large price increases', () => {
      manager.switchStrategy('diamond');
      const recommendation = manager.getSellRecommendation(10000, 100); // 9900% increase
      
      expect(recommendation.shouldSell).toBe(true);
      expect(recommendation.phases).toHaveLength(4); // All phases should trigger
    });

    it('should maintain precision with decimal calculations', () => {
      manager.switchStrategy('scalping');
      const recommendation = manager.getSellRecommendation(105.5, 100); // 5.5% increase
      
      expect(recommendation.shouldSell).toBe(true);
      expect(recommendation.phases[0].expectedProfit).toBeCloseTo(1.1, 1); // 5.5 * 0.2 = 1.1
    });
  });
});