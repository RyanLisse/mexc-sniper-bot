/**
 * Unit Tests for Position Manager Module
 * 
 * Comprehensive tests for position tracking, stop losses, and take profits.
 * Tests the PositionManager class extracted from auto-sniping.ts
 */

import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest';
import { PositionManager } from '@/src/services/trading/consolidated/core-trading/position-manager';
import type { ModuleContext, Position, TradeResult } from '@/src/services/trading/consolidated/core-trading/types';

// Mock the unified MEXC service factory
vi.mock('@/src/services/api/unified-mexc-service-factory', () => ({
  getUnifiedMexcService: vi.fn().mockResolvedValue({
    getPrice: vi.fn().mockResolvedValue({
      success: true,
      data: [{ price: '1.5000' }],
    }),
  }),
}));

describe('Position Manager', () => {
  let positionManager: PositionManager;
  let mockContext: ModuleContext;
  let mockPosition: Position;

  beforeEach(() => {
    // Create mock context
    mockContext = {
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
      config: {
        paperTradingMode: true,
        positionManagementEnabled: true,
        riskManagement: {
          stopLossEnabled: true,
          takeProfitEnabled: true,
          priceCheckInterval: 5000,
          emergencyStopEnabled: true,
        },
      },
      orderExecutor: {
        executePaperSnipe: vi.fn().mockResolvedValue({
          success: true,
          orderId: 'mock-order-123',
          data: {
            orderId: 'mock-order-123',
            symbol: 'TESTUSDT',
            side: 'SELL',
            type: 'MARKET',
            quantity: '100.0',
            price: '1.5000',
            status: 'FILLED',
            executedQty: '100.0',
            timestamp: new Date().toISOString(),
          },
        }),
        executeRealSnipe: vi.fn(),
        createPositionEntry: vi.fn(),
      },
      positionManager: {} as any, // Will be set after creation
    } as any;

    // Create mock position
    mockPosition = {
      id: 'test-position-123',
      symbol: 'TESTUSDT',
      side: 'BUY',
      orderId: 'test-order-123',
      entryPrice: 1.0,
      quantity: 100,
      stopLossPercent: 10,
      takeProfitPercent: 20,
      stopLossPrice: 0.9,
      takeProfitPrice: 1.2,
      timestamp: new Date().toISOString(),
      status: 'open',
      openTime: new Date(),
      strategy: 'test-strategy',
      tags: ['test'],
    };

    // Create position manager
    positionManager = new PositionManager(mockContext);
    mockContext.positionManager = positionManager;
  });

  afterEach(() => {
    // Clean up timers and monitoring
    positionManager.clearAllMonitoring();
    positionManager.shutdown();
  });

  describe('Position Management', () => {
    test('should add position to tracking', () => {
      positionManager.addPosition(mockPosition);

      const activePositions = positionManager.getActivePositions();
      expect(activePositions.size).toBe(1);
      expect(activePositions.get(mockPosition.id)).toEqual(mockPosition);
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        'Position added to tracking',
        expect.objectContaining({
          positionId: mockPosition.id,
          symbol: mockPosition.symbol,
          side: mockPosition.side,
          quantity: mockPosition.quantity,
        })
      );
    });

    test('should get specific position', () => {
      positionManager.addPosition(mockPosition);

      const retrievedPosition = positionManager.getPosition(mockPosition.id);
      expect(retrievedPosition).toEqual(mockPosition);

      const nonExistentPosition = positionManager.getPosition('non-existent');
      expect(nonExistentPosition).toBeUndefined();
    });

    test('should remove position from tracking', () => {
      positionManager.addPosition(mockPosition);
      expect(positionManager.getActivePositions().size).toBe(1);

      const removed = positionManager.removePosition(mockPosition.id);
      expect(removed).toBe(true);
      expect(positionManager.getActivePositions().size).toBe(0);
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        'Position removed from tracking',
        expect.objectContaining({
          positionId: mockPosition.id,
          symbol: mockPosition.symbol,
        })
      );
    });

    test('should return false when removing non-existent position', () => {
      const removed = positionManager.removePosition('non-existent');
      expect(removed).toBe(false);
    });

    test('should get position statistics', () => {
      positionManager.addPosition(mockPosition);

      const stats = positionManager.getPositionStats();
      expect(stats).toEqual({
        totalPositions: 1,
        activePositions: 1,
        pendingStopLosses: 1,
        pendingTakeProfits: 1,
        positions: [
          {
            id: mockPosition.id,
            symbol: mockPosition.symbol,
            side: mockPosition.side,
            quantity: mockPosition.quantity,
            entryPrice: mockPosition.entryPrice,
            currentPnL: mockPosition.unrealizedPnL,
            stopLossPrice: mockPosition.stopLossPrice,
            takeProfitPrice: mockPosition.takeProfitPrice,
            status: 'active',
          },
        ],
      });
    });
  });

  describe('Stop Loss Management', () => {
    test('should update position stop loss successfully', async () => {
      positionManager.addPosition(mockPosition);

      const result = await positionManager.updatePositionStopLoss(
        mockPosition.id,
        15 // 15% stop loss
      );

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      const updatedPosition = positionManager.getPosition(mockPosition.id);
      expect(updatedPosition?.stopLossPercent).toBe(15);
      expect(updatedPosition?.stopLossPrice).toBe(0.85); // 1.0 * (1 - 15/100)

      expect(mockContext.logger.info).toHaveBeenCalledWith(
        'Position stop-loss updated',
        expect.objectContaining({
          positionId: mockPosition.id,
          newStopLossPercent: 15,
          newStopLossPrice: 0.85,
        })
      );
    });

    test('should handle stop loss update for non-existent position', async () => {
      const result = await positionManager.updatePositionStopLoss(
        'non-existent',
        10
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Position non-existent not found');
    });

    test('should remove stop loss when percentage is 0', async () => {
      positionManager.addPosition(mockPosition);

      const result = await positionManager.updatePositionStopLoss(
        mockPosition.id,
        0
      );

      expect(result.success).toBe(true);

      const updatedPosition = positionManager.getPosition(mockPosition.id);
      expect(updatedPosition?.stopLossPercent).toBe(0);
      expect(updatedPosition?.stopLossPrice).toBeUndefined();
    });

    test('should calculate stop loss for SELL positions correctly', async () => {
      const sellPosition = { ...mockPosition, side: 'SELL' as const };
      positionManager.addPosition(sellPosition);

      const result = await positionManager.updatePositionStopLoss(
        sellPosition.id,
        10
      );

      expect(result.success).toBe(true);

      const updatedPosition = positionManager.getPosition(sellPosition.id);
      expect(updatedPosition?.stopLossPrice).toBe(1.1); // 1.0 * (1 + 10/100)
    });
  });

  describe('Take Profit Management', () => {
    test('should update position take profit successfully', async () => {
      positionManager.addPosition(mockPosition);

      const result = await positionManager.updatePositionTakeProfit(
        mockPosition.id,
        25 // 25% take profit
      );

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      const updatedPosition = positionManager.getPosition(mockPosition.id);
      expect(updatedPosition?.takeProfitPercent).toBe(25);
      expect(updatedPosition?.takeProfitPrice).toBe(1.25); // 1.0 * (1 + 25/100)

      expect(mockContext.logger.info).toHaveBeenCalledWith(
        'Position take-profit updated',
        expect.objectContaining({
          positionId: mockPosition.id,
          newTakeProfitPercent: 25,
          newTakeProfitPrice: 1.25,
        })
      );
    });

    test('should handle take profit update for non-existent position', async () => {
      const result = await positionManager.updatePositionTakeProfit(
        'non-existent',
        20
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Position non-existent not found');
    });

    test('should remove take profit when percentage is 0', async () => {
      positionManager.addPosition(mockPosition);

      const result = await positionManager.updatePositionTakeProfit(
        mockPosition.id,
        0
      );

      expect(result.success).toBe(true);

      const updatedPosition = positionManager.getPosition(mockPosition.id);
      expect(updatedPosition?.takeProfitPercent).toBe(0);
      expect(updatedPosition?.takeProfitPrice).toBeUndefined();
    });

    test('should calculate take profit for SELL positions correctly', async () => {
      const sellPosition = { ...mockPosition, side: 'SELL' as const };
      positionManager.addPosition(sellPosition);

      const result = await positionManager.updatePositionTakeProfit(
        sellPosition.id,
        20
      );

      expect(result.success).toBe(true);

      const updatedPosition = positionManager.getPosition(sellPosition.id);
      expect(updatedPosition?.takeProfitPrice).toBe(0.8); // 1.0 * (1 - 20/100)
    });
  });

  describe('Position Closing', () => {
    test('should close position successfully', async () => {
      positionManager.addPosition(mockPosition);

      const result = await positionManager.closePositionPublic(
        mockPosition.id,
        'Manual close'
      );

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockContext.orderExecutor.executePaperSnipe).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: mockPosition.symbol,
          side: 'SELL', // Opposite of BUY
          type: 'MARKET',
          quantity: mockPosition.quantity,
        })
      );
    });

    test('should handle closing non-existent position', async () => {
      const result = await positionManager.closePositionPublic(
        'non-existent',
        'Manual close'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Position non-existent not found');
    });

    test('should close all positions', async () => {
      const position2 = { ...mockPosition, id: 'test-position-456', symbol: 'ETHUSDT' };
      positionManager.addPosition(mockPosition);
      positionManager.addPosition(position2);

      const result = await positionManager.closeAllPositions('Emergency close');

      expect(result.success).toBe(true);
      expect(result.closedCount).toBe(2);
      expect(result.errors).toBeUndefined();
    });
  });

  describe('Monitoring and Cleanup', () => {
    test('should clear all monitoring', () => {
      positionManager.addPosition(mockPosition);

      // Verify monitoring is set up
      const stats = positionManager.getPositionStats();
      expect(stats.pendingStopLosses).toBe(1);
      expect(stats.pendingTakeProfits).toBe(1);

      positionManager.clearAllMonitoring();

      expect(mockContext.logger.info).toHaveBeenCalledWith(
        'All position monitoring cleared'
      );
    });

    test('should initialize successfully', async () => {
      await expect(positionManager.initialize()).resolves.not.toThrow();
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        'PositionManager initialized successfully'
      );
    });

    test('should update configuration', () => {
      const newConfig = { test: 'config' };
      expect(() => positionManager.updateConfig(newConfig)).not.toThrow();
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        'PositionManager configuration updated'
      );
    });

    test('should shutdown cleanly', () => {
      positionManager.addPosition(mockPosition);
      
      expect(() => positionManager.shutdown()).not.toThrow();
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        'PositionManager shutdown completed'
      );

      // Verify all data is cleared
      expect(positionManager.getActivePositions().size).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle MEXC API errors gracefully', async () => {
      const { getUnifiedMexcService } = await import('@/src/services/api/unified-mexc-service-factory');
      vi.mocked(getUnifiedMexcService).mockResolvedValueOnce({
        getPrice: vi.fn().mockResolvedValue({
          success: false,
          error: 'API Error',
        }),
      } as any);

      positionManager.addPosition(mockPosition);

      // The getCurrentPrice method should handle API errors gracefully
      // Position monitoring should continue despite API errors
      expect(positionManager.getActivePositions().size).toBe(1);
    });

    test('should handle update errors gracefully', async () => {
      positionManager.addPosition(mockPosition);

      // Force an error by setting an invalid context
      const originalLogger = mockContext.logger.error;
      mockContext.logger.error = vi.fn().mockImplementation(() => {
        throw new Error('Logger error');
      });

      const result = await positionManager.updatePositionStopLoss(
        mockPosition.id,
        10
      );

      // Should still succeed despite logger error
      expect(result.success).toBe(true);

      // Restore original logger
      mockContext.logger.error = originalLogger;
    });
  });

  describe('Edge Cases', () => {
    test('should handle position without stop loss or take profit', () => {
      const positionWithoutLevels = {
        ...mockPosition,
        stopLossPrice: undefined,
        takeProfitPrice: undefined,
        stopLossPercent: undefined,
        takeProfitPercent: undefined,
      };

      expect(() => positionManager.addPosition(positionWithoutLevels)).not.toThrow();

      const stats = positionManager.getPositionStats();
      expect(stats.pendingStopLosses).toBe(0);
      expect(stats.pendingTakeProfits).toBe(0);
    });

    test('should handle duplicate position IDs', () => {
      positionManager.addPosition(mockPosition);
      
      // Adding same position again should replace the previous one
      const duplicatePosition = { ...mockPosition, entryPrice: 2.0 };
      positionManager.addPosition(duplicatePosition);

      expect(positionManager.getActivePositions().size).toBe(1);
      const storedPosition = positionManager.getPosition(mockPosition.id);
      expect(storedPosition?.entryPrice).toBe(2.0);
    });

    test('should handle invalid prices', async () => {
      const { getUnifiedMexcService } = await import('@/src/services/api/unified-mexc-service-factory');
      vi.mocked(getUnifiedMexcService).mockResolvedValueOnce({
        getPrice: vi.fn().mockResolvedValue({
          success: true,
          data: [{ price: 'invalid' }],
        }),
      } as any);

      positionManager.addPosition(mockPosition);

      // Should handle invalid price data gracefully
      expect(positionManager.getActivePositions().size).toBe(1);
    });
  });
});