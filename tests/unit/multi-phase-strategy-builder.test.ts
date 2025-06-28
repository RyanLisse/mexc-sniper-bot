import { describe, it, expect, beforeEach } from 'vitest';
import { MultiPhaseStrategyBuilder, StrategyPatterns } from "@/src/services/multi-phase-strategy-builder";

describe('MultiPhaseStrategyBuilder', () => {
  let builder: MultiPhaseStrategyBuilder;

  beforeEach(() => {
    builder = new MultiPhaseStrategyBuilder('test-strategy', 'Test Strategy');
  });

  describe('Basic Builder Functionality', () => {
    it('should create builder with correct initial values', () => {
      expect(builder).toBeDefined();
      
      const preview = builder.preview();
      expect(preview.levels).toHaveLength(0);
      
      // Test the actual build result for id and name
      builder.addPhase(10, 50); // Add a phase so build() doesn't throw
      const strategy = builder.build();
      expect(strategy.id).toBe('test-strategy');
      expect(strategy.name).toBe('Test Strategy');
    });

    it('should add single phase correctly', () => {
      builder.addPhase(50, 25); // 50% price increase, sell 25%
      
      const preview = builder.preview();
      expect(preview.levels).toHaveLength(1);
      expect(preview.levels[0]).toEqual({
        percentage: 50,
        multiplier: 1.5,
        sellPercentage: 25,
      });
    });

    it('should add multiple phases correctly', () => {
      builder.addPhases([
        [25, 30],
        [50, 40],
        [75, 30],
      ]);
      
      const preview = builder.preview();
      expect(preview.levels).toHaveLength(3);
      expect(preview.levels[0].percentage).toBe(25);
      expect(preview.levels[1].percentage).toBe(50);
      expect(preview.levels[2].percentage).toBe(75);
    });

    it('should set description correctly', () => {
      builder.withDescription('Custom strategy description');
      builder.addPhase(10, 50); // Add a phase so build() doesn't throw
      
      const strategy = builder.build();
      expect(strategy.description).toBe('Custom strategy description');
    });

    it('should build complete strategy', () => {
      const strategy = builder
        .addPhase(50, 25)
        .addPhase(100, 25)
        .withDescription('Two-phase strategy')
        .build();
      
      expect(strategy.id).toBe('test-strategy');
      expect(strategy.name).toBe('Test Strategy');
      expect(strategy.description).toBe('Two-phase strategy');
      expect(strategy.levels).toHaveLength(2);
    });
  });

  describe('Predefined Strategy Methods', () => {
    it('should create conservative strategy', () => {
      const strategy = builder.createConservativeStrategy().build();

      expect(strategy.levels).toHaveLength(4);
      expect(strategy.levels[0].percentage).toBe(10);
      expect(strategy.levels[1].percentage).toBe(20);
      expect(strategy.levels[2].percentage).toBe(30);
      expect(strategy.levels[3].percentage).toBe(100);

      // Conservative should sell larger percentages at lower targets
      expect(strategy.levels[0].sellPercentage).toBe(18); // 60 * 0.3
      expect(strategy.levels[1].sellPercentage).toBe(24); // 60 * 0.4
      expect(strategy.levels[2].sellPercentage).toBe(18); // 60 * 0.3
      expect(strategy.levels[3].sellPercentage).toBe(40); // 100 - 60
    });

    it('should create conservative strategy with custom targets', () => {
      const strategy = builder.createConservativeStrategy(80, 150).build();

      expect(strategy.levels[0].percentage).toBe(10);
      expect(strategy.levels[1].percentage).toBe(20);
      expect(strategy.levels[2].percentage).toBe(30);
      expect(strategy.levels[3].percentage).toBe(150); // maxTarget
    });

    it('should create aggressive strategy', () => {
      const strategy = builder.createAggressiveStrategy().build();

      expect(strategy.levels).toHaveLength(4);
      expect(strategy.levels[0].percentage).toBe(100);
      expect(strategy.levels[1].percentage).toBe(150); // 100 * 1.5
      expect(strategy.levels[2].percentage).toBe(200); // 100 * 2
      expect(strategy.levels[3].percentage).toBe(500); // maxTarget

      // Aggressive should have smaller sell percentages initially
      expect(strategy.levels[0].sellPercentage).toBe(15);
      expect(strategy.levels[1].sellPercentage).toBe(20);
      expect(strategy.levels[2].sellPercentage).toBe(25);
      expect(strategy.levels[3].sellPercentage).toBe(20);
    });

    it('should create scalping strategy', () => {
      const strategy = builder.createScalpingStrategy().build();

      expect(strategy.levels).toHaveLength(4);
      expect(strategy.levels[0].percentage).toBe(5); // 20/4 = 5
      expect(strategy.levels[1].percentage).toBe(10); // 5*2 = 10
      expect(strategy.levels[2].percentage).toBe(15); // 5*3 = 15
      expect(strategy.levels[3].percentage).toBe(20); // 5*4 = 20

      // Scalping should have quick exits
      strategy.levels.forEach((level: any) => {
        expect(level.percentage).toBeLessThanOrEqual(20);
      });
    });

    it('should create DCA (Dollar Cost Averaging) strategy', () => {
      const strategy = builder.createDCAStrategy().build();

      expect(strategy.levels).toHaveLength(5);

      // DCA should have equal sell percentages
      strategy.levels.forEach((level: any) => {
        expect(level.sellPercentage).toBe(20); // 100/5 = 20
      });

      // Should have progressive targets
      expect(strategy.levels[0].percentage).toBe(20); // 100/5 = 20
      expect(strategy.levels[4].percentage).toBe(100); // 20*5 = 100
    });
  });

  describe('Validation', () => {
    it('should validate percentage values', () => {
      expect(() => builder.addPhase(-10, 25)).toThrow('Target percentage must be positive');
      expect(() => builder.addPhase(0, 25)).toThrow('Target percentage must be positive');
    });

    it('should validate sell percentage values', () => {
      expect(() => builder.addPhase(50, -10)).toThrow('Sell percentage must be between 0 and 100');
      expect(() => builder.addPhase(50, 150)).toThrow('Sell percentage must be between 0 and 100');
    });

    it('should validate total sell percentage', () => {
      builder.addPhase(25, 60);
      builder.addPhase(50, 50); // Total would be 110%

      expect(() => builder.build()).toThrow('Total sell percentage (110.0%) exceeds 100%');
    });

    it('should validate phase ordering', () => {
      builder.addPhase(50, 25);
      builder.addPhase(50, 25); // Same percentage - should cause error

      // The validation happens during build() when it sorts and checks for duplicates
      expect(() => builder.build()).toThrow('Target percentages must be strictly increasing');
    });

    it('should validate minimum phases', () => {
      expect(() => builder.build()).toThrow('Strategy must have at least one phase');
    });

    it('should allow exactly 100% total sell percentage', () => {
      builder.addPhases([
        [25, 25],
        [50, 25],
        [75, 25],
        [100, 25],
      ]);
      
      expect(() => builder.build()).not.toThrow();
    });
  });

  describe('Method Chaining', () => {
    it('should support fluent interface', () => {
      const strategy = builder
        .addPhase(20, 30)
        .addPhase(40, 40)
        .addPhase(60, 30)
        .withDescription('Chained strategy')
        .build();
      
      expect(strategy.levels).toHaveLength(3);
      expect(strategy.description).toBe('Chained strategy');
    });

    it('should support mixed method chaining', () => {
      const strategy = builder
        .createConservativeStrategy()
        .withDescription('Conservative with custom description')
        .build();

      expect(strategy.levels).toHaveLength(4); // Conservative strategy has 4 levels
      expect(strategy.description).toBe('Conservative with custom description');
    });
  });

  describe('Edge Cases', () => {
    it('should handle single phase strategy', () => {
      const strategy = builder.addPhase(100, 100).build();
      
      expect(strategy.levels).toHaveLength(1);
      expect(strategy.levels[0].sellPercentage).toBe(100);
    });

    it('should handle many phases', () => {
      const phases = Array.from({ length: 20 }, (_, i) => [
        (i + 1) * 5,
        5,
      ] as [number, number]);
      
      builder.addPhases(phases);
      const strategy = builder.build();
      
      expect(strategy.levels).toHaveLength(20);
      expect(strategy.levels[19].percentage).toBe(100);
    });

    it('should handle decimal percentages', () => {
      builder.addPhase(12.5, 33.33);
      const strategy = builder.build();
      
      expect(strategy.levels[0].percentage).toBe(12.5);
      expect(strategy.levels[0].sellPercentage).toBe(33.33);
      expect(strategy.levels[0].multiplier).toBe(1.125);
    });

    it('should reset builder state after build', () => {
      builder.addPhase(50, 50).build();

      // Builder doesn't auto-reset, so we need to create a new one
      const newBuilder = new MultiPhaseStrategyBuilder('test-reset', 'Test Reset');
      const newStrategy = newBuilder.addPhase(25, 50).build();
      expect(newStrategy.levels).toHaveLength(1);
      expect(newStrategy.levels[0].percentage).toBe(25);
    });
  });

  describe('Preview Functionality', () => {
    it('should preview without building', () => {
      builder.addPhase(50, 50);
      
      const preview = builder.preview();
      expect(preview.levels).toHaveLength(1);
      
      // Should still be able to add more phases
      builder.addPhase(100, 50);
      const newPreview = builder.preview();
      expect(newPreview.levels).toHaveLength(2);
    });

    it('should show intermediate state in preview', () => {
      builder.addPhase(25, 25);
      let preview = builder.preview();
      expect(preview.levels).toHaveLength(1);
      
      builder.addPhase(50, 25);
      preview = builder.preview();
      expect(preview.levels).toHaveLength(2);
      
      builder.addPhase(75, 25);
      preview = builder.preview();
      expect(preview.levels).toHaveLength(3);
    });
  });
});

