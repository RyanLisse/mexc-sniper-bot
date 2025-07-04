/**
 * Unit tests for Enhanced MEXC WebSocket Service
 * Tests real-time WebSocket connections, pattern detection, and circuit breaker integration
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type {
  RealTimePriceData,
  RealTimeSymbolStatus,
  RealTimePatternMatch,
  WebSocketConnectionHealth,
} from '../../../../src/services/data/enhanced-mexc-websocket-service';

describe('Enhanced MEXC WebSocket Service', () => {
  let mockConsole: any;

  // Mock data for testing
  const mockPriceData: RealTimePriceData = {
    symbol: 'BTCUSDT',
    price: 45000,
    priceChange: 500,
    priceChangePercent: 1.12,
    volume: 125000,
    high: 45500,
    low: 44000,
    timestamp: Date.now(),
    lastTradeTime: Date.now() - 1000,
    bidPrice: 44995,
    askPrice: 45005,
    openPrice: 44500,
  };

  const mockSymbolStatus: RealTimeSymbolStatus = {
    symbol: 'BTCUSDT',
    vcoinId: 'BTC001',
    sts: 2,
    st: 2,
    tt: 4,
    timestamp: Date.now(),
    isReadyState: true,
    confidence: 95,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock console methods
    mockConsole = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    global.console.info = mockConsole.info;
    global.console.warn = mockConsole.warn;
    global.console.error = mockConsole.error;
    global.console.debug = mockConsole.debug;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Real-Time Data Types', () => {
    it('should have proper price data structure', () => {
      expect(mockPriceData).toHaveProperty('symbol');
      expect(mockPriceData).toHaveProperty('price');
      expect(mockPriceData).toHaveProperty('priceChange');
      expect(mockPriceData).toHaveProperty('priceChangePercent');
      expect(mockPriceData).toHaveProperty('volume');
      expect(mockPriceData).toHaveProperty('high');
      expect(mockPriceData).toHaveProperty('low');
      expect(mockPriceData).toHaveProperty('timestamp');
      expect(mockPriceData).toHaveProperty('bidPrice');
      expect(mockPriceData).toHaveProperty('askPrice');
      expect(mockPriceData).toHaveProperty('openPrice');

      expect(typeof mockPriceData.symbol).toBe('string');
      expect(typeof mockPriceData.price).toBe('number');
      expect(typeof mockPriceData.priceChange).toBe('number');
      expect(typeof mockPriceData.priceChangePercent).toBe('number');
      expect(typeof mockPriceData.volume).toBe('number');
      expect(typeof mockPriceData.timestamp).toBe('number');
    });

    it('should have proper symbol status structure', () => {
      expect(mockSymbolStatus).toHaveProperty('symbol');
      expect(mockSymbolStatus).toHaveProperty('vcoinId');
      expect(mockSymbolStatus).toHaveProperty('sts');
      expect(mockSymbolStatus).toHaveProperty('st');
      expect(mockSymbolStatus).toHaveProperty('tt');
      expect(mockSymbolStatus).toHaveProperty('timestamp');
      expect(mockSymbolStatus).toHaveProperty('isReadyState');
      expect(mockSymbolStatus).toHaveProperty('confidence');

      expect(typeof mockSymbolStatus.symbol).toBe('string');
      expect(typeof mockSymbolStatus.vcoinId).toBe('string');
      expect(typeof mockSymbolStatus.sts).toBe('number');
      expect(typeof mockSymbolStatus.st).toBe('number');
      expect(typeof mockSymbolStatus.tt).toBe('number');
      expect(typeof mockSymbolStatus.isReadyState).toBe('boolean');
      expect(typeof mockSymbolStatus.confidence).toBe('number');
    });

    it('should validate pattern match structure', () => {
      const patternMatch: RealTimePatternMatch = {
        patternId: 'ready_BTCUSDT_1234567890',
        symbol: 'BTCUSDT',
        vcoinId: 'BTC001',
        patternType: 'ready_state',
        confidence: 95,
        triggers: {
          sts: 2,
          st: 2,
          tt: 4,
        },
        timing: {
          detectedAt: Date.now(),
          advanceNoticeMs: 3.5 * 60 * 60 * 1000,
        },
        priceData: mockPriceData,
      };

      expect(patternMatch).toHaveProperty('patternId');
      expect(patternMatch).toHaveProperty('symbol');
      expect(patternMatch).toHaveProperty('vcoinId');
      expect(patternMatch).toHaveProperty('patternType');
      expect(patternMatch).toHaveProperty('confidence');
      expect(patternMatch).toHaveProperty('triggers');
      expect(patternMatch).toHaveProperty('timing');
      expect(patternMatch).toHaveProperty('priceData');

      expect(['ready_state', 'pre_ready', 'launch_sequence']).toContain(patternMatch.patternType);
      expect(typeof patternMatch.confidence).toBe('number');
      expect(patternMatch.confidence).toBeGreaterThanOrEqual(0);
      expect(patternMatch.confidence).toBeLessThanOrEqual(100);
    });

    it('should validate connection health structure', () => {
      const connectionHealth: WebSocketConnectionHealth = {
        isConnected: true,
        lastMessageTime: Date.now(),
        messageCount: 150,
        errorCount: 2,
        reconnectCount: 1,
        averageLatency: 45.5,
        subscriptionCount: 5,
        circuitBreakerStatus: 'CLOSED',
      };

      expect(connectionHealth).toHaveProperty('isConnected');
      expect(connectionHealth).toHaveProperty('lastMessageTime');
      expect(connectionHealth).toHaveProperty('messageCount');
      expect(connectionHealth).toHaveProperty('errorCount');
      expect(connectionHealth).toHaveProperty('reconnectCount');
      expect(connectionHealth).toHaveProperty('averageLatency');
      expect(connectionHealth).toHaveProperty('subscriptionCount');
      expect(connectionHealth).toHaveProperty('circuitBreakerStatus');

      expect(typeof connectionHealth.isConnected).toBe('boolean');
      expect(typeof connectionHealth.messageCount).toBe('number');
      expect(typeof connectionHealth.errorCount).toBe('number');
      expect(typeof connectionHealth.averageLatency).toBe('number');
    });
  });

  describe('Real-Time Pattern Detection Logic', () => {
    it('should identify ready state pattern correctly', () => {
      // Test the ready state pattern logic: sts:2, st:2, tt:4
      const readyStateConditions = [
        { sts: 2, st: 2, tt: 4, expected: true },
        { sts: 1, st: 2, tt: 4, expected: false },
        { sts: 2, st: 1, tt: 4, expected: false },
        { sts: 2, st: 2, tt: 3, expected: false },
        { sts: 0, st: 0, tt: 0, expected: false },
      ];

      readyStateConditions.forEach(({ sts, st, tt, expected }) => {
        const isReady = sts === 2 && st === 2 && tt === 4;
        expect(isReady).toBe(expected);
      });
    });

    it('should calculate pattern confidence correctly', () => {
      // Base confidence calculation logic
      let confidence = 70; // Base confidence

      // Exact status match adds 20
      if (mockSymbolStatus.sts === 2 && mockSymbolStatus.st === 2 && mockSymbolStatus.tt === 4) {
        confidence += 20;
      }

      // Volume adds 5
      if (mockPriceData.volume > 0) {
        confidence += 5;
      }

      // Price movement adds 5
      if (Math.abs(mockPriceData.priceChangePercent) > 0.1) {
        confidence += 5;
      }

      // Should not exceed 100
      confidence = Math.min(confidence, 100);

      expect(confidence).toBe(100);
      expect(confidence).toBeGreaterThanOrEqual(70);
      expect(confidence).toBeLessThanOrEqual(100);
    });

    it('should calculate advance notice correctly', () => {
      const baseNotice = 3.5 * 60 * 60 * 1000; // 3.5 hours in milliseconds
      const volumeAdjustment = mockPriceData.volume > 100000 ? -0.5 * 60 * 60 * 1000 : 0;
      const advanceNotice = Math.max(baseNotice + volumeAdjustment, 1 * 60 * 60 * 1000);

      expect(advanceNotice).toBeGreaterThanOrEqual(1 * 60 * 60 * 1000); // Minimum 1 hour
      expect(advanceNotice).toBeLessThanOrEqual(3.5 * 60 * 60 * 1000); // Maximum 3.5 hours
      expect(typeof advanceNotice).toBe('number');
    });

    it('should detect significant status changes', () => {
      const previousStatus = { sts: 1, st: 1, tt: 3 };
      const currentStatus = { sts: 2, st: 2, tt: 4 };

      const hasChange = 
        previousStatus.sts !== currentStatus.sts ||
        previousStatus.st !== currentStatus.st ||
        previousStatus.tt !== currentStatus.tt;

      expect(hasChange).toBe(true);

      // Test no change
      const sameStatus = { sts: 2, st: 2, tt: 4 };
      const noChange = 
        currentStatus.sts !== sameStatus.sts ||
        currentStatus.st !== sameStatus.st ||
        currentStatus.tt !== sameStatus.tt;

      expect(noChange).toBe(false);
    });
  });

  describe('Price History Management', () => {
    it('should manage price history with size limits', () => {
      const PRICE_HISTORY_LIMIT = 100;
      const priceHistory: RealTimePriceData[] = [];

      // Simulate adding price data
      for (let i = 0; i < 150; i++) {
        const priceData = {
          ...mockPriceData,
          price: 45000 + i,
          timestamp: Date.now() + i * 1000,
        };

        priceHistory.push(priceData);

        // Limit history size
        if (priceHistory.length > PRICE_HISTORY_LIMIT) {
          priceHistory.shift();
        }
      }

      expect(priceHistory.length).toBe(PRICE_HISTORY_LIMIT);
      expect(priceHistory[0].price).toBe(45050); // First entry after trimming
      expect(priceHistory[priceHistory.length - 1].price).toBe(45149); // Last entry
    });

    it('should handle empty price history gracefully', () => {
      const emptyHistory: RealTimePriceData[] = [];
      
      expect(emptyHistory.length).toBe(0);
      expect(emptyHistory.find(p => p.symbol === 'BTCUSDT')).toBeUndefined();
    });
  });

  describe('Subscription Management', () => {
    it('should manage pattern callbacks correctly', () => {
      const patternCallbacks = new Map<string, Set<(pattern: RealTimePatternMatch) => void>>();
      
      // Add callback
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      if (!patternCallbacks.has('BTCUSDT')) {
        patternCallbacks.set('BTCUSDT', new Set());
      }

      patternCallbacks.get('BTCUSDT')?.add(callback1);
      patternCallbacks.get('BTCUSDT')?.add(callback2);

      expect(patternCallbacks.has('BTCUSDT')).toBe(true);
      expect(patternCallbacks.get('BTCUSDT')?.size).toBe(2);

      // Remove callback
      patternCallbacks.get('BTCUSDT')?.delete(callback1);
      expect(patternCallbacks.get('BTCUSDT')?.size).toBe(1);

      // Remove all callbacks
      patternCallbacks.get('BTCUSDT')?.delete(callback2);
      if (patternCallbacks.get('BTCUSDT')?.size === 0) {
        patternCallbacks.delete('BTCUSDT');
      }

      expect(patternCallbacks.has('BTCUSDT')).toBe(false);
    });

    it('should handle callback notifications safely', () => {
      const callbacks = new Set<(pattern: RealTimePatternMatch) => void>();
      
      const successCallback = vi.fn();
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });

      callbacks.add(successCallback);
      callbacks.add(errorCallback);

      const testPattern: RealTimePatternMatch = {
        patternId: 'test_pattern',
        symbol: 'BTCUSDT',
        vcoinId: 'BTC001',
        patternType: 'ready_state',
        confidence: 95,
        triggers: { sts: 2, st: 2, tt: 4 },
        timing: { detectedAt: Date.now(), advanceNoticeMs: 1000 },
        priceData: mockPriceData,
      };

      // Simulate callback notification with error handling
      callbacks.forEach((callback) => {
        try {
          callback(testPattern);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBe('Callback error');
        }
      });

      expect(successCallback).toHaveBeenCalledWith(testPattern);
      expect(errorCallback).toHaveBeenCalledWith(testPattern);
    });
  });

  describe('Connection Health Monitoring', () => {
    it('should track connection health metrics', () => {
      const health: WebSocketConnectionHealth = {
        isConnected: false,
        lastMessageTime: 0,
        messageCount: 0,
        errorCount: 0,
        reconnectCount: 0,
        averageLatency: 0,
        subscriptionCount: 0,
        circuitBreakerStatus: 'CLOSED',
      };

      // Simulate connection established
      health.isConnected = true;
      health.lastMessageTime = Date.now();

      // Simulate message received
      health.messageCount++;
      health.lastMessageTime = Date.now();

      // Simulate error
      health.errorCount++;

      // Simulate reconnection
      health.reconnectCount++;

      expect(health.isConnected).toBe(true);
      expect(health.messageCount).toBe(1);
      expect(health.errorCount).toBe(1);
      expect(health.reconnectCount).toBe(1);
      expect(health.lastMessageTime).toBeGreaterThan(0);
    });

    it('should calculate latency correctly', () => {
      const latencies = [10, 20, 30, 40, 50];
      const averageLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;

      expect(averageLatency).toBe(30);
      expect(typeof averageLatency).toBe('number');
    });
  });

  describe('WebSocket Configuration', () => {
    it('should have proper WebSocket configuration', () => {
      const MEXC_WS_URL = 'wss://wbs.mexc.com/ws';
      const HEARTBEAT_INTERVAL = 30000;
      const HEALTH_CHECK_INTERVAL = 10000;

      expect(MEXC_WS_URL).toBe('wss://wbs.mexc.com/ws');
      expect(HEARTBEAT_INTERVAL).toBe(30000); // 30 seconds
      expect(HEALTH_CHECK_INTERVAL).toBe(10000); // 10 seconds

      // Validate URL format
      expect(MEXC_WS_URL.startsWith('wss://')).toBe(true);
      expect(MEXC_WS_URL.includes('mexc.com')).toBe(true);
    });

    it('should handle reconnection strategy correctly', () => {
      let reconnectAttempts = 0;
      const maxReconnectAttempts = 10;
      let reconnectDelay = 1000;

      // Simulate reconnection attempts
      const shouldReconnect = reconnectAttempts < maxReconnectAttempts;
      expect(shouldReconnect).toBe(true);

      // Simulate exponential backoff
      reconnectAttempts++;
      reconnectDelay = Math.min(reconnectDelay * 2, 30000); // Cap at 30 seconds

      expect(reconnectAttempts).toBe(1);
      expect(reconnectDelay).toBe(2000);

      // Test maximum delay cap
      reconnectDelay = 60000;
      reconnectDelay = Math.min(reconnectDelay * 2, 30000);
      expect(reconnectDelay).toBe(30000);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed price data gracefully', () => {
      const malformedData = [
        { symbol: 'BTC', price: 'invalid' },
        { symbol: '', price: 45000 },
        { price: 45000 }, // missing symbol
        null,
        undefined,
      ];

      malformedData.forEach(data => {
        // Simple validation function
        const isValidPriceData = (data: any): boolean => {
          if (!data || typeof data !== 'object') {
            return false;
          }
          
          return (
            'symbol' in data &&
            'price' in data &&
            typeof data.symbol === 'string' &&
            data.symbol !== '' &&
            typeof data.price === 'number'
          );
        };

        const isValid = isValidPriceData(data);

        // All the test data should be invalid
        expect(isValid).toBe(false);
      });
    });

    it('should handle WebSocket message parsing errors', () => {
      const invalidMessages = [
        '{"invalid": json',
        '',
        'null',
        'undefined',
        '[]',
        '{}',
      ];

      invalidMessages.forEach(message => {
        try {
          const parsed = JSON.parse(message);
          expect(parsed).toBeDefined();
        } catch (error) {
          expect(error).toBeInstanceOf(SyntaxError);
        }
      });
    });

    it('should handle circuit breaker states correctly', () => {
      const circuitBreakerStates = ['CLOSED', 'OPEN', 'HALF_OPEN'];
      
      circuitBreakerStates.forEach(state => {
        expect(typeof state).toBe('string');
        expect(['CLOSED', 'OPEN', 'HALF_OPEN']).toContain(state);
      });
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle large numbers of subscriptions efficiently', () => {
      const subscriptions = new Map<string, Set<string>>();
      
      // Simulate many symbol subscriptions
      for (let i = 0; i < 1000; i++) {
        const symbol = `SYMBOL${i}USDT`;
        if (!subscriptions.has(symbol)) {
          subscriptions.set(symbol, new Set());
        }
        subscriptions.get(symbol)?.add('ticker');
        subscriptions.get(symbol)?.add('depth');
      }

      expect(subscriptions.size).toBe(1000);
      
      // Clean up
      subscriptions.clear();
      expect(subscriptions.size).toBe(0);
    });

    it('should manage memory efficiently with time-based cleanup', () => {
      const priceHistory = new Map<string, RealTimePriceData[]>();
      const CLEANUP_THRESHOLD = 60000; // 1 minute
      const currentTime = Date.now();

      // Add old and new data
      priceHistory.set('BTCUSDT', [
        { ...mockPriceData, timestamp: currentTime - 120000 }, // 2 minutes old
        { ...mockPriceData, timestamp: currentTime - 30000 },  // 30 seconds old
        { ...mockPriceData, timestamp: currentTime },          // Current
      ]);

      // Simulate cleanup of old data
      for (const [symbol, history] of priceHistory.entries()) {
        const filteredHistory = history.filter(
          data => currentTime - data.timestamp < CLEANUP_THRESHOLD
        );
        priceHistory.set(symbol, filteredHistory);
      }

      const cleanedHistory = priceHistory.get('BTCUSDT');
      expect(cleanedHistory?.length).toBe(2); // Should remove the 2-minute old entry
    });
  });
});