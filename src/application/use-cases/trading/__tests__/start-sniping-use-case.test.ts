/**
 * Start Sniping Use Case Tests
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from "vitest";
import { StartSnipingUseCase } from "../start-sniping-use-case";
import { Trade, TradeStatus } from "@/src/domain/entities/trading/trade";
import type { TradingRepository, TradingService, NotificationService } from "@/src/application/interfaces/trading-repository";
import { DomainValidationError, BusinessRuleViolationError } from "@/src/domain/errors/trading-errors";

type MockedTradingRepository = {
  [K in keyof TradingRepository]: MockedFunction<TradingRepository[K]>;
};

type MockedTradingService = {
  [K in keyof TradingService]: MockedFunction<TradingService[K]>;
};

type MockedNotificationService = {
  [K in keyof NotificationService]: MockedFunction<NotificationService[K]>;
};

describe("StartSnipingUseCase", () => {
  let useCase: StartSnipingUseCase;
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

    useCase = new StartSnipingUseCase(
      mockTradingRepository,
      mockTradingService,
      mockNotificationService,
      mockLogger
    );
  });

  describe("execute", () => {
    const validInput = {
      userId: "user123",
      symbol: "BTCUSDT",
      confidenceScore: 85,
      positionSizeUsdt: 100,
      stopLossPercent: 5,
      takeProfitPercent: 10,
      paperTrade: false,
    };

    it("should successfully start auto-sniping for valid input", async () => {
      // Arrange
      mockTradingService.canTrade.mockResolvedValue(true);
      mockTradingRepository.findActiveTradesByUserId.mockResolvedValue([]);
      mockTradingService.getCurrentPrice.mockResolvedValue(50000);
      
      const savedTrade = Trade.create(validInput);
      mockTradingRepository.saveTrade.mockResolvedValue(savedTrade);
      
      const executingTrade = savedTrade.startExecution();
      mockTradingRepository.updateTrade.mockResolvedValue(executingTrade);

      // Act
      const result = await useCase.execute(validInput);

      // Assert
      expect(result.success).toBe(true);
      expect(result.tradeId).toBeDefined();
      expect(result.trade).toBeDefined();
      expect(result.trade?.isExecuting()).toBe(true);
      expect(mockTradingRepository.saveTrade).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: "BTCUSDT",
          userId: "user123",
          isAutoSnipe: true,
          confidenceScore: 85,
        })
      );
      expect(mockNotificationService.notifyTradeExecution).toHaveBeenCalled();
    });

    it("should reject input with invalid confidence score", async () => {
      // Arrange
      const invalidInput = { ...validInput, confidenceScore: 150 };

      // Act
      const result = await useCase.execute(invalidInput);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("Confidence score must be between 0-100");
    });

    it("should reject input with missing required fields", async () => {
      // Arrange
      const invalidInput = { ...validInput, userId: "" };

      // Act
      const result = await useCase.execute(invalidInput);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("User ID is required");
    });

    it("should reject low confidence score for auto-sniping", async () => {
      // Arrange
      const lowConfidenceInput = { ...validInput, confidenceScore: 30 };
      mockTradingService.canTrade.mockResolvedValue(true);
      mockTradingRepository.findActiveTradesByUserId.mockResolvedValue([]);

      // Act
      const result = await useCase.execute(lowConfidenceInput);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("Confidence score too low for auto-sniping");
    });

    it("should reject if symbol is not tradeable", async () => {
      // Arrange
      mockTradingService.canTrade.mockResolvedValue(false);

      // Act
      const result = await useCase.execute(validInput);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("not available for trading");
    });

    it("should reject if user already has active auto-snipe for symbol", async () => {
      // Arrange
      const existingTrade = Trade.create({
        userId: validInput.userId,
        symbol: validInput.symbol,
        isAutoSnipe: true,
        confidenceScore: 80,
      });

      mockTradingService.canTrade.mockResolvedValue(true);
      mockTradingRepository.findActiveTradesByUserId.mockResolvedValue([existingTrade]);

      // Act
      const result = await useCase.execute(validInput);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("Auto-sniping already active for symbol");
    });

    it("should reject if user has reached maximum concurrent positions", async () => {
      // Arrange
      const activeTrades = Array.from({ length: 10 }, (_, i) => 
        Trade.create({
          userId: validInput.userId,
          symbol: `COIN${i}USDT`,
          isAutoSnipe: true,
          confidenceScore: 80,
        })
      );

      mockTradingService.canTrade.mockResolvedValue(true);
      mockTradingRepository.findActiveTradesByUserId.mockResolvedValue(activeTrades);

      // Act
      const result = await useCase.execute(validInput);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("Maximum concurrent positions reached");
    });

    it("should handle trading service errors gracefully", async () => {
      // Arrange
      mockTradingService.canTrade.mockRejectedValue(new Error("Service unavailable"));

      // Act
      const result = await useCase.execute(validInput);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("Service unavailable");
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it("should handle repository save errors", async () => {
      // Arrange
      mockTradingService.canTrade.mockResolvedValue(true);
      mockTradingRepository.findActiveTradesByUserId.mockResolvedValue([]);
      mockTradingService.getCurrentPrice.mockResolvedValue(50000);
      mockTradingRepository.saveTrade.mockRejectedValue(new Error("Database error"));

      // Act
      const result = await useCase.execute(validInput);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("Database error");
    });

    it("should create trade with correct domain properties", async () => {
      // Arrange
      mockTradingService.canTrade.mockResolvedValue(true);
      mockTradingRepository.findActiveTradesByUserId.mockResolvedValue([]);
      mockTradingService.getCurrentPrice.mockResolvedValue(50000);
      
      let savedTrade: Trade;
      mockTradingRepository.saveTrade.mockImplementation(async (trade) => {
        savedTrade = trade;
        return trade;
      });
      
      const executingTrade = Trade.create(validInput).startExecution();
      mockTradingRepository.updateTrade.mockResolvedValue(executingTrade);

      // Act
      await useCase.execute(validInput);

      // Assert
      expect(savedTrade!).toBeDefined();
      expect(savedTrade!.userId).toBe(validInput.userId);
      expect(savedTrade!.symbol).toBe("BTCUSDT");
      expect(savedTrade!.isAutoSnipe).toBe(true);
      expect(savedTrade!.confidenceScore).toBe(85);
      expect(savedTrade!.stopLossPercent).toBe(5);
      expect(savedTrade!.takeProfitPercent).toBe(10);
      expect(savedTrade!.paperTrade).toBe(false);
      expect(savedTrade!.status).toBe(TradeStatus.PENDING);
    });
  });

  describe("canUserStartSniping", () => {
    it("should return true when user can start sniping", async () => {
      // Arrange
      mockTradingRepository.findActiveTradesByUserId.mockResolvedValue([]);

      // Act
      const result = await useCase.canUserStartSniping("user123");

      // Assert
      expect(result.canStart).toBe(true);
      expect(result.activeTradesCount).toBe(0);
      expect(result.maxAllowed).toBe(10);
    });

    it("should return false when user has too many active trades", async () => {
      // Arrange
      const activeTrades = Array.from({ length: 10 }, (_, i) => 
        Trade.create({
          userId: "user123",
          symbol: `COIN${i}USDT`,
          isAutoSnipe: true,
          confidenceScore: 80,
        })
      );
      mockTradingRepository.findActiveTradesByUserId.mockResolvedValue(activeTrades);

      // Act
      const result = await useCase.canUserStartSniping("user123");

      // Assert
      expect(result.canStart).toBe(false);
      expect(result.reason).toContain("Maximum concurrent auto-snipe positions reached");
      expect(result.activeTradesCount).toBe(10);
    });

    it("should handle repository errors gracefully", async () => {
      // Arrange
      mockTradingRepository.findActiveTradesByUserId.mockRejectedValue(new Error("Database error"));

      // Act
      const result = await useCase.canUserStartSniping("user123");

      // Assert
      expect(result.canStart).toBe(false);
      expect(result.reason).toContain("Unable to verify trading eligibility");
    });
  });
});