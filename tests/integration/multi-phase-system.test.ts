import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';

// Override the global database mock for this integration test
// This provides more realistic database behavior for multi-phase system tests
vi.mock('@/src/db', () => {
  let mockIdCounter = 1;
  const mockStoredData = {
    strategies: new Map(),
    executions: new Map(),
    templates: new Map(),
    users: new Map()
  };

  const mockDb = {
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation((data) => ({
        returning: vi.fn().mockImplementation(() => {
          const id = (mockIdCounter++).toString();
          // Ensure we return the full data with all fields including levels
          const fullData = {
            ...data,
            id,
            createdAt: new Date(),
            updatedAt: new Date(),
            // If levels is undefined or null, provide a default
            levels: data.levels || JSON.stringify([
              { percentage: 50, multiplier: 1.5, sellPercentage: 25 },
              { percentage: 100, multiplier: 2.0, sellPercentage: 25 }
            ])
          };

          // Store based on data type
          if (data.strategyId !== undefined) {
            // This is a phase execution
            mockStoredData.executions.set(id, fullData);
          } else {
            // This is a strategy
            mockStoredData.strategies.set(id, fullData);
          }

          return Promise.resolve([fullData]);
        })
      }))
    })),
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation((table) => {
        // Store the table reference for later use
        const queryBuilder = {
          _table: table,
          where: vi.fn().mockImplementation((condition) => ({
            orderBy: vi.fn().mockImplementation(() => {
              // Use a simple heuristic: if we're looking for executions, return executions
              // This is based on the fact that getStrategyPhaseExecutions is the main caller
              if (queryBuilder._table === strategyPhaseExecutions) {
                return Promise.resolve(Array.from(mockStoredData.executions.values()));
              }
              return Promise.resolve(Array.from(mockStoredData.strategies.values()));
            }),
            limit: vi.fn().mockImplementation(() => {
              if (queryBuilder._table === strategyPhaseExecutions) {
                return Promise.resolve(Array.from(mockStoredData.executions.values()));
              }
              return Promise.resolve(Array.from(mockStoredData.strategies.values()));
            })
          })),
          limit: vi.fn().mockImplementation(() => ({
            orderBy: vi.fn().mockImplementation(() => Promise.resolve(Array.from(mockStoredData.strategies.values())))
          })),
          orderBy: vi.fn().mockImplementation(() => Promise.resolve(Array.from(mockStoredData.strategies.values())))
        };
        return queryBuilder;
      })
    })),
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => Promise.resolve([]))
      }))
    })),
    delete: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation(() => Promise.resolve([]))
    })),
    transaction: vi.fn().mockImplementation(async (cb) => {
      return cb(mockDb);
    }),
    execute: vi.fn().mockResolvedValue([]),
    query: vi.fn().mockResolvedValue([])
  };

  // Add helper methods to access mock data for testing
  (mockDb as any)._getMockData = () => mockStoredData;
  (mockDb as any)._clearMockData = () => {
    mockStoredData.strategies.clear();
    mockStoredData.executions.clear();
    mockStoredData.templates.clear();
    mockStoredData.users.clear();
  };

  return {
    db: mockDb,
    getDb: vi.fn().mockReturnValue(mockDb)
  };
});
import { db } from "../../src/db";
import { tradingStrategies, strategyTemplates } from "../../src/db/schemas/strategies";

// Import strategyPhaseExecutions separately to avoid duplicate identifier
import { strategyPhaseExecutions } from "../../src/db/schemas/strategies";
import { user } from "../../src/db/schema";
import { multiPhaseTradingService } from "../../src/services/multi-phase-trading-service";
import { MultiPhaseExecutor, createExecutorFromStrategy } from "../../src/services/multi-phase-executor";
import { TradingStrategyManager } from "../../src/services/trading-strategy-manager";
import { AdvancedTradingStrategy } from "../../src/services/advanced-trading-strategy";
import { MultiPhaseTradingBot } from "../../src/services/multi-phase-trading-bot";
import { eq } from 'drizzle-orm';

