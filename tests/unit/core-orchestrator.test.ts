/**
 * Core Orchestrator Test Suite
 * 
 * Comprehensive tests for the auto-sniping orchestrator system
 * Testing critical trading operations, safety systems, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { EventEmitter } from 'node:events';
import { AutoSnipingOrchestrator } from '@/src/services/trading/orchestrator/core-orchestrator';
import { PatternProcessor } from '@/src/services/trading/orchestrator/pattern-processor';
import { PositionMonitor } from '@/src/services/trading/orchestrator/position-monitor';
import { SafetyManager } from '@/src/services/trading/orchestrator/safety-manager';
import { TradeExecutor } from '@/src/services/trading/orchestrator/trade-executor';
import type {
  AutoSnipingConfig,
  AutoSnipingStatus,
  AutoSnipingMetrics,
  OperationResult,
  SnipeTarget,
  PatternMatch,
  TradingPosition,
} from '@/src/services/trading/orchestrator/types';

// Mock all dependencies
vi.mock('@/src/services/trading/orchestrator/pattern-processor');
vi.mock('@/src/services/trading/orchestrator/position-monitor');
vi.mock('@/src/services/trading/orchestrator/safety-manager');
vi.mock('@/src/services/trading/orchestrator/trade-executor');

describe('AutoSnipingOrchestrator', () => {
  let orchestrator: AutoSnipingOrchestrator;
  let mockPatternProcessor: vi.Mocked<PatternProcessor>;
  let mockPositionMonitor: vi.Mocked<PositionMonitor>;
  let mockSafetyManager: vi.Mocked<SafetyManager>;
  let mockTradeExecutor: vi.Mocked<TradeExecutor>;

  const defaultConfig: AutoSnipingConfig = {
    enabled: true,
    maxConcurrentPositions: 3,
    patternDetectionInterval: 30000,
    safetyCheckInterval: 60000,
    confidenceThreshold: 75,
    maxPositionSize: 0.1,
    stopLossPercentage: 0.15,
    strategy: 'conservative',
    paperTradingMode: true,
  };

  const mockSuccessResult: OperationResult = {
    success: true,
    message: 'Operation completed successfully',
    timestamp: new Date().toISOString(),
  };

  const mockFailureResult: OperationResult = {
    success: false,
    message: 'Operation failed',
    error: 'Test error',
    timestamp: new Date().toISOString(),
  };

  beforeEach(() => {
    // Clear singleton instance
    (AutoSnipingOrchestrator as any).instance = null;
    
    // Create fresh mocks
    mockPatternProcessor = {
      initialize: vi.fn().mockResolvedValue(mockSuccessResult),
      start: vi.fn().mockResolvedValue(mockSuccessResult),
      stop: vi.fn().mockResolvedValue(mockSuccessResult),
      shutdown: vi.fn().mockResolvedValue(undefined),
      detectPatterns: vi.fn().mockResolvedValue([]),
      emergencyStop: vi.fn().mockResolvedValue(mockSuccessResult),
    } as any;

    mockPositionMonitor = {
      initialize: vi.fn().mockResolvedValue(mockSuccessResult),
      start: vi.fn().mockResolvedValue(mockSuccessResult),
      stop: vi.fn().mockResolvedValue(mockSuccessResult),
      shutdown: vi.fn().mockResolvedValue(undefined),
      getCurrentPositions: vi.fn().mockReturnValue([]),
      getPositionCount: vi.fn().mockReturnValue(0),
      getTotalPnL: vi.fn().mockReturnValue({ realized: 0, unrealized: 0, total: 0, percentage: 0 }),
      emergencyCloseAllPositions: vi.fn().mockResolvedValue(mockSuccessResult),
      emergencyStop: vi.fn().mockResolvedValue(mockSuccessResult),
    } as any;

    mockSafetyManager = {
      initialize: vi.fn().mockResolvedValue(mockSuccessResult),
      start: vi.fn().mockResolvedValue(mockSuccessResult),
      stop: vi.fn().mockResolvedValue(mockSuccessResult),
      shutdown: vi.fn().mockResolvedValue(undefined),
      performSafetyCheck: vi.fn().mockResolvedValue(mockSuccessResult),
      isSystemHealthy: vi.fn().mockReturnValue(true),
      getSystemHealth: vi.fn().mockReturnValue({
        patternDetection: 'operational' as const,
        tradingBot: 'operational' as const,
        safetyCoordinator: 'operational' as const,
        mexcConnection: 'connected' as const,
      }),
      emergencyStop: vi.fn().mockResolvedValue(mockSuccessResult),
    } as any;

    mockTradeExecutor = {
      initialize: vi.fn().mockResolvedValue(mockSuccessResult),
      start: vi.fn().mockResolvedValue(mockSuccessResult),
      stop: vi.fn().mockResolvedValue(mockSuccessResult),
      shutdown: vi.fn().mockResolvedValue(undefined),
      executeSnipe: vi.fn().mockResolvedValue(mockSuccessResult),
      cancelAllPendingOrders: vi.fn().mockResolvedValue(mockSuccessResult),
      emergencyStop: vi.fn().mockResolvedValue(mockSuccessResult),
    } as any;

    // Setup constructor mocks
    (PatternProcessor as any).mockImplementation(() => mockPatternProcessor);
    (PositionMonitor as any).mockImplementation(() => mockPositionMonitor);
    (SafetyManager as any).mockImplementation(() => mockSafetyManager);
    (TradeExecutor as any).mockImplementation(() => mockTradeExecutor);

    orchestrator = AutoSnipingOrchestrator.getInstance(defaultConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  describe('Singleton Pattern', () => {
    it('should create a singleton instance', () => {
      const instance1 = AutoSnipingOrchestrator.getInstance(defaultConfig);
      const instance2 = AutoSnipingOrchestrator.getInstance(defaultConfig);
      
      expect(instance1).toBe(instance2);
    });

    it('should use existing instance configuration when called multiple times', () => {
      const config1 = { ...defaultConfig, confidenceThreshold: 80 };
      const config2 = { ...defaultConfig, confidenceThreshold: 90 };
      
      const instance1 = AutoSnipingOrchestrator.getInstance(config1);
      const instance2 = AutoSnipingOrchestrator.getInstance(config2);
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully with valid configuration', async () => {
      const result = await orchestrator.initialize();
      
      expect(result.success).toBe(true);
      expect(mockPatternProcessor.initialize).toHaveBeenCalled();
      expect(mockPositionMonitor.initialize).toHaveBeenCalled();
      expect(mockSafetyManager.initialize).toHaveBeenCalled();
      expect(mockTradeExecutor.initialize).toHaveBeenCalled();
    });

    it('should not re-initialize if already initialized', async () => {
      await orchestrator.initialize();
      const result = await orchestrator.initialize();
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('already initialized');
    });

    it('should handle initialization failure gracefully', async () => {
      mockPatternProcessor.initialize.mockResolvedValueOnce(mockFailureResult);
      
      const result = await orchestrator.initialize();
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should validate configuration during initialization', async () => {
      const invalidConfig = { ...defaultConfig, confidenceThreshold: 150 };
      const orchestratorWithInvalidConfig = new (AutoSnipingOrchestrator as any)(invalidConfig);
      
      const result = await orchestratorWithInvalidConfig.initialize();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('configuration');
    });
  });

  describe('Auto-Sniping Operations', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should start auto-sniping successfully', async () => {
      const result = await orchestrator.startAutoSniping();
      
      expect(result.success).toBe(true);
      expect(mockPatternProcessor.start).toHaveBeenCalled();
      expect(mockPositionMonitor.start).toHaveBeenCalled();
      expect(mockSafetyManager.start).toHaveBeenCalled();
      expect(mockTradeExecutor.start).toHaveBeenCalled();
    });

    it('should not start if not initialized', async () => {
      const uninitializedOrchestrator = new (AutoSnipingOrchestrator as any)();
      
      const result = await uninitializedOrchestrator.startAutoSniping();
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('not initialized');
    });

    it('should not start if already running', async () => {
      await orchestrator.startAutoSniping();
      const result = await orchestrator.startAutoSniping();
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('already running');
    });

    it('should not start if disabled in configuration', async () => {
      const disabledConfig = { ...defaultConfig, enabled: false };
      const disabledOrchestrator = AutoSnipingOrchestrator.getInstance(disabledConfig);
      await disabledOrchestrator.initialize();
      
      const result = await disabledOrchestrator.startAutoSniping();
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('disabled');
    });

    it('should not start if safety check fails', async () => {
      mockSafetyManager.performSafetyCheck.mockResolvedValueOnce(mockFailureResult);
      
      const result = await orchestrator.startAutoSniping();
      
      expect(result.success).toBe(false);
    });

    it('should stop auto-sniping successfully', async () => {
      await orchestrator.startAutoSniping();
      const result = await orchestrator.stopAutoSniping();
      
      expect(result.success).toBe(true);
      expect(mockPatternProcessor.stop).toHaveBeenCalled();
      expect(mockPositionMonitor.stop).toHaveBeenCalled();
      expect(mockSafetyManager.stop).toHaveBeenCalled();
      expect(mockTradeExecutor.stop).toHaveBeenCalled();
    });

    it('should not stop if not running', async () => {
      const result = await orchestrator.stopAutoSniping();
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('not running');
    });
  });

  describe('Status and Metrics', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
      await orchestrator.startAutoSniping();
    });

    it('should return current status', async () => {
      const status = await orchestrator.getStatus();
      
      expect(status).toHaveProperty('active');
      expect(status).toHaveProperty('safeToOperate');
      expect(status).toHaveProperty('currentPositions');
      expect(status).toHaveProperty('systemHealth');
      expect(status).toHaveProperty('runningTime');
      expect(status.active).toBe(true);
    });

    it('should return performance metrics', async () => {
      const metrics = await orchestrator.getMetrics();
      
      expect(metrics).toHaveProperty('performance');
      expect(metrics).toHaveProperty('trading');
      expect(metrics).toHaveProperty('system');
      expect(metrics.performance).toHaveProperty('uptime');
      expect(metrics.trading).toHaveProperty('totalTrades');
      expect(metrics.system).toHaveProperty('memoryUsage');
    });

    it('should track detected opportunities', async () => {
      const mockPattern: PatternMatch = {
        symbol: 'BTCUSDT',
        pattern: 'sudden_volume_spike',
        confidence: 85,
        timestamp: new Date().toISOString(),
        data: { volume: 1000000, price: 45000 },
      };

      mockPatternProcessor.detectPatterns.mockResolvedValueOnce([mockPattern]);
      
      // Trigger pattern detection (simulate interval)
      vi.advanceTimersByTime(30000);
      
      const status = await orchestrator.getStatus();
      expect(status.detectedOpportunities).toBeGreaterThan(0);
    });
  });

  describe('Configuration Updates', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should update configuration successfully', async () => {
      const newConfig = { confidenceThreshold: 80 };
      
      const result = await orchestrator.updateConfiguration(newConfig);
      
      expect(result.success).toBe(true);
    });

    it('should validate configuration updates', async () => {
      const invalidConfig = { confidenceThreshold: 150 };
      
      const result = await orchestrator.updateConfiguration(invalidConfig);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('validation');
    });

    it('should restart system if critical configuration changes while running', async () => {
      await orchestrator.startAutoSniping();
      const newConfig = { strategy: 'aggressive' as const };
      
      const result = await orchestrator.updateConfiguration(newConfig);
      
      expect(result.success).toBe(true);
      expect(mockTradeExecutor.stop).toHaveBeenCalled();
      expect(mockTradeExecutor.start).toHaveBeenCalled();
    });
  });

  describe('Snipe Target Processing', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
      await orchestrator.startAutoSniping();
    });

    it('should process snipe target successfully', async () => {
      const target: SnipeTarget = {
        symbol: 'BTCUSDT',
        price: 45000,
        quantity: 0.001,
        confidence: 85,
        strategy: 'market',
        timestamp: new Date().toISOString(),
      };

      const result = await orchestrator.processSnipeTarget(target);
      
      expect(result.success).toBe(true);
      expect(mockTradeExecutor.executeSnipe).toHaveBeenCalledWith(target);
    });

    it('should reject snipe target if not running', async () => {
      await orchestrator.stopAutoSniping();
      
      const target: SnipeTarget = {
        symbol: 'BTCUSDT',
        price: 45000,
        quantity: 0.001,
        confidence: 85,
        strategy: 'market',
        timestamp: new Date().toISOString(),
      };

      const result = await orchestrator.processSnipeTarget(target);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('not running');
    });

    it('should reject snipe target if safety check fails', async () => {
      mockSafetyManager.performSafetyCheck.mockResolvedValueOnce(mockFailureResult);
      
      const target: SnipeTarget = {
        symbol: 'BTCUSDT',
        price: 45000,
        quantity: 0.001,
        confidence: 85,
        strategy: 'market',
        timestamp: new Date().toISOString(),
      };

      const result = await orchestrator.processSnipeTarget(target);
      
      expect(result.success).toBe(false);
    });

    it('should update metrics when snipe is executed', async () => {
      const target: SnipeTarget = {
        symbol: 'BTCUSDT',
        price: 45000,
        quantity: 0.001,
        confidence: 85,
        strategy: 'market',
        timestamp: new Date().toISOString(),
      };

      await orchestrator.processSnipeTarget(target);
      
      const status = await orchestrator.getStatus();
      expect(status.executedTrades).toBeGreaterThan(0);
    });
  });

  describe('Emergency Operations', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
      await orchestrator.startAutoSniping();
    });

    it('should execute emergency stop successfully', async () => {
      const result = await orchestrator.emergencyStop('Test emergency');
      
      expect(result.success).toBe(true);
      expect(mockTradeExecutor.emergencyStop).toHaveBeenCalled();
      expect(mockPositionMonitor.emergencyStop).toHaveBeenCalled();
      expect(mockSafetyManager.emergencyStop).toHaveBeenCalled();
      expect(mockPatternProcessor.emergencyStop).toHaveBeenCalled();
    });

    it('should handle emergency stop even when not running', async () => {
      await orchestrator.stopAutoSniping();
      
      const result = await orchestrator.emergencyStop('Test emergency');
      
      expect(result.success).toBe(true);
    });

    it('should handle critical safety violations automatically', async () => {
      const criticalViolation = {
        type: 'critical_position_loss',
        severity: 'critical' as const,
        description: 'Position loss exceeded 20%',
        timestamp: new Date().toISOString(),
      };

      // Simulate safety violation event
      orchestrator['eventEmitter'].emit('safetyViolation', criticalViolation);
      
      // Allow async operations to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockTradeExecutor.emergencyStop).toHaveBeenCalled();
    });
  });

  describe('Shutdown and Cleanup', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
      await orchestrator.startAutoSniping();
    });

    it('should shutdown gracefully', async () => {
      await orchestrator.shutdown();
      
      expect(mockPatternProcessor.shutdown).toHaveBeenCalled();
      expect(mockPositionMonitor.shutdown).toHaveBeenCalled();
      expect(mockSafetyManager.shutdown).toHaveBeenCalled();
      expect(mockTradeExecutor.shutdown).toHaveBeenCalled();
    });

    it('should stop running operations before shutdown', async () => {
      await orchestrator.shutdown();
      
      const status = await orchestrator.getStatus();
      expect(status.active).toBe(false);
    });

    it('should clear monitoring intervals on shutdown', async () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      await orchestrator.shutdown();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should handle pattern processor errors gracefully', async () => {
      mockPatternProcessor.start.mockRejectedValueOnce(new Error('Pattern processor error'));
      
      const result = await orchestrator.startAutoSniping();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Pattern processor error');
    });

    it('should handle trade executor errors gracefully', async () => {
      mockTradeExecutor.executeSnipe.mockRejectedValueOnce(new Error('Trade execution error'));
      
      const target: SnipeTarget = {
        symbol: 'BTCUSDT',
        price: 45000,
        quantity: 0.001,
        confidence: 85,
        strategy: 'market',
        timestamp: new Date().toISOString(),
      };

      await orchestrator.startAutoSniping();
      const result = await orchestrator.processSnipeTarget(target);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Trade execution error');
    });

    it('should handle unexpected errors with proper logging', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockSafetyManager.performSafetyCheck.mockRejectedValueOnce(new Error('Unexpected error'));
      
      await orchestrator.startAutoSniping();
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Event System', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
      await orchestrator.startAutoSniping();
    });

    it('should emit events for trade execution', async () => {
      const eventSpy = vi.fn();
      orchestrator['eventEmitter'].on('tradeExecuted', eventSpy);
      
      const mockTradeData = { symbol: 'BTCUSDT', orderId: '12345', status: 'filled' };
      orchestrator['eventEmitter'].emit('tradeExecuted', mockTradeData);
      
      expect(eventSpy).toHaveBeenCalledWith(mockTradeData);
    });

    it('should emit events for position changes', async () => {
      const eventSpy = vi.fn();
      orchestrator['eventEmitter'].on('positionOpened', eventSpy);
      
      const mockPosition: TradingPosition = {
        id: 'pos_123',
        symbol: 'BTCUSDT',
        side: 'buy',
        quantity: 0.001,
        entryPrice: 45000,
        currentPrice: 45100,
        pnl: 0.1,
        status: 'open',
        timestamp: new Date().toISOString(),
      };
      
      orchestrator['eventEmitter'].emit('positionOpened', mockPosition);
      
      expect(eventSpy).toHaveBeenCalledWith(mockPosition);
    });
  });
});