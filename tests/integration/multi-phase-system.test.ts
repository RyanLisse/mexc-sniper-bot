import { describe, it, expect } from 'vitest';
import { MultiPhaseTradingBot } from "@/src/services/trading/multi-phase-trading-bot";
import { MultiPhaseExecutor } from "@/src/services/trading/multi-phase-executor";
import { MultiPhaseStrategyBuilder } from "@/src/services/trading/multi-phase-strategy-builder";
import { TRADING_STRATEGIES } from "@/src/services/trading/trading-strategy-manager";

describe('Multi-Phase Trading System Core Integration', () => {
  describe('Component Integration', () => {
    it('should integrate MultiPhaseStrategyBuilder with MultiPhaseTradingBot', () => {
      // Create a strategy using the builder
      const strategy = new MultiPhaseStrategyBuilder('test-integration', 'Integration Test Strategy')
        .addPhase(25, 30)
        .addPhase(50, 40)
        .addPhase(75, 30)
        .withDescription('Integration test strategy')
        .build();

      // Convert to trading strategy format for bot
      const tradingStrategy = {
        id: strategy.id,
        name: strategy.name,
        description: strategy.description,
        levels: strategy.levels,
      };

      // Create bot with custom strategy
      const bot = new MultiPhaseTradingBot(tradingStrategy, 100, 1000);

      // Test bot functionality
      const result = bot.onPriceUpdate(130); // 30% increase
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0]).toContain('Phase 1');

      const status = bot.getStatus();
      expect(status.entryPrice).toBe(100);
      expect(status.position).toBe(1000);
    });

    it('should work with predefined strategies', () => {
      // Test with conservative strategy
      const conservativeBot = new MultiPhaseTradingBot(
        TRADING_STRATEGIES.conservative,
        100,
        1000
      );

      const result = conservativeBot.onPriceUpdate(115); // 15% increase
      expect(result.actions).toHaveLength(1);
      expect(result.status.summary.completedPhases).toBe(1);

      // Test performance summary
      const performance = conservativeBot.getPerformanceSummary(115);
      expect(performance.totalPnL).toBeGreaterThan(0);
      expect(performance.efficiency).toBeGreaterThanOrEqual(0);
    });

    it('should handle risk metrics calculations', () => {
      const bot = new MultiPhaseTradingBot(TRADING_STRATEGIES.normal, 100, 1000);

      // Test profit scenario
      const profitMetrics = bot.getRiskMetrics(120);
      expect(profitMetrics.currentDrawdown).toBe(0);
      expect(profitMetrics.riskRewardRatio).toBeGreaterThan(0);

      // Test loss scenario
      const lossMetrics = bot.getRiskMetrics(80);
      expect(lossMetrics.currentDrawdown).toBe(20);
      expect(lossMetrics.positionRisk).toBe(20);
    });

    it('should integrate position management and performance analytics', () => {
      const bot = new MultiPhaseTradingBot(TRADING_STRATEGIES.normal, 100, 1000);

      // Initialize position
      const initResult = bot.initializePosition('TESTUSDT', 100, 1000);
      expect(initResult.success).toBe(true);
      expect(initResult.details.symbol).toBe('TESTUSDT');

      // Get position info
      const positionInfo = bot.getPositionInfo();
      expect(positionInfo.hasPosition).toBe(true);
      expect(positionInfo.symbol).toBe('TESTUSDT');

      // Test efficiency metrics
      const efficiency = bot.getExecutionEfficiency();
      expect(efficiency.successRate).toBeGreaterThanOrEqual(0);
      expect(efficiency.costEfficiency).toBeGreaterThanOrEqual(0);
    });
  });

  describe('State Management Integration', () => {
    it('should maintain state consistency across components', () => {
      const bot = new MultiPhaseTradingBot(TRADING_STRATEGIES.normal, 100, 1000);

      // Execute some phases
      bot.onPriceUpdate(150); // Should execute phase 1
      bot.onPriceUpdate(200); // Should execute phase 2

      // Export state
      const state = bot.exportState();
      expect(state.entryPrice).toBe(100);
      expect(state.position).toBe(1000);
      expect(state.executorState).toBeDefined();

      // Create new bot and import state
      const newBot = new MultiPhaseTradingBot(TRADING_STRATEGIES.normal, 50, 500);
      newBot.importState(state);

      const newStatus = newBot.getStatus();
      expect(newStatus.entryPrice).toBe(100);
      expect(newStatus.position).toBe(1000);
      expect(newStatus.completionPercentage).toBeGreaterThan(0);
    });
  });

  describe('Price Movement Simulation', () => {
    it('should simulate complex price movements correctly', () => {
      const bot = new MultiPhaseTradingBot(TRADING_STRATEGIES.normal, 100, 1000);

      const priceMovements = [
        { price: 110, description: 'Small pump +10%' },
        { price: 150, description: 'First target hit +50%' },
        { price: 200, description: 'Second target hit +100%' },
        { price: 180, description: 'Pullback -10%' },
        { price: 275, description: 'Rally to third target +175%' },
      ];

      const results = bot.simulatePriceMovements(priceMovements);

      expect(results).toHaveLength(5);
      expect(results[0].actions).toHaveLength(0); // No execution at 10%
      expect(results[1].actions).toHaveLength(1); // Execute phase 1 at 50%
      expect(results[2].actions).toHaveLength(1); // Execute phase 2 at 100%
      expect(results[3].actions).toHaveLength(0); // No new execution on pullback
      expect(results[4].actions).toHaveLength(2); // Execute phases 3 and 4 at 175%

      // Performance should improve with each execution
      expect(results[4].performance.totalPnL).toBeGreaterThan(results[1].performance.totalPnL);
    });
  });

  describe('Advanced Bot Features', () => {
    it('should work with multiple strategy configurations', () => {
      const strategies = {
        conservative: TRADING_STRATEGIES.conservative,
        normal: TRADING_STRATEGIES.normal,
        aggressive: TRADING_STRATEGIES.highPriceIncrease,
      };

      const advancedBot = new (require('@/src/services/trading/multi-phase-trading-bot').AdvancedMultiPhaseTradingBot)(
        strategies,
        'normal',
        100,
        1000
      );

      // Test initial strategy
      expect(advancedBot.getCurrentStrategy().id).toBe('normal');

      // Test strategy switching
      const switchSuccess = advancedBot.switchStrategy('conservative');
      expect(switchSuccess).toBe(true);
      expect(advancedBot.getCurrentStrategy().id).toBe('conservative');

      // Test failed switch
      const failedSwitch = advancedBot.switchStrategy('nonexistent');
      expect(failedSwitch).toBe(false);
      expect(advancedBot.getCurrentStrategy().id).toBe('conservative');

      // Test available strategies
      const availableStrategies = advancedBot.listStrategies();
      expect(availableStrategies).toContain('conservative');
      expect(availableStrategies).toContain('normal');
      expect(availableStrategies).toContain('aggressive');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid market conditions gracefully', () => {
      const bot = new MultiPhaseTradingBot(TRADING_STRATEGIES.normal, 100, 1000);

      // Test with extreme market conditions
      const extremeConditions = {
        volatility: 0.95,
        volume: 0.1,
        momentum: -0.8,
        support: 80,
        resistance: 120,
      };

      const optimalEntry = bot.calculateOptimalEntry('TESTUSDT', extremeConditions);
      expect(optimalEntry.entryPrice).toBeGreaterThan(0);
      expect(optimalEntry.confidence).toBeGreaterThanOrEqual(30);
      expect(optimalEntry.confidence).toBeLessThanOrEqual(95);
      expect(optimalEntry.adjustments).toBeDefined();
    });

    it('should handle position initialization edge cases', () => {
      const bot = new MultiPhaseTradingBot(TRADING_STRATEGIES.normal, 100, 1000);

      // Test invalid inputs
      const invalidResult = bot.initializePosition('', 0, 0);
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.message).toContain('Failed');

      // Test valid inputs
      const validResult = bot.initializePosition('VALIDUSDT', 100, 1000);
      expect(validResult.success).toBe(true);
      expect(validResult.details.symbol).toBe('VALIDUSDT');
    });
  });

  describe('Performance and Maintenance', () => {
    it('should perform maintenance operations correctly', () => {
      const bot = new MultiPhaseTradingBot(TRADING_STRATEGIES.normal, 100, 1000);

      // Generate some history first
      bot.onPriceUpdate(150);
      bot.onPriceUpdate(200);

      // Perform maintenance
      const maintenanceResult = bot.performMaintenanceCleanup();
      expect(maintenanceResult.success).toBe(true);
      expect(maintenanceResult.operations).toBeDefined();
      expect(Array.isArray(maintenanceResult.operations)).toBe(true);

      // Check pending operations
      const pendingOps = bot.getPendingPersistenceOperations();
      expect(pendingOps.hasPending).toBeDefined();
      expect(Array.isArray(pendingOps.operations)).toBe(true);
    });
  });
});