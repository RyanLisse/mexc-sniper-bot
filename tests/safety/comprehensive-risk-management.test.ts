/**
 * Comprehensive Risk Management Tests
 * 
 * Advanced test suite for risk management and safety protocols in auto sniping:
 * - Portfolio risk limits and enforcement
 * - Position sizing validation and caps
 * - Stop loss and emergency protocols
 * - Drawdown protection and circuit breakers
 * - Multi-agent safety coordination
 * - Real-time risk monitoring and alerts
 * - Recovery procedures and fail-safes
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { AdvancedRiskEngine } from '../../src/services/advanced-risk-engine';
import { ComprehensiveSafetyCoordinator } from '../../src/services/comprehensive-safety-coordinator';
import { EmergencySafetySystem } from '../../src/services/emergency-safety-system';
import { MultiPhaseTradingBot } from '../../src/services/multi-phase-trading-bot';
import { TradingStrategyManager } from '../../src/services/trading-strategy-manager';
import { PatternDetectionEngine } from '../../src/services/pattern-detection-engine';
import { TransactionLockService } from '../../src/services/transaction-lock-service';
import type { AgentBehaviorMetrics } from '../../src/mexc-agents/safety-monitor-agent';

describe('Comprehensive Risk Management', () => {
  let riskEngine: AdvancedRiskEngine;
  let safetyCoordinator: ComprehensiveSafetyCoordinator;
  let emergencySystem: EmergencySafetySystem;
  let tradingBot: MultiPhaseTradingBot;
  let strategyManager: TradingStrategyManager;
  let patternEngine: PatternDetectionEngine;
  let lockService: TransactionLockService;

  // Risk testing scenarios
  const RISK_SCENARIOS = {
    CONSERVATIVE_PORTFOLIO: {
      totalValue: 10000,
      maxRisk: 5,
      maxPositionSize: 2,
      stopLossThreshold: 10
    },
    MODERATE_PORTFOLIO: {
      totalValue: 50000,
      maxRisk: 10,
      maxPositionSize: 5,
      stopLossThreshold: 15
    },
    AGGRESSIVE_PORTFOLIO: {
      totalValue: 100000,
      maxRisk: 20,
      maxPositionSize: 10,
      stopLossThreshold: 25
    }
  };

  // Market stress test conditions
  const STRESS_CONDITIONS = {
    BLACK_SWAN: {
      priceDropPercent: 50,
      volumeSpike: 20,
      liquidityDrop: 80,
      volatilityIndex: 0.95
    },
    FLASH_CRASH: {
      priceDropPercent: 30,
      durationMinutes: 5,
      recoveryPercent: 60,
      marketHalt: true
    },
    LIQUIDITY_CRISIS: {
      bidAskSpread: 15,
      orderBookDepth: 10,
      slippageRisk: 25,
      marketMakerAbsence: true
    },
    MANIPULATION_ATTACK: {
      pumpPercent: 200,
      dumpPercent: 80,
      volumeAnomaly: 50,
      crossExchangeDeviation: 20
    }
  };

  beforeAll(() => {
    // Mock database and external dependencies
    vi.mock('../../src/db', () => ({
      db: {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: '1', createdAt: new Date() }])
          })
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
              orderBy: vi.fn().mockResolvedValue([])
            })
          })
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([])
          })
        })
      }
    }));
  });

  beforeEach(() => {
    // Initialize risk management components
    riskEngine = new AdvancedRiskEngine({
      maxPortfolioValue: RISK_SCENARIOS.MODERATE_PORTFOLIO.maxRisk,
      maxSinglePositionSize: RISK_SCENARIOS.MODERATE_PORTFOLIO.maxPositionSize,
      maxDailyLoss: 1000,
      maxDrawdown: 15,
      confidenceLevel: 0.95,
      lookbackPeriod: 30,
      correlationThreshold: 0.7,
      volatilityMultiplier: 1.2,
      adaptiveRiskScaling: true,
      marketRegimeDetection: true,
      stressTestingEnabled: true,
      emergencyVolatilityThreshold: 0.8,
      emergencyLiquidityThreshold: 0.3,
      emergencyCorrelationThreshold: 0.9
    });

    emergencySystem = new EmergencySafetySystem({
      priceDeviationThreshold: 20,
      volumeAnomalyThreshold: 5,
      correlationBreakThreshold: 0.5,
      liquidityGapThreshold: 10.0,
      autoResponseEnabled: true,
      emergencyHaltThreshold: 80,
      liquidationThreshold: 90,
      maxLiquidationSize: 10000,
      maxConcurrentEmergencies: 3,
      cooldownPeriod: 5,
      manualOverrideRequired: false,
      autoRecoveryEnabled: true,
      recoveryCheckInterval: 5
    });

    safetyCoordinator = new ComprehensiveSafetyCoordinator({
      agentMonitoringInterval: 500,
      riskAssessmentInterval: 250,
      systemHealthCheckInterval: 1000,
      criticalViolationThreshold: 3,
      riskScoreThreshold: 85,
      agentAnomalyThreshold: 80,
      autoEmergencyShutdown: true,
      emergencyContactEnabled: false,
      safetyOverrideRequired: false
    });

    lockService = TransactionLockService.getInstance();

    // Initialize trading components
    strategyManager = new TradingStrategyManager();
    patternEngine = PatternDetectionEngine.getInstance();
    
    const testStrategy = {
      id: 'risk-test-strategy',
      name: 'Risk Management Test Strategy',
      levels: [
        { percentage: 50, multiplier: 1.5, sellPercentage: 25 },
        { percentage: 100, multiplier: 2.0, sellPercentage: 30 },
        { percentage: 200, multiplier: 3.0, sellPercentage: 45 }
      ]
    };

    tradingBot = new MultiPhaseTradingBot(
      testStrategy, 
      2500, // $2.5k position 
      RISK_SCENARIOS.MODERATE_PORTFOLIO.totalValue
    );

    // Wire up event handlers for testing
    setupEventHandlers();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function setupEventHandlers() {
    // Track safety events for assertions
    const safetyEvents: any[] = [];
    
    emergencySystem.on('emergency_stop', (event) => {
      safetyEvents.push({ type: 'emergency_stop', ...event });
    });
    
    riskEngine.on('risk_threshold_exceeded', (event) => {
      safetyEvents.push({ type: 'risk_exceeded', ...event });
    });
    
    safetyCoordinator.on('safety_alert', (event) => {
      safetyEvents.push({ type: 'safety_alert', ...event });
    });

    // Store events for test assertions
    (globalThis as any).testSafetyEvents = safetyEvents;
  }

  describe('Portfolio Risk Limits', () => {
    it('should enforce maximum portfolio risk percentage', async () => {
      // Arrange: Portfolio at 8% risk, attempting 5% additional position
      await riskEngine.updatePortfolioMetrics({
        totalValue: 50000,
        currentRisk: 8.0,
        unrealizedPnL: -4000
      });

      const newPositionRequest = {
        symbol: 'HIGHRISKUSDT',
        entryPrice: 1.0,
        requestedPositionSize: 2500, // 5% of portfolio
        estimatedRisk: 5.0,
        portfolioValue: 50000
      };

      // Act: Validate position against risk limits
      const decision = await riskEngine.validatePositionSize(newPositionRequest);

      // Assert: Should reject or significantly reduce position
      if (decision.approved) {
        expect(decision.adjustedPositionSize).toBeLessThan(1000); // Heavily reduced
        expect(decision.warnings).toContain('approaching_risk_limit');
      } else {
        expect(decision.approved).toBe(false);
        expect(decision.rejectionReason).toContain('portfolio_risk_exceeded');
      }
    });

    it('should implement diversification requirements', async () => {
      // Arrange: Concentrated positions in correlated assets
      const portfolioPositions = [
        { symbol: 'BTCUSDT', value: 15000, correlation: 1.0 },
        { symbol: 'ETHUSDT', value: 10000, correlation: 0.8 }, // High correlation with BTC
        { symbol: 'ADAUSDT', value: 5000, correlation: 0.6 }
      ];

      await riskEngine.updatePortfolioPositions(portfolioPositions);

      const newCorrelatedPosition = {
        symbol: 'LINKUSDT', // Also crypto, likely correlated
        entryPrice: 10.0,
        requestedPositionSize: 1000,
        correlationWithPortfolio: 0.75
      };

      // Act: Check diversification
      const diversificationCheck = await riskEngine.assessDiversificationRisk(newCorrelatedPosition);

      // Assert: Should flag concentration risk
      expect(diversificationCheck.concentrationRisk).toBe('high');
      expect(diversificationCheck.recommendedMaxPosition).toBeLessThan(1000);
      expect(diversificationCheck.warnings).toContain('sector_concentration');
    });

    it('should monitor correlation risk in real-time', async () => {
      // Arrange: Portfolio with correlated positions
      const correlatedPositions = [
        { symbol: 'BTCUSDT', value: 10000, beta: 1.0 },
        { symbol: 'ETHUSDT', value: 8000, beta: 1.2 },
        { symbol: 'BNBUSDT', value: 6000, beta: 0.9 }
      ];

      // Simulate market crash affecting all crypto
      const marketStressEvent = {
        marketDirection: 'down',
        correlationSpike: 0.95, // All cryptos moving together
        volatilityIncrease: 200,
        liquidityDecrease: 60
      };

      // Act: Update correlation matrix during stress
      await riskEngine.updateCorrelationMatrix(correlatedPositions, marketStressEvent);
      const correlationRisk = await riskEngine.calculateCorrelationRisk();

      // Assert: Should detect elevated correlation risk
      expect(correlationRisk.overallCorrelation).toBeGreaterThan(0.8);
      expect(correlationRisk.riskLevel).toBe('critical');
      expect(correlationRisk.recommendedAction).toBe('reduce_positions');
    });
  });

  describe('Position Sizing and Validation', () => {
    it('should enforce maximum position size per trade', async () => {
      // Arrange: Large position request exceeding limits
      const largePositionRequest = {
        symbol: 'LARGEPOSUSDT',
        entryPrice: 1.0,
        requestedPositionSize: 8000, // 16% of $50k portfolio (exceeds 5% limit)
        portfolioValue: 50000,
        confidence: 85
      };

      // Act: Validate position size
      const validation = await riskEngine.validatePositionSize(largePositionRequest);

      // Assert: Should cap position size
      expect(validation.approved).toBe(true);
      expect(validation.adjustedPositionSize).toBeLessThanOrEqual(2500); // 5% cap
      expect(validation.positionSizeRatio).toBeLessThanOrEqual(0.05);
      expect(validation.adjustmentReason).toBe('position_size_capped');
    });

    it('should adjust position size based on market volatility', async () => {
      // Arrange: High volatility market conditions
      const volatileMarketConditions = {
        volatilityIndex: 0.85,
        averageTrueRange: 12.5,
        recentMaxDrawdown: 18,
        liquidityScore: 0.4
      };

      await riskEngine.updateMarketConditions(volatileMarketConditions);

      const standardPositionRequest = {
        symbol: 'VOLATILEUSDT',
        entryPrice: 100.0,
        requestedPositionSize: 2500, // Normal 5% position
        portfolioValue: 50000
      };

      // Act: Calculate volatility-adjusted position size
      const adjustedPosition = await riskEngine.calculateVolatilityAdjustedPosition(standardPositionRequest);

      // Assert: Should reduce position size for high volatility
      expect(adjustedPosition.adjustedSize).toBeLessThan(standardPositionRequest.requestedPositionSize);
      expect(adjustedPosition.volatilityReduction).toBeGreaterThan(0);
      expect(adjustedPosition.reasoning).toContain('high_volatility');
    });

    it('should validate stop loss placement', async () => {
      // Arrange: Position with various stop loss scenarios
      const stopLossScenarios = [
        { entryPrice: 100, stopLoss: 85, expected: 'valid' }, // 15% stop loss
        { entryPrice: 100, stopLoss: 50, expected: 'too_wide' }, // 50% stop loss
        { entryPrice: 100, stopLoss: 98, expected: 'too_tight' }, // 2% stop loss
        { entryPrice: 100, stopLoss: 105, expected: 'invalid' } // Stop above entry
      ];

      // Act & Assert: Validate each scenario
      for (const scenario of stopLossScenarios) {
        const validation = await riskEngine.validateStopLossPlacement({
          symbol: 'TESTUSDT',
          entryPrice: scenario.entryPrice,
          stopLoss: scenario.stopLoss,
          positionSize: 1000
        });

        if (scenario.expected === 'valid') {
          expect(validation.isValid).toBe(true);
        } else {
          expect(validation.isValid).toBe(false);
          expect(validation.issues).toContain(scenario.expected);
        }
      }
    });
  });

  describe('Emergency Protocols and Circuit Breakers', () => {
    it('should trigger emergency stop on rapid portfolio decline', async () => {
      // Arrange: Rapid portfolio decline simulation
      const portfolioDeclineSequence = [
        { value: 50000, timestamp: Date.now() },
        { value: 47500, timestamp: Date.now() + 1000 }, // -5%
        { value: 45000, timestamp: Date.now() + 2000 }, // -10%
        { value: 42500, timestamp: Date.now() + 3000 }, // -15%
        { value: 40000, timestamp: Date.now() + 4000 }  // -20% (should trigger)
      ];

      let emergencyTriggered = false;
      emergencySystem.on('emergency_stop', () => {
        emergencyTriggered = true;
      });

      // Act: Process portfolio decline
      for (const update of portfolioDeclineSequence) {
        await riskEngine.updatePortfolioMetrics(update);
        await emergencySystem.assessPortfolioHealth({
          totalValue: update.value,
          positions: [{ symbol: 'TESTUSDT', value: update.value, pnl: update.value - 50000 }],
          riskMetrics: { totalExposure: 0.8, maxDrawdown: 20 }
        });
      }

      // Assert: Emergency stop should be triggered
      expect(emergencyTriggered).toBe(true);
      expect(emergencySystem.isEmergencyActive()).toBe(true);
      expect(riskEngine.isEmergencyModeActive()).toBe(true);
    });

    it('should implement circuit breakers for consecutive losses', async () => {
      // Arrange: Consecutive losing trades
      const consecutiveLosses = [
        { symbol: 'LOSS1USDT', pnl: -500, timestamp: Date.now() },
        { symbol: 'LOSS2USDT', pnl: -300, timestamp: Date.now() + 60000 },
        { symbol: 'LOSS3USDT', pnl: -450, timestamp: Date.now() + 120000 },
        { symbol: 'LOSS4USDT', pnl: -200, timestamp: Date.now() + 180000 },
        { symbol: 'LOSS5USDT', pnl: -350, timestamp: Date.now() + 240000 }
      ];

      let circuitBreakerTriggered = false;
      emergencySystem.on('circuit_breaker_activated', () => {
        circuitBreakerTriggered = true;
      });

      // Act: Process consecutive losses
      for (const loss of consecutiveLosses) {
        emergencySystem.recordTradeResult({
          success: false,
          symbol: loss.symbol,
          amount: 1000,
          pnl: loss.pnl,
          timestamp: new Date(loss.timestamp).toISOString()
        });
      }

      // Assert: Circuit breaker should activate
      expect(circuitBreakerTriggered).toBe(true);
      expect(emergencySystem.getConsecutiveLossCount()).toBe(5);
      expect(emergencySystem.isTradingHalted()).toBe(true);
    });

    it('should coordinate multi-agent safety shutdown', async () => {
      // Arrange: Critical system state requiring coordinated shutdown
      const criticalSystemState = {
        portfolioRisk: 95, // Critical risk level
        agentAnomalies: 3, // Multiple agent issues
        marketVolatility: 0.98, // Extreme volatility
        connectivityIssues: true,
        dataIntegrityViolations: 2
      };

      const shutdownEvents: string[] = [];
      safetyCoordinator.on('coordinated_shutdown', (event) => {
        shutdownEvents.push(event.reason);
      });

      // Act: Trigger coordinated safety assessment
      await safetyCoordinator.assessSystemSafety(criticalSystemState);

      // Assert: Should initiate coordinated shutdown
      expect(shutdownEvents).toContain('critical_system_state');
      expect(safetyCoordinator.isSystemHalted()).toBe(true);
    });
  });

  describe('Real-time Risk Monitoring', () => {
    it('should monitor position-level risk in real-time', async () => {
      // Arrange: Active position with changing conditions
      tradingBot.initializePosition('REALTIMERISKUSDT', 100, 1000);
      
      const riskMetrics: any[] = [];
      riskEngine.on('position_risk_update', (metrics) => {
        riskMetrics.push(metrics);
      });

      // Act: Simulate price movements with risk monitoring
      const priceMovements = [105, 110, 95, 85, 80, 90, 120]; // Volatile movements
      
      for (const price of priceMovements) {
        await riskEngine.updatePositionRisk('REALTIMERISKUSDT', {
          currentPrice: price,
          entryPrice: 100,
          positionSize: 1000,
          unrealizedPnL: (price - 100) * 10 // 10 units
        });
      }

      // Assert: Should track risk metrics continuously
      expect(riskMetrics.length).toBe(priceMovements.length);
      
      // Should detect maximum drawdown
      const maxDrawdown = Math.max(...riskMetrics.map(m => m.drawdown || 0));
      expect(maxDrawdown).toBeGreaterThan(15); // From $100 to $80 = 20% drawdown
      
      // Should flag high-risk periods
      const highRiskPeriods = riskMetrics.filter(m => m.riskLevel === 'high');
      expect(highRiskPeriods.length).toBeGreaterThan(0);
    });

    it('should detect and respond to flash crash scenarios', async () => {
      // Arrange: Flash crash simulation
      tradingBot.initializePosition('FLASHCRASHUSDT', 100, 2000);
      
      const flashCrashSequence = [
        { price: 100, volume: 1000000, timestamp: Date.now() },
        { price: 95, volume: 2000000, timestamp: Date.now() + 1000 },
        { price: 85, volume: 5000000, timestamp: Date.now() + 2000 }, // Flash crash
        { price: 75, volume: 8000000, timestamp: Date.now() + 3000 }, // Bottom
        { price: 82, volume: 3000000, timestamp: Date.now() + 4000 }  // Recovery
      ];

      const crashDetected = await riskEngine.detectFlashCrash(flashCrashSequence);

      // Assert: Should detect flash crash pattern
      expect(crashDetected.isFlashCrash).toBe(true);
      expect(crashDetected.severity).toBe('critical');
      expect(crashDetected.maxDropPercent).toBeGreaterThanOrEqual(25);
      expect(crashDetected.volumeSpike).toBeGreaterThan(5);
    });

    it('should implement adaptive risk thresholds', async () => {
      // Arrange: Different market regime conditions
      const marketRegimes = [
        { name: 'bull_market', volatility: 0.3, trend: 'up', sentiment: 'positive' },
        { name: 'bear_market', volatility: 0.6, trend: 'down', sentiment: 'negative' },
        { name: 'sideways', volatility: 0.4, trend: 'neutral', sentiment: 'mixed' },
        { name: 'crisis', volatility: 0.9, trend: 'down', sentiment: 'panic' }
      ];

      // Act: Test adaptive thresholds for each regime
      const adaptiveThresholds = [];
      
      for (const regime of marketRegimes) {
        const thresholds = await riskEngine.calculateAdaptiveThresholds(regime);
        adaptiveThresholds.push({ regime: regime.name, thresholds });
      }

      // Assert: Thresholds should adapt to market conditions
      const bullThresholds = adaptiveThresholds.find(t => t.regime === 'bull_market')?.thresholds;
      const crisisThresholds = adaptiveThresholds.find(t => t.regime === 'crisis')?.thresholds;

      expect(bullThresholds?.maxPositionSize).toBeGreaterThan(crisisThresholds?.maxPositionSize);
      expect(bullThresholds?.stopLossThreshold).toBeGreaterThan(crisisThresholds?.stopLossThreshold);
      expect(crisisThresholds?.riskReductionFactor).toBeGreaterThan(bullThresholds?.riskReductionFactor);
    });
  });

  describe('Stress Testing and Edge Cases', () => {
    it('should handle black swan market events', async () => {
      // Arrange: Black swan event simulation
      const blackSwanEvent = STRESS_CONDITIONS.BLACK_SWAN;
      
      // Initialize multiple positions before event
      tradingBot.initializePosition('BTCUSDT', 50000, 0.4);
      tradingBot.initializePosition('ETHUSDT', 3000, 5);
      tradingBot.initializePosition('ADAUSDT', 2, 1000);

      // Act: Simulate black swan event
      const stressTestResult = await riskEngine.runStressTest({
        scenario: 'black_swan',
        priceShocks: {
          'BTCUSDT': -blackSwanEvent.priceDropPercent,
          'ETHUSDT': -blackSwanEvent.priceDropPercent * 1.2, // Alts hit harder
          'ADAUSDT': -blackSwanEvent.priceDropPercent * 1.5
        },
        marketConditions: {
          volatility: blackSwanEvent.volatilityIndex,
          liquidityReduction: blackSwanEvent.liquidityDrop,
          volumeSpike: blackSwanEvent.volumeSpike
        }
      });

      // Assert: Should survive stress test with proper risk management
      expect(stressTestResult.portfolioSurvival).toBe(true);
      expect(stressTestResult.maxDrawdown).toBeLessThan(30); // Should limit drawdown
      expect(stressTestResult.emergencyActionsTriggered).toBeGreaterThan(0);
    });

    it('should handle liquidity crisis scenarios', async () => {
      // Arrange: Liquidity crisis conditions
      const liquidityCrisis = STRESS_CONDITIONS.LIQUIDITY_CRISIS;
      
      // Mock order book with wide spreads and thin depth
      const thinOrderBook = {
        bids: [[0.85, 100]], // Very wide spread
        asks: [[1.15, 100]],
        depth: 200, // Minimal depth
        spread: 0.30 // 30% spread
      };

      // Act: Attempt trading during liquidity crisis
      const liquidityAssessment = await riskEngine.assessLiquidityRisk({
        orderBook: thinOrderBook,
        recentVolume: 50000, // Low volume
        marketMakerActivity: 'absent',
        slippageRisk: liquidityCrisis.slippageRisk
      });

      // Assert: Should restrict trading during liquidity crisis
      expect(liquidityAssessment.tradingRecommendation).toBe('avoid');
      expect(liquidityAssessment.maxPositionSize).toBeLessThan(100);
      expect(liquidityAssessment.warnings).toContain('extreme_illiquidity');
    });

    it('should detect and prevent manipulation attacks', async () => {
      // Arrange: Manipulation attack simulation
      const manipulationAttack = STRESS_CONDITIONS.MANIPULATION_ATTACK;
      
      const suspiciousActivity = {
        rapidPriceMovement: manipulationAttack.pumpPercent,
        volumeAnomaly: manipulationAttack.volumeAnomaly,
        orderBookManipulation: true,
        crossExchangeDeviation: manipulationAttack.crossExchangeDeviation,
        coordinatedTrading: true
      };

      // Act: Analyze for manipulation
      const manipulationDetection = await riskEngine.detectManipulation(suspiciousActivity);

      // Assert: Should detect and respond to manipulation
      expect(manipulationDetection.manipulationScore).toBeGreaterThan(0.8);
      expect(manipulationDetection.riskLevel).toBe('critical');
      expect(manipulationDetection.recommendedAction).toBe('halt_trading');
      expect(manipulationDetection.indicators).toContain('coordinated_pump');
    });
  });

  describe('Recovery and Fail-Safe Mechanisms', () => {
    it('should implement graceful degradation under system stress', async () => {
      // Arrange: System resource constraints
      const resourceConstraints = {
        memoryUsage: 0.85, // 85% memory usage
        cpuUsage: 0.90, // 90% CPU usage
        networkLatency: 2000, // 2s latency
        databaseConnections: 0.95 // 95% of max connections
      };

      // Act: Implement graceful degradation
      const degradationPlan = await safetyCoordinator.implementGracefulDegradation(resourceConstraints);

      // Assert: Should reduce functionality appropriately
      expect(degradationPlan.tradingEnabled).toBe(true); // Core function maintained
      expect(degradationPlan.reducedFunctionality).toContain('pattern_analysis');
      expect(degradationPlan.monitoringInterval).toBeGreaterThan(500); // Reduced monitoring frequency
      expect(degradationPlan.maxConcurrentPositions).toBeLessThan(10); // Reduced concurrency
    });

    it('should recover from system failures with data integrity', async () => {
      // Arrange: System failure scenario
      const failureScenario = {
        type: 'database_failure',
        duration: 30000, // 30 second outage
        dataLoss: false,
        backupAvailable: true
      };

      // Act: Simulate failure and recovery
      await safetyCoordinator.simulateSystemFailure(failureScenario);
      const recoveryResult = await safetyCoordinator.initiateRecovery();

      // Assert: Should recover with data integrity
      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.dataIntegrityVerified).toBe(true);
      expect(recoveryResult.recoveryTime).toBeLessThan(60000); // Under 1 minute
      expect(recoveryResult.lostTransactions).toBe(0);
    });

    it('should maintain transaction integrity during concurrent operations', async () => {
      // Arrange: Concurrent trading operations
      const concurrentOperations = Array.from({ length: 10 }, (_, i) => ({
        id: `concurrent-op-${i}`,
        symbol: `TEST${i}USDT`,
        operation: 'buy',
        amount: 100 + i * 10,
        price: 1.0 + i * 0.1
      }));

      // Act: Execute concurrent operations with locks
      const results = await Promise.allSettled(
        concurrentOperations.map(async (op) => {
          const lockConfig = {
            resourceId: `trade_${op.symbol}`,
            ownerId: 'test-user',
            ownerType: 'system' as const,
            transactionType: 'trade' as const,
            transactionData: op
          };
          
          return await lockService.executeWithLock(lockConfig, async () => {
            // Simulate trade execution
            await new Promise(resolve => setTimeout(resolve, 100));
            return { success: true, orderId: `order-${op.id}` };
          });
        })
      );

      // Assert: All operations should complete successfully
      const successfulOperations = results.filter(r => r.status === 'fulfilled').length;
      expect(successfulOperations).toBe(concurrentOperations.length);
      
      // All operations should succeed (no deadlocks)
      expect(successfulOperations).toBe(concurrentOperations.length);
    });
  });

  describe('Performance Under Risk Constraints', () => {
    it('should maintain performance with risk monitoring overhead', async () => {
      // Arrange: High-frequency operation simulation
      const operationCount = 1000;
      const startTime = performance.now();

      // Act: Execute operations with full risk monitoring
      const results = await Promise.all(
        Array.from({ length: operationCount }, async (_, i) => {
          const price = 100 + Math.sin(i * 0.1) * 10; // Simulated price movement
          
          await riskEngine.validateTrade({
            symbol: 'PERFTEST',
            price,
            amount: 100,
            side: 'buy'
          });
          
          return { success: true, price };
        })
      );

      const executionTime = performance.now() - startTime;
      const avgLatency = executionTime / operationCount;

      // Assert: Performance should be acceptable
      expect(results.length).toBe(operationCount);
      expect(avgLatency).toBeLessThan(10); // Less than 10ms per operation
      expect(executionTime).toBeLessThan(30000); // Under 30 seconds total
    });

    it('should scale risk monitoring with portfolio size', async () => {
      // Arrange: Different portfolio sizes
      const portfolioSizes = [10000, 50000, 100000, 500000, 1000000];
      const scalingMetrics = [];

      // Act: Test risk monitoring performance at different scales
      for (const portfolioSize of portfolioSizes) {
        const startTime = performance.now();
        
        // Create portfolio positions proportional to size
        const positionCount = Math.floor(portfolioSize / 10000);
        const positions = Array.from({ length: positionCount }, (_, i) => ({
          symbol: `SCALE${i}USDT`,
          value: portfolioSize / positionCount,
          entryPrice: 100,
          currentPrice: 100 + Math.random() * 20
        }));

        await riskEngine.updatePortfolioPositions(positions);
        await riskEngine.calculatePortfolioRisk();
        
        const processingTime = performance.now() - startTime;
        scalingMetrics.push({ portfolioSize, positionCount, processingTime });
      }

      // Assert: Processing time should scale reasonably
      const largestPortfolio = scalingMetrics[scalingMetrics.length - 1];
      const smallestPortfolio = scalingMetrics[0];
      
      // Should not scale linearly (optimization should help)
      const scalingFactor = largestPortfolio.processingTime / smallestPortfolio.processingTime;
      const portfolioSizeFactor = largestPortfolio.portfolioSize / smallestPortfolio.portfolioSize;
      
      expect(scalingFactor).toBeLessThan(portfolioSizeFactor * 0.5); // Better than linear scaling
    });
  });
});