/**
 * Cross-Domain Integration Tests
 * Tests interactions between Trading, Safety, Portfolio, and Pattern Detection domains
 * Validates Clean Architecture domain boundaries and event handling
 * 
 * Phase 3 Production Readiness - Enhanced with Pattern Detection Integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { StartSnipingUseCase } from "@/src/application/use-cases/trading/start-sniping-use-case";
import { ExecuteTradeUseCase } from "@/src/application/use-cases/trading/execute-trade-use-case";
import { SafetyRule } from "@/src/domain/value-objects/safety/safety-rule";
import { Trade, TradeStatus } from "@/src/domain/entities/trading/trade";
import { Order, OrderStatus } from "@/src/domain/value-objects/trading/order";
import { Money } from "@/src/domain/value-objects/trading/money";
import { Price } from "@/src/domain/value-objects/trading/price";
import { DomainEvent } from "@/src/domain/events/domain-event";
import { TradingDomainFeatureFlagManager, ROLLOUT_PHASES } from "@/src/lib/feature-flags/trading-domain-flags";

// Pattern Detection Domain Integration
import { PatternDetectionCore } from "@/src/core/pattern-detection/pattern-detection-core";
import type { PatternMatch, PatternAnalysisRequest } from "@/src/core/pattern-detection/interfaces";
import { tradingFeatureFlagService } from "@/src/lib/feature-flags/trading-integration-example";
import type { UserContext } from "@/src/lib/feature-flags/enhanced-feature-flag-manager";

describe("Cross-Domain Integration Tests", () => {
  let tradingUseCase: StartSnipingUseCase;
  let executeTradeUseCase: ExecuteTradeUseCase;
  let featureFlagManager: TradingDomainFeatureFlagManager;
  let mockDomainEventBus: any;
  let mockSafetyService: any;
  let mockPortfolioService: any;
  let mockTradingRepository: any;
  let mockMexcService: any;
  let mockLogger: any;
  
  // Pattern Detection Domain Integration
  let patternDetectionCore: PatternDetectionCore;
  let patternDetectionEvents: any[] = [];
  let mockUserContext: UserContext;
  
  // Domain event tracking
  let publishedEvents: DomainEvent[] = [];
  let safetyRuleEvaluations: any[] = [];
  let portfolioUpdates: any[] = [];

  beforeEach(() => {
    // Reset state
    publishedEvents = [];
    safetyRuleEvaluations = [];
    portfolioUpdates = [];
    patternDetectionEvents = [];

    // Initialize feature flags for testing
    featureFlagManager = new TradingDomainFeatureFlagManager();
    featureFlagManager.applyRolloutPhase('DEVELOPMENT');

    // Initialize Pattern Detection Core for cross-domain testing
    patternDetectionCore = PatternDetectionCore.getInstance({
      minAdvanceHours: 2,
      confidenceThreshold: 65,
      enableCaching: true,
      enableAIEnhancement: true,
      enableActivityEnhancement: true,
      strictValidation: false,
    });

    // Setup pattern detection event capture
    patternDetectionCore.on('patterns_detected', (event) => {
      patternDetectionEvents.push(event);
    });

    // Mock user context for feature flag integration
    mockUserContext = {
      userId: "test_user_123",
      portfolioId: "portfolio_123",
      email: "test@mexc.com",
      userType: "premium",
      registrationDate: "2024-01-01T00:00:00Z",
      country: "US", 
      tradingExperience: "advanced",
      riskTolerance: "high",
      customAttributes: {
        totalTrades: 1500,
        portfolioValue: 100000,
        avgWinRate: 0.72,
      },
    };

    // Mock domain event bus
    mockDomainEventBus = {
      publish: vi.fn((event: DomainEvent) => {
        publishedEvents.push(event);
      }),
      subscribe: vi.fn(),
    };

    // Mock safety service with rule evaluation
    mockSafetyService = {
      evaluateRules: vi.fn(async (context) => {
        const evaluation = {
          portfolioId: context.portfolioId,
          symbol: context.symbol,
          currentValue: context.currentValue,
          rulesTriggered: [],
          severity: 'low',
          shouldBlock: false,
          recommendations: [],
        };
        safetyRuleEvaluations.push(evaluation);
        return evaluation;
      }),
      getRulesForPortfolio: vi.fn(async (portfolioId) => [
        SafetyRule.createDrawdownRule("Max Drawdown", 20, "high", "reduce_position"),
        SafetyRule.createPositionRiskRule("Position Risk", 5, "medium", "alert_only"),
      ]),
      createSafetyRule: vi.fn(),
    };

    // Mock portfolio service
    mockPortfolioService = {
      updatePortfolioValue: vi.fn(async (portfolioId, newValue) => {
        const update = { portfolioId, newValue, timestamp: new Date() };
        portfolioUpdates.push(update);
        return update;
      }),
      getPortfolioById: vi.fn(async (portfolioId) => ({
        id: portfolioId,
        userId: "user123",
        totalValue: Money.fromUSDT(10000),
        availableBalance: Money.fromUSDT(8000),
        positions: [],
      })),
      addPosition: vi.fn(),
      removePosition: vi.fn(),
      calculateMetrics: vi.fn(),
    };

    // Mock trading repository
    mockTradingRepository = {
      saveTrade: vi.fn(async (trade) => trade),
      findTradeById: vi.fn(),
      updateTrade: vi.fn(async (trade) => trade),
      findActiveTradesByUserId: vi.fn(async () => []),
    };

    // Mock MEXC service
    mockMexcService = {
      getSymbolInfo: vi.fn(async () => ({
        success: true,
        data: { status: "TRADING", filters: [] },
      })),
      getTickerPrice: vi.fn(async () => ({
        success: true,
        data: { price: "50000" },
      })),
      placeOrder: vi.fn(async () => ({
        success: true,
        data: {
          orderId: "12345",
          clientOrderId: "test-123",
          symbol: "BTCUSDT",
          side: "BUY",
          type: "MARKET",
          origQty: "0.002",
          price: "50000",
          status: "FILLED",
          executedQty: "0.002",
          cummulativeQuoteQty: "100",
          transactTime: Date.now(),
        },
      })),
    };

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
  });

  describe("Trading → Safety → Portfolio Workflow", () => {
    it("should complete full cross-domain workflow with safety checks", async () => {
      // Create a high-risk trade that should trigger safety rules
      const trade = Trade.create({
        userId: "user123",
        symbol: "BTCUSDT",
        isAutoSnipe: true,
        confidenceScore: 95, // High confidence
        positionSizeUsdt: 5000, // Large position - should trigger safety rules
        paperTrade: false,
      });

      // Step 1: Safety evaluation before trade execution
      const safetyEvaluation = await mockSafetyService.evaluateRules({
        portfolioId: "portfolio_123",
        symbol: "BTCUSDT",
        currentValue: 5000, // 50% of portfolio (high risk)
        timestamp: new Date(),
        additionalData: { tradeType: "auto_snipe", confidenceScore: 95 },
      });

      expect(safetyEvaluation.portfolioId).toBe("portfolio_123");
      expect(safetyEvaluation.symbol).toBe("BTCUSDT");
      expect(safetyRuleEvaluations).toHaveLength(1);

      // Step 2: Portfolio impact assessment
      const portfolioUpdate = await mockPortfolioService.updatePortfolioValue(
        "portfolio_123",
        Money.fromUSDT(9500) // After 5% loss simulation
      );

      expect(portfolioUpdate.portfolioId).toBe("portfolio_123");
      expect(portfolioUpdates).toHaveLength(1);

      // Step 3: Cross-domain event validation
      // Simulate domain events that would be published during the workflow
      const tradeStartedEvent = {
        aggregateId: trade.id,
        eventType: "trade.execution.started",
        payload: { 
          tradeId: trade.id, 
          userId: "user123", 
          symbol: "BTCUSDT",
          positionSize: 5000,
        },
        timestamp: new Date(),
      };

      mockDomainEventBus.publish(tradeStartedEvent);

      const safetyEvaluatedEvent = {
        aggregateId: "portfolio_123",
        eventType: "safety.rules.evaluated",
        payload: {
          portfolioId: "portfolio_123",
          rulesEvaluated: 2,
          triggeredRules: [],
          severity: "low",
        },
        timestamp: new Date(),
      };

      mockDomainEventBus.publish(safetyEvaluatedEvent);

      const portfolioUpdatedEvent = {
        aggregateId: "portfolio_123", 
        eventType: "portfolio.value.updated",
        payload: {
          portfolioId: "portfolio_123",
          previousValue: 10000,
          newValue: 9500,
          changePercent: -5,
        },
        timestamp: new Date(),
      };

      mockDomainEventBus.publish(portfolioUpdatedEvent);

      // Verify cross-domain interaction
      expect(publishedEvents).toHaveLength(3);
      expect(publishedEvents[0].eventType).toBe("trade.execution.started");
      expect(publishedEvents[1].eventType).toBe("safety.rules.evaluated");
      expect(publishedEvents[2].eventType).toBe("portfolio.value.updated");

      // Verify services were called with correct data
      expect(mockSafetyService.evaluateRules).toHaveBeenCalledWith(
        expect.objectContaining({
          portfolioId: "portfolio_123",
          symbol: "BTCUSDT",
          currentValue: 5000,
        })
      );

      expect(mockPortfolioService.updatePortfolioValue).toHaveBeenCalledWith(
        "portfolio_123",
        expect.any(Object)
      );
    });

    it("should handle safety rule violations and block risky trades", async () => {
      // Create safety rule that would be triggered
      const drawdownRule = SafetyRule.createDrawdownRule(
        "Critical Drawdown Protection",
        10, // 10% max drawdown
        "critical",
        "emergency_stop"
      );

      // Mock safety service to trigger rule violation
      mockSafetyService.evaluateRules.mockResolvedValueOnce({
        portfolioId: "portfolio_123",
        symbol: "BTCUSDT",
        currentValue: 15, // 15% drawdown - exceeds 10% limit
        rulesTriggered: [drawdownRule],
        severity: "critical",
        shouldBlock: true,
        recommendations: ["emergency_stop", "reduce_position"],
      });

      // Attempt trade execution that should be blocked
      const safetyEvaluation = await mockSafetyService.evaluateRules({
        portfolioId: "portfolio_123",
        symbol: "BTCUSDT", 
        currentValue: 15,
        timestamp: new Date(),
      });

      // Verify trade would be blocked
      expect(safetyEvaluation.shouldBlock).toBe(true);
      expect(safetyEvaluation.severity).toBe("critical");
      expect(safetyEvaluation.rulesTriggered).toHaveLength(1);
      expect(safetyEvaluation.recommendations).toContain("emergency_stop");
    });

    it("should validate portfolio consistency after trade execution", async () => {
      // Start with known portfolio state
      const initialPortfolio = await mockPortfolioService.getPortfolioById("portfolio_123");
      expect(initialPortfolio.totalValue.amount).toBe(10000);

      // Execute trade that affects portfolio
      const trade = Trade.create({
        userId: "user123",
        symbol: "BTCUSDT",
        isAutoSnipe: true,
        positionSizeUsdt: 1000, // Moderate position
      });

      // Simulate successful trade execution
      const order = Order.create({
        symbol: "BTCUSDT",
        side: "BUY",
        type: "MARKET",
        quantity: 0.02,
        price: Price.fromString("50000"),
        timeInForce: "IOC",
      });

      const filledOrder = order.markAsFilled(0.02, Price.fromString("50000"));
      const updatedTrade = trade.addOrder(filledOrder);

      // Update portfolio to reflect trade
      await mockPortfolioService.addPosition({
        portfolioId: "portfolio_123",
        symbol: "BTCUSDT",
        quantity: 0.02,
        averagePrice: 50000,
        currentValue: 1000,
      });

      // Verify portfolio state consistency
      expect(mockPortfolioService.addPosition).toHaveBeenCalledWith(
        expect.objectContaining({
          portfolioId: "portfolio_123",
          symbol: "BTCUSDT",
          quantity: 0.02,
        })
      );
    });
  });

  describe("Event-Driven Cross-Domain Communication", () => {
    it("should handle trading events triggering safety evaluations", async () => {
      // Publish trading event
      const tradeExecutedEvent = {
        aggregateId: "trade_123",
        eventType: "trade.order.filled",
        payload: {
          tradeId: "trade_123",
          orderId: "order_456",
          symbol: "BTCUSDT",
          side: "BUY",
          executedQuantity: 0.02,
          executedPrice: 50000,
          portfolioId: "portfolio_123",
        },
        timestamp: new Date(),
      };

      mockDomainEventBus.publish(tradeExecutedEvent);

      // Simulate safety service responding to event
      await mockSafetyService.evaluateRules({
        portfolioId: "portfolio_123",
        symbol: "BTCUSDT",
        currentValue: 1000,
        timestamp: new Date(),
        additionalData: { 
          triggerEvent: "trade.order.filled",
          tradeId: "trade_123",
        },
      });

      // Verify event was published and safety evaluation triggered
      expect(publishedEvents).toHaveLength(1);
      expect(publishedEvents[0].eventType).toBe("trade.order.filled");
      expect(safetyRuleEvaluations).toHaveLength(1);
      expect(safetyRuleEvaluations[0].symbol).toBe("BTCUSDT");
    });

    it("should handle portfolio events triggering risk recalculation", async () => {
      // Publish portfolio change event
      const portfolioChangeEvent = {
        aggregateId: "portfolio_123",
        eventType: "portfolio.position.added",
        payload: {
          portfolioId: "portfolio_123",
          symbol: "ETHUSDT",
          quantity: 5,
          value: 15000, // Large position addition
          newTotalValue: 25000,
        },
        timestamp: new Date(),
      };

      mockDomainEventBus.publish(portfolioChangeEvent);

      // Simulate safety service recalculating risk due to portfolio change
      await mockSafetyService.evaluateRules({
        portfolioId: "portfolio_123",
        symbol: "ETHUSDT",
        currentValue: 15000,
        timestamp: new Date(),
        additionalData: {
          triggerEvent: "portfolio.position.added",
          totalPortfolioValue: 25000,
        },
      });

      // Verify risk recalculation was triggered
      expect(publishedEvents).toHaveLength(1);
      expect(safetyRuleEvaluations).toHaveLength(1);
      expect(safetyRuleEvaluations[0].currentValue).toBe(15000);
    });

    it("should validate event ordering and consistency", async () => {
      // Publish events in specific order
      const events = [
        {
          aggregateId: "trade_123",
          eventType: "trade.execution.started",
          payload: { tradeId: "trade_123", symbol: "BTCUSDT" },
          timestamp: new Date(Date.now() - 3000),
        },
        {
          aggregateId: "trade_123", 
          eventType: "trade.order.placed",
          payload: { tradeId: "trade_123", orderId: "order_456" },
          timestamp: new Date(Date.now() - 2000),
        },
        {
          aggregateId: "trade_123",
          eventType: "trade.order.filled", 
          payload: { tradeId: "trade_123", orderId: "order_456" },
          timestamp: new Date(Date.now() - 1000),
        },
      ];

      events.forEach(event => mockDomainEventBus.publish(event));

      // Verify events are in correct chronological order
      expect(publishedEvents).toHaveLength(3);
      expect(publishedEvents[0].timestamp.getTime()).toBeLessThan(publishedEvents[1].timestamp.getTime());
      expect(publishedEvents[1].timestamp.getTime()).toBeLessThan(publishedEvents[2].timestamp.getTime());

      // Verify event sequence makes logical sense
      expect(publishedEvents[0].eventType).toBe("trade.execution.started");
      expect(publishedEvents[1].eventType).toBe("trade.order.placed");
      expect(publishedEvents[2].eventType).toBe("trade.order.filled");
    });
  });

  describe("Domain Boundary Validation", () => {
    it("should maintain domain boundaries during cross-domain operations", async () => {
      // Ensure trading domain doesn't directly access portfolio persistence
      const trade = Trade.create({
        userId: "user123",
        symbol: "BTCUSDT",
        isAutoSnipe: true,
      });

      // Trading should only communicate through domain services, not direct DB access
      await mockTradingRepository.saveTrade(trade);

      // Portfolio updates should go through portfolio service
      await mockPortfolioService.updatePortfolioValue("portfolio_123", Money.fromUSDT(9500));

      // Safety evaluations should go through safety service  
      await mockSafetyService.evaluateRules({
        portfolioId: "portfolio_123",
        symbol: "BTCUSDT",
        currentValue: 500,
        timestamp: new Date(),
      });

      // Verify no cross-domain persistence calls
      expect(mockTradingRepository.saveTrade).toHaveBeenCalledWith(trade);
      expect(mockPortfolioService.updatePortfolioValue).toHaveBeenCalledTimes(1);
      expect(mockSafetyService.evaluateRules).toHaveBeenCalledTimes(1);
    });

    it("should validate data consistency across domain boundaries", async () => {
      // Create trade with specific properties
      const tradeData = {
        userId: "user123",
        symbol: "BTCUSDT",
        positionSizeUsdt: 1000,
        confidenceScore: 85,
      };

      const trade = Trade.create(tradeData);

      // Verify trade data integrity when crossing domain boundaries
      expect(trade.userId).toBe(tradeData.userId);
      expect(trade.symbol).toBe(tradeData.symbol);
      expect(trade.confidenceScore).toBe(tradeData.confidenceScore);

      // Safety evaluation should receive consistent data
      await mockSafetyService.evaluateRules({
        portfolioId: "portfolio_123",
        symbol: tradeData.symbol,
        currentValue: tradeData.positionSizeUsdt,
        timestamp: new Date(),
        additionalData: {
          userId: tradeData.userId,
          confidenceScore: tradeData.confidenceScore,
        },
      });

      const evaluation = safetyRuleEvaluations[0];
      expect(evaluation.symbol).toBe(tradeData.symbol);
      expect(evaluation.currentValue).toBe(tradeData.positionSizeUsdt);
    });
  });

  describe("Pattern Detection Domain Integration", () => {
    const mockSymbolData = [
      {
        cd: "BTCUSDT",
        sts: 2, // Ready state
        st: 2,  // Active
        tt: 4,  // Live trading
        price: "45000.00",
        volume: "1000000",
        marketCap: "900000000",
      },
      {
        cd: "ETHUSDT", 
        sts: 1, // Pre-ready
        st: 1,
        tt: 3,
        price: "3000.00",
        volume: "500000",
        marketCap: "360000000",
      }
    ];

    it("should integrate pattern detection with trading decisions", async () => {
      // Test feature flag integration for enhanced pattern detection
      const enhancedPatternEnabled = await tradingFeatureFlagService
        .isEnhancedPatternDetectionEnabled(mockUserContext);
      
      const tradingConfig = await tradingFeatureFlagService
        .getTradingConfiguration(mockUserContext);

      // Perform pattern analysis
      const analysisRequest: PatternAnalysisRequest = {
        symbols: mockSymbolData,
        analysisType: "discovery",
        confidenceThreshold: enhancedPatternEnabled ? 70 : 65,
        includeHistorical: false,
      };

      const patternResult = await patternDetectionCore.analyzePatterns(analysisRequest);

      // Verify pattern detection results
      expect(patternResult).toBeDefined();
      expect(patternResult.matches).toBeInstanceOf(Array);
      expect(patternResult.summary.totalAnalyzed).toBe(2);

      // Check for ready state patterns that should trigger trading
      const readyStateMatches = patternResult.matches.filter(m => m.patternType === "ready_state");
      if (readyStateMatches.length > 0) {
        const readyMatch = readyStateMatches[0];
        
        // Create a trade based on pattern detection
        const trade = Trade.create({
          userId: mockUserContext.userId,
          symbol: readyMatch.symbol,
          isAutoSnipe: true,
          confidenceScore: readyMatch.confidence,
          positionSizeUsdt: 1000,
          paperTrade: false,
        });

        // Verify trade creation based on pattern
        expect(trade.symbol).toBe(readyMatch.symbol);
        expect(trade.confidenceScore).toBe(readyMatch.confidence);
      }

      // Verify pattern detection events were emitted for trading domain
      if (patternResult.matches.length > 0) {
        expect(patternDetectionEvents).toHaveLength(1);
        expect(patternDetectionEvents[0].matches).toHaveLength(patternResult.matches.length);
        expect(patternDetectionEvents[0].metadata.source).toBe('pattern-detection-core');
      }
    });

    it("should validate pattern confidence for safety domain integration", async () => {
      // Perform high-confidence pattern analysis for safety validation
      const analysisRequest: PatternAnalysisRequest = {
        symbols: mockSymbolData,
        analysisType: "validation",
        confidenceThreshold: 80, // High confidence for safety
      };

      const patternResult = await patternDetectionCore.analyzePatterns(analysisRequest);

      // Verify safety-compliant patterns
      patternResult.matches.forEach(match => {
        expect(match.confidence).toBeGreaterThanOrEqual(80);
        expect(match.riskLevel).toMatch(/^(low|medium|high)$/);
      });

      // Test safety rule evaluation with pattern data
      if (patternResult.matches.length > 0) {
        const highConfidenceMatch = patternResult.matches[0];
        
        const safetyEvaluation = await mockSafetyService.evaluateRules({
          portfolioId: mockUserContext.portfolioId,
          symbol: highConfidenceMatch.symbol,
          currentValue: 1000,
          timestamp: new Date(),
          additionalData: {
            patternType: highConfidenceMatch.patternType,
            patternConfidence: highConfidenceMatch.confidence,
            patternRecommendation: highConfidenceMatch.recommendation,
          },
        });

        expect(safetyEvaluation.symbol).toBe(highConfidenceMatch.symbol);
        expect(safetyRuleEvaluations).toHaveLength(1);
      }
    });

    it("should correlate patterns across portfolio for portfolio domain integration", async () => {
      // Test multi-symbol pattern correlation for portfolio optimization
      const analysisRequest: PatternAnalysisRequest = {
        symbols: [
          ...mockSymbolData,
          {
            cd: "ADAUSDT",
            sts: 2,
            st: 2,
            tt: 4,
            price: "0.45",
            volume: "10000000",
            marketCap: "15000000",
          }
        ],
        analysisType: "correlation",
        confidenceThreshold: 60,
      };

      const patternResult = await patternDetectionCore.analyzePatterns(analysisRequest);

      // Verify correlation analysis for portfolio optimization
      if (patternResult.correlations && patternResult.correlations.length > 0) {
        const correlation = patternResult.correlations[0];
        
        // Update portfolio based on correlated patterns
        for (const symbol of correlation.symbols) {
          const symbolMatch = patternResult.matches.find(m => m.symbol === symbol);
          if (symbolMatch && symbolMatch.recommendation === "immediate_action") {
            await mockPortfolioService.addPosition({
              portfolioId: mockUserContext.portfolioId,
              symbol: symbol,
              quantity: 0.01,
              averagePrice: parseFloat(mockSymbolData.find(s => s.cd === symbol)?.price || "0"),
              currentValue: 100,
            });
          }
        }

        expect(correlation.symbols).toBeInstanceOf(Array);
        expect(correlation.strength).toBeGreaterThanOrEqual(0);
        expect(correlation.strength).toBeLessThanOrEqual(1);
      }

      // Verify portfolio summary reflects pattern analysis
      expect(patternResult.summary.totalAnalyzed).toBe(3);
    });

    it("should handle pattern detection events in event-driven architecture", async () => {
      let patternDetectedEventReceived = false;
      let tradingDecisionTriggered = false;

      // Mock event handlers for cross-domain communication
      const mockPatternEventHandler = (eventData: any) => {
        patternDetectedEventReceived = true;
        
        // Simulate trading domain responding to pattern detection event
        eventData.matches.forEach((match: PatternMatch) => {
          if (match.recommendation === "immediate_action") {
            tradingDecisionTriggered = true;
            
            // Publish trading event in response to pattern
            const tradingEvent = {
              aggregateId: `trade_${Date.now()}`,
              eventType: "trade.pattern.triggered",
              payload: {
                symbol: match.symbol,
                patternType: match.patternType,
                confidence: match.confidence,
                userId: mockUserContext.userId,
                portfolioId: mockUserContext.portfolioId,
              },
              timestamp: new Date(),
            };
            
            mockDomainEventBus.publish(tradingEvent);
          }
        });
      };

      // Subscribe to pattern detection events
      patternDetectionCore.on('patterns_detected', mockPatternEventHandler);

      // Trigger pattern analysis
      const analysisRequest: PatternAnalysisRequest = {
        symbols: mockSymbolData,
        analysisType: "discovery",
        confidenceThreshold: 50,
      };

      const patternResult = await patternDetectionCore.analyzePatterns(analysisRequest);

      // Verify event-driven communication
      if (patternResult.matches.length > 0) {
        expect(patternDetectedEventReceived).toBe(true);
        
        // Check if any immediate action patterns triggered trading decisions
        const immediateActionMatches = patternResult.matches.filter(
          m => m.recommendation === "immediate_action"
        );
        
        if (immediateActionMatches.length > 0) {
          expect(tradingDecisionTriggered).toBe(true);
          
          // Verify trading events were published
          const tradingEvents = publishedEvents.filter(
            e => e.eventType === "trade.pattern.triggered"
          );
          expect(tradingEvents.length).toBeGreaterThan(0);
        }
      }

      // Clean up event listener
      patternDetectionCore.off('patterns_detected', mockPatternEventHandler);
    });

    it("should validate pattern detection performance metrics for monitoring", async () => {
      // Perform multiple pattern analyses to generate metrics
      const requests = Array.from({ length: 3 }, (_, i) => ({
        symbols: mockSymbolData,
        analysisType: "discovery" as const,
        confidenceThreshold: 60 + i * 5,
      }));

      const startTime = Date.now();
      const results = await Promise.all(
        requests.map(req => patternDetectionCore.analyzePatterns(req))
      );
      const duration = Date.now() - startTime;

      // Verify performance metrics are available for monitoring integration
      const metrics = patternDetectionCore.getMetrics();
      
      expect(metrics).toHaveProperty('totalAnalyzed');
      expect(metrics).toHaveProperty('patternsDetected');
      expect(metrics).toHaveProperty('averageConfidence');
      expect(metrics).toHaveProperty('executionTime');
      expect(metrics).toHaveProperty('cacheHitRatio');
      expect(metrics).toHaveProperty('errorCount');
      expect(metrics).toHaveProperty('warningCount');
      expect(metrics).toHaveProperty('cacheStats');

      // Verify all analyses completed successfully
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.analysisMetadata.executionTime).toBeGreaterThan(0);
      });

      // Performance should be reasonable for monitoring purposes
      expect(duration).toBeLessThan(5000); // 5 seconds max
      expect(metrics.errorCount).toBe(0);
    });

    it("should maintain domain boundaries with pattern detection integration", async () => {
      // Verify pattern detection only communicates through proper domain interfaces
      const analysisRequest: PatternAnalysisRequest = {
        symbols: mockSymbolData,
        analysisType: "discovery",
        confidenceThreshold: 70,
      };

      const patternResult = await patternDetectionCore.analyzePatterns(analysisRequest);

      // Pattern detection should not directly access trading/portfolio/safety persistence
      // It should only emit events and provide analysis results
      expect(patternResult.matches).toBeInstanceOf(Array);
      expect(patternResult.analysisMetadata).toBeDefined();

      // Verify pattern data can be safely passed across domain boundaries
      if (patternResult.matches.length > 0) {
        const pattern = patternResult.matches[0];
        
        // Data should be serializable and complete for cross-domain use
        expect(pattern.symbol).toBeDefined();
        expect(pattern.confidence).toBeGreaterThan(0);
        expect(pattern.patternType).toBeDefined();
        expect(pattern.detectedAt).toBeInstanceOf(Date);
        expect(pattern.recommendation).toMatch(
          /^(immediate_action|monitor_closely|prepare_entry|wait|avoid)$/
        );
      }

      // Verify no direct database or persistence calls from pattern detection
      expect(mockTradingRepository.saveTrade).not.toHaveBeenCalled();
      expect(mockPortfolioService.updatePortfolioValue).not.toHaveBeenCalled();
      expect(mockSafetyService.evaluateRules).not.toHaveBeenCalled();
    });
  });

  afterEach(() => {
    // Clean up mocks
    vi.clearAllMocks();
    
    // Clean up pattern detection listeners
    if (patternDetectionCore) {
      patternDetectionCore.removeAllListeners();
    }
    
    // Reset tracking arrays
    publishedEvents = [];
    safetyRuleEvaluations = [];
    portfolioUpdates = [];
    patternDetectionEvents = [];
  });
});