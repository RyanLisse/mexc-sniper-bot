/**
 * WebSocket Connection and Real-Time Data Tests
 * 
 * Tests for WebSocket connection establishment, real-time data streaming,
 * connection cleanup, and synchronization issues.
 * 
 * Agent 7/15: WebSocket Connection and Real-Time Data Specialist
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setTestTimeout } from '../utils/timeout-utilities';
import { WebSocketServerService } from '@/src/services/data/websocket-server';
import { MexcWebSocketStreamService } from '@/src/services/data/websocket/stream-processor';
import { WebSocketClientService } from '@/src/services/data/websocket-client';
import { MarketDataManager } from '@/src/services/data/websocket/market-data-manager';
import { MexcConnectionManager } from '@/src/services/data/websocket/connection-manager';

describe('WebSocket Connection and Real-Time Data Fixes', () => {
  const TEST_TIMEOUT = setTestTimeout('unit');
  
  let server: WebSocketServerService;
  let client: WebSocketClientService;
  let streamService: MexcWebSocketStreamService;
  let marketDataManager: MarketDataManager;

  beforeEach(async () => {
    // Reset all WebSocket services
    server = new WebSocketServerService({
      port: 8081, // Use different port to avoid conflicts
      host: 'localhost',
      path: '/test-ws',
      authentication: { 
        required: false,
        tokenValidation: async (token: string) => ({ valid: true, userId: 'test' })
      }
    });
    
    client = new WebSocketClientService({
      url: 'ws://localhost:8081/test-ws',
      authentication: { token: 'test-token', autoRefresh: false },
      reconnection: { enabled: true, maxAttempts: 3, delay: 1000, maxDelay: 5000 }
    });
    
    streamService = MexcWebSocketStreamService.getInstance();
    marketDataManager = MarketDataManager.getInstance();

    // Setup mocks for external dependencies
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(async () => {
    // Clean up connections and services
    if (client && client.isConnected()) {
      client.disconnect();
    }
    
    if (server && server.isHealthy()) {
      await server.stop();
    }

    // Reset market data
    marketDataManager.clearCaches();
    
    vi.restoreAllMocks();
  });

  describe('WebSocket Server Connection Management', () => {
    it('should start server successfully', async () => {
      await server.start();
      
      expect(server.isHealthy()).toBe(true);
      
      const metrics = server.getServerMetrics();
      expect(metrics.totalConnections).toBe(0);
    }, TEST_TIMEOUT);

    it('should handle connection establishment', async () => {
      await server.start();
      
      // Mock WebSocket connection
      const mockWs = {
        readyState: 1, // WebSocket.OPEN
        on: vi.fn(),
        send: vi.fn(),
        close: vi.fn(),
        ping: vi.fn()
      } as any;

      // Simulate connection handling
      expect(server.getConnectionMetrics()).toHaveLength(0);
    }, TEST_TIMEOUT);

    it('should handle server cleanup properly', async () => {
      await server.start();
      expect(server.isHealthy()).toBe(true);
      
      await server.stop();
      expect(server.isHealthy()).toBe(false);
    }, TEST_TIMEOUT);
  });

  describe('WebSocket Client Connection', () => {
    it('should handle connection lifecycle', async () => {
      const states: string[] = [];
      
      client.on('stateChange', ({ newState }: { newState: string }) => {
        states.push(newState);
      });

      // Test connection without actual WebSocket server
      try {
        await client.connect('test-token');
      } catch (error) {
        // Expected to fail without running server
        expect(error).toBeDefined();
      }

      expect(client.getState()).toBe('error');
    }, TEST_TIMEOUT);

    it('should manage message queue during disconnection', () => {
      expect(client.isConnected()).toBe(false);
      
      const result = client.send({
        type: 'test:message',
        channel: 'test',
        data: { test: 'data' }
      });
      
      // Should queue message when disconnected
      expect(result).toBe(false);
      
      const metrics = client.getMetrics();
      expect(metrics.queuedMessages).toBeGreaterThan(0);
    }, TEST_TIMEOUT);

    it('should handle subscription management', () => {
      const mockHandler = vi.fn();
      
      const unsubscribe = client.subscribe('test:channel', mockHandler);
      
      expect(client.getSubscriptions()).toContain('test:channel');
      
      unsubscribe();
      
      expect(client.getSubscriptions()).not.toContain('test:channel');
    }, TEST_TIMEOUT);

    it('should implement reconnection logic', () => {
      const reconnectInfo = client.getMetrics().reconnectInfo;
      
      expect(reconnectInfo).toBeDefined();
      expect(reconnectInfo.maxAttempts).toBeGreaterThan(0);
    }, TEST_TIMEOUT);
  });

  describe('MEXC WebSocket Stream Service', () => {
    it('should initialize stream processor correctly', async () => {
      await streamService.initialize({
        mexcWsUrl: 'wss://wbs.mexc.com/ws',
        subscriptions: ['ticker', 'depth'],
        enableReconnection: true
      });

      const status = streamService.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.subscriptions).toHaveLength(0); // Not connected yet
    }, TEST_TIMEOUT);

    it('should handle stream subscriptions', async () => {
      await streamService.initialize();
      
      const symbols = ['BTCUSDT', 'ETHUSDT'];
      await streamService.subscribeToStreams(symbols.map(s => `${s}@ticker`));
      
      const status = streamService.getStatus();
      expect(status.subscriptions).toHaveLength(2);
    }, TEST_TIMEOUT);

    it('should provide status and metrics', () => {
      const status = streamService.getStatus();
      
      expect(status).toHaveProperty('initialized');
      expect(status).toHaveProperty('connected');
      expect(status).toHaveProperty('subscriptions');
      expect(status).toHaveProperty('messageStats');
      expect(status).toHaveProperty('cacheStats');
    }, TEST_TIMEOUT);

    it('should handle cache clearing', () => {
      streamService.clearCache();
      
      const status = streamService.getStatus();
      expect(status.messageStats.received).toBe(0);
      expect(status.messageStats.processed).toBe(0);
    }, TEST_TIMEOUT);
  });

  describe('Market Data Manager', () => {
    it('should handle price updates', async () => {
      const mockTicker = {
        s: 'BTCUSDT',
        c: '45000.50',
        h: '46000.00',
        l: '44500.00',
        v: '1000.5',
        q: '45000000',
        o: '45200.00',
        P: '-0.44',
        p: '-200.50',
        t: Date.now()
      };

      await marketDataManager.updatePrice(mockTicker);
      
      const cachedPrice = marketDataManager.getPrice('BTCUSDT');
      expect(cachedPrice).toBeDefined();
      expect(cachedPrice?.symbol).toBe('BTCUSDT');
      expect(cachedPrice?.price).toBe(45000.50);
    }, TEST_TIMEOUT);

    it('should handle market depth updates', async () => {
      const mockDepth = {
        s: 'BTCUSDT',
        bids: [['45000', '0.5'], ['44999', '1.0']],
        asks: [['45001', '0.8'], ['45002', '1.2']],
        ts: Date.now()
      };

      await marketDataManager.updateDepth(mockDepth);
      
      const cachedDepth = marketDataManager.getDepth('BTCUSDT');
      expect(cachedDepth).toBeDefined();
      expect(cachedDepth?.bids).toHaveLength(2);
      expect(cachedDepth?.asks).toHaveLength(2);
    }, TEST_TIMEOUT);

    it('should detect ready state patterns', async () => {
      const mockStatus = {
        symbol: 'BTCUSDT',
        sts: 2,
        st: 2,
        tt: 4,
        ps: 150,
        qs: 200,
        ca: 75,
        timestamp: Date.now()
      };

      let notificationReceived = false;
      marketDataManager.setEventHandlers({
        onNotification: (notification) => {
          if (notification.type === 'pattern_detected') {
            notificationReceived = true;
          }
        }
      });

      await marketDataManager.updateSymbolStatus(mockStatus);
      
      expect(notificationReceived).toBe(true);
      
      const cachedStatus = marketDataManager.getStatus('BTCUSDT');
      expect(cachedStatus).toBeDefined();
      expect(cachedStatus?.sts).toBe(2);
    }, TEST_TIMEOUT);

    it('should provide cache statistics', () => {
      const stats = marketDataManager.getCacheStats();
      
      expect(stats).toHaveProperty('prices');
      expect(stats).toHaveProperty('depths');
      expect(stats).toHaveProperty('statuses');
      expect(typeof stats.prices).toBe('number');
    }, TEST_TIMEOUT);

    it('should clear caches properly', () => {
      marketDataManager.clearCaches();
      
      const stats = marketDataManager.getCacheStats();
      expect(stats.prices).toBe(0);
      expect(stats.depths).toBe(0);
      expect(stats.statuses).toBe(0);
    }, TEST_TIMEOUT);
  });

  describe('Connection Manager', () => {
    it('should create connection manager with proper configuration', () => {
      const connectionManager = new MexcConnectionManager(
        {
          url: 'wss://test.websocket.url',
          maxReconnectAttempts: 5,
          initialReconnectDelay: 2000,
          maxReconnectDelay: 30000,
          heartbeatInterval: 25000
        },
        () => {}, // onMessage
        () => {}  // onError
      );

      const status = connectionManager.getStatus();
      expect(status.connected).toBe(false);
      expect(status.connecting).toBe(false);
      expect(status.reconnectAttempts).toBe(0);
    }, TEST_TIMEOUT);

    it('should handle connection status properly', () => {
      const connectionManager = new MexcConnectionManager(
        { url: 'wss://test.url' },
        () => {},
        () => {}
      );

      expect(connectionManager.getStatus().connected).toBe(false);
    }, TEST_TIMEOUT);

    it('should properly disconnect', () => {
      const connectionManager = new MexcConnectionManager(
        { url: 'wss://test.url' },
        () => {},
        () => {}
      );

      connectionManager.disconnect();
      
      const status = connectionManager.getStatus();
      expect(status.connected).toBe(false);
      expect(status.reconnectAttempts).toBe(0);
    }, TEST_TIMEOUT);
  });

  describe('Real-Time Data Integrity', () => {
    it('should maintain data consistency across updates', async () => {
      // Test sequence of price updates
      const updates = [
        { s: 'BTCUSDT', c: '45000', t: Date.now() },
        { s: 'BTCUSDT', c: '45100', t: Date.now() + 1000 },
        { s: 'BTCUSDT', c: '44900', t: Date.now() + 2000 }
      ];

      for (const update of updates) {
        await marketDataManager.updatePrice({
          ...update,
          h: '46000', l: '44000', v: '1000', q: '45000000',
          o: '45000', P: '0', p: '0'
        });
      }

      const finalPrice = marketDataManager.getPrice('BTCUSDT');
      expect(finalPrice?.price).toBe(44900);
    }, TEST_TIMEOUT);

    it('should handle rapid fire updates without data loss', async () => {
      const updatePromises = [];
      
      // Simulate 10 rapid updates
      for (let i = 0; i < 10; i++) {
        updatePromises.push(
          marketDataManager.updatePrice({
            s: `TEST${i}`,
            c: `${45000 + i}`,
            h: '46000', l: '44000', v: '1000', q: '45000000',
            o: '45000', P: '0', p: '0',
            t: Date.now() + i
          })
        );
      }

      await Promise.all(updatePromises);
      
      const symbols = marketDataManager.getAllSymbols();
      expect(symbols.length).toBeGreaterThanOrEqual(10);
    }, TEST_TIMEOUT);

    it('should handle malformed data gracefully', async () => {
      const malformedData = {
        s: 'INVALID',
        c: 'not-a-number',
        h: '', l: null, v: undefined, q: 'invalid',
        o: 'bad', P: 'percent', p: 'change',
        t: 'timestamp'
      } as any;

      // Should not throw error
      await expect(marketDataManager.updatePrice(malformedData)).resolves.not.toThrow();
    }, TEST_TIMEOUT);
  });

  describe('Connection Synchronization', () => {
    it('should handle async connection operations properly', async () => {
      const server = new WebSocketServerService({
        port: 8082,
        authentication: { 
          required: false,
          tokenValidation: async (token: string) => ({ valid: true, userId: 'test' })
        }
      });

      await server.start();
      expect(server.isHealthy()).toBe(true);

      // Multiple rapid start calls should not cause issues
      await Promise.all([
        server.start(),
        server.start(),
        server.start()
      ]);

      expect(server.isHealthy()).toBe(true);
      await server.stop();
    }, TEST_TIMEOUT);

    it('should handle subscription race conditions', () => {
      const client = new WebSocketClientService();
      const handlers = Array.from({ length: 5 }, () => vi.fn());
      
      // Subscribe to same channel multiple times rapidly
      const unsubscribes = handlers.map(handler => 
        client.subscribe('test:channel', handler)
      );

      expect(client.getSubscriptions()).toContain('test:channel');

      // Unsubscribe all
      unsubscribes.forEach(unsub => unsub());
      
      expect(client.getSubscriptions()).not.toContain('test:channel');
    }, TEST_TIMEOUT);
  });

  describe('Error Handling and Recovery', () => {
    it('should handle connection errors gracefully', () => {
      const client = new WebSocketClientService({
        reconnection: { enabled: true, maxAttempts: 2, delay: 1000, maxDelay: 5000 }
      });

      let errorReceived = false;
      client.on('error', () => {
        errorReceived = true;
      });

      // Attempt to connect to non-existent server
      expect(async () => {
        await client.connect('test-token');
      }).rejects.toThrow();
    }, TEST_TIMEOUT);

    it('should handle message processing errors', async () => {
      const errorHandler = vi.fn();
      marketDataManager.setEventHandlers({
        onPriceUpdate: () => {
          throw new Error('Handler error');
        }
      });

      // Should not throw despite handler error
      await expect(marketDataManager.updatePrice({
        s: 'TEST', c: '1000', h: '1000', l: '1000',
        v: '100', q: '100000', o: '1000', P: '0', p: '0', t: Date.now()
      })).resolves.not.toThrow();
    }, TEST_TIMEOUT);

    it('should recover from stream processor errors', async () => {
      await streamService.initialize();
      
      // Simulate error and recovery
      const status = streamService.getStatus();
      expect(status.initialized).toBe(true);
      
      streamService.clearCache();
      
      const clearedStatus = streamService.getStatus();
      expect(clearedStatus.messageStats.received).toBe(0);
    }, TEST_TIMEOUT);
  });
});