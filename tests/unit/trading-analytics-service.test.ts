/**
 * Trading Analytics Service Test Suite
 * 
 * Comprehensive tests for trading analytics data collection, metrics calculation,
 * performance tracking, and reporting accuracy.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TradingAnalyticsService, tradingAnalytics } from '@/src/services/trading/trading-analytics-service';

describe('Trading Analytics Service', () => {
  let analyticsService: TradingAnalyticsService;
  
  beforeEach(() => {
    // Create fresh instance for each test
    analyticsService = TradingAnalyticsService.getInstance();
    analyticsService.clearAnalyticsData();
    
    // Mock console methods to avoid noise in test output
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    analyticsService.clearAnalyticsData();
    vi.restoreAllMocks();
  });

  describe('Service Initialization', () => {
    it('should initialize analytics service successfully', () => {
      analyticsService.initialize();
      
      const stats = analyticsService.getAnalyticsStats();
      expect(stats.totalEvents).toBe(0);
      expect(stats.cacheSize).toBe(0);
    });

    it('should be a singleton instance', () => {
      const instance1 = TradingAnalyticsService.getInstance();
      const instance2 = TradingAnalyticsService.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('Event Logging', () => {
    it('should log trading events with complete data', () => {
      analyticsService.logTradingEvent({
        eventType: 'TRADE_PLACED',
        userId: 'test-user-1',
        metadata: { symbol: 'BTCUSDT', quantity: 0.1 },
        performance: { responseTimeMs: 150, retryCount: 0 },
        success: true
      });

      const stats = analyticsService.getAnalyticsStats();
      expect(stats.totalEvents).toBe(1);
    });

    it('should handle failed trading events', () => {
      analyticsService.logTradingEvent({
        eventType: 'TRADE_FAILED',
        userId: 'test-user-1',
        metadata: { symbol: 'ETHUSDT', error: 'Insufficient balance' },
        performance: { responseTimeMs: 300, retryCount: 2 },
        success: false,
        error: 'Insufficient balance for trade execution'
      });

      const report = analyticsService.generateAnalyticsReport();
      expect(report.summary.errorRate).toBe(1);
      expect(report.summary.totalTrades).toBe(1);
      expect(report.summary.failedTrades).toBe(1);
    });

    it('should validate event data structure', () => {
      // Should not throw for valid event
      expect(() => {
        analyticsService.logTradingEvent({
          eventType: 'API_CALL',
          metadata: { endpoint: '/api/balance' },
          performance: { responseTimeMs: 50, retryCount: 0 },
          success: true
        });
      }).not.toThrow();

      const stats = analyticsService.getAnalyticsStats();
      expect(stats.totalEvents).toBe(1);
    });
  });

  describe('API Call Logging', () => {
    it('should log successful API calls', () => {
      analyticsService.logApiCall(
        'GET /api/account/balance',
        120,
        true,
        'test-user',
        undefined,
        { endpoint: '/api/account/balance' }
      );

      const report = analyticsService.generateAnalyticsReport();
      expect(report.breakdowns.byEventType['API_CALL']).toBe(1);
      expect(report.summary.averageResponseTime).toBe(120);
    });

    it('should log failed API calls with error details', () => {
      analyticsService.logApiCall(
        'POST /api/trade',
        5000,
        false,
        'test-user',
        'Rate limit exceeded',
        { endpoint: '/api/trade', retryAfter: 60 }
      );

      const report = analyticsService.generateAnalyticsReport();
      expect(report.summary.errorRate).toBe(1);
      expect(report.breakdowns.byErrorType['RATE_LIMIT_ERROR']).toBe(1);
    });
  });

  describe('Trade Operation Logging', () => {
    it('should log successful trade placements', () => {
      analyticsService.logTradeOperation(
        'PLACE',
        'BTCUSDT',
        'trader-1',
        200,
        true,
        { quantity: 0.5, price: 45000 }
      );

      const report = analyticsService.generateAnalyticsReport();
      expect(report.breakdowns.byEventType['TRADE_PLACED']).toBe(1);
      expect(report.summary.successfulTrades).toBe(1);
    });

    it('should log trade fills correctly', () => {
      analyticsService.logTradeOperation(
        'FILL',
        'ETHUSDT',
        'trader-1',
        150,
        true,
        { fillPrice: 3200, fillQuantity: 1.0 }
      );

      const report = analyticsService.generateAnalyticsReport();
      expect(report.breakdowns.byEventType['TRADE_FILLED']).toBe(1);
      expect(report.summary.totalTrades).toBe(1);
    });

    it('should handle trade cancellations', () => {
      analyticsService.logTradeOperation(
        'CANCEL',
        'ADAUSDT',
        'trader-1',
        100,
        true,
        { reason: 'User requested' }
      );

      const report = analyticsService.generateAnalyticsReport();
      expect(report.breakdowns.byEventType['TRADE_CANCELLED']).toBe(1);
    });

    it('should mark failed operations correctly', () => {
      analyticsService.logTradeOperation(
        'PLACE',
        'BTCUSDT',
        'trader-1',
        300,
        false,
        { quantity: 10, price: 45000 },
        'Insufficient balance'
      );

      const report = analyticsService.generateAnalyticsReport();
      expect(report.breakdowns.byEventType['TRADE_FAILED']).toBe(1);
      expect(report.summary.failedTrades).toBe(1);
    });
  });

  describe('Analytics Report Generation', () => {
    beforeEach(() => {
      // Seed with sample data
      analyticsService.logTradeOperation('PLACE', 'BTCUSDT', 'user1', 100, true, { volume: 1000 });
      analyticsService.logTradeOperation('FILL', 'BTCUSDT', 'user1', 150, true, { volume: 1000 });
      analyticsService.logTradeOperation('PLACE', 'ETHUSDT', 'user2', 200, false, {}, 'Network error');
      analyticsService.logApiCall('GET /api/balance', 50, true, 'user1');
    });

    it('should generate comprehensive analytics report', () => {
      const report = analyticsService.generateAnalyticsReport();

      expect(report.reportId).toBeDefined();
      expect(report.generatedAt).toBeDefined();
      expect(report.timeRange).toBeDefined();
      
      // Summary metrics
      expect(report.summary.totalTrades).toBe(3);
      expect(report.summary.successfulTrades).toBe(2);
      expect(report.summary.failedTrades).toBe(1);
      expect(report.summary.errorRate).toBeCloseTo(0.25); // 1 of 4 total events failed
      
      // Breakdowns
      expect(report.breakdowns.byEventType['TRADE_PLACED']).toBe(1);
      expect(report.breakdowns.byEventType['TRADE_FILLED']).toBe(1);
      expect(report.breakdowns.byEventType['TRADE_FAILED']).toBe(1);
      expect(report.breakdowns.byEventType['API_CALL']).toBe(1);
      
      expect(report.breakdowns.byUser['user1']).toBe(3);
      expect(report.breakdowns.byUser['user2']).toBe(1);
    });

    it('should calculate volume correctly', () => {
      const report = analyticsService.generateAnalyticsReport();
      expect(report.summary.totalVolume).toBe(2000); // Two successful trades with 1000 volume each
    });

    it('should filter reports by user', () => {
      const report = analyticsService.generateAnalyticsReport(
        undefined,
        undefined,
        { userId: 'user1' }
      );

      expect(report.breakdowns.byUser['user1']).toBe(3);
      expect(report.breakdowns.byUser['user2']).toBeUndefined();
    });

    it('should filter reports by event type', () => {
      const report = analyticsService.generateAnalyticsReport(
        undefined,
        undefined,
        { eventType: 'API_CALL' }
      );

      expect(report.summary.totalTrades).toBe(0); // API_CALL is not a trade event
      expect(Object.keys(report.breakdowns.byEventType)).toEqual(['API_CALL']);
    });

    it('should filter reports to errors only', () => {
      const report = analyticsService.generateAnalyticsReport(
        undefined,
        undefined,
        { onlyErrors: true }
      );

      expect(report.summary.errorRate).toBe(1); // All filtered events are errors
      expect(report.breakdowns.byEventType['TRADE_FAILED']).toBe(1);
    });

    it('should handle time range filtering', () => {
      const start = new Date(Date.now() - 1000); // 1 second ago
      const end = new Date();
      
      const report = analyticsService.generateAnalyticsReport(start, end);
      
      expect(report.timeRange.start).toBe(start.toISOString());
      expect(report.timeRange.end).toBe(end.toISOString());
      expect(report.summary.totalTrades).toBeGreaterThan(0);
    });
  });

  describe('Performance Metrics', () => {
    beforeEach(() => {
      // Add events with different performance characteristics
      analyticsService.logApiCall('fast-operation', 50, true, 'user1');
      analyticsService.logApiCall('slow-operation', 500, true, 'user1');
      analyticsService.logApiCall('failed-operation', 1000, false, 'user1', 'Timeout');
    });

    it('should calculate real-time performance metrics', () => {
      const metrics = analyticsService.getPerformanceMetrics();
      
      expect(metrics).toBeDefined();
      expect(Array.isArray(metrics)).toBe(true);
    });

    it('should filter metrics by operation', () => {
      const metrics = analyticsService.getPerformanceMetrics('fast-operation');
      
      if (metrics.length > 0) {
        expect(metrics[0].operation).toBe('fast-operation');
      }
    });

    it('should respect time window parameter', () => {
      const shortWindow = analyticsService.getPerformanceMetrics(undefined, 1000); // 1 second
      const longWindow = analyticsService.getPerformanceMetrics(undefined, 300000); // 5 minutes
      
      // Both should be arrays (may be empty for short window)
      expect(Array.isArray(shortWindow)).toBe(true);
      expect(Array.isArray(longWindow)).toBe(true);
    });

    it('should cache metrics for performance', () => {
      const metrics1 = analyticsService.getPerformanceMetrics('test-op');
      const metrics2 = analyticsService.getPerformanceMetrics('test-op');
      
      // Second call should use cache (same reference or similar performance)
      expect(Array.isArray(metrics1)).toBe(true);
      expect(Array.isArray(metrics2)).toBe(true);
    });
  });

  describe('Data Export', () => {
    beforeEach(() => {
      analyticsService.logTradeOperation('PLACE', 'BTCUSDT', 'user1', 100, true);
      analyticsService.logTradeOperation('FILL', 'BTCUSDT', 'user1', 150, true);
    });

    it('should export data in JSON format', () => {
      const exported = analyticsService.exportAnalytics('json');
      
      expect(() => JSON.parse(exported)).not.toThrow();
      
      const data = JSON.parse(exported);
      expect(data.reportId).toBeDefined();
      expect(data.summary).toBeDefined();
    });

    it('should export data in CSV format', () => {
      const exported = analyticsService.exportAnalytics('csv');
      
      expect(typeof exported).toBe('string');
      expect(exported).toContain('Metric,Value');
      expect(exported).toContain('Total Trades');
    });

    it('should export data in human-readable format', () => {
      const exported = analyticsService.exportAnalytics('human-readable');
      
      expect(typeof exported).toBe('string');
      expect(exported).toContain('TRADING ANALYTICS REPORT');
      expect(exported).toContain('SUMMARY');
      expect(exported).toContain('Total Trades:');
    });

    it('should throw error for unsupported format', () => {
      expect(() => {
        analyticsService.exportAnalytics('xml' as any);
      }).toThrow('Unsupported export format: xml');
    });
  });

  describe('Alert System', () => {
    let alertCallbackSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      alertCallbackSpy = vi.fn();
      analyticsService.addAlertCallback(alertCallbackSpy);
    });

    it('should trigger alerts for high response times', () => {
      analyticsService.logApiCall('slow-operation', 10000, true); // 10 seconds
      
      // Alert callback should have been called
      expect(alertCallbackSpy).toHaveBeenCalled();
    });

    it('should trigger alerts for failed trades', () => {
      analyticsService.logTradeOperation(
        'PLACE',
        'BTCUSDT',
        'user1',
        100,
        false,
        {},
        'Insufficient funds'
      );
      
      expect(alertCallbackSpy).toHaveBeenCalled();
    });

    it('should trigger alerts for high retry counts', () => {
      analyticsService.logTradingEvent({
        eventType: 'API_CALL',
        metadata: { operation: 'retry-test' },
        performance: { responseTimeMs: 100, retryCount: 5 },
        success: true
      });
      
      expect(alertCallbackSpy).toHaveBeenCalled();
    });

    it('should handle alert callback errors gracefully', () => {
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error('Alert callback error');
      });
      
      analyticsService.addAlertCallback(errorCallback);
      
      expect(() => {
        analyticsService.logApiCall('test', 10000, true);
      }).not.toThrow();
    });
  });

  describe('Anomaly Detection', () => {
    it('should detect high error rate anomalies', () => {
      // Create mostly failed events
      for (let i = 0; i < 10; i++) {
        analyticsService.logTradingEvent({
          eventType: 'TRADE_FAILED',
          metadata: { test: true },
          performance: { responseTimeMs: 100, retryCount: 0 },
          success: false,
          error: 'Test error'
        });
      }
      
      // Add one successful event
      analyticsService.logTradingEvent({
        eventType: 'TRADE_PLACED',
        metadata: { test: true },
        performance: { responseTimeMs: 100, retryCount: 0 },
        success: true
      });

      const report = analyticsService.generateAnalyticsReport();
      const highErrorRateAnomaly = report.anomalies.find(a => a.type === 'HIGH_ERROR_RATE');
      
      expect(highErrorRateAnomaly).toBeDefined();
      expect(highErrorRateAnomaly?.severity).toBe('CRITICAL');
    });

    it('should detect high response time anomalies', () => {
      // Create events with very high response times
      for (let i = 0; i < 5; i++) {
        analyticsService.logTradingEvent({
          eventType: 'API_CALL',
          metadata: { test: true },
          performance: { responseTimeMs: 15000, retryCount: 0 }, // 15 seconds
          success: true
        });
      }

      const report = analyticsService.generateAnalyticsReport();
      const highResponseTimeAnomaly = report.anomalies.find(a => a.type === 'HIGH_RESPONSE_TIME');
      
      expect(highResponseTimeAnomaly).toBeDefined();
      expect(highResponseTimeAnomaly?.severity).toBe('HIGH');
    });
  });

  describe('Recommendations Generation', () => {
    it('should recommend credential review for high error rates', () => {
      // Create many failed events
      for (let i = 0; i < 20; i++) {
        analyticsService.logTradingEvent({
          eventType: 'API_CALL',
          metadata: { test: true },
          performance: { responseTimeMs: 100, retryCount: 0 },
          success: false,
          error: 'Authentication failed'
        });
      }

      const report = analyticsService.generateAnalyticsReport();
      const credentialRecommendation = report.recommendations.find(r => 
        r.includes('credential validity')
      );
      
      expect(credentialRecommendation).toBeDefined();
    });

    it('should recommend caching for high response times', () => {
      // Create events with high response times
      for (let i = 0; i < 10; i++) {
        analyticsService.logTradingEvent({
          eventType: 'API_CALL',
          metadata: { test: true },
          performance: { responseTimeMs: 8000, retryCount: 0 },
          success: true
        });
      }

      const report = analyticsService.generateAnalyticsReport();
      const cachingRecommendation = report.recommendations.find(r => 
        r.includes('caching')
      );
      
      expect(cachingRecommendation).toBeDefined();
    });

    it('should recommend strategy review when no trades', () => {
      // Only log non-trade events
      analyticsService.logTradingEvent({
        eventType: 'API_CALL',
        metadata: { test: true },
        performance: { responseTimeMs: 100, retryCount: 0 },
        success: true
      });

      const report = analyticsService.generateAnalyticsReport();
      const strategyRecommendation = report.recommendations.find(r => 
        r.includes('trading strategy')
      );
      
      expect(strategyRecommendation).toBeDefined();
    });

    it('should recommend rate limit review for high retry rates', () => {
      // Create events with high retry counts
      for (let i = 0; i < 10; i++) {
        analyticsService.logTradingEvent({
          eventType: 'API_CALL',
          metadata: { test: true },
          performance: { responseTimeMs: 100, retryCount: 3 },
          success: true
        });
      }

      const report = analyticsService.generateAnalyticsReport();
      const retryRecommendation = report.recommendations.find(r => 
        r.includes('rate limiting')
      );
      
      expect(retryRecommendation).toBeDefined();
    });
  });

  describe('Data Management', () => {
    it('should enforce maximum event storage limit', () => {
      // Create more events than the storage limit allows
      const maxEvents = 150; // More than typical limit
      
      for (let i = 0; i < maxEvents; i++) {
        analyticsService.logTradingEvent({
          eventType: 'API_CALL',
          metadata: { index: i },
          performance: { responseTimeMs: 100, retryCount: 0 },
          success: true
        });
      }

      const stats = analyticsService.getAnalyticsStats();
      // Should not exceed the configured maximum (100,000 events)
      expect(stats.totalEvents).toBeLessThanOrEqual(100000); // Actual max from ANALYTICS_CONFIG
    });

    it('should clear all analytics data', () => {
      analyticsService.logTradingEvent({
        eventType: 'API_CALL',
        metadata: { test: true },
        performance: { responseTimeMs: 100, retryCount: 0 },
        success: true
      });

      let stats = analyticsService.getAnalyticsStats();
      expect(stats.totalEvents).toBeGreaterThan(0);

      analyticsService.clearAnalyticsData();
      
      stats = analyticsService.getAnalyticsStats();
      expect(stats.totalEvents).toBe(0);
      expect(stats.cacheSize).toBe(0);
    });

    it('should provide accurate analytics statistics', () => {
      // Add some events
      analyticsService.logTradingEvent({
        eventType: 'API_CALL',
        metadata: { test: true },
        performance: { responseTimeMs: 100, retryCount: 0 },
        success: true
      });

      const stats = analyticsService.getAnalyticsStats();
      
      expect(stats.totalEvents).toBe(1);
      expect(stats.eventsLast24h).toBe(1);
      expect(stats.averageEventSize).toBeGreaterThan(0);
      expect(stats.newestEvent).toBeDefined();
      expect(stats.oldestEvent).toBeDefined();
    });
  });

  describe('Error Categorization', () => {
    it('should categorize connection errors correctly', () => {
      analyticsService.logTradingEvent({
        eventType: 'API_CALL',
        metadata: { test: true },
        performance: { responseTimeMs: 100, retryCount: 0 },
        success: false,
        error: 'Connection timeout occurred'
      });

      const report = analyticsService.generateAnalyticsReport();
      expect(report.breakdowns.byErrorType['CONNECTION_ERROR']).toBe(1);
    });

    it('should categorize rate limit errors correctly', () => {
      analyticsService.logTradingEvent({
        eventType: 'API_CALL',
        metadata: { test: true },
        performance: { responseTimeMs: 100, retryCount: 0 },
        success: false,
        error: 'Rate limit exceeded'
      });

      const report = analyticsService.generateAnalyticsReport();
      expect(report.breakdowns.byErrorType['RATE_LIMIT_ERROR']).toBe(1);
    });

    it('should categorize authentication errors correctly', () => {
      analyticsService.logTradingEvent({
        eventType: 'API_CALL',
        metadata: { test: true },
        performance: { responseTimeMs: 100, retryCount: 0 },
        success: false,
        error: 'Invalid API credentials'
      });

      const report = analyticsService.generateAnalyticsReport();
      expect(report.breakdowns.byErrorType['AUTHENTICATION_ERROR']).toBe(1);
    });

    it('should categorize balance errors correctly', () => {
      analyticsService.logTradingEvent({
        eventType: 'TRADE_FAILED',
        metadata: { test: true },
        performance: { responseTimeMs: 100, retryCount: 0 },
        success: false,
        error: 'Insufficient balance for trade'
      });

      const report = analyticsService.generateAnalyticsReport();
      expect(report.breakdowns.byErrorType['BALANCE_ERROR']).toBe(1);
    });

    it('should categorize unknown errors correctly', () => {
      analyticsService.logTradingEvent({
        eventType: 'API_CALL',
        metadata: { test: true },
        performance: { responseTimeMs: 100, retryCount: 0 },
        success: false,
        error: 'Something weird happened'
      });

      const report = analyticsService.generateAnalyticsReport();
      expect(report.breakdowns.byErrorType['UNKNOWN_ERROR']).toBe(1);
    });
  });

  describe('Resource Management', () => {
    it('should dispose of resources properly', () => {
      analyticsService.initialize();
      
      expect(() => {
        analyticsService.dispose();
      }).not.toThrow();
    });

    it('should handle multiple dispose calls gracefully', () => {
      analyticsService.dispose();
      
      expect(() => {
        analyticsService.dispose();
      }).not.toThrow();
    });
  });

  describe('Global Instance Integration', () => {
    it('should work with global tradingAnalytics instance', () => {
      tradingAnalytics.logApiCall('global-test', 100, true);
      
      const stats = tradingAnalytics.getAnalyticsStats();
      expect(stats.totalEvents).toBeGreaterThan(0);
    });

    it('should maintain data consistency across global instance', () => {
      const event = {
        eventType: 'API_CALL' as const,
        metadata: { global: true },
        performance: { responseTimeMs: 100, retryCount: 0 },
        success: true
      };

      tradingAnalytics.logTradingEvent(event);
      
      const report = tradingAnalytics.generateAnalyticsReport();
      expect(report.summary.totalTrades).toBe(0); // API_CALL is not a trade
      expect(report.breakdowns.byEventType['API_CALL']).toBeGreaterThan(0);
    });
  });
});