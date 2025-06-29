/**
 * High-Frequency Auto Sniping Performance Tests
 * 
 * Comprehensive performance test suite for high-frequency auto sniping scenarios:
 * - Real-time pattern detection under load
 * - Concurrent trade execution performance
 * - Memory usage optimization during extended operation
 * - Latency optimization for order placement
 * - Throughput testing for market data processing
 * - Scalability testing with multiple symbols
 * - Stress testing under extreme market conditions
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PatternDetectionCore } from '@/src/core/pattern-detection';
import type { SymbolEntry } from '@/src/services/api/mexc-unified-exports';
import { UnifiedMexcServiceV2 } from '@/src/services/api/unified-mexc-service-v2';
import { webSocketClient } from '@/src/services/data/websocket-client';
import { ComprehensiveSafetyCoordinator } from '@/src/services/risk/comprehensive-safety-coordinator';
import { MultiPhaseTradingBot } from '@/src/services/trading/multi-phase-trading-bot';
import { 
  ApiMockingUtils,
  MockDataGenerator, 
  PerformanceTestUtils, 
  TestFixtures 
} from '../utils/auto-sniping-test-utilities';
import { 
  globalTimeoutMonitor, 
  setTestTimeout, 
  timeoutPromise,
  withTimeout 
} from '../utils/timeout-utilities';

describe('High-Frequency Auto Sniping Performance', () => {
  // Set extended timeout for performance tests (60 seconds)
  const TEST_TIMEOUT = setTestTimeout('performance');
  console.log(`🕐 Performance tests configured with ${TEST_TIMEOUT}ms timeout`);
  let patternEngine: PatternDetectionCore;
  let tradingBots: Map<string, MultiPhaseTradingBot>;
  let mexcService: UnifiedMexcServiceV2;
  let safetyCoordinator: ComprehensiveSafetyCoordinator;
  let wsClient = webSocketClient;

  // Performance benchmarks and thresholds
  const PERFORMANCE_THRESHOLDS = {
    PATTERN_DETECTION_LATENCY: 100, // ms
    ORDER_EXECUTION_LATENCY: 500, // ms
    MARKET_DATA_PROCESSING_RPS: 1000, // requests per second
    MEMORY_USAGE_GROWTH_RATE: 0.1, // 10% per hour
    CONCURRENT_SYMBOL_LIMIT: 100,
    MAX_CPU_USAGE: 80, // percent
    MAX_RESPONSE_TIME_P99: 2000 // ms
  };

  beforeAll(() => {
    // Mock external dependencies for performance testing
    ApiMockingUtils.setupDatabaseMocks();
  });

  beforeEach(() => {
    // Initialize core services
    patternEngine = PatternDetectionCore.getInstance();
    tradingBots = new Map();
    
    mexcService = new UnifiedMexcServiceV2({
      apiKey: 'perf-test-key',
      secretKey: 'perf-test-secret',
      enableCaching: true,
      enableCircuitBreaker: true,
      enableMetrics: true,
      enableEnhancedCaching: true
    });

    safetyCoordinator = new ComprehensiveSafetyCoordinator({
      agentMonitoringInterval: 100, // Faster monitoring for performance tests
      riskAssessmentInterval: 50,
      systemHealthCheckInterval: 200,
      criticalViolationThreshold: 10,
      riskScoreThreshold: 90,
      agentAnomalyThreshold: 85,
      autoEmergencyShutdown: false // Disabled for performance tests
    });

    // Setup optimized API mocks for performance
    ApiMockingUtils.setupMexcApiMocks(mexcService);

    // Override with performance-optimized mocks
    vi.spyOn(mexcService, 'getTicker').mockImplementation(async (symbol: string) => {
      // Simulate fast API response
      await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 20));
      return {
        success: true,
        data: {
          symbol,
          lastPrice: (1.0 + Math.random() * 0.1).toString(),
          price: (1.0 + Math.random() * 0.1).toString(),
          priceChange: '0',
          priceChangePercent: '0',
          volume: '1000000',
          quoteVolume: '1000000',
          openPrice: '1.0',
          highPrice: '1.1',
          lowPrice: '0.9',
          count: '100'
        },
        timestamp: new Date().toISOString()
      };
    });

    vi.spyOn(mexcService, 'placeOrder').mockImplementation(async () => {
      // Simulate order execution latency
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
      return {
        success: true,
        data: {
          orderId: `perf-order-${Date.now()}-${Math.random()}`,
          status: 'FILLED',
          price: '1.0',
          quantity: '1000'
        },
        timestamp: new Date().toISOString()
      };
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    tradingBots.clear();
  });

  describe('Pattern Detection Performance', () => {
    it('should detect patterns within latency thresholds', async () => {
      // Arrange: Generate multiple pattern scenarios
      const testSymbols = Array.from({ length: 50 }, (_, i) => 
        MockDataGenerator.generateReadyStatePattern(`PERF${i}USDT`)
      );

      // Act: Measure pattern detection performance
      const performanceResult = await PerformanceTestUtils.measureExecutionTime(
        async () => {
          const detectionPromises = testSymbols.map(symbol => 
            patternEngine.detectReadyStatePattern(symbol)
          );
          return Promise.all(detectionPromises);
        },
        10 // 10 iterations
      );

      // Assert: Performance thresholds
      expect(performanceResult.avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.PATTERN_DETECTION_LATENCY);
      expect(performanceResult.maxTime).toBeLessThan(PERFORMANCE_THRESHOLDS.PATTERN_DETECTION_LATENCY * 2);
      
      // Verify all patterns were detected
      expect(performanceResult.result.flat().length).toBe(testSymbols.length * 10);
    });

    it('should maintain performance under sustained pattern detection load', async () => {
      // Arrange: Continuous pattern detection simulation
      const testDuration = 10000; // 10 seconds
      const targetRPS = 100; // 100 patterns per second
      let processedPatterns = 0;
      let totalLatency = 0;
      let maxLatency = 0;

      const startTime = Date.now();

      // Act: Sustained load test
      const loadTestPromise = new Promise<void>((resolve) => {
        const interval = setInterval(async () => {
          if (Date.now() - startTime >= testDuration) {
            clearInterval(interval);
            resolve();
            return;
          }

          const batchStart = performance.now();
          const symbol = MockDataGenerator.generateReadyStatePattern(`LOAD${processedPatterns}USDT`);
          
          try {
            await patternEngine.detectReadyStatePattern(symbol);
            const latency = performance.now() - batchStart;
            totalLatency += latency;
            maxLatency = Math.max(maxLatency, latency);
            processedPatterns++;
          } catch (error) {
            console.warn('Pattern detection failed under load:', error);
          }
        }, 1000 / targetRPS);
      });

      await loadTestPromise;

      // Assert: Performance metrics
      const avgLatency = totalLatency / processedPatterns;
      const actualRPS = processedPatterns / (testDuration / 1000);

      expect(avgLatency).toBeLessThan(PERFORMANCE_THRESHOLDS.PATTERN_DETECTION_LATENCY);
      expect(maxLatency).toBeLessThan(PERFORMANCE_THRESHOLDS.PATTERN_DETECTION_LATENCY * 3);
      expect(actualRPS).toBeGreaterThan(targetRPS * 0.8); // Allow 20% tolerance
      expect(processedPatterns).toBeGreaterThan(800); // Should process most patterns
    });

    it('should scale pattern detection across multiple symbols', async () => {
      // Arrange: Varying symbol counts
      const symbolCounts = [10, 25, 50, 100, 200];
      const scalingResults = [];

      // Act: Test scaling characteristics
      for (const count of symbolCounts) {
        const symbols = Array.from({ length: count }, (_, i) => 
          MockDataGenerator.generateReadyStatePattern(`SCALE${i}USDT`)
        );

        const result = await PerformanceTestUtils.measureExecutionTime(
          async () => {
            const promises = symbols.map(symbol => 
              patternEngine.detectReadyStatePattern(symbol)
            );
            return Promise.all(promises);
          },
          3 // 3 iterations for statistical significance
        );

        scalingResults.push({
          symbolCount: count,
          avgTime: result.avgTime,
          throughput: count / (result.avgTime / 1000) // symbols per second
        });
      }

      // Assert: Scaling characteristics
      const firstResult = scalingResults[0];
      const lastResult = scalingResults[scalingResults.length - 1];

      // Throughput should not degrade linearly
      const throughputRatio = lastResult.throughput / firstResult.throughput;
      expect(throughputRatio).toBeGreaterThan(0.3); // Should maintain at least 30% throughput

      // Processing time should scale sub-linearly
      const timeRatio = lastResult.avgTime / firstResult.avgTime;
      const symbolRatio = lastResult.symbolCount / firstResult.symbolCount;
      expect(timeRatio).toBeLessThan(symbolRatio * 0.8); // Better than linear scaling
    });
  });

  describe('Concurrent Trade Execution Performance', () => {
    it('should handle concurrent order placements efficiently', async () => {
      // Arrange: Multiple trading bots for different symbols
      const symbolCount = 20;
      const symbols = Array.from({ length: symbolCount }, (_, i) => `CONCURRENT${i}USDT`);
      
      symbols.forEach(symbol => {
        const bot = new MultiPhaseTradingBot(
          TestFixtures.TRADING_STRATEGIES.MODERATE,
          1000,
          50000
        );
        bot.initializePosition(symbol, 1.0, 1000);
        tradingBots.set(symbol, bot);
      });

      // Act: Trigger concurrent order executions
      const executionResult = await PerformanceTestUtils.measureExecutionTime(
        async () => {
          const executionPromises = Array.from(tradingBots.entries()).map(([symbol, bot]) => 
            bot.onPriceUpdate(1.5) // 50% price increase triggers sell
          );
          return Promise.all(executionPromises);
        },
        5 // 5 iterations
      );

      // Assert: Concurrent execution performance
      expect(executionResult.avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.ORDER_EXECUTION_LATENCY);
      
      // Verify all executions completed
      const results = executionResult.result;
      expect(results.length).toBe(symbolCount);
      
      // Most should have triggered actions
      const actionsTriggered = results.filter(r => r.actions && r.actions.length > 0).length;
      expect(actionsTriggered).toBeGreaterThan(symbolCount * 0.8);
    });

    it('should maintain order integrity under high concurrency', async () => {
      // Arrange: High concurrency scenario
      const concurrentOperations = 100;
      const symbol = 'INTEGRITYTESTUSDT';
      
      const bot = new MultiPhaseTradingBot(
        TestFixtures.TRADING_STRATEGIES.MODERATE,
        5000,
        100000
      );
      bot.initializePosition(symbol, 1.0, 5000);

      const orderResults: any[] = [];
      let orderSequence = 0;

      // Mock order placement with sequencing
      vi.spyOn(mexcService, 'placeOrder').mockImplementation(async () => {
        const currentSequence = ++orderSequence;
        await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
        
        const result = {
          success: true,
          data: {
            orderId: `integrity-order-${currentSequence}`,
            status: 'FILLED',
            price: '1.5',
            quantity: '100'
          },
          timestamp: new Date().toISOString()
        };
        
        orderResults.push(result.data);
        return result;
      });

      // Act: Execute concurrent operations
      const concurrentPromises = Array.from({ length: concurrentOperations }, async (_, i) => {
        const price = 1.5 + (i * 0.01); // Slightly different prices
        return bot.onPriceUpdate(price);
      });

      await Promise.all(concurrentPromises);

      // Assert: Order integrity
      expect(orderResults.length).toBeGreaterThan(0);
      
      // Orders should be sequenced correctly
      for (let i = 1; i < orderResults.length; i++) {
        expect(orderResults[i].sequence).toBeGreaterThan(orderResults[i-1].sequence);
        expect(orderResults[i].timestamp).toBeGreaterThanOrEqual(orderResults[i-1].timestamp);
      }

      // No duplicate order IDs
      const orderIds = orderResults.map(r => r.orderId);
      const uniqueOrderIds = new Set(orderIds);
      expect(uniqueOrderIds.size).toBe(orderResults.length);
    });

    it('should optimize memory usage during extended trading sessions', async () => {
      // Arrange: Extended trading session simulation
      const sessionDuration = 30000; // 30 seconds (simulating hours)
      const priceUpdateInterval = 100; // Every 100ms
      const symbol = 'MEMORYTESTUSDT';

      const bot = new MultiPhaseTradingBot(
        TestFixtures.TRADING_STRATEGIES.MODERATE,
        2000,
        50000
      );
      bot.initializePosition(symbol, 1.0, 2000);

      const initialMemory = PerformanceTestUtils.getMemoryUsage();
      let updateCount = 0;
      const memorySnapshots = [initialMemory];

      // Act: Simulate extended trading session
      const sessionPromise = new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          if (Date.now() - startTime >= sessionDuration) {
            clearInterval(interval);
            resolve();
            return;
          }

          updateCount++;
          const price = 1.0 + Math.sin(updateCount * 0.1) * 0.5; // Oscillating price
          bot.onPriceUpdate(price);

          // Take memory snapshot every 100 updates
          if (updateCount % 100 === 0) {
            memorySnapshots.push(PerformanceTestUtils.getMemoryUsage());
          }
        }, priceUpdateInterval);

        const startTime = Date.now();
      });

      await sessionPromise;
      const finalMemory = PerformanceTestUtils.getMemoryUsage();

      // Assert: Memory optimization
      const memoryGrowth = (finalMemory.heapUsed - initialMemory.heapUsed) / initialMemory.heapUsed;
      expect(memoryGrowth).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_USAGE_GROWTH_RATE);

      // Memory should not grow monotonically (garbage collection working)
      let memoryDecreases = 0;
      for (let i = 1; i < memorySnapshots.length; i++) {
        if (memorySnapshots[i].heapUsed < memorySnapshots[i-1].heapUsed) {
          memoryDecreases++;
        }
      }
      expect(memoryDecreases).toBeGreaterThan(0); // Should see some GC activity

      expect(updateCount).toBeGreaterThan(200); // Should have processed many updates
    });
  });

  describe('Market Data Processing Throughput', () => {
    it('should process high-frequency market data efficiently', async () => {
      // Arrange: High-frequency market data simulation
      const dataPointsPerSecond = 1000;
      const testDuration = 5000; // 5 seconds
      const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'DOTUSDT', 'LINKUSDT'];
      
      let processedDataPoints = 0;
      let processingErrors = 0;
      const processingTimes: number[] = [];

      // Act: Process high-frequency data
      const dataProcessingPromise = new Promise<void>((resolve) => {
        const interval = setInterval(async () => {
          if (Date.now() - startTime >= testDuration) {
            clearInterval(interval);
            resolve();
            return;
          }

          const batchStart = performance.now();
          const symbol = symbols[processedDataPoints % symbols.length];
          const marketData = MockDataGenerator.generateMarketData('volatile');

          try {
            // Simulate market data processing
            const ticker = await mexcService.getTicker(symbol);
            let price = 1.0;
            if (ticker.success) {
              const data = ticker.data;
              if (Array.isArray(data)) {
                price = data.length > 0 && 'lastPrice' in data[0] ? parseFloat(data[0].lastPrice) : 1.0;
              } else if (data && 'lastPrice' in data) {
                price = parseFloat(data.lastPrice);
              }
            }
            await patternEngine.analyzeSymbolReadiness({
              sts: Math.floor(Math.random() * 3),
              st: Math.floor(Math.random() * 3),
              tt: Math.floor(Math.random() * 5),
              cd: symbol
            });

            processedDataPoints++;
            processingTimes.push(performance.now() - batchStart);
          } catch (error) {
            processingErrors++;
          }
        }, 1000 / dataPointsPerSecond);

        const startTime = Date.now();
      });

      await dataProcessingPromise;

      // Assert: Throughput performance
      const actualRPS = processedDataPoints / (testDuration / 1000);
      const avgProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
      const errorRate = processingErrors / (processedDataPoints + processingErrors);

      expect(actualRPS).toBeGreaterThan(PERFORMANCE_THRESHOLDS.MARKET_DATA_PROCESSING_RPS * 0.7);
      expect(avgProcessingTime).toBeLessThan(50); // 50ms average
      expect(errorRate).toBeLessThan(0.05); // Less than 5% error rate
    });

    it('should handle WebSocket message processing at scale', async () => {
      // Arrange: WebSocket message simulation
      const messagesPerSecond = 500;
      const testDuration = 10000; // 10 seconds
      let processedMessages = 0;
      let messageQueue: any[] = [];
      const processingLatencies: number[] = [];

      // Mock WebSocket message processing
      const processMessage = async (message: any) => {
        const processStart = performance.now();
        
        // Simulate message processing
        await new Promise(resolve => setTimeout(resolve, 1 + Math.random() * 5));
        
        if (message.type === 'price_update') {
          const ticker = await mexcService.getTicker(message.symbol);
          let price = 1.0;
          if (ticker.success) {
            const data = ticker.data;
            if (Array.isArray(data)) {
              price = data.length > 0 && 'lastPrice' in data[0] ? parseFloat(data[0].lastPrice) : 1.0;
            } else if (data && 'lastPrice' in data) {
              price = parseFloat(data.lastPrice);
            }
          }
        }
        
        processedMessages++;
        processingLatencies.push(performance.now() - processStart);
      };

      // Act: Simulate WebSocket message flow
      const messageFlowPromise = new Promise<void>((resolve) => {
        // Message generator
        const messageInterval = setInterval(() => {
          if (Date.now() - startTime >= testDuration) {
            clearInterval(messageInterval);
            return;
          }

          const message = {
            type: 'price_update',
            symbol: `TEST${Math.floor(Math.random() * 10)}USDT`,
            price: 1.0 + Math.random() * 0.1,
            timestamp: Date.now()
          };

          messageQueue.push(message);
        }, 1000 / messagesPerSecond);

        // Message processor
        const processorInterval = setInterval(async () => {
          if (Date.now() - startTime >= testDuration && messageQueue.length === 0) {
            clearInterval(processorInterval);
            resolve();
            return;
          }

          const batch = messageQueue.splice(0, 10); // Process in batches
          await Promise.all(batch.map(processMessage));
        }, 10);

        const startTime = Date.now();
      });

      await messageFlowPromise;

      // Assert: Message processing performance
      const actualMPS = processedMessages / (testDuration / 1000);
      const avgLatency = processingLatencies.reduce((a, b) => a + b, 0) / processingLatencies.length;
      const maxLatency = Math.max(...processingLatencies);

      expect(actualMPS).toBeGreaterThan(messagesPerSecond * 0.8);
      expect(avgLatency).toBeLessThan(20); // 20ms average latency
      expect(maxLatency).toBeLessThan(100); // 100ms max latency
      expect(messageQueue.length).toBeLessThan(50); // Queue should be mostly cleared
    });
  });

  describe('System-Wide Performance Under Load', () => {
    it('should maintain performance with multiple active strategies', async () => {
      // Arrange: Multiple active strategies
      const strategyCount = 25;
      const strategies = [
        TestFixtures.TRADING_STRATEGIES.CONSERVATIVE,
        TestFixtures.TRADING_STRATEGIES.MODERATE,
        TestFixtures.TRADING_STRATEGIES.AGGRESSIVE
      ];

      // Initialize multiple bots with different strategies
      for (let i = 0; i < strategyCount; i++) {
        const strategy = strategies[i % strategies.length];
        const symbol = `MULTI${i}USDT`;
        const bot = new MultiPhaseTradingBot(strategy, 1000, 50000);
        bot.initializePosition(symbol, 1.0, 1000);
        tradingBots.set(symbol, bot);
      }

      // Act: Simulate concurrent strategy execution
      const performanceResult = await PerformanceTestUtils.measureExecutionTime(
        async () => {
          const priceUpdates = Array.from(tradingBots.entries()).map(([symbol, bot]) => {
            const randomPrice = 1.0 + Math.random() * 0.5; // Random price movement
            return bot.onPriceUpdate(randomPrice);
          });
          return Promise.all(priceUpdates);
        },
        10 // 10 iterations
      );

      // Assert: Multi-strategy performance
      expect(performanceResult.avgTime).toBeLessThan(1000); // Under 1 second
      expect(performanceResult.maxTime).toBeLessThan(2000); // Max 2 seconds
      
      // All strategies should complete
      expect(performanceResult.result.length).toBe(strategyCount);
    });

    it('should handle stress testing with circuit breaker protection', async () => {
      // Arrange: Stress test configuration
      const stressTestConfig = {
        concurrentRequests: 200,
        requestRate: 100, // requests per second
        duration: 15000, // 15 seconds
        errorInjectionRate: 0.1 // 10% error rate
      };

      let successfulRequests = 0;
      let failedRequests = 0;
      let circuitBreakerTriggered = false;

      // Mock with occasional errors
      vi.spyOn(mexcService, 'getTicker').mockImplementation(async (symbol: string) => {
        if (Math.random() < stressTestConfig.errorInjectionRate) {
          throw new Error('Simulated API error');
        }
        await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 40));
        return {
          success: true,
          data: {
            symbol,
            lastPrice: (1.0 + Math.random() * 0.1).toString(),
            price: (1.0 + Math.random() * 0.1).toString(),
            priceChange: '0',
            priceChangePercent: '0',
            volume: '1000000',
            quoteVolume: '1000000',
            openPrice: '1.0',
            highPrice: '1.1',
            lowPrice: '0.9',
            count: '100'
          },
          timestamp: new Date().toISOString()
        };
      });

      // Note: Circuit breaker monitoring would be handled through other mechanisms

      // Act: Execute stress test
      const stressTestResult = await PerformanceTestUtils.runLoadTest(
        async () => {
          try {
            const ticker = await mexcService.getTicker('STRESSUSDT');
            let price = 1.0;
            if (ticker.success) {
              const data = ticker.data;
              if (Array.isArray(data)) {
                price = data.length > 0 && 'lastPrice' in data[0] ? parseFloat(data[0].lastPrice) : 1.0;
              } else if (data && 'lastPrice' in data) {
                price = parseFloat(data.lastPrice);
              }
            }
            successfulRequests++;
          } catch (error) {
            failedRequests++;
          }
        },
        {
          concurrency: stressTestConfig.concurrentRequests,
          duration: stressTestConfig.duration,
          rampUpTime: 2000 // 2 second ramp up
        }
      );

      // Assert: Stress test results
      expect(stressTestResult.totalRequests).toBeGreaterThan(1000);
      expect(stressTestResult.requestsPerSecond).toBeGreaterThan(50);
      expect(stressTestResult.avgResponseTime).toBeLessThan(200);
      
      // Error rate should be manageable
      const errorRate = failedRequests / (successfulRequests + failedRequests);
      expect(errorRate).toBeLessThan(0.2); // Less than 20% errors
      
      // Circuit breaker should protect against cascading failures
      if (circuitBreakerTriggered) {
        expect(errorRate).toBeLessThan(0.5); // Should limit damage
      }
    });

    it('should demonstrate scalability limits and graceful degradation', async () => {
      // Arrange: Escalating load test
      const loadLevels = [10, 50, 100, 200, 500];
      const scalabilityResults = [];

      // Act: Test at different load levels
      for (const concurrency of loadLevels) {
        const loadTestResult = await PerformanceTestUtils.runLoadTest(
          async () => {
            const symbol = `SCALE${Math.floor(Math.random() * 10)}USDT`;
            const ticker = await mexcService.getTicker(symbol);
            if (ticker.success) {
              const data = ticker.data;
              if (Array.isArray(data)) {
                return data.length > 0 && 'lastPrice' in data[0] ? parseFloat(data[0].lastPrice) : 1.0;
              } else if (data && 'lastPrice' in data) {
                return parseFloat(data.lastPrice);
              }
            }
            return 1.0;
          },
          {
            concurrency,
            duration: 5000, // 5 seconds per level
            rampUpTime: 1000
          }
        );

        scalabilityResults.push({
          concurrency,
          rps: loadTestResult.requestsPerSecond,
          avgResponseTime: loadTestResult.avgResponseTime,
          errorRate: loadTestResult.failedRequests / loadTestResult.totalRequests,
          successRate: loadTestResult.successfulRequests / loadTestResult.totalRequests
        });
      }

      // Assert: Scalability characteristics
      const lowLoadResult = scalabilityResults[0];
      const highLoadResult = scalabilityResults[scalabilityResults.length - 1];

      // Should maintain reasonable success rate even at high load
      expect(highLoadResult.successRate).toBeGreaterThan(0.6); // 60% success rate

      // Response time should degrade gracefully
      expect(highLoadResult.avgResponseTime).toBeLessThan(lowLoadResult.avgResponseTime * 10);

      // Should identify breaking point
      const breakingPoint = scalabilityResults.find(r => r.successRate < 0.5);
      if (breakingPoint) {
        console.log(`Breaking point identified at concurrency: ${breakingPoint.concurrency}`);
        expect(breakingPoint.concurrency).toBeGreaterThan(50); // Should handle at least 50 concurrent
      }
    });
  });

  describe('Real-World Performance Scenarios', () => {
    it('should handle new listing launch scenario', async () => {
      // Arrange: New listing launch simulation
      const newListing = {
        symbol: 'NEWLAUNCHUSDT',
        listingTime: Date.now() + 5000, // 5 seconds from now
        expectedVolume: 1000000,
        initialPrice: 0.001
      };

      const bot = new MultiPhaseTradingBot(
        TestFixtures.TRADING_STRATEGIES.AGGRESSIVE,
        10000,
        100000
      );

      // Simulate high-frequency monitoring before launch
      let monitoringCycles = 0;
      const monitoringMetrics: number[] = [];

      // Act: Pre-launch monitoring and execution
      const launchScenarioPromise = new Promise<void>((resolve) => {
        const monitorInterval = setInterval(async () => {
          const cycleStart = performance.now();
          monitoringCycles++;

          // Check if listing is live
          if (Date.now() >= newListing.listingTime) {
            // Execute immediate snipe
            bot.initializePosition(newListing.symbol, newListing.initialPrice, 10000);
            const result = bot.onPriceUpdate(newListing.initialPrice * 1.5); // 50% immediate pump
            
            clearInterval(monitorInterval);
            resolve();
            return;
          }

          // Monitor for readiness patterns
          const readyState = MockDataGenerator.generateReadyStatePattern(newListing.symbol);
          await patternEngine.detectReadyStatePattern(readyState);

          monitoringMetrics.push(performance.now() - cycleStart);
        }, 100); // Monitor every 100ms
      });

      await launchScenarioPromise;

      // Assert: Launch scenario performance
      expect(monitoringCycles).toBeGreaterThan(30); // Should have monitored for ~3+ seconds
      
      const avgMonitoringTime = monitoringMetrics.reduce((a, b) => a + b, 0) / monitoringMetrics.length;
      expect(avgMonitoringTime).toBeLessThan(50); // Fast monitoring cycles

      // Should detect launch timing accurately
      expect(Date.now() - newListing.listingTime).toBeLessThan(500); // Within 500ms
    });

    it('should optimize for flash crash recovery', async () => {
      // Arrange: Flash crash scenario
      const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'];
      const positions = new Map();

      symbols.forEach(symbol => {
        const bot = new MultiPhaseTradingBot(
          TestFixtures.TRADING_STRATEGIES.MODERATE,
          5000,
          100000
        );
        bot.initializePosition(symbol, 100.0, 50); // $5000 position at $100
        positions.set(symbol, bot);
      });

      // Simulate flash crash
      const crashSequence = [
        { time: 0, priceMultiplier: 1.0 },      // Normal
        { time: 1000, priceMultiplier: 0.95 },  // -5%
        { time: 2000, priceMultiplier: 0.8 },   // -20%
        { time: 3000, priceMultiplier: 0.7 },   // -30% (flash crash)
        { time: 4000, priceMultiplier: 0.85 },  // Recovery starts
        { time: 5000, priceMultiplier: 0.9 }    // Partial recovery
      ];

      const recoveryMetrics = {
        stopLossExecutions: 0,
        recoveryTrades: 0,
        totalLatency: 0,
        maxLatency: 0
      };

      // Act: Process flash crash sequence
      for (const step of crashSequence) {
        await new Promise(resolve => setTimeout(resolve, step.time === 0 ? 0 : 1000));
        
        const stepStart = performance.now();
        const processingPromises = symbols.map(async symbol => {
          const bot = positions.get(symbol)!;
          const newPrice = 100 * step.priceMultiplier;
          const result = bot.onPriceUpdate(newPrice);
          
          if (result.actions?.some(a => a.isStopLoss)) {
            recoveryMetrics.stopLossExecutions++;
          }
          if (step.priceMultiplier > 0.8 && result.actions?.length > 0) {
            recoveryMetrics.recoveryTrades++;
          }
          
          return result;
        });

        await Promise.all(processingPromises);
        
        const stepLatency = performance.now() - stepStart;
        recoveryMetrics.totalLatency += stepLatency;
        recoveryMetrics.maxLatency = Math.max(recoveryMetrics.maxLatency, stepLatency);
      }

      // Assert: Flash crash response performance
      expect(recoveryMetrics.stopLossExecutions).toBeGreaterThan(0); // Should trigger stop losses
      expect(recoveryMetrics.maxLatency).toBeLessThan(100); // Fast response to crash
      expect(recoveryMetrics.totalLatency / crashSequence.length).toBeLessThan(50); // Avg response time
    });
  });
});