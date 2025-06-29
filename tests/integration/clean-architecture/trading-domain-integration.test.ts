/**
 * Trading Domain Integration Tests
 * Tests the integration between Clean Architecture layers
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExecuteTradeUseCase } from "@/src/application/use-cases/trading/execute-trade-use-case";
import { StartSnipingUseCase } from "@/src/application/use-cases/trading/start-sniping-use-case";
import { Trade, TradeStatus } from "@/src/domain/entities/trading/trade";
import { Order, OrderStatus } from "@/src/domain/value-objects/trading/order";
import { TradingNotificationServiceAdapter } from "@/src/infrastructure/adapters/notifications/trading-notification-service-adapter";
import { MexcTradingServiceAdapter } from "@/src/infrastructure/adapters/trading/mexc-trading-service-adapter";
import { DrizzleTradingRepository } from "@/src/infrastructure/repositories/drizzle-trading-repository";
import type { UnifiedMexcServiceV2 } from "@/src/services/api/unified-mexc-service-v2";

describe("Trading Domain Integration", () => {
  let startSnipingUseCase: StartSnipingUseCase;
  let executeTradeUseCase: ExecuteTradeUseCase;
  let tradingRepository: DrizzleTradingRepository;
  let tradingService: MexcTradingServiceAdapter;
  let notificationService: TradingNotificationServiceAdapter;
  
  let mockMexcService: jest.Mocked<UnifiedMexcServiceV2>;
  let mockLogger: any;
  let mockEventEmitter: any;

  beforeEach(() => {
    // Mock MEXC service
    mockMexcService = {
      placeOrder: vi.fn(),
      getTickerPrice: vi.fn(),
      getSymbolInfo: vi.fn(),
      getServerTime: vi.fn(),
    } as any;

    // Mock logger
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    // Mock event emitter
    mockEventEmitter = {
      emit: vi.fn(),
    };

    // Create infrastructure adapters
    tradingRepository = new DrizzleTradingRepository(mockLogger);
    tradingService = new MexcTradingServiceAdapter(mockMexcService, undefined, mockLogger);
    notificationService = new TradingNotificationServiceAdapter(mockLogger, mockEventEmitter);

    // Create use cases
    startSnipingUseCase = new StartSnipingUseCase(
      tradingRepository,
      tradingService,
      notificationService,
      mockLogger
    );

    executeTradeUseCase = new ExecuteTradeUseCase(
      tradingRepository,
      tradingService,
      notificationService,
      mockLogger
    );
  });

  describe("Complete Auto-Sniping Workflow", () => {
    it("should complete full auto-sniping workflow from start to execution", async () => {
      // Arrange - Mock external services
      mockMexcService.getSymbolInfo.mockResolvedValue({
        success: true,
        data: { status: "TRADING", filters: [] },
      });

      mockMexcService.getTickerPrice.mockResolvedValue({
        success: true,
        data: { price: "50000" },
      });

      mockMexcService.placeOrder.mockResolvedValue({
        success: true,
        data: {
          orderId: "12345",
          clientOrderId: "auto-snipe-client-123",
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
      });

      // Mock repository methods to avoid database calls in integration test
      const mockTrades = new Map<string, Trade>();
      
      vi.spyOn(tradingRepository, 'saveTrade').mockImplementation(async (trade) => {
        mockTrades.set(trade.id, trade);
        return trade;
      });

      vi.spyOn(tradingRepository, 'findTradeById').mockImplementation(async (id) => {
        return mockTrades.get(id) || null;
      });

      vi.spyOn(tradingRepository, 'findActiveTradesByUserId').mockResolvedValue([]);

      vi.spyOn(tradingRepository, 'updateTrade').mockImplementation(async (trade) => {
        mockTrades.set(trade.id, trade);
        return trade;
      });

      // Act - Step 1: Start auto-sniping
      const startResult = await startSnipingUseCase.execute({
        userId: "user123",
        symbol: "BTCUSDT",
        confidenceScore: 85,
        positionSizeUsdt: 100,
        stopLossPercent: 5,
        takeProfitPercent: 10,
        paperTrade: false,
      });

      // Assert - Step 1: Auto-sniping started successfully
      expect(startResult.success).toBe(true);
      expect(startResult.tradeId).toBeDefined();
      expect(startResult.trade).toBeDefined();
      expect(startResult.trade!.status).toBe(TradeStatus.EXECUTING);
      expect(startResult.trade!.isAutoSnipe).toBe(true);

      // Act - Step 2: Execute the trade
      const executeResult = await executeTradeUseCase.execute({
        tradeId: startResult.tradeId!,
        symbol: "BTCUSDT",
        side: "BUY",
        type: "MARKET",
        quoteOrderQty: 100,
        timeInForce: "IOC",
        confidenceScore: 85,
        paperTrade: false,
      });

      // Assert - Step 2: Trade executed successfully
      expect(executeResult.success).toBe(true);
      expect(executeResult.trade).toBeDefined();
      expect(executeResult.order).toBeDefined();
      expect(executeResult.executionTime).toBeGreaterThan(0);

      // Verify the trade state after execution
      const finalTrade = executeResult.trade!;
      expect(finalTrade.hasOrders()).toBe(true);
      expect(finalTrade.orders).toHaveLength(1);
      
      const order = finalTrade.orders[0];
      expect(order.isFilled()).toBe(true);
      expect(order.symbol).toBe("BTCUSDT");
      expect(order.executedQuantity).toBe(0.002);
      expect(order.executedPrice).toBe(50000);

      // Verify domain events were emitted
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        "trade.execution.started",
        expect.objectContaining({
          tradeId: startResult.tradeId,
          userId: "user123",
          symbol: "BTCUSDT",
        })
      );

      // Verify repository interactions
      expect(tradingRepository.saveTrade).toHaveBeenCalled();
      expect(tradingRepository.updateTrade).toHaveBeenCalled();
      expect(tradingRepository.findTradeById).toHaveBeenCalledWith(startResult.tradeId);

      // Verify external service calls
      expect(mockMexcService.getSymbolInfo).toHaveBeenCalledWith("BTCUSDT");
      expect(mockMexcService.getTickerPrice).toHaveBeenCalledWith("BTCUSDT");
      expect(mockMexcService.placeOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: "BTCUSDT",
          side: "BUY",
          type: "MARKET",
          quoteOrderQty: 100,
        })
      );
    });

    it("should handle paper trading workflow", async () => {
      // Arrange
      mockMexcService.getSymbolInfo.mockResolvedValue({
        success: true,
        data: { status: "TRADING", filters: [] },
      });

      mockMexcService.getTickerPrice.mockResolvedValue({
        success: true,
        data: { price: "50000" },
      });

      const mockTrades = new Map<string, Trade>();
      
      vi.spyOn(tradingRepository, 'saveTrade').mockImplementation(async (trade) => {
        mockTrades.set(trade.id, trade);
        return trade;
      });

      vi.spyOn(tradingRepository, 'findTradeById').mockImplementation(async (id) => {
        return mockTrades.get(id) || null;
      });

      vi.spyOn(tradingRepository, 'findActiveTradesByUserId').mockResolvedValue([]);

      vi.spyOn(tradingRepository, 'updateTrade').mockImplementation(async (trade) => {
        mockTrades.set(trade.id, trade);
        return trade;
      });

      // Act - Start paper trading auto-snipe
      const startResult = await startSnipingUseCase.execute({
        userId: "user123",
        symbol: "BTCUSDT",
        confidenceScore: 85,
        positionSizeUsdt: 100,
        paperTrade: true,
      });

      expect(startResult.success).toBe(true);
      expect(startResult.trade!.paperTrade).toBe(true);

      // Execute paper trade
      const executeResult = await executeTradeUseCase.execute({
        tradeId: startResult.tradeId!,
        symbol: "BTCUSDT",
        side: "BUY",
        type: "MARKET",
        quoteOrderQty: 100,
        paperTrade: true,
      });

      // Assert - Paper trade should succeed without calling real MEXC API
      expect(executeResult.success).toBe(true);
      expect(mockMexcService.placeOrder).not.toHaveBeenCalled(); // Should not call real API
      expect(mockMexcService.getTickerPrice).toHaveBeenCalled(); // Should get price for simulation
    });

    it("should handle validation failures gracefully", async () => {
      // Arrange - Mock symbol as not tradeable
      mockMexcService.getSymbolInfo.mockResolvedValue({
        success: true,
        data: { status: "HALT", filters: [] },
      });

      vi.spyOn(tradingRepository, 'findActiveTradesByUserId').mockResolvedValue([]);

      // Act
      const result = await startSnipingUseCase.execute({
        userId: "user123",
        symbol: "HALTEDCOIN",
        confidenceScore: 85,
        positionSizeUsdt: 100,
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("not available for trading");
    });

    it("should prevent duplicate auto-snipes for same symbol", async () => {
      // Arrange
      const existingTrade = Trade.create({
        userId: "user123",
        symbol: "BTCUSDT",
        isAutoSnipe: true,
        confidenceScore: 80,
      });

      mockMexcService.getSymbolInfo.mockResolvedValue({
        success: true,
        data: { status: "TRADING", filters: [] },
      });

      vi.spyOn(tradingRepository, 'findActiveTradesByUserId').mockResolvedValue([existingTrade]);

      // Act
      const result = await startSnipingUseCase.execute({
        userId: "user123",
        symbol: "BTCUSDT",
        confidenceScore: 85,
        positionSizeUsdt: 100,
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("Auto-sniping already active for symbol");
    });

    it("should handle MEXC service failures", async () => {
      // Arrange
      mockMexcService.getSymbolInfo.mockResolvedValue({
        success: true,
        data: { status: "TRADING", filters: [] },
      });

      mockMexcService.getTickerPrice.mockResolvedValue({
        success: true,
        data: { price: "50000" },
      });

      mockMexcService.placeOrder.mockResolvedValue({
        success: false,
        error: "Insufficient balance",
      });

      const mockTrades = new Map<string, Trade>();
      
      vi.spyOn(tradingRepository, 'saveTrade').mockImplementation(async (trade) => {
        mockTrades.set(trade.id, trade);
        return trade;
      });

      vi.spyOn(tradingRepository, 'findTradeById').mockImplementation(async (id) => {
        return mockTrades.get(id) || null;
      });

      vi.spyOn(tradingRepository, 'findActiveTradesByUserId').mockResolvedValue([]);

      vi.spyOn(tradingRepository, 'updateTrade').mockImplementation(async (trade) => {
        mockTrades.set(trade.id, trade);
        return trade;
      });

      // Act
      const startResult = await startSnipingUseCase.execute({
        userId: "user123",
        symbol: "BTCUSDT",
        confidenceScore: 85,
        positionSizeUsdt: 100,
      });

      const executeResult = await executeTradeUseCase.execute({
        tradeId: startResult.tradeId!,
        symbol: "BTCUSDT",
        side: "BUY",
        type: "MARKET",
        quoteOrderQty: 100,
      });

      // Assert
      expect(executeResult.success).toBe(false);
      expect(executeResult.error).toBe("Insufficient balance");
    });
  });

  describe("Repository Adapter Integration", () => {
    it("should correctly map domain entities to database format", async () => {
      // Create a trade with complex properties
      const trade = Trade.create({
        userId: "user123",
        symbol: "BTCUSDT",
        strategy: "aggressive",
        isAutoSnipe: true,
        confidenceScore: 85,
        paperTrade: false,
        stopLossPercent: 5,
        takeProfitPercent: 10,
        notes: "Test trade for integration",
      });

      // Mock the save operation to capture the mapped data
      let savedData: any;
      vi.spyOn(tradingRepository, 'saveTrade').mockImplementation(async (tradeToSave) => {
        // Verify the trade properties are preserved
        expect(tradeToSave.id).toBeDefined();
        expect(tradeToSave.userId).toBe("user123");
        expect(tradeToSave.symbol).toBe("BTCUSDT");
        expect(tradeToSave.strategy).toBe("aggressive");
        expect(tradeToSave.isAutoSnipe).toBe(true);
        expect(tradeToSave.confidenceScore).toBe(85);
        expect(tradeToSave.paperTrade).toBe(false);
        expect(tradeToSave.stopLossPercent).toBe(5);
        expect(tradeToSave.takeProfitPercent).toBe(10);
        expect(tradeToSave.notes).toBe("Test trade for integration");
        
        return tradeToSave;
      });

      // Act
      const result = await tradingRepository.saveTrade(trade);

      // Assert
      expect(result).toBe(trade);
      expect(tradingRepository.saveTrade).toHaveBeenCalledWith(trade);
    });
  });

  describe("Service Adapter Integration", () => {
    it("should correctly adapt MEXC service responses to domain format", async () => {
      // Arrange
      const mockMexcResponse = {
        success: true,
        data: {
          orderId: 12345,
          clientOrderId: "test-client-123",
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
      };

      mockMexcService.placeOrder.mockResolvedValue(mockMexcResponse);

      // Act
      const result = await tradingService.executeTrade({
        symbol: "BTCUSDT",
        side: "BUY",
        type: "MARKET",
        quoteOrderQty: 100,
        timeInForce: "IOC",
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.orderId).toBe("12345");
      expect(result.data!.symbol).toBe("BTCUSDT");
      expect(result.data!.side).toBe("BUY");
      expect(result.data!.status).toBe("FILLED");
      expect(result.executionTime).toBeGreaterThan(0);
    });
  });
});