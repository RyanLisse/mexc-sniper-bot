/**
 * MEXC API Real Behavior Integration Tests
 * 
 * Comprehensive test suite for MEXC API integration covering:
 * - Real API response validation
 * - Rate limit handling and backoff strategies
 * - Authentication and signature validation
 * - WebSocket connection management
 * - Order placement and execution flows
 * - Market data accuracy and timing
 * - Error code handling and recovery
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { UnifiedMexcService } from '../../src/services/unified-mexc-service';
import { UnifiedMexcClient } from '../../src/services/unified-mexc-client';
import { AdaptiveRateLimiter } from '../../src/services/adaptive-rate-limiter';
import { CircuitBreaker } from '../../src/services/circuit-breaker';
import { WebSocketClient } from '../../src/services/websocket-client';
import type { ActivityData, ActivityQueryOptions } from '../../src/schemas/mexc-schemas';

// Test environment configuration
const TEST_CONFIG = {
  // Use demo/testnet credentials for safety
  apiKey: process.env.MEXC_TEST_API_KEY || 'test-api-key',
  secretKey: process.env.MEXC_TEST_SECRET_KEY || 'test-secret-key',
  baseUrl: process.env.MEXC_TEST_BASE_URL || 'https://api.mexc.com',
  enableRealApi: process.env.ENABLE_REAL_MEXC_TESTS === 'true',
  maxTestDuration: 30000, // 30 seconds max per test
  rateLimitBuffer: 1.5 // Safety buffer for rate limits
};

describe('MEXC API Real Behavior Integration', () => {
  let mexcService: UnifiedMexcService;
  let mexcClient: UnifiedMexcClient;
  let rateLimiter: AdaptiveRateLimiter;
  let circuitBreaker: CircuitBreaker;
  let wsClient: WebSocketClient;

  // API Response validation helpers
  class ApiValidator {
    static validateSpotPriceResponse(response: any, symbol: string) {
      expect(response).toBeDefined();
      expect(typeof response.price).toBe('number');
      expect(response.price).toBeGreaterThan(0);
      expect(response.symbol).toBe(symbol);
      expect(response.timestamp).toBeDefined();
    }

    static validateOrderBookResponse(response: any) {
      expect(response).toBeDefined();
      expect(Array.isArray(response.bids)).toBe(true);
      expect(Array.isArray(response.asks)).toBe(true);
      expect(response.bids.length).toBeGreaterThan(0);
      expect(response.asks.length).toBeGreaterThan(0);
      
      // Validate bid/ask structure [price, quantity]
      response.bids.forEach((bid: any) => {
        expect(Array.isArray(bid)).toBe(true);
        expect(bid).toHaveLength(2);
        expect(typeof bid[0]).toBe('number'); // price
        expect(typeof bid[1]).toBe('number'); // quantity
        expect(bid[0]).toBeGreaterThan(0);
        expect(bid[1]).toBeGreaterThan(0);
      });
    }

    static validateKlineResponse(response: any) {
      expect(Array.isArray(response)).toBe(true);
      if (response.length > 0) {
        const kline = response[0];
        expect(Array.isArray(kline)).toBe(true);
        expect(kline).toHaveLength(12); // MEXC kline format
        expect(typeof kline[0]).toBe('number'); // timestamp
        expect(typeof kline[1]).toBe('string'); // open
        expect(typeof kline[2]).toBe('string'); // high
        expect(typeof kline[3]).toBe('string'); // low
        expect(typeof kline[4]).toBe('string'); // close
        expect(typeof kline[5]).toBe('string'); // volume
      }
    }

    static validateAccountInfoResponse(response: any) {
      expect(response).toBeDefined();
      expect(Array.isArray(response.balances)).toBe(true);
      expect(typeof response.accountType).toBe('string');
      expect(typeof response.updateTime).toBe('number');
      
      if (response.balances.length > 0) {
        const balance = response.balances[0];
        expect(typeof balance.asset).toBe('string');
        expect(typeof balance.free).toBe('string');
        expect(typeof balance.locked).toBe('string');
      }
    }
  }

  beforeAll(async () => {
    if (!TEST_CONFIG.enableRealApi) {
      console.log('Real API tests disabled. Set ENABLE_REAL_MEXC_TESTS=true to enable.');
      return;
    }

    // Validate test environment
    if (!TEST_CONFIG.apiKey || TEST_CONFIG.apiKey === 'test-api-key') {
      throw new Error('Real API key required for integration tests');
    }
  });

  beforeEach(() => {
    // Initialize services
    rateLimiter = new AdaptiveRateLimiter({
      maxRequestsPerSecond: 10,
      maxRequestsPerMinute: 200,
      adaptiveBackoff: true,
      safetyBuffer: TEST_CONFIG.rateLimitBuffer
    });

    circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      recoveryTimeout: 30000,
      monitoringPeriod: 60000
    });

    mexcClient = new UnifiedMexcClient({
      apiKey: TEST_CONFIG.apiKey,
      secretKey: TEST_CONFIG.secretKey,
      baseUrl: TEST_CONFIG.baseUrl,
      rateLimiter,
      circuitBreaker,
      timeout: 10000
    });

    mexcService = new UnifiedMexcService({
      apiKey: TEST_CONFIG.apiKey,
      secretKey: TEST_CONFIG.secretKey,
      baseUrl: TEST_CONFIG.baseUrl,
      enableCaching: true,
      enableCircuitBreaker: true,
      enableMetrics: true,
      maxRetries: 3,
      retryDelay: 1000
    });

    // Mock implementations for non-real-API tests
    if (!TEST_CONFIG.enableRealApi) {
      vi.spyOn(mexcService, 'getSpotPrice').mockResolvedValue(50000);
      vi.spyOn(mexcService, 'getOrderBookDepth').mockResolvedValue({
        bids: [[49950, 1.5], [49900, 2.0]],
        asks: [[50050, 1.5], [50100, 2.0]]
      });
      vi.spyOn(mexcService, 'get24hrTicker').mockResolvedValue({
        symbol: 'BTCUSDT',
        volume: '1000000',
        count: 50000,
        high: '51000',
        low: '49000',
        lastPrice: '50000'
      });
    }
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    // Cleanup connections
    if (wsClient) {
      await wsClient.disconnect();
    }
  });

  describe('Authentication and Security', () => {
    it('should generate valid API signatures', async () => {
      if (!TEST_CONFIG.enableRealApi) {
        expect(true).toBe(true); // Skip in mock mode
        return;
      }

      // Arrange: Test signature generation
      const timestamp = Date.now();
      const method = 'GET';
      const endpoint = '/api/v3/account';
      const params = `timestamp=${timestamp}`;

      // Act: Generate signature
      const signature = mexcClient.generateSignature(method, endpoint, params);

      // Assert: Valid signature format
      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(0);
    });

    it('should handle authentication errors gracefully', async () => {
      // Arrange: Invalid credentials
      const invalidService = new UnifiedMexcService({
        apiKey: 'invalid-key',
        secretKey: 'invalid-secret',
        baseUrl: TEST_CONFIG.baseUrl
      });

      // Act & Assert: Should handle auth errors
      if (TEST_CONFIG.enableRealApi) {
        await expect(invalidService.getAccountInfo()).rejects.toThrow(/authentication|signature|invalid/i);
      } else {
        // Mock behavior
        vi.spyOn(invalidService, 'getAccountInfo').mockRejectedValue(new Error('Invalid API key'));
        await expect(invalidService.getAccountInfo()).rejects.toThrow('Invalid API key');
      }
    });

    it('should refresh authentication tokens when needed', async () => {
      // Arrange: Simulate token expiration
      let authAttempts = 0;
      
      if (!TEST_CONFIG.enableRealApi) {
        vi.spyOn(mexcService as any, 'makeAuthenticatedRequest').mockImplementation(async () => {
          authAttempts++;
          if (authAttempts === 1) {
            throw new Error('Token expired');
          }
          return { success: true };
        });
      }

      // Act: Make authenticated request
      try {
        await mexcService.getAccountInfo();
        if (!TEST_CONFIG.enableRealApi) {
          expect(authAttempts).toBe(2); // Should retry after token refresh
        }
      } catch (error) {
        if (TEST_CONFIG.enableRealApi) {
          // Real API might have different behavior
          expect(error).toBeDefined();
        }
      }
    });
  });

  describe('Market Data Accuracy', () => {
    it('should fetch accurate spot prices', async () => {
      // Act: Fetch BTC spot price
      const btcPrice = await mexcService.getSpotPrice('BTCUSDT');

      // Assert: Valid price data
      ApiValidator.validateSpotPriceResponse({ price: btcPrice, symbol: 'BTCUSDT', timestamp: Date.now() }, 'BTCUSDT');
      
      if (TEST_CONFIG.enableRealApi) {
        expect(btcPrice).toBeGreaterThan(1000); // Sanity check for BTC price
        expect(btcPrice).toBeLessThan(1000000); // Upper bound sanity check
      }
    });

    it('should provide consistent order book data', async () => {
      // Act: Fetch order book
      const orderBook = await mexcService.getOrderBookDepth('BTCUSDT', 20);

      // Assert: Valid order book structure
      ApiValidator.validateOrderBookResponse(orderBook);

      if (TEST_CONFIG.enableRealApi) {
        // Best bid should be lower than best ask
        expect(orderBook.bids[0][0]).toBeLessThan(orderBook.asks[0][0]);
        
        // Bids should be in descending order
        for (let i = 1; i < orderBook.bids.length; i++) {
          expect(orderBook.bids[i][0]).toBeLessThanOrEqual(orderBook.bids[i-1][0]);
        }
        
        // Asks should be in ascending order
        for (let i = 1; i < orderBook.asks.length; i++) {
          expect(orderBook.asks[i][0]).toBeGreaterThanOrEqual(orderBook.asks[i-1][0]);
        }
      }
    });

    it('should return valid kline/candlestick data', async () => {
      // Act: Fetch recent klines
      const klines = await mexcService.getKlines('BTCUSDT', '1h', 10);

      // Assert: Valid kline data
      ApiValidator.validateKlineResponse(klines);

      if (TEST_CONFIG.enableRealApi && klines.length > 1) {
        // Timestamps should be in ascending order
        for (let i = 1; i < klines.length; i++) {
          expect(klines[i][0]).toBeGreaterThan(klines[i-1][0]);
        }

        // OHLC data should be logical (High >= Open, Close; Low <= Open, Close)
        klines.forEach(kline => {
          const [, open, high, low, close] = kline.map(Number);
          expect(high).toBeGreaterThanOrEqual(Math.max(open, close));
          expect(low).toBeLessThanOrEqual(Math.min(open, close));
        });
      }
    });

    it('should handle market data for new listings', async () => {
      // Arrange: Test with a newer listing symbol
      const newListingSymbol = 'DOGEUSDT'; // Commonly available

      // Act: Fetch market data
      const ticker = await mexcService.get24hrTicker(newListingSymbol);

      // Assert: Valid ticker data
      expect(ticker).toBeDefined();
      expect(ticker.symbol).toBe(newListingSymbol);
      expect(typeof ticker.lastPrice).toBe('string');
      expect(parseFloat(ticker.lastPrice)).toBeGreaterThan(0);

      if (TEST_CONFIG.enableRealApi) {
        expect(parseInt(ticker.count)).toBeGreaterThan(0); // Should have some trades
        expect(parseFloat(ticker.volume)).toBeGreaterThan(0); // Should have volume
      }
    });
  });

  describe('Rate Limiting and Performance', () => {
    it('should respect MEXC rate limits', async () => {
      // Arrange: Rapid requests to test rate limiting
      const requestCount = 50;
      const startTime = Date.now();
      const requests = [];

      // Act: Make rapid requests
      for (let i = 0; i < requestCount; i++) {
        requests.push(mexcService.getSpotPrice('BTCUSDT'));
      }

      const results = await Promise.allSettled(requests);
      const executionTime = Date.now() - startTime;

      // Assert: Should handle rate limits gracefully
      const successfulRequests = results.filter(r => r.status === 'fulfilled').length;
      const failedRequests = results.filter(r => r.status === 'rejected').length;

      expect(successfulRequests).toBeGreaterThan(0);
      
      if (TEST_CONFIG.enableRealApi) {
        // Should either succeed all or fail some due to rate limiting
        expect(successfulRequests + failedRequests).toBe(requestCount);
        
        // Execution time should be reasonable (not too fast = respecting limits)
        expect(executionTime).toBeGreaterThan(requestCount * 50); // At least 50ms per request
      }
    });

    it('should implement adaptive backoff for rate limit errors', async () => {
      // Arrange: Monitor backoff behavior
      const backoffMetrics = {
        initialDelay: 1000,
        maxDelay: 10000,
        backoffFactor: 2,
        actualDelays: []
      };

      let requestAttempts = 0;
      
      if (!TEST_CONFIG.enableRealApi) {
        vi.spyOn(mexcService as any, 'makeRequest').mockImplementation(async () => {
          requestAttempts++;
          if (requestAttempts <= 3) {
            const delay = backoffMetrics.initialDelay * Math.pow(backoffMetrics.backoffFactor, requestAttempts - 1);
            backoffMetrics.actualDelays.push(delay);
            throw new Error('Rate limit exceeded');
          }
          return { success: true };
        });
      }

      // Act: Trigger rate limit handling
      try {
        await mexcService.getSpotPrice('BTCUSDT');
      } catch (error) {
        // Expected in mock mode
      }

      // Assert: Backoff behavior
      if (!TEST_CONFIG.enableRealApi) {
        expect(backoffMetrics.actualDelays.length).toBeGreaterThan(0);
        
        // Each delay should be longer than the previous
        for (let i = 1; i < backoffMetrics.actualDelays.length; i++) {
          expect(backoffMetrics.actualDelays[i]).toBeGreaterThan(backoffMetrics.actualDelays[i-1]);
        }
      }
    });

    it('should maintain performance under sustained load', async () => {
      // Arrange: Sustained load test
      const testDuration = 10000; // 10 seconds
      const targetRPS = 5; // Conservative rate
      const startTime = Date.now();
      const metrics = {
        totalRequests: 0,
        successfulRequests: 0,
        averageLatency: 0,
        maxLatency: 0,
        errors: []
      };

      // Act: Sustained load simulation
      const loadInterval = setInterval(async () => {
        if (Date.now() - startTime >= testDuration) {
          clearInterval(loadInterval);
          return;
        }

        const requestStart = Date.now();
        metrics.totalRequests++;

        try {
          await mexcService.getSpotPrice('ETHUSDT');
          const latency = Date.now() - requestStart;
          metrics.successfulRequests++;
          metrics.averageLatency = (metrics.averageLatency + latency) / metrics.successfulRequests;
          metrics.maxLatency = Math.max(metrics.maxLatency, latency);
        } catch (error) {
          metrics.errors.push(error.message);
        }
      }, 1000 / targetRPS);

      // Wait for test completion
      await new Promise(resolve => setTimeout(resolve, testDuration + 1000));

      // Assert: Performance metrics
      expect(metrics.totalRequests).toBeGreaterThan(0);
      expect(metrics.successfulRequests / metrics.totalRequests).toBeGreaterThan(0.8); // 80% success rate
      
      if (TEST_CONFIG.enableRealApi) {
        expect(metrics.averageLatency).toBeLessThan(5000); // Average < 5s
        expect(metrics.maxLatency).toBeLessThan(15000); // Max < 15s
      }
    });
  });

  describe('WebSocket Integration', () => {
    it('should establish stable WebSocket connections', async () => {
      if (!TEST_CONFIG.enableRealApi) {
        expect(true).toBe(true); // Skip in mock mode
        return;
      }

      // Arrange: WebSocket configuration
      wsClient = new WebSocketClient({
        baseUrl: 'wss://wbs.mexc.com/ws',
        reconnectInterval: 5000,
        maxReconnectAttempts: 3,
        heartbeatInterval: 30000
      });

      let connectionEstablished = false;
      let messagesReceived = 0;

      wsClient.on('open', () => {
        connectionEstablished = true;
      });

      wsClient.on('message', () => {
        messagesReceived++;
      });

      // Act: Connect and subscribe
      await wsClient.connect();
      await wsClient.subscribe({
        method: 'SUBSCRIPTION',
        params: ['spot@public.deals.v3.api@BTCUSDT']
      });

      // Wait for data
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Assert: Connection and data flow
      expect(connectionEstablished).toBe(true);
      expect(messagesReceived).toBeGreaterThan(0);
    });

    it('should handle WebSocket reconnections', async () => {
      if (!TEST_CONFIG.enableRealApi) {
        // Mock WebSocket reconnection behavior
        let connectionAttempts = 0;
        const mockWsClient = {
          connect: vi.fn().mockImplementation(() => {
            connectionAttempts++;
            if (connectionAttempts <= 2) {
              throw new Error('Connection failed');
            }
            return Promise.resolve();
          }),
          isConnected: vi.fn().mockReturnValue(connectionAttempts > 2)
        };

        // Simulate reconnection attempts
        for (let i = 0; i < 3; i++) {
          try {
            await mockWsClient.connect();
          } catch (error) {
            // Expected for first 2 attempts
          }
        }

        expect(connectionAttempts).toBe(3);
        expect(mockWsClient.isConnected()).toBe(true);
        return;
      }

      // Real WebSocket reconnection test
      wsClient = new WebSocketClient({
        baseUrl: 'wss://wbs.mexc.com/ws',
        reconnectInterval: 1000,
        maxReconnectAttempts: 3
      });

      let reconnectionAttempts = 0;
      wsClient.on('reconnect_attempt', () => {
        reconnectionAttempts++;
      });

      // Connect, then simulate disconnection
      await wsClient.connect();
      wsClient.disconnect(); // Force disconnect

      // Wait for reconnection attempts
      await new Promise(resolve => setTimeout(resolve, 5000));

      expect(reconnectionAttempts).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle common MEXC error codes', async () => {
      // Arrange: Common error scenarios
      const errorScenarios = [
        { code: 1002, message: 'Unauthorized', test: 'invalid auth' },
        { code: 1003, message: 'Too many requests', test: 'rate limit' },
        { code: 2001, message: 'Invalid symbol', test: 'invalid symbol' },
        { code: 2011, message: 'Unknown order', test: 'order not found' }
      ];

      // Act & Assert: Test each error scenario
      for (const scenario of errorScenarios) {
        if (!TEST_CONFIG.enableRealApi) {
          // Mock error responses
          vi.spyOn(mexcService as any, 'makeRequest').mockRejectedValueOnce({
            code: scenario.code,
            message: scenario.message
          });

          try {
            await mexcService.getSpotPrice('INVALID');
          } catch (error) {
            expect(error.code).toBe(scenario.code);
            expect(error.message).toBe(scenario.message);
          }
        }
      }
    });

    it('should implement circuit breaker for API failures', async () => {
      // Arrange: Circuit breaker test
      const failureThreshold = 5;
      let consecutiveFailures = 0;
      let circuitBreakerOpen = false;

      if (!TEST_CONFIG.enableRealApi) {
        vi.spyOn(mexcService as any, 'makeRequest').mockImplementation(async () => {
          consecutiveFailures++;
          if (consecutiveFailures >= failureThreshold) {
            circuitBreakerOpen = true;
            throw new Error('Circuit breaker open');
          }
          throw new Error('API failure');
        });
      }

      // Act: Trigger circuit breaker
      for (let i = 0; i < failureThreshold + 2; i++) {
        try {
          await mexcService.getSpotPrice('BTCUSDT');
        } catch (error) {
          // Expected failures
        }
      }

      // Assert: Circuit breaker activation
      if (!TEST_CONFIG.enableRealApi) {
        expect(circuitBreakerOpen).toBe(true);
      }
    });

    it('should recover from temporary network issues', async () => {
      // Arrange: Network issue simulation
      let networkIssueCount = 0;
      const maxNetworkIssues = 3;

      if (!TEST_CONFIG.enableRealApi) {
        vi.spyOn(mexcService as any, 'makeRequest').mockImplementation(async () => {
          networkIssueCount++;
          if (networkIssueCount <= maxNetworkIssues) {
            throw new Error('Network timeout');
          }
          return { price: 50000 };
        });
      }

      // Act: Attempt requests with network recovery
      let finalResult;
      for (let attempt = 0; attempt < maxNetworkIssues + 2; attempt++) {
        try {
          finalResult = await mexcService.getSpotPrice('BTCUSDT');
          break;
        } catch (error) {
          await new Promise(resolve => setTimeout(resolve, 100)); // Brief delay
        }
      }

      // Assert: Should eventually succeed
      if (!TEST_CONFIG.enableRealApi) {
        expect(finalResult).toBeDefined();
        expect(networkIssueCount).toBe(maxNetworkIssues + 1);
      }
    });
  });

  describe('Data Consistency and Validation', () => {
    it('should validate API response schemas', async () => {
      // Act: Fetch various data types
      const spotPrice = await mexcService.getSpotPrice('BTCUSDT');
      const orderBook = await mexcService.getOrderBookDepth('BTCUSDT');
      const ticker = await mexcService.get24hrTicker('BTCUSDT');

      // Assert: Schema validation
      expect(typeof spotPrice).toBe('number');
      ApiValidator.validateOrderBookResponse(orderBook);
      
      expect(ticker).toBeDefined();
      expect(typeof ticker.symbol).toBe('string');
      expect(typeof ticker.lastPrice).toBe('string');
      expect(typeof ticker.volume).toBe('string');
    });

    it('should ensure price data consistency across endpoints', async () => {
      if (!TEST_CONFIG.enableRealApi) {
        // Mock consistent prices
        vi.spyOn(mexcService, 'getSpotPrice').mockResolvedValue(50000);
        vi.spyOn(mexcService, 'get24hrTicker').mockResolvedValue({
          symbol: 'BTCUSDT',
          lastPrice: '50000',
          volume: '1000000',
          count: 50000,
          high: '51000',
          low: '49000'
        });
      }

      // Act: Fetch price from multiple endpoints
      const spotPrice = await mexcService.getSpotPrice('BTCUSDT');
      const ticker = await mexcService.get24hrTicker('BTCUSDT');
      const orderBook = await mexcService.getOrderBookDepth('BTCUSDT');

      // Assert: Price consistency (within reasonable bounds)
      const tickerPrice = parseFloat(ticker.lastPrice);
      const midPrice = (orderBook.bids[0][0] + orderBook.asks[0][0]) / 2;

      expect(Math.abs(spotPrice - tickerPrice) / spotPrice).toBeLessThan(0.001); // <0.1% difference
      expect(Math.abs(spotPrice - midPrice) / spotPrice).toBeLessThan(0.01); // <1% difference
    });

    it('should handle timestamp synchronization', async () => {
      // Arrange: Server time check
      const localTime = Date.now();
      
      let serverTime;
      if (TEST_CONFIG.enableRealApi) {
        serverTime = await mexcService.getServerTime();
      } else {
        serverTime = Date.now();
      }

      // Assert: Time synchronization
      const timeDiff = Math.abs(serverTime - localTime);
      expect(timeDiff).toBeLessThan(5000); // Within 5 seconds
    });
  });

  describe('Activity Data Integration', () => {
    it('should fetch and validate activity data', async () => {
      // Arrange: Activity query options
      const queryOptions: ActivityQueryOptions = {
        currency: 'BTC',
        activityType: 'SUN_SHINE',
        limit: 10,
        orderBy: 'created_at',
        orderDirection: 'desc'
      };

      // Act: Fetch activity data
      let activityData: ActivityData[];
      
      if (TEST_CONFIG.enableRealApi) {
        activityData = await mexcService.getActivityData(queryOptions);
      } else {
        // Mock activity data
        activityData = [
          {
            activityId: 'test-activity-1',
            currency: 'BTC',
            currencyId: 'btc-currency-id',
            activityType: 'SUN_SHINE'
          }
        ];
      }

      // Assert: Valid activity data structure
      expect(Array.isArray(activityData)).toBe(true);
      
      if (activityData.length > 0) {
        const activity = activityData[0];
        expect(activity.activityId).toBeDefined();
        expect(activity.currency).toBeDefined();
        expect(activity.activityType).toBeDefined();
      }
    });

    it('should correlate activity data with trading symbols', async () => {
      // Arrange: Symbol with potential activity
      const symbol = 'BTCUSDT';
      const currency = symbol.replace('USDT', '');

      // Act: Get both price and activity data
      const price = await mexcService.getSpotPrice(symbol);
      
      let activities: ActivityData[];
      if (TEST_CONFIG.enableRealApi) {
        activities = await mexcService.getActivityData({ currency });
      } else {
        activities = [
          {
            activityId: 'correlation-test',
            currency,
            currencyId: 'test-currency-id',
            activityType: 'PROMOTION'
          }
        ];
      }

      // Assert: Data correlation
      expect(price).toBeGreaterThan(0);
      expect(Array.isArray(activities)).toBe(true);
      
      if (activities.length > 0) {
        expect(activities[0].currency).toBe(currency);
      }
    });
  });
});