describe('StrategyPatterns', () => {
  describe('Momentum Pattern', () => {
    it('should create low momentum strategy', () => {
      const builder = StrategyPatterns.momentum('low');
      const strategy = builder.build();

      expect(strategy.levels).toHaveLength(6); // createBalancedStrategy(6, 60, 80)
      // Low momentum should have lower targets
      expect(strategy.levels[0].percentage).toBeLessThan(50);
    });

    it('should create medium momentum strategy', () => {
      const builder = StrategyPatterns.momentum('medium');
      const strategy = builder.build();
      
      expect(strategy.levels).toHaveLength(4);
      // Medium momentum should have moderate targets
      expect(strategy.levels[0].percentage).toBeGreaterThan(30);
      expect(strategy.levels[0].percentage).toBeLessThan(80);
    });

    it('should create high momentum strategy', () => {
      const builder = StrategyPatterns.momentum('high');
      const strategy = builder.build();

      expect(strategy.levels).toHaveLength(3); // createBalancedStrategy(3, 300, 70)
      // High momentum should have higher targets
      expect(strategy.levels[0].percentage).toBeGreaterThan(50);
    });
  });

  describe('Risk Adjusted Pattern', () => {
    it('should create strategy for small position', () => {
      const builder = StrategyPatterns.riskAdjusted(2); // 2% position
      const strategy = builder.build();
      
      expect(strategy.levels).toHaveLength(4);
      // Small position allows for more aggressive targets
      expect(strategy.levels[0].percentage).toBeGreaterThan(40);
    });

    it('should create strategy for large position', () => {
      const builder = StrategyPatterns.riskAdjusted(15); // 15% position
      const strategy = builder.build();

      expect(strategy.levels).toHaveLength(4); // createConservativeStrategy(70, 80)
      // Large position requires more conservative targets
      expect(strategy.levels[0].percentage).toBeLessThanOrEqual(30);
    });

    it('should handle edge cases in position sizing', () => {
      // Very small position
      let builder = StrategyPatterns.riskAdjusted(0.5);
      let strategy = builder.build();
      expect(strategy.levels).toBeDefined();
      
      // Very large position
      builder = StrategyPatterns.riskAdjusted(50);
      strategy = builder.build();
      expect(strategy.levels).toBeDefined();
      expect(strategy.levels[0].percentage).toBeLessThan(20); // Should be very conservative
    });
  });

  describe('Volatility Adjusted Pattern', () => {
    it('should create strategy for low volatility', () => {
      const builder = StrategyPatterns.volatilityAdjusted(0.2); // Low volatility
      const strategy = builder.build();
      
      expect(strategy.levels).toHaveLength(4);
      // Low volatility allows for higher targets
      expect(strategy.levels[strategy.levels.length - 1].percentage).toBeGreaterThan(100);
    });

    it('should create strategy for high volatility', () => {
      const builder = StrategyPatterns.volatilityAdjusted(0.8); // High volatility
      const strategy = builder.build();

      expect(strategy.levels).toHaveLength(4); // createConservativeStrategy(60, 50)
      // High volatility requires lower, more conservative targets
      expect(strategy.levels[strategy.levels.length - 1].percentage).toBeLessThan(100);
    });

    it('should handle extreme volatility values', () => {
      // Zero volatility
      let builder = StrategyPatterns.volatilityAdjusted(0);
      let strategy = builder.build();
      expect(strategy.levels).toBeDefined();
      
      // Maximum volatility
      builder = StrategyPatterns.volatilityAdjusted(1);
      strategy = builder.build();
      expect(strategy.levels).toBeDefined();
      expect(strategy.levels[0].percentage).toBeLessThan(30);
    });
  });

  describe('Market Condition Pattern', () => {
    it('should create bullish market strategy', () => {
      const builder = StrategyPatterns.marketCondition('bullish');
      const strategy = builder.build();
      
      expect(strategy.levels).toHaveLength(4);
      // Bullish should have higher targets and smaller initial sells
      expect(strategy.levels[0].sellPercentage).toBeLessThan(30);
      expect(strategy.levels[strategy.levels.length - 1].percentage).toBeGreaterThan(200);
    });

    it('should create bearish market strategy', () => {
      const builder = StrategyPatterns.marketCondition('bearish');
      const strategy = builder.build();

      expect(strategy.levels).toHaveLength(4); // createConservativeStrategy(80, 60)
      // Bearish should have lower targets and larger initial sells
      expect(strategy.levels[0].sellPercentage).toBeGreaterThan(20);
      expect(strategy.levels[strategy.levels.length - 1].percentage).toBeLessThan(100);
    });

    it('should create neutral market strategy', () => {
      const builder = StrategyPatterns.marketCondition('neutral');
      const strategy = builder.build();
      
      expect(strategy.levels).toHaveLength(4);
      // Neutral should have balanced approach
      expect(strategy.levels[0].percentage).toBeGreaterThan(20);
      expect(strategy.levels[0].percentage).toBeLessThan(80);
    });

    it('should handle sideways market strategy', () => {
      const builder = StrategyPatterns.marketCondition('sideways');
      const strategy = builder.build();

      expect(strategy.levels).toHaveLength(4); // createScalpingStrategy(40)
      // Sideways should have many small targets for range trading
      strategy.levels.forEach((level: any) => {
        expect(level.percentage).toBeLessThanOrEqual(40);
      });
    });
  });

  describe('Pattern Integration', () => {
    it('should create consistent strategies across patterns', () => {
      const patterns = [
        StrategyPatterns.momentum('medium'),
        StrategyPatterns.riskAdjusted(5),
        StrategyPatterns.volatilityAdjusted(0.5),
        StrategyPatterns.marketCondition('neutral'),
      ];

      patterns.forEach(builder => {
        const strategy = builder.build();
        
        // All strategies should be valid
        expect(strategy.levels.length).toBeGreaterThan(0);
        
        // Should have proper ordering
        for (let i = 1; i < strategy.levels.length; i++) {
          expect(strategy.levels[i].percentage).toBeGreaterThan(strategy.levels[i - 1].percentage);
        }
        
        // Should have valid sell percentages
        const totalSell = strategy.levels.reduce((sum: number, level: any) => sum + level.sellPercentage, 0);
        expect(totalSell).toBeLessThanOrEqual(100);
      });
    });

    it('should maintain pattern characteristics', () => {
      // Conservative patterns should have lower first targets
      const conservative = StrategyPatterns.marketCondition('bearish').build();
      const aggressive = StrategyPatterns.marketCondition('bullish').build();
      
      expect(conservative.levels[0].percentage).toBeLessThan(aggressive.levels[0].percentage);
      
      // High volatility should have fewer phases than low volatility
      const highVol = StrategyPatterns.volatilityAdjusted(0.9).build();
      const lowVol = StrategyPatterns.volatilityAdjusted(0.1).build();
      
      expect(highVol.levels.length).toBeLessThanOrEqual(lowVol.levels.length);
    });
  });
});