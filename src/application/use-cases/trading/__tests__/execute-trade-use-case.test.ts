/**
 * Execute Trade Use Case Tests
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from "vitest";
import { ExecuteTradeUseCase } from "../execute-trade-use-case";
import { Trade, TradeStatus } from "@/src/domain/entities/trading/trade";
import { Order, OrderStatus, OrderSide, OrderType, TimeInForce } from "@/src/domain/value-objects/trading/order";
import { Money } from "@/src/domain/value-objects/trading/money";
import { Price } from "@/src/domain/value-objects/trading/price";
import type { TradingRepository, TradingService, NotificationService } from "@/src/application/interfaces/trading-repository";
import { DomainValidationError, InvalidTradeParametersError, BusinessRuleViolationError } from "@/src/domain/errors/trading-errors";

type MockedTradingRepository = {
  [K in keyof TradingRepository]: MockedFunction<TradingRepository[K]>;
};

type MockedTradingService = {
  [K in keyof TradingService]: MockedFunction<TradingService[K]>;
};

type MockedNotificationService = {
  [K in keyof NotificationService]: MockedFunction<NotificationService[K]>;
};

describe("ExecuteTradeUseCase", () => {
  let useCase: ExecuteTradeUseCase;
  let mockTradingRepository: MockedTradingRepository;
  let mockTradingService: MockedTradingService;
  let mockNotificationService: MockedNotificationService;
  let mockLogger: any;

  beforeEach(() => {
    mockTradingRepository = {
      saveTrade: vi.fn(),
      findTradeById: vi.fn(),
      findTradesByUserId: vi.fn(),
      findTradesBySymbol: vi.fn(),
      findActiveTradesByUserId: vi.fn(),
      updateTrade: vi.fn(),
      deleteTrade: vi.fn(),
      getTradingMetrics: vi.fn(),
    };

    mockTradingService = {
      executeTrade: vi.fn(),
      getCurrentPrice: vi.fn(),
      canTrade: vi.fn(),
    };

    mockNotificationService = {
      notifyTradeExecution: vi.fn(),
      notifyTradeCompletion: vi.fn(),
      notifyTradeFailure: vi.fn(),
    };

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    useCase = new ExecuteTradeUseCase(
      mockTradingRepository,
      mockTradingService,
      mockNotificationService,
      mockLogger
    );
  });

  describe("execute", () => {
    const validInput = {
      tradeId: "trade-123",
      symbol: "BTCUSDT",
      side: "BUY" as const,
      type: "MARKET" as const,
      quoteOrderQty: 100,
      timeInForce: "IOC" as const,
      confidenceScore: 85,
      paperTrade: false,
    };

    let mockTrade: Trade;

    beforeEach(() => {
      mockTrade = Trade.create({
        userId: "user123",
        symbol: "BTCUSDT",
        isAutoSnipe: true,
        confidenceScore: 85,
        paperTrade: false,
      });
    });

    it("should successfully execute trade with valid input", async () => {
      // Arrange
      mockTradingRepository.findTradeById.mockResolvedValue(mockTrade);
      mockTradingService.canTrade.mockResolvedValue(true);
      
      const mockExecutionResult = {
        success: true,
        data: {
          orderId: "order-123",
          symbol: "BTCUSDT",
          side: "BUY",
          type: "MARKET",
          quantity: "0.002",
          price: "50000",
          status: "FILLED",
          executedQty: "0.002",
          timestamp: new Date().toISOString(),
        },
        executionTime: 150,
      };
      mockTradingService.executeTrade.mockResolvedValue(mockExecutionResult);
      
      // Mock the updateTrade to return any Trade instance
      mockTradingRepository.updateTrade.mockImplementation(async (trade) => trade);

      // Act
      const result = await useCase.execute(validInput);

      // Assert
      if (!result.success) {
        console.log("Test failed with error:", result.error);
      }
      expect(result.success).toBe(true);
      expect(result.trade).toBeDefined();
      expect(result.order).toBeDefined();
      expect(result.executionTime).toBeGreaterThan(0);
      expect(mockTradingService.executeTrade).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: "BTCUSDT",
          side: "BUY",
          type: "MARKET",
          quoteOrderQty: 100,
        })
      );
      expect(mockNotificationService.notifyTradeExecution).toHaveBeenCalled();
    });

    it("should reject input with missing required fields", async () => {
      // Arrange
      const invalidInput = { ...validInput, tradeId: "" };

      // Act
      const result = await useCase.execute(invalidInput);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("Trade ID is required");
    });

    it("should reject if neither quantity nor quoteOrderQty is provided", async () => {
      // Arrange
      const invalidInput = { ...validInput };
      delete (invalidInput as any).quoteOrderQty;

      // Act
      const result = await useCase.execute(invalidInput);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("Either quantity or quoteOrderQty must be provided");
    });

    it("should reject LIMIT orders without price", async () => {
      // Arrange
      const invalidInput = { 
        ...validInput, 
        type: "LIMIT" as const,
      };

      // Act
      const result = await useCase.execute(invalidInput);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("Price is required for LIMIT orders");
    });

    it("should reject if trade not found", async () => {
      // Arrange
      mockTradingRepository.findTradeById.mockResolvedValue(null);

      // Act
      const result = await useCase.execute(validInput);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("Trade not found");
    });

    it("should reject if trade is already finalized", async () => {
      // Arrange
      const executingTrade = mockTrade.startExecution();
      const entryPrice = Price.create(50000, "BTCUSDT", "mexc", 2);
      const totalCost = Money.create(100, "USDT", 2);
      const totalRevenue = Money.create(110, "USDT", 2);
      const completedTrade = executingTrade.completeExecution(
        entryPrice,
        undefined,
        0.002,
        totalCost,
        totalRevenue
      );
      mockTradingRepository.findTradeById.mockResolvedValue(completedTrade);

      // Act
      const result = await useCase.execute(validInput);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("execute trade");
    });

    it("should reject if symbol mismatch", async () => {
      // Arrange
      const mismatchInput = { ...validInput, symbol: "ETHUSDT" };
      mockTradingRepository.findTradeById.mockResolvedValue(mockTrade);

      // Act
      const result = await useCase.execute(mismatchInput);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("Symbol mismatch");
    });

    it("should reject if trading not allowed for symbol", async () => {
      // Arrange
      mockTradingRepository.findTradeById.mockResolvedValue(mockTrade);
      mockTradingService.canTrade.mockResolvedValue(false);

      // Act
      const result = await useCase.execute(validInput);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("Trading not allowed for symbol");
    });

    it("should handle paper trading mode mismatch", async () => {
      // Arrange
      const paperTradeInput = { ...validInput, paperTrade: true };
      mockTradingRepository.findTradeById.mockResolvedValue(mockTrade);
      mockTradingService.canTrade.mockResolvedValue(true);

      // Act
      const result = await useCase.execute(paperTradeInput);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("Paper trading mode mismatch");
    });

    it("should handle trading service execution failure", async () => {
      // Arrange
      mockTradingRepository.findTradeById.mockResolvedValue(mockTrade);
      mockTradingService.canTrade.mockResolvedValue(true);
      
      const failedExecutionResult = {
        success: false,
        error: "Insufficient balance",
        executionTime: 100,
      };
      mockTradingService.executeTrade.mockResolvedValue(failedExecutionResult);
      
      const failedTrade = mockTrade.markAsFailed("Insufficient balance");
      mockTradingRepository.updateTrade.mockResolvedValue(failedTrade);

      // Act
      const result = await useCase.execute(validInput);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe("Insufficient balance");
      expect(mockNotificationService.notifyTradeFailure).toHaveBeenCalledWith(
        expect.any(Object),
        "Insufficient balance"
      );
    });

    it("should create order with correct properties", async () => {
      // Arrange
      mockTradingRepository.findTradeById.mockResolvedValue(mockTrade);
      mockTradingService.canTrade.mockResolvedValue(true);
      
      const mockExecutionResult = {
        success: true,
        data: {
          orderId: "order-123",
          symbol: "BTCUSDT",
          side: "BUY",
          type: "MARKET",
          quantity: "0.002",
          price: "50000",
          status: "FILLED",
          executedQty: "0.002",
          timestamp: new Date().toISOString(),
        },
      };
      mockTradingService.executeTrade.mockResolvedValue(mockExecutionResult);
      
      let updatedTrade: Trade | undefined;
      mockTradingRepository.updateTrade.mockImplementation(async (trade) => {
        updatedTrade = trade;
        return trade;
      });

      // Act
      await useCase.execute(validInput);

      // Assert
      expect(updatedTrade).toBeDefined();
      expect(updatedTrade!.hasOrders()).toBe(true);
      
      const orders = updatedTrade!.orders;
      expect(orders).toHaveLength(1);
      
      const order = orders[0];
      expect(order.symbol).toBe("BTCUSDT");
      expect(order.side).toBe(OrderSide.BUY);
      expect(order.type).toBe(OrderType.MARKET);
      expect(order.timeInForce).toBe(TimeInForce.IOC);
      expect(order.quoteOrderQty).toBe(100);
      expect(order.isAutoSnipe).toBe(true);
      expect(order.confidenceScore).toBe(85);
    });

    it("should update order status based on execution result", async () => {
      // Arrange
      mockTradingRepository.findTradeById.mockResolvedValue(mockTrade);
      mockTradingService.canTrade.mockResolvedValue(true);
      
      const partialFillResult = {
        success: true,
        data: {
          orderId: "order-123",
          symbol: "BTCUSDT",
          side: "BUY",
          type: "MARKET",
          quantity: "0.002",
          price: "50000",
          status: "PARTIALLY_FILLED",
          executedQty: "0.001",
          timestamp: new Date().toISOString(),
        },
      };
      mockTradingService.executeTrade.mockResolvedValue(partialFillResult);
      
      let updatedTrade: Trade | undefined;
      mockTradingRepository.updateTrade.mockImplementation(async (trade) => {
        updatedTrade = trade;
        return trade;
      });

      // Act
      await useCase.execute(validInput);

      // Assert
      const order = updatedTrade!.orders[0];
      expect(order.isPartiallyFilled()).toBe(true);
      expect(order.executedQuantity).toBe(0.001);
      expect(order.executedPrice).toBe(50000);
    });

    it("should handle trading service exceptions", async () => {
      // Arrange
      mockTradingRepository.findTradeById.mockResolvedValue(mockTrade);
      mockTradingService.canTrade.mockResolvedValue(true);
      mockTradingService.executeTrade.mockRejectedValue(new Error("Network error"));

      // Act
      const result = await useCase.execute(validInput);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("Network error");
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe("canExecuteTrade", () => {
    it("should return true when trade can be executed", async () => {
      // Arrange
      const pendingTrade = Trade.create({
        userId: "user123",
        symbol: "BTCUSDT",
        isAutoSnipe: true,
        confidenceScore: 85,
      });
      mockTradingRepository.findTradeById.mockResolvedValue(pendingTrade);
      mockTradingService.canTrade.mockResolvedValue(true);

      // Act
      const result = await useCase.canExecuteTrade("trade-123");

      // Assert
      expect(result.canExecute).toBe(true);
      expect(result.trade).toBe(pendingTrade);
    });

    it("should return false when trade not found", async () => {
      // Arrange
      mockTradingRepository.findTradeById.mockResolvedValue(null);

      // Act
      const result = await useCase.canExecuteTrade("trade-123");

      // Assert
      expect(result.canExecute).toBe(false);
      expect(result.reason).toContain("Trade not found");
    });

    it("should return false when trade is finalized", async () => {
      // Arrange
      const executingTrade = Trade.create({
        userId: "user123",
        symbol: "BTCUSDT",
        isAutoSnipe: true,
        confidenceScore: 85,
      }).startExecution();
      
      const entryPrice = Price.create(50000, "BTCUSDT", "mexc", 2);
      const totalCost = Money.create(100, "USDT", 2);
      const totalRevenue = Money.create(110, "USDT", 2);
      const completedTrade = executingTrade.completeExecution(
        entryPrice,
        undefined,
        0.002,
        totalCost,
        totalRevenue
      );
      mockTradingRepository.findTradeById.mockResolvedValue(completedTrade);

      // Act
      const result = await useCase.canExecuteTrade("trade-123");

      // Assert
      expect(result.canExecute).toBe(false);
      expect(result.reason).toContain("already finalized");
    });

    it("should return false when trading not allowed", async () => {
      // Arrange
      const pendingTrade = Trade.create({
        userId: "user123",
        symbol: "BTCUSDT",
        isAutoSnipe: true,
        confidenceScore: 85,
      });
      mockTradingRepository.findTradeById.mockResolvedValue(pendingTrade);
      mockTradingService.canTrade.mockResolvedValue(false);

      // Act
      const result = await useCase.canExecuteTrade("trade-123");

      // Assert
      expect(result.canExecute).toBe(false);
      expect(result.reason).toContain("Trading not allowed");
    });
  });
});