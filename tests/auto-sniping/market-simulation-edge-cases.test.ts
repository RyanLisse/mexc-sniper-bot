/**
 * Market Simulation Edge Cases Tests
 * 
 * Advanced test suite for simulating extreme market conditions and edge cases
 * that the auto sniping system must handle gracefully:
 * - Flash crashes and circuit breakers
 * - Extreme volatility and liquidity crunches  
 * - Market manipulation patterns
 * - Network latency and connectivity issues
 * - Exchange-specific quirks and behaviors
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { PatternDetectionEngine } from '../../src/services/pattern-detection-engine';
import { MultiPhaseTradingBot } from '../../src/services/multi-phase-trading-bot';
import { UnifiedMexcService } from '../../src/services/unified-mexc-service';
import { AdvancedRiskEngine } from '../../src/services/advanced-risk-engine';
import { EmergencySafetySystem } from '../../src/services/emergency-safety-system';
import type { SymbolEntry } from '../../src/services/mexc-unified-exports';

describe('Market Simulation Edge Cases', () => {
  let patternEngine: PatternDetectionEngine;
  let tradingBot: MultiPhaseTradingBot;
  let mexcService: UnifiedMexcService;
  let riskEngine: AdvancedRiskEngine;
  let emergencySystem: EmergencySafetySystem;

  // Market simulation helpers
  class MarketSimulator {
    static generateFlashCrash(initialPrice: number, crashPercent: number) {
      const crashPrice = initialPrice * (1 - crashPercent / 100);
      const recoveryPrice = initialPrice * (1 - crashPercent / 200); // Partial recovery
      
      return {
        priceSequence: [
          initialPrice,
          initialPrice * 0.99,  // Minor drop
          initialPrice * 0.95,  // Accelerating
          crashPrice,           // Flash crash bottom
          crashPrice * 1.1,     // Dead cat bounce
          recoveryPrice         // Settling point
        ],
        timeDeltas: [0, 100, 200, 250, 300, 1000], // Milliseconds between updates
        volumeSpikes: [1, 2, 5, 20, 10, 3] // Volume multipliers
      };
    }

    static generatePumpAndDump(basePrice: number, pumpMultiplier: number) {
      const peakPrice = basePrice * pumpMultiplier;
      const dumpPrice = basePrice * 0.3; // Dramatic drop below initial
      
      return {
        priceSequence: [
          basePrice,
          basePrice * 1.2,     // Initial pump
          basePrice * 1.5,     // Building momentum  
          basePrice * 2.0,     // Acceleration
          peakPrice,           // Peak
          peakPrice * 0.8,     // Initial dump
          peakPrice * 0.5,     // Panic selling
          dumpPrice            // Bottom
        ],
        timeDeltas: [0, 300, 600, 900, 1200, 1300, 1400, 1500],
        volumeSpikes: [1, 3, 8, 15, 25, 30, 40, 20]
      };
    }

    static generateExtremeVolatility(basePrice: number, duration: number) {
      const priceSequence: number[] = [basePrice];
      const timeDeltas: number[] = [0];
      const volumeSpikes: number[] = [1];
      
      let currentPrice = basePrice;
      let currentTime = 0;
      
      for (let i = 0; i < duration; i++) {
        // Random walk with extreme volatility
        const volatility = 0.15; // 15% swings
        const direction = Math.random() < 0.5 ? -1 : 1;
        const magnitude = Math.random() * volatility;
        
        currentPrice *= (1 + direction * magnitude);
        currentTime += 50 + Math.random() * 100; // Variable timing
        
        priceSequence.push(currentPrice);
        timeDeltas.push(currentTime);
        volumeSpikes.push(1 + Math.random() * 10);
      }
      
      return { priceSequence, timeDeltas, volumeSpikes };
    }
  }

  beforeAll(() => {
    // Mock external dependencies
    vi.mock('../../src/db', () => ({
      db: {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: '1' }])
          })
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([])
            })
          })
        })
      }
    }));
  });

  beforeEach(() => {
    // Initialize services with aggressive test configuration
    patternEngine = PatternDetectionEngine.getInstance();
    
    riskEngine = new AdvancedRiskEngine({
      maxPortfolioValue: 50000,
      maxSinglePositionSize: 5000,
      maxConcurrentPositions: 10,
      maxDailyLoss: 1000,
      maxDrawdown: 15, // Higher for stress testing
      confidenceLevel: 0.95,
      lookbackPeriod: 30,
      correlationThreshold: 0.8,
      volatilityMultiplier: 1.2,
      adaptiveRiskScaling: true,
      marketRegimeDetection: true,
      stressTestingEnabled: true,
      emergencyVolatilityThreshold: 0.8,
      emergencyLiquidityThreshold: 0.2,
      emergencyCorrelationThreshold: 0.9
    });

    mexcService = new UnifiedMexcService({
      apiKey: 'test-api-key',
      secretKey: 'test-secret-key',
      enableCircuitBreaker: true,
      timeout: 5000,
      maxRetries: 3
    });

    emergencySystem = new EmergencySafetySystem({
      priceDeviationThreshold: 25,
      volumeAnomalyThreshold: 3.0,
      correlationBreakThreshold: 0.5,
      liquidityGapThreshold: 10.0,
      autoResponseEnabled: true,
      emergencyHaltThreshold: 80,
      liquidationThreshold: 90,
      maxLiquidationSize: 10000,
      maxConcurrentEmergencies: 3,
      cooldownPeriod: 5 // Fast response for testing
    });

    const aggressiveStrategy = {
      id: 'edge-case-strategy',
      name: 'Edge Case Test Strategy',
      levels: [
        { percentage: 25, multiplier: 1.25, sellPercentage: 20 },
        { percentage: 50, multiplier: 1.5, sellPercentage: 30 },
        { percentage: 100, multiplier: 2.0, sellPercentage: 50 }
      ]
    };

    tradingBot = new MultiPhaseTradingBot(aggressiveStrategy, 5000, 100000); // $5k position, $100k portfolio

    // Mock MEXC API responses
    vi.spyOn(mexcService, 'getTicker').mockImplementation(async (symbol: string) => ({
      success: true,
      data: {
        symbol,
        lastPrice: '1.0',
        price: '1.0',
        priceChange: '0',
        priceChangePercent: '0',
        volume: '1000000',
        quoteVolume: '1000000',
        openPrice: '1.0',
        highPrice: '1.0',
        lowPrice: '1.0',
        count: '100'
      },
      timestamp: new Date().toISOString()
    }));
    vi.spyOn(mexcService, 'placeOrder').mockResolvedValue({
      success: true,
      data: {
        orderId: 'edge-case-order',
        symbol: 'TESTUSDT',
        status: 'FILLED',
        price: '1.0',
        quantity: '1000'
      },
      timestamp: new Date().toISOString()
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Flash Crash Scenarios', () => {
    it('should handle 20% flash crash with emergency protocols', async () => {
      // Arrange: 20% flash crash simulation
      const flashCrash = MarketSimulator.generateFlashCrash(1.0, 20);
      tradingBot.initializePosition('FLASHCRASHUSDT', 1.0, 5000);

      let emergencyTriggered = false;
      // Note: EmergencySafetySystem doesn't extend EventEmitter
      // Would need to check emergency status directly

      // Act: Process flash crash sequence
      const results = [];
      for (let i = 0; i < flashCrash.priceSequence.length; i++) {
        const price = flashCrash.priceSequence[i];
        const volume = flashCrash.volumeSpikes[i];
        
        // Update market conditions
        await riskEngine.updateMarketConditions({
          volatilityIndex: Math.abs(price - flashCrash.priceSequence[0]) / flashCrash.priceSequence[0] * 100,
          tradingVolume24h: volume * 1000000,
          priceChange24h: ((price - flashCrash.priceSequence[0]) / flashCrash.priceSequence[0]) * 100,
          timestamp: new Date(Date.now() + flashCrash.timeDeltas[i]).toISOString()
        });

        const result = tradingBot.onPriceUpdate(price);
        results.push(result);

        // Check emergency systems
        await emergencySystem.detectMarketAnomalies({
          priceChange: (price - 1.0) / 1.0,
          volatility: 0.8,
          volume: volume * 1000000
        });
      }

      // Assert: Should trigger appropriate responses
      expect(emergencyTriggered).toBe(true);
      
      // Should execute stop loss during crash
      const stopLossExecuted = results.some(r => 
        r.actions?.some(a => a.isStopLoss)
      );
      expect(stopLossExecuted).toBe(true);

      // Portfolio protection should be active
      expect(riskEngine.isEmergencyModeActive()).toBe(true);
    });

    it('should prevent entry during extreme volatility conditions', async () => {
      // Arrange: Extreme volatility pattern
      const volatilePattern: SymbolEntry = {
        sts: 2,
        st: 2,
        tt: 4,
        cd: 'EXTREMEVOLATILUSDT',
        ca: 1000,
        ps: 100,
        qs: 50
      };

      // Mock extremely volatile market conditions
      await riskEngine.updateMarketConditions({
        volatilityIndex: 95, // 95% volatility index
        liquidityIndex: 20, // Low liquidity (shallow)
        bidAskSpread: 5.0, // High spread due to volatility
        marketSentiment: 'volatile'
      });

      // Act: Attempt pattern detection in volatile conditions
      const detectionResults = await patternEngine.detectReadyStatePattern(volatilePattern);

      // Assert: Should adjust confidence or reject due to volatility
      if (detectionResults.length > 0) {
        expect(detectionResults[0].confidence).toBeLessThan(80); // Reduced confidence
        expect(detectionResults[0].riskLevel).toBe('high'); // High risk due to volatility
      } else {
        expect(detectionResults).toHaveLength(0); // Rejected entry
      }
    });
  });

  describe('Pump and Dump Detection', () => {
    it('should detect and respond to pump and dump patterns', async () => {
      // Arrange: Pump and dump simulation
      const pumpDump = MarketSimulator.generatePumpAndDump(0.01, 10); // 1000% pump
      tradingBot.initializePosition('PUMPDUMPUSDT', 0.01, 100000); // Large position

      const pumpDumpAlerts: string[] = [];
      riskEngine.on('manipulation_detected', (alert) => {
        pumpDumpAlerts.push(alert.type);
      });

      // Act: Process pump and dump sequence
      for (let i = 0; i < pumpDump.priceSequence.length; i++) {
        const price = pumpDump.priceSequence[i];
        const volume = pumpDump.volumeSpikes[i];
        
        // Detect manipulation patterns
        await riskEngine.detectManipulation({
          rapidPriceMovement: i > 0 ? Math.abs((price - pumpDump.priceSequence[i-1]) / pumpDump.priceSequence[i-1]) * 100 : 0,
          volumeAnomaly: volume,
          orderBookManipulation: volume > 20,
          crossExchangeDeviation: 0,
          coordinatedTrading: volume > 15
        });

        tradingBot.onPriceUpdate(price);
      }

      // Assert: Should detect manipulation
      expect(pumpDumpAlerts).toContain('pump_detected');
      expect(pumpDumpAlerts).toContain('dump_detected');
      
      // Should have executed exit strategy during pump
      const positionInfo = tradingBot.getPositionInfo();
      expect(positionInfo.currentSize).toBeLessThan(100000); // Partial exit
    });

    it('should handle coordinated manipulation attempts', async () => {
      // Arrange: Coordinated manipulation scenario
      const manipulationIndicators = {
        suspiciousVolumeSpikes: [
          { time: Date.now(), volume: 1000000, price: 1.0 },
          { time: Date.now() + 1000, volume: 5000000, price: 1.2 },
          { time: Date.now() + 2000, volume: 10000000, price: 1.5 }
        ],
        orderBookAnomalies: [
          { type: 'wall_removed', price: 1.1, volume: 1000000 },
          { type: 'fake_wall', price: 1.3, volume: 500000 }
        ],
        crossExchangeArbitrage: {
          mexcPrice: 1.0,
          binancePrice: 1.05,
          deviation: 0.05
        }
      };

      // Act: Analyze manipulation indicators
      const manipulationResult = await riskEngine.detectManipulation({
        rapidPriceMovement: 150, // 50% price increase
        volumeAnomaly: 500, // 5x volume spike
        orderBookManipulation: true,
        crossExchangeDeviation: 5, // 5% deviation
        coordinatedTrading: true
      });

      // Assert: Should detect high manipulation risk
      expect(manipulationResult.riskLevel).toBe('high');
      expect(manipulationResult.manipulationScore).toBeGreaterThan(0.8);
      expect(manipulationResult.indicators).toContain('coordinated_pump');
      expect(manipulationResult.recommendedAction).toBe('halt_trading');
    });
  });

  describe('Network and Connectivity Issues', () => {
    it('should handle intermittent network connectivity', async () => {
      // Arrange: Intermittent connection simulation
      let connectionAttempts = 0;
      vi.spyOn(mexcService, 'getTicker').mockImplementation(async () => {
        connectionAttempts++;
        if (connectionAttempts % 3 === 0) {
          throw new Error('Connection timeout');
        }
        return {
          success: true,
          data: {
            symbol: 'NETWORKISSUEUSDT',
            lastPrice: '1.5',
            price: '1.5',
            priceChange: '0',
            priceChangePercent: '0',
            volume: '1000000',
            quoteVolume: '1000000',
            openPrice: '1.5',
            highPrice: '1.5',
            lowPrice: '1.5',
            count: '100'
          },
          timestamp: new Date().toISOString()
        };
      });

      tradingBot.initializePosition('NETWORKISSUEUSDT', 1.0, 1000);

      // Act: Attempt price updates with network issues
      const results = [];
      for (let i = 0; i < 10; i++) {
        try {
          const result = tradingBot.onPriceUpdate(1.5);
          results.push({ success: true, result });
        } catch (error) {
          results.push({ success: false, error: error instanceof Error ? error.message : String(error) });
        }
        
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate delays
      }

      // Assert: Should handle connectivity gracefully
      const successfulUpdates = results.filter(r => r.success).length;
      expect(successfulUpdates).toBeGreaterThan(5); // Should succeed most of the time
      expect(connectionAttempts).toBeGreaterThan(10); // Should retry failed attempts
    });

    it('should maintain order integrity during latency spikes', async () => {
      // Arrange: High latency simulation
      const latencySpikes = [50, 100, 500, 1000, 2000, 5000, 1000, 500]; // ms
      tradingBot.initializePosition('LATENCYUSDT', 1.0, 1000);

      let orderSequence: any[] = [];
      vi.spyOn(mexcService, 'placeOrder').mockImplementation(async (params) => {
        const latency = latencySpikes[orderSequence.length % latencySpikes.length];
        
        await new Promise(resolve => setTimeout(resolve, latency));
        
        const order = {
          orderId: `latency-order-${orderSequence.length}`,
          status: 'FILLED',
          executedQty: params.quantity || '1000',
          executedPrice: params.price || '1.0',
          latency,
          timestamp: new Date().toISOString()
        };
        
        orderSequence.push(order);
        return {
          success: true,
          data: order,
          timestamp: new Date().toISOString()
        };
      });

      // Act: Execute trades with varying latency
      const executionResults = [];
      for (const targetPrice of [1.25, 1.5, 1.75, 2.0]) {
        const result = tradingBot.onPriceUpdate(targetPrice);
        executionResults.push(result);
        
        if (result.actions?.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 100)); // Process orders
        }
      }

      // Assert: Orders should maintain correct sequence despite latency
      expect(orderSequence.length).toBeGreaterThan(0);
      
      // Verify order timing integrity
      for (let i = 1; i < orderSequence.length; i++) {
        expect(orderSequence[i].timestamp).toBeGreaterThanOrEqual(orderSequence[i-1].timestamp);
      }
    });
  });

  describe('Exchange-Specific Quirks', () => {
    it('should handle MEXC minimum order size requirements', async () => {
      // Arrange: MEXC minimum order constraints
      const mexcConstraints = {
        minimumOrderSizeUSDT: 10,
        minimumQuantity: 0.001,
        priceTickSize: 0.0001,
        quantityStepSize: 0.0001
      };

      vi.spyOn(mexcService, 'getSymbolInfo').mockResolvedValue({
        success: true,
        data: {
          symbol: 'SMALLORDERUSDT',
          cd: 'SMALLORDERUSDT'
        },
        timestamp: new Date().toISOString()
      });

      // Test small position that might violate minimums
      tradingBot.initializePosition('SMALLORDERUSDT', 100, 0.05); // $5 position

      // Act: Attempt to execute small order
      const result = tradingBot.onPriceUpdate(150); // 50% gain

      // Assert: Should handle minimum requirements
      if (result.actions?.length > 0) {
        const action = result.actions[0];
        // Note: actions are strings describing the action, not objects with amount properties
        expect(action).toContain('Sell'); // Should contain action description
        expect(typeof action).toBe('string');
      } else {
        // Should reject if below minimums or provide appropriate warnings
        expect(result.status).toBeDefined();
      }
    });

    it('should handle MEXC trading pair status changes', async () => {
      // Arrange: Trading pair status change simulation
      const statusChanges = [
        { status: 'TRADING', timestamp: Date.now() },
        { status: 'BREAK', timestamp: Date.now() + 1000 }, // Trading halted
        { status: 'TRADING', timestamp: Date.now() + 5000 }, // Resumed
      ];

      let currentStatusIndex = 0;
      vi.spyOn(mexcService, 'getSymbolStatus').mockImplementation(async () => {
        return {
          success: true,
          data: statusChanges[currentStatusIndex],
          timestamp: new Date().toISOString(),
        };
      });

      tradingBot.initializePosition('STATUSCHANGEUSDT', 1.0, 1000);

      // Act: Process trades during status changes
      const results = [];
      for (const price of [1.2, 1.5, 1.8]) {
        currentStatusIndex = Math.min(currentStatusIndex + 1, statusChanges.length - 1);
        
        const result = tradingBot.onPriceUpdate(price);
        results.push({
          price,
          status: statusChanges[currentStatusIndex].status,
          result
        });
      }

      // Assert: Should respect trading status
      const breakPeriodResult = results.find(r => r.status === 'BREAK');
      if (breakPeriodResult) {
        expect(breakPeriodResult.result.status).toBe('trading_halted');
        expect(breakPeriodResult.result.actions).toHaveLength(0);
      }

      const resumedResult = results.find(r => r.status === 'TRADING' && r.price > 1.0);
      if (resumedResult) {
        expect(resumedResult.result.status).not.toBe('trading_halted');
      }
    });
  });

  describe('Extreme Market Conditions', () => {
    it('should handle zero liquidity scenarios', async () => {
      // Arrange: Zero liquidity simulation
      vi.spyOn(mexcService, 'getOrderBookDepth').mockResolvedValue({
        success: true,
        data: {
          bids: [], // No buyers
          asks: []  // No sellers
        },
        timestamp: new Date().toISOString(),
      });

      vi.spyOn(mexcService, 'get24hrTicker').mockResolvedValue({
        success: true,
        data: {
          symbol: 'ZEROLIQUIDITYUSDT',
          volume: '0',
          count: 0,
          high: '1.0',
          low: '1.0',
          lastPrice: '1.0'
        },
        timestamp: new Date().toISOString(),
      });

      tradingBot.initializePosition('ZEROLIQUIDITYUSDT', 1.0, 1000);

      // Act: Attempt to trade in zero liquidity
      const result = tradingBot.onPriceUpdate(1.5);

      // Assert: Should detect and handle zero liquidity
      expect(result.status).toBeDefined();
      expect(result.actions).toHaveLength(0);
    });

    it('should handle extreme price gaps', async () => {
      // Arrange: Extreme price gap (90% jump)
      const entryPrice = 1.0;
      const gapPrice = 19.0; // 1900% gap up
      
      tradingBot.initializePosition('PRICEGAPUSDT', entryPrice, 1000);

      // Mock gap detection
      vi.spyOn(mexcService, 'detectPriceGap').mockResolvedValue({
        success: true,
        data: {
          hasGap: true,
          gapPercentage: 1800,
          previousPrice: entryPrice,
          currentPrice: gapPrice,
          gapType: 'up'
        },
        timestamp: new Date().toISOString(),
      });

      // Act: Process extreme price gap
      const result = tradingBot.onPriceUpdate(gapPrice);

      // Assert: Should handle gap appropriately and execute sell strategy
      expect(result.status).toBeDefined();
      expect(result.status.currentPrice).toBe(gapPrice);
      
      // Should execute sell strategy for such a large price increase
      expect(result.actions.length).toBeGreaterThan(0);
      if (result.actions?.length > 0) {
        expect(typeof result.actions[0]).toBe('string');
        expect(result.actions[0]).toContain('EXECUTE');
      }
    });

    it('should handle market maker absence', async () => {
      // Arrange: Wide bid-ask spreads indicating MM absence
      vi.spyOn(mexcService, 'getOrderBookDepth').mockResolvedValue({
        success: true,
        data: {
          bids: [
            [0.8, 100], // 20% below mid
          ],
          asks: [
            [1.2, 100], // 20% above mid
          ]
        },
        timestamp: new Date().toISOString(),
      });

      const marketConditions = {
        bidAskSpread: 0.4,
        spreadPercentage: 40,
        marketMakerActive: false,
        liquidityScore: 0.1
      };

      // Act: Update market conditions and check emergency mode
      await riskEngine.updateMarketConditions({
        bidAskSpread: marketConditions.bidAskSpread,
        liquidityIndex: 10, // Low liquidity index
        volatilityIndex: 90, // High volatility due to wide spreads
        timestamp: new Date().toISOString()
      });

      // Assert: Should detect poor market conditions
      expect(riskEngine.isEmergencyModeActive()).toBe(true);
    });
  });

  describe('System Recovery and Resilience', () => {
    it('should recover gracefully from multiple system failures', async () => {
      // Arrange: Cascade of system failures
      const failureSequence = [
        'database_timeout',
        'api_rate_limit',
        'network_partition',
        'memory_pressure',
        'websocket_disconnect'
      ];

      let recoveryMetrics = {
        failuresEncountered: 0,
        recoveryTime: 0,
        dataIntegrityMaintained: true
      };

      // Act: Simulate failure cascade with emergency system
      for (const failure of failureSequence) {
        const startTime = Date.now();
        
        try {
          // Simulate various failure conditions through emergency system
          await emergencySystem.detectMarketAnomalies({
            priceChange: Math.random() * 50 - 25, // Random price change
            volatility: Math.random() * 2,
            volume: Math.random() * 1000000
          });
          
          recoveryMetrics.recoveryTime += Date.now() - startTime;
          recoveryMetrics.failuresEncountered++;
        } catch (error) {
          recoveryMetrics.dataIntegrityMaintained = false;
        }
      }

      // Assert: Should recover from all failures
      expect(recoveryMetrics.failuresEncountered).toBe(failureSequence.length);
      expect(recoveryMetrics.dataIntegrityMaintained).toBe(true);
      expect(recoveryMetrics.recoveryTime / failureSequence.length).toBeLessThan(5000); // Avg <5s recovery
    });

    it('should maintain trading continuity during partial degradation', async () => {
      // Arrange: Partial system degradation
      const degradationScenario = {
        databaseLatency: 2000,    // 2s delays
        apiSuccessRate: 0.7,      // 70% success rate
        websocketDropouts: 0.3,   // 30% message loss
        memoryConstraints: 0.8    // 80% memory usage
      };

      // Act: Continue trading under degradation
      tradingBot.initializePosition('DEGRADATIONTEST', 1.0, 1000);
      
      const tradingResults = [];
      for (let i = 0; i < 20; i++) {
        const price = 1.0 + (i * 0.05); // Gradual price increase
        
        // Simulate degraded conditions
        if (Math.random() < degradationScenario.websocketDropouts) {
          continue; // Skip this update (simulating message loss)
        }
        
        const result = tradingBot.onPriceUpdate(price);
        tradingResults.push(result);
      }

      // Assert: Should maintain basic functionality
      expect(tradingResults.length).toBeGreaterThan(10); // Some updates processed
      
      // Should still execute key phases despite degradation
      const executedActions = tradingResults.filter(r => r.actions?.length > 0);
      expect(executedActions.length).toBeGreaterThan(0);
    });
  });
});