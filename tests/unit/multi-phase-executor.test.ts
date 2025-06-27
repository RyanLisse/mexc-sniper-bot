import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MultiPhaseExecutor } from "@/src/services/trading/multi-phase-executor";
import type { TradingStrategyConfig } from "@/src/services/trading/multi-phase-trading-service";

describe('MultiPhaseExecutor', () => {
  let executor: MultiPhaseExecutor;
  const strategy: TradingStrategyConfig = {
    id: 'test-strategy',
    name: 'Test Strategy',
    description: 'Test multi-phase strategy',
    levels: [
      { percentage: 50, multiplier: 1.5, sellPercentage: 25 },
      { percentage: 100, multiplier: 2.0, sellPercentage: 25 },
      { percentage: 150, multiplier: 2.5, sellPercentage: 25 },
      { percentage: 200, multiplier: 3.0, sellPercentage: 25 },
    ],
  };
  const entryPrice = 100;
  const totalAmount = 1000;

  beforeEach(() => {
    executor = new MultiPhaseExecutor(strategy, entryPrice, totalAmount);
  });

  describe('Phase Execution Logic', () => {
    it('should identify phases to execute based on price', () => {
      const result = executor.executePhases(150); // 50% increase
      
      expect(result.phasesToExecute).toHaveLength(1);
      expect(result.phasesToExecute[0].phase).toBe(1);
      expect(result.phasesToExecute[0].amount).toBe(250); // 25% of 1000
      expect(result.phasesToExecute[0].targetPrice).toBe(150); // 100 * 1.5
    });

    it('should execute multiple phases when price hits multiple targets', () => {
      const result = executor.executePhases(200); // 100% increase
      
      expect(result.phasesToExecute).toHaveLength(2);
      expect(result.phasesToExecute[0].phase).toBe(1);
      expect(result.phasesToExecute[1].phase).toBe(2);
    });

    it('should not execute already completed phases', () => {
      // Record phase 1 as executed
      executor.recordPhaseExecution(1, 150, 250);
      
      const result = executor.executePhases(150);
      expect(result.phasesToExecute).toHaveLength(0);
    });

    it('should calculate urgency correctly', () => {
      const result = executor.executePhases(180); // 80% increase (30% overshoot of 50% target)
      
      expect(result.phasesToExecute).toHaveLength(1);
      expect(result.phasesToExecute[0].urgency).toBe('high'); // >20% overshoot
    });

    it('should limit phases per execution', () => {
      const result = executor.executePhases(400, { maxPhasesPerExecution: 2 }); // All phases triggered
      
      expect(result.phasesToExecute).toHaveLength(2); // Limited to 2
    });

    it('should sort phases by urgency', () => {
      const result = executor.executePhases(400); // All phases triggered
      
      // Should be sorted by urgency (high first)
      for (let i = 0; i < result.phasesToExecute.length - 1; i++) {
        const current = result.phasesToExecute[i];
        const next = result.phasesToExecute[i + 1];
        
        const urgencyOrder = { high: 3, medium: 2, low: 1 };
        expect(urgencyOrder[current.urgency]).toBeGreaterThanOrEqual(urgencyOrder[next.urgency]);
      }
    });
  });

  describe('Phase Recording', () => {
    it('should record phase execution correctly', async () => {
      await executor.recordPhaseExecution(1, 150, 250, {
        fees: 1.5,
        slippage: 0.1,
        latency: 100,
      });

      const analytics = executor.getExecutionAnalytics();
      expect(analytics.totalExecutions).toBe(1);
      expect(analytics.avgExecutionTime).toBe(100);
      expect(analytics.totalProfitRealized).toBe(250 * (150 - 100) - 1.5);
    });

    it('should handle phase recording without optional parameters', async () => {
      await executor.recordPhaseExecution(1, 150, 250);

      const analytics = executor.getExecutionAnalytics();
      expect(analytics.totalExecutions).toBe(1);
      expect(analytics.totalProfitRealized).toBe(250 * (150 - 100));
    });

    it('should update executed phases set', async () => {
      await executor.recordPhaseExecution(1, 150, 250);
      
      const status = executor.getPhaseStatus();
      expect(status.completedPhases).toBe(1);
      expect(status.phaseDetails[0].status).toBe('completed');
    });

    it('should persist execution history', async () => {
      await executor.recordPhaseExecution(1, 150, 250);
      await executor.recordPhaseExecution(2, 200, 250);

      const analytics = executor.getExecutionAnalytics();
      expect(analytics.totalExecutions).toBe(2);
    });
  });

  describe('Phase Status Tracking', () => {
    it('should return correct phase status', () => {
      const status = executor.getPhaseStatus();
      
      expect(status.totalPhases).toBe(4);
      expect(status.completedPhases).toBe(0);
      expect(status.pendingPhases).toBe(4);
      expect(status.phaseDetails).toHaveLength(4);
      expect(status.nextPhase?.phase).toBe(1);
    });

    it('should update status after phase execution', async () => {
      await executor.recordPhaseExecution(1, 150, 250);
      
      const status = executor.getPhaseStatus();
      expect(status.completedPhases).toBe(1);
      expect(status.pendingPhases).toBe(3);
      expect(status.phaseDetails[0].status).toBe('completed');
      expect(status.nextPhase?.phase).toBe(2);
    });

    it('should show no next phase when all phases are complete', async () => {
      // Complete all phases
      for (let i = 1; i <= 4; i++) {
        await executor.recordPhaseExecution(i, 100 + i * 50, 250);
      }
      
      const status = executor.getPhaseStatus();
      expect(status.completedPhases).toBe(4);
      expect(status.nextPhase).toBeNull();
    });
  });

  describe('Summary Calculations', () => {
    it('should calculate execution summary correctly', () => {
      const summary = executor.calculateSummary(120);
      
      expect(summary.totalSold).toBe(0); // No phases executed
      expect(summary.totalRemaining).toBe(1000);
      expect(summary.realizedProfit).toBe(0);
      expect(summary.unrealizedProfit).toBe(1000 * (120 - 100)); // 20,000
      expect(summary.completedPhases).toBe(0);
      expect(summary.nextPhaseTarget).toBe(150); // First phase target
    });

    it('should update summary after phase execution', async () => {
      await executor.recordPhaseExecution(1, 150, 250);
      
      const summary = executor.calculateSummary(150);
      expect(summary.totalSold).toBe(250);
      expect(summary.totalRemaining).toBe(750);
      expect(summary.realizedProfit).toBeGreaterThan(0);
      expect(summary.completedPhases).toBe(1);
      expect(summary.nextPhaseTarget).toBe(200); // Second phase target
    });

    it('should calculate fees correctly', async () => {
      await executor.recordPhaseExecution(1, 150, 250, { fees: 5.0 });
      
      const summary = executor.calculateSummary(150);
      expect(summary.totalFees).toBeGreaterThan(0);
    });

    it('should calculate execution efficiency', async () => {
      await executor.recordPhaseExecution(1, 145, 250); // Slightly below target
      
      const summary = executor.calculateSummary(150);
      expect(summary.executionEfficiency).toBeLessThan(100);
      expect(summary.executionEfficiency).toBeGreaterThan(90);
    });
  });

  describe('Phase Visualization', () => {
    it('should generate correct phase visualization', async () => {
      // Execute some phases to test visualization
      await executor.recordPhaseExecution(1, 150, 250);
      await executor.recordPhaseExecution(2, 200, 250);

      const visualization = executor.getPhaseVisualization(250); // 150% price increase
      
      expect(visualization).toBeDefined();
      expect(typeof visualization).toBe('string');
      expect(visualization.length).toBeGreaterThan(0);
      // Check for basic visualization structure
      expect(visualization).toMatch(/Phase|phase/i);
    });

    it('should show completed phases correctly', async () => {
      // Execute first two phases
      await executor.recordPhaseExecution(1, 150, 250);
      await executor.recordPhaseExecution(2, 200, 250);

      const completedVisualization = executor.getPhaseVisualization(250);
      
      expect(completedVisualization).toBeDefined();
      expect(typeof completedVisualization).toBe('string');
      expect(completedVisualization.length).toBeGreaterThan(0);
      // Should contain information about completed phases
      expect(completedVisualization).toMatch(/1|2/);
    });

    it('should generate visualization with percentage', async () => {
      // Execute one phase
      await executor.recordPhaseExecution(1, 150, 250);

      const percentageVisualization = executor.getPhaseVisualizationWithPercentage(50); // 50% price increase
      
      expect(percentageVisualization).toBeDefined();
      expect(typeof percentageVisualization).toBe('string');
      expect(percentageVisualization.length).toBeGreaterThan(0);
      // Should contain percentage information
      expect(percentageVisualization).toMatch(/%|percent/i);
    });
  });

  describe('Execution Analytics', () => {
    it('should return empty analytics when no executions', () => {
      const analytics = executor.getExecutionAnalytics();
      
      expect(analytics).toBeDefined();
      expect(analytics.totalExecutions).toBe(0);
      expect(analytics.successRate).toBe(0);
      expect(analytics.avgExecutionTime).toBe(0);
      expect(analytics.avgSlippage).toBe(0);
      expect(analytics.totalProfitRealized).toBe(0);
      expect(analytics.bestExecution).toBeNull();
      expect(analytics.worstExecution).toBeNull();
      expect(analytics.executionTrend).toBe('stable');
    });

    it('should calculate analytics correctly after executions', async () => {
      // Execute several phases using recordPhaseExecution
      await executor.recordPhaseExecution(1, 150, 250, { latency: 50 });
      await executor.recordPhaseExecution(2, 200, 250, { latency: 60 });
      await executor.recordPhaseExecution(3, 300, 250, { latency: 70 });

      const analytics = executor.getExecutionAnalytics();
      
      expect(analytics.totalExecutions).toBe(3);
      expect(analytics.successRate).toBeGreaterThan(0);
      expect(analytics.avgExecutionTime).toBeGreaterThan(0);
      expect(analytics.totalProfitRealized).toBeGreaterThan(0);
      expect(analytics.bestExecution).toBeDefined();
      expect(analytics.worstExecution).toBeDefined();
      expect(analytics.executionTrend).toMatch(/improving|stable|declining/);
    });

    it('should determine execution trend', async () => {
      // Execute phases multiple times to establish trend
      for (let i = 1; i <= 4; i++) {
        await executor.recordPhaseExecution(i, 100 + i * 50, 250, { latency: 40 + i * 10 });
      }

      const analytics = executor.getExecutionAnalytics();
      
      expect(analytics).toBeDefined();
      expect(analytics.totalExecutions).toBe(4);
      expect(typeof analytics.avgExecutionTime).toBe('number');
      expect(analytics.avgExecutionTime).toBeGreaterThan(0);
      expect(analytics.successRate).toBeGreaterThanOrEqual(0);
      expect(analytics.successRate).toBeLessThanOrEqual(100);
      expect(analytics.executionTrend).toBeDefined();
      expect(analytics.executionTrend).toMatch(/improving|stable|declining/);
    });
  });

  describe('State Management', () => {
    it('should export state correctly', async () => {
      await executor.recordPhaseExecution(1, 150, 250);
      
      const state = executor.exportState();
      
      expect(state.executedPhases).toEqual([1]);
      expect(state.phaseHistory).toHaveLength(1);
      expect(state.strategy).toEqual(strategy);
      expect(state.entryPrice).toBe(entryPrice);
      expect(state.totalAmount).toBe(totalAmount);
    });

    it('should import state correctly', async () => {
      const state = {
        executedPhases: [1, 2],
        phaseHistory: [
          { phase: 1, price: 150, amount: 250, profit: 12500, timestamp: new Date() },
          { phase: 2, price: 200, amount: 250, profit: 25000, timestamp: new Date() },
        ],
      };

      executor.importState(state);
      
      const status = executor.getPhaseStatus();
      expect(status.completedPhases).toBe(2);
      
      const analytics = executor.getExecutionAnalytics();
      expect(analytics.totalExecutions).toBe(2);
    });

    it('should reset state correctly', async () => {
      await executor.recordPhaseExecution(1, 150, 250);
      executor.reset();
      
      const status = executor.getPhaseStatus();
      expect(status.completedPhases).toBe(0);
      
      const analytics = executor.getExecutionAnalytics();
      expect(analytics.totalExecutions).toBe(0);
    });
  });

  describe('Utility Methods', () => {
    it('should check completion status correctly', async () => {
      expect(executor.isComplete()).toBe(false);
      
      // Complete all phases
      for (let i = 1; i <= 4; i++) {
        await executor.recordPhaseExecution(i, 100 + i * 50, 250);
      }
      
      expect(executor.isComplete()).toBe(true);
    });

    it('should return remaining phases correctly', async () => {
      let remaining = executor.getRemainingPhases();
      expect(remaining).toEqual([1, 2, 3, 4]);
      
      await executor.recordPhaseExecution(1, 150, 250);
      await executor.recordPhaseExecution(3, 250, 250);
      
      remaining = executor.getRemainingPhases();
      expect(remaining).toEqual([2, 4]);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle price at exactly the target', () => {
      const result = executor.executePhases(150); // Exactly 50% increase
      
      expect(result.phasesToExecute).toHaveLength(1);
      expect(result.phasesToExecute[0].phase).toBe(1);
    });

    it('should handle very small price movements', () => {
      const result = executor.executePhases(100.01); // Tiny increase
      
      expect(result.phasesToExecute).toHaveLength(0);
    });

    it('should handle price below entry', () => {
      const result = executor.executePhases(80); // 20% loss
      
      expect(result.phasesToExecute).toHaveLength(0);
      expect(result.summary.unrealizedProfit).toBeLessThan(0);
    });

    it('should handle zero amounts gracefully', () => {
      const zeroAmountExecutor = new MultiPhaseExecutor(strategy, entryPrice, 0);
      
      const result = zeroAmountExecutor.executePhases(150);
      expect(result.phasesToExecute).toHaveLength(1);
      expect(result.phasesToExecute[0].amount).toBe(0);
    });

    it('should handle missing optional parameters', async () => {
      // Should not throw when called with minimal parameters
      await expect(executor.recordPhaseExecution(1, 150, 250)).resolves.toBeUndefined();
    });
  });

  describe('Constructor Options', () => {
    it('should initialize with existing execution state', () => {
      const options = {
        executedPhases: [1, 2],
        existingHistory: [
          { phase: 1, price: 150, amount: 250, profit: 12500, timestamp: new Date() },
          { phase: 2, price: 200, amount: 250, profit: 25000, timestamp: new Date() },
        ],
      };

      const executorWithState = new MultiPhaseExecutor(strategy, entryPrice, totalAmount, options);
      
      const status = executorWithState.getPhaseStatus();
      expect(status.completedPhases).toBe(2);
    });

    it('should handle strategyId and userId for database persistence', () => {
      const options = {
        strategyId: 123,
        userId: 'user-456',
      };

      const executorWithDb = new MultiPhaseExecutor(strategy, entryPrice, totalAmount, options);
      
      // Should not throw during construction
      expect(executorWithDb).toBeDefined();
    });
  });
});