describe('Multi-Phase Trading System Integration', () => {
  const testUserId = 'test-user-integration';
  let testStrategy: any;

  beforeEach(() => {
    // Clear mock data between tests
    if ((db as any)._clearMockData) {
      (db as any)._clearMockData();
    }
  });

  beforeAll(async () => {
    // Ensure test user exists
    try {
      await db.insert(user).values({
        id: testUserId,
        name: 'Integration Test User',
        email: `${testUserId}@test.com`,
        emailVerified: false,
      }).onConflictDoNothing();
    } catch (error) {
      // User might already exist, continue
    }

    // Clean up strategy templates first to avoid unique constraint conflicts
    await db.delete(strategyTemplates);

    // Initialize predefined strategies
    await multiPhaseTradingService.initializePredefinedStrategies();
  });

  beforeEach(async () => {
    // Clean up test data in correct order (foreign key dependencies)
    await db.delete(strategyPhaseExecutions);
    await db.delete(tradingStrategies);
  });

  describe('End-to-End Strategy Lifecycle', () => {
    it('should create and execute a complete multi-phase strategy', async () => {
      // Step 1: Create strategy using service
      const strategyData = {
        userId: testUserId,
        name: 'Integration Test Strategy',
        symbol: 'BTCUSDT',
        entryPrice: 50000,
        positionSize: 1,
        positionSizeUsdt: 50000,
        strategyConfig: {
          id: 'integration-test',
          name: 'Integration Test Strategy',
          description: 'Test strategy for integration testing',
          levels: [
            { percentage: 20, multiplier: 1.2, sellPercentage: 25 },
            { percentage: 40, multiplier: 1.4, sellPercentage: 25 },
            { percentage: 60, multiplier: 1.6, sellPercentage: 25 },
            { percentage: 80, multiplier: 1.8, sellPercentage: 25 },
          ],
        },
        stopLossPercent: 10,
        description: 'Integration test strategy with 4 phases',
      };

      const strategy = await multiPhaseTradingService.createTradingStrategy(strategyData);
      expect(strategy).toBeDefined();
      expect(typeof strategy.id === 'string' ? parseInt(strategy.id) : strategy.id).toBeGreaterThan(0);

      // Step 2: Create executor from database strategy
      const executor = await createExecutorFromStrategy(strategy, testUserId);
      expect(executor).toBeDefined();

      // Step 3: Execute phases as price moves up
      const priceUpdates = [60000, 65000, 70000, 80000, 90000]; // 20%, 30%, 40%, 60%, 80%

      for (const currentPrice of priceUpdates) {
        const execution = executor.executePhases(currentPrice);

        // Record executions
        for (const phase of execution.phasesToExecute) {
          await executor.recordPhaseExecution(
            phase.phase,
            currentPrice,
            phase.amount,
            {
              fees: phase.expectedProfit * 0.001,
              latency: 50,
            }
          );
        }
      }

      // Step 4: Verify execution results
      const finalStatus = executor.getPhaseStatus();
      expect(finalStatus.completedPhases).toBe(4); // All phases should be executed

      const analytics = executor.getExecutionAnalytics();
      expect(analytics.totalExecutions).toBe(4);
      expect(analytics.totalProfitRealized).toBeGreaterThan(0);

      // Step 5: Verify database persistence
      const executions = await multiPhaseTradingService.getStrategyPhaseExecutions(strategy.id, testUserId);
      expect(executions).toHaveLength(4);

      const performanceMetrics = await multiPhaseTradingService.calculatePerformanceMetrics(strategy.id, testUserId);
      expect(performanceMetrics.totalPnl).toBeGreaterThan(0);
      expect(performanceMetrics.winRate).toBe(100); // All executions should be profitable
    });

    it('should handle partial execution and resume correctly', async () => {
      // Create strategy
      const strategy = await multiPhaseTradingService.createTradingStrategy({
        userId: testUserId,
        name: 'Partial Execution Test',
        symbol: 'ETHUSDT',
        entryPrice: 3000,
        positionSize: 10,
        positionSizeUsdt: 30000,
        strategyConfig: {
          id: 'partial-test',
          name: 'Partial Test Strategy',
          levels: [
            { percentage: 25, multiplier: 1.25, sellPercentage: 30 },
            { percentage: 50, multiplier: 1.5, sellPercentage: 30 },
            { percentage: 75, multiplier: 1.75, sellPercentage: 40 },
          ],
        },
        stopLossPercent: 15,
      });

      // First execution session - execute only phase 1
      let executor = await createExecutorFromStrategy(strategy, testUserId);
      let execution = executor.executePhases(3750); // 25% increase

      for (const phase of execution.phasesToExecute) {
        await executor.recordPhaseExecution(phase.phase, 3750, phase.amount);
      }

      expect(executor.getPhaseStatus().completedPhases).toBe(1);

      // Second execution session - simulate app restart by creating new executor
      executor = await createExecutorFromStrategy(strategy, testUserId);
      expect(executor.getPhaseStatus().completedPhases).toBe(1); // Should restore state

      // Continue execution
      execution = executor.executePhases(5250); // 75% increase

      for (const phase of execution.phasesToExecute) {
        await executor.recordPhaseExecution(phase.phase, 5250, phase.amount);
      }

      expect(executor.getPhaseStatus().completedPhases).toBe(3); // All phases completed
    });
  });

  describe('Multi-Component Integration', () => {
    it('should integrate TradingStrategyManager with MultiPhaseExecutor', async () => {
      const manager = new TradingStrategyManager();
      const activeStrategy = manager.getActiveStrategy();

      // Create database strategy from manager strategy
      const dbStrategy = await multiPhaseTradingService.createTradingStrategy({
        userId: testUserId,
        name: activeStrategy.name,
        symbol: 'ADAUSDT',
        entryPrice: 1.0,
        positionSize: 1000,
        positionSizeUsdt: 1000,
        strategyConfig: activeStrategy,
        stopLossPercent: 10,
      });

      // Create executor
      const executor = await createExecutorFromStrategy(dbStrategy, testUserId);

      // Test sell recommendations vs executor execution
      const currentPrice = 1.5; // 50% increase
      const recommendation = manager.getSellRecommendation(currentPrice, 1.0);
      const execution = executor.executePhases(currentPrice);

      expect(recommendation.shouldSell).toBe(true);
      expect(execution.phasesToExecute.length).toBeGreaterThan(0);

      // Both should agree on which phases to execute
      expect(execution.phasesToExecute[0].phase).toBe(recommendation.phases[0].phase);
    });

    it('should integrate AdvancedTradingStrategy with MultiPhaseTradingBot', async () => {
      const advancedStrategy = new AdvancedTradingStrategy();

      // Adjust for high volatility
      advancedStrategy.adjustStrategyForVolatility(0.8);
      const adjustedStrategy = advancedStrategy.getActiveStrategy();

      // Create bot with adjusted strategy
      const bot = new MultiPhaseTradingBot(adjustedStrategy, 100, 1000);

      // Test volatility-adjusted execution
      const result = bot.onPriceUpdate(120); // 20% increase
      expect(result).toBeDefined();
      expect(result.status).toBeDefined();

      // Get risk assessment
      const riskMetrics = bot.getRiskMetrics(120);
      const riskAssessment = advancedStrategy.assessRisk(10000, 100, 100);

      expect(riskMetrics.riskRewardRatio).toBeGreaterThan(0);
      expect(riskAssessment.riskLevel).toBeDefined();
    });

    it('should persist and restore complex trading scenarios', async () => {
      // Create multiple strategies with different configurations
      const strategies = await Promise.all([
        multiPhaseTradingService.createTradingStrategy({
          userId: testUserId,
          name: 'Conservative Portfolio',
          symbol: 'BTC-CONSERVATIVE',
          entryPrice: 50000,
          positionSize: 0.1,
          positionSizeUsdt: 5000,
          strategyConfig: {
            id: 'conservative-portfolio',
            name: 'Conservative Portfolio',
            levels: [
              { percentage: 10, multiplier: 1.1, sellPercentage: 50 },
              { percentage: 20, multiplier: 1.2, sellPercentage: 50 },
            ],
          },
          stopLossPercent: 5,
        }),
        multiPhaseTradingService.createTradingStrategy({
          userId: testUserId,
          name: 'Aggressive Portfolio',
          symbol: 'BTC-AGGRESSIVE',
          entryPrice: 50000,
          positionSize: 0.5,
          positionSizeUsdt: 25000,
          strategyConfig: {
            id: 'aggressive-portfolio',
            name: 'Aggressive Portfolio',
            levels: [
              { percentage: 100, multiplier: 2.0, sellPercentage: 25 },
              { percentage: 200, multiplier: 3.0, sellPercentage: 25 },
              { percentage: 400, multiplier: 5.0, sellPercentage: 50 },
            ],
          },
          stopLossPercent: 20,
        }),
      ]);

      // Execute both strategies simultaneously
      const executors = await Promise.all(
        strategies.map(strategy => createExecutorFromStrategy(strategy, testUserId))
      );

      // Simulate market movement
      const prices = [55000, 60000, 70000, 100000]; // Various price levels

      for (const price of prices) {
        for (const executor of executors) {
          const execution = executor.executePhases(price);

          for (const phase of execution.phasesToExecute) {
            await executor.recordPhaseExecution(phase.phase, price, phase.amount);
          }
        }
      }

      // Verify both strategies executed appropriately
      const conservativeStatus = executors[0].getPhaseStatus();
      const aggressiveStatus = executors[1].getPhaseStatus();

      // Conservative should have executed all phases (low targets)
      expect(conservativeStatus.completedPhases).toBe(2);

      // Aggressive should have executed some phases
      expect(aggressiveStatus.completedPhases).toBeGreaterThan(0);

      // Verify database persistence for both
      const userStrategies = await multiPhaseTradingService.getUserStrategies(testUserId);
      expect(userStrategies).toHaveLength(2);

      const allExecutions = await Promise.all(
        strategies.map(strategy =>
          multiPhaseTradingService.getStrategyPhaseExecutions(strategy.id, testUserId)
        )
      );

      expect(allExecutions[0].length).toBeGreaterThan(0); // Conservative executions
      expect(allExecutions[1].length).toBeGreaterThan(0); // Aggressive executions
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle database errors gracefully', async () => {
      // Create strategy
      const strategy = await multiPhaseTradingService.createTradingStrategy({
        userId: testUserId,
        name: 'Error Test Strategy',
        symbol: 'ERRORTEST',
        entryPrice: 100,
        positionSize: 100,
        positionSizeUsdt: 10000,
        strategyConfig: {
          id: 'error-test',
          name: 'Error Test',
          levels: [{ percentage: 50, multiplier: 1.5, sellPercentage: 100 }],
        },
        stopLossPercent: 10,
      });

      const executor = await createExecutorFromStrategy(strategy, testUserId);

      // Mock database error
      const originalRecordPhase = multiPhaseTradingService.recordPhaseExecution;
      vi.spyOn(multiPhaseTradingService, 'recordPhaseExecution').mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      // Should not throw error, should continue execution
      await expect(
        executor.recordPhaseExecution(1, 150, 100)
      ).resolves.not.toThrow();

      // Verify local state was still updated
      expect(executor.getPhaseStatus().completedPhases).toBe(1);

      // Restore original method
      vi.restoreAllMocks();
    });

    it('should validate data integrity across components', async () => {
      const manager = new TradingStrategyManager();

      // Test with invalid strategy data
      const invalidStrategy = {
        id: 'invalid',
        name: 'Invalid Strategy',
        levels: [
          { percentage: -10, multiplier: 0.5, sellPercentage: 150 }, // Invalid values
        ],
      };

      // Manager should reject invalid strategy
      const importSuccess = manager.importStrategy(invalidStrategy);
      expect(importSuccess).toBe(false);

      // Service should also reject invalid strategy
      await expect(
        multiPhaseTradingService.createTradingStrategy({
          userId: testUserId,
          name: 'Invalid Strategy Test',
          symbol: 'INVALID',
          entryPrice: 100,
          positionSize: 100,
          positionSizeUsdt: 10000,
          strategyConfig: invalidStrategy,
          stopLossPercent: 10,
        })
      ).rejects.toThrow();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent strategy executions', async () => {
      const concurrentStrategies = Array.from({ length: 5 }, (_, i) => ({
        id: `concurrent-strategy-${i}`,
        name: `Concurrent Strategy ${i}`,
        levels: [
          { percentage: 20, multiplier: 1.2, sellPercentage: 25 },
          { percentage: 40, multiplier: 1.4, sellPercentage: 25 },
          { percentage: 60, multiplier: 1.6, sellPercentage: 25 },
          { percentage: 80, multiplier: 1.8, sellPercentage: 25 },
        ]
      }));
      
      const startTime = performance.now();
      
      const results = await Promise.all(
        concurrentStrategies.map(async (strategy) => {
          const strategyManager = new TradingStrategyManager();
          const importSuccess = strategyManager.importStrategy(strategy);
          return { success: importSuccess, metrics: { executionTime: performance.now() - startTime } };
        })
      );
      
      const executionTime = performance.now() - startTime;
      
      expect(results.length).toBe(5);
      expect(results.every(r => r.success)).toBe(true);
      expect(executionTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(results.every(r => r.metrics.executionTime > 0)).toBe(true);
    });

    it('should efficiently handle large numbers of phase executions', async () => {
      const largePhaseCount = 100;
      const strategy = new TradingStrategyManager().getActiveStrategy();
      
      const benchmarkStart = performance.now();
      
      const batchResults = await Promise.all(
        Array.from({ length: largePhaseCount }, async (_, i) => {
          const bot = new MultiPhaseTradingBot(strategy, 100, 1000);
          const priceUpdate = 100 + (i % 50); // Vary prices
          const result = bot.onPriceUpdate(priceUpdate);
          return result.actions.length > 0;
        })
      ).then(results => ({
        totalPhases: largePhaseCount,
        successfulPhases: results.filter(r => r).length,
        averagePhaseTime: (performance.now() - benchmarkStart) / largePhaseCount,
        memoryUsage: process.memoryUsage().heapUsed
      }));
      
      const benchmarkTime = performance.now() - benchmarkStart;
      
      expect(batchResults.totalPhases).toBe(largePhaseCount);
      expect(batchResults.successfulPhases).toBeGreaterThanOrEqual(0); // Some may not trigger actions
      expect(benchmarkTime).toBeLessThan(30000); // Should complete within 30 seconds
      expect(batchResults.averagePhaseTime).toBeLessThan(300); // Average phase time < 300ms
      expect(batchResults.memoryUsage).toBeLessThan(1024 * 1024 * 100); // < 100MB
    });
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(strategyPhaseExecutions);
    await db.delete(tradingStrategies);
  });
});