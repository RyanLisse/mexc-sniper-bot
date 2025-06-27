/**
 * MEXC Integration Synchronization Test
 * 
 * Verifies that the MEXC integration test synchronization fixes work properly.
 * Tests the standardized utilities and ensures proper test isolation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  setupMexcIntegrationTest,
  teardownMexcIntegrationTest,
  createMockSymbolEntry,
  createMockCalendarEntry,
  createMockActivityData,
  waitForMexcOperation,
  resetMexcServiceMocks,
  measureMexcPerformance,
  validateMexcPerformance,
  simulateMexcApiFailures
} from '../utils/mexc-integration-utilities';

describe('MEXC Integration Synchronization Tests', () => {
  let testSetup: ReturnType<typeof setupMexcIntegrationTest>;

  beforeEach(() => {
    // Use standardized MEXC integration test setup
    testSetup = setupMexcIntegrationTest();
  });

  afterEach(() => {
    // Use standardized teardown
    teardownMexcIntegrationTest(testSetup.mexcService);
  });

  describe('Environment Configuration', () => {
    it('should properly configure MEXC test environment variables', () => {
      expect(process.env.MEXC_API_KEY).toBe('mx_test_api_key_123456789abcdef');
      expect(process.env.MEXC_SECRET_KEY).toBe('test_secret_key_123456789abcdef');
      expect(process.env.MEXC_BASE_URL).toBe('https://api.mexc.com');
      expect(process.env.NODE_ENV).toBe('test');
    });

    it('should provide consistent mock service instance', () => {
      expect(testSetup.mexcService).toBeDefined();
      expect(typeof testSetup.mexcService.getSymbolData).toBe('function');
      expect(typeof testSetup.mexcService.getServerTime).toBe('function');
      expect(typeof testSetup.mexcService.getActivityData).toBe('function');
      expect(typeof testSetup.mexcService.placeOrder).toBe('function');
    });
  });

  describe('Mock Data Generation', () => {
    it('should create standardized mock symbol entries', () => {
      const symbol = createMockSymbolEntry({
        cd: 'TESTUSDT',
        ps: 1000
      });

      expect(symbol.sts).toBe(2);
      expect(symbol.st).toBe(2);
      expect(symbol.tt).toBe(4);
      expect(symbol.cd).toBe('TESTUSDT');
      expect(symbol.ps).toBe(1000);
      expect(symbol.ca).toBe("0x1000");
      expect(symbol.qs).toBe(50);
    });

    it('should create standardized mock calendar entries', () => {
      const calendar = createMockCalendarEntry({
        symbol: 'NEWCOINUSDT',
        projectName: 'New Coin'
      });

      expect(calendar.symbol).toBe('NEWCOINUSDT');
      expect(calendar.projectName).toBe('New Coin');
      expect(calendar.vcoinId).toBe('test-vcoin-id');
      expect(typeof calendar.firstOpenTime).toBe('number');
      expect(calendar.firstOpenTime).toBeGreaterThan(Date.now());
    });

    it('should create standardized mock activity data', () => {
      const activity = createMockActivityData({
        currency: 'NEWCOIN',
        activityType: 'PROMOTION'
      });

      expect(activity.currency).toBe('NEWCOIN');
      expect(activity.activityType).toBe('PROMOTION');
      expect(activity.activityId).toBe('test-activity-123');
      expect(activity.currencyId).toBe('test-currency-id');
    });
  });

  describe('Service Mock Functionality', () => {
    it('should provide consistent MEXC service responses', async () => {
      const { mexcService } = testSetup;

      // Test symbol data response
      const symbolData = await mexcService.getSymbolData('TESTUSDT');
      expect(symbolData.success).toBe(true);
      expect(symbolData.data.symbol).toBe('TESTUSDT');
      expect(symbolData.data.lastPrice).toBe('1.0000');
      expect(typeof symbolData.executionTimeMs).toBe('number');

      // Test server time response
      const serverTime = await mexcService.getServerTime();
      expect(serverTime.success).toBe(true);
      expect(typeof serverTime.data).toBe('number');
      expect(serverTime.data).toBeGreaterThan(0);

      // Test activity data response
      const activityData = await mexcService.getActivityData('TEST');
      expect(activityData.success).toBe(true);
      expect(Array.isArray(activityData.data)).toBe(true);
      expect(activityData.data.length).toBeGreaterThan(0);
    });

    it('should handle order placement requests', async () => {
      const { mexcService } = testSetup;

      const orderResponse = await mexcService.placeOrder({
        symbol: 'TESTUSDT',
        side: 'BUY',
        type: 'MARKET',
        quantity: '100'
      });

      expect(orderResponse.success).toBe(true);
      expect(orderResponse.data.symbol).toBe('TESTUSDT');
      expect(orderResponse.data.status).toBe('FILLED');
      expect(typeof orderResponse.data.orderId).toBe('string');
    });

    it('should handle calendar listings requests', async () => {
      const { mexcService } = testSetup;

      const calendarResponse = await mexcService.getCalendarListings();
      expect(calendarResponse.success).toBe(true);
      expect(Array.isArray(calendarResponse.data)).toBe(true);
      expect(calendarResponse.data.length).toBeGreaterThan(0);
      expect(calendarResponse.data[0].vcoinId).toBe('test-vcoin-id');
    });
  });

  describe('Timing and Synchronization', () => {
    it('should provide timing synchronization utilities', async () => {
      const startTime = Date.now();
      await waitForMexcOperation(100);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeGreaterThanOrEqual(50);
      expect(endTime - startTime).toBeLessThan(200);
    });

    it('should measure MEXC operation performance', async () => {
      const mockOperation = async () => {
        await waitForMexcOperation(50);
        return 'test-result';
      };

      const { result, executionTime } = await measureMexcPerformance(mockOperation, 'Test Operation');
      
      expect(result).toBe('test-result');
      expect(executionTime).toBeGreaterThanOrEqual(40);
      expect(executionTime).toBeLessThan(150);
    });

    it('should validate performance within acceptable limits', () => {
      // Should not throw for acceptable performance
      expect(() => {
        validateMexcPerformance(50, 100, 'Fast Operation');
      }).not.toThrow();

      // Should not throw for slow performance (only warns)
      expect(() => {
        validateMexcPerformance(150, 100, 'Slow Operation');
      }).not.toThrow();
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle mock service resets properly', () => {
      const { mexcService } = testSetup;

      // Verify mocks are working
      expect(typeof mexcService.getSymbolData.mockClear).toBe('function');
      expect(typeof mexcService.getServerTime.mockClear).toBe('function');

      // Reset mocks
      resetMexcServiceMocks(mexcService);

      // Mocks should still be mock functions but cleared
      expect(typeof mexcService.getSymbolData.mockClear).toBe('function');
      expect(mexcService.getSymbolData).toHaveBeenCalledTimes(0);
    });

    it('should simulate API failures for testing error handling', async () => {
      const { mexcService } = testSetup;

      // Configure service to fail 2 times then succeed
      simulateMexcApiFailures(mexcService, 2);

      // First two calls should fail
      await expect(mexcService.getSymbolData('TESTUSDT')).rejects.toThrow('MEXC API temporarily unavailable');
      await expect(mexcService.getSymbolData('TESTUSDT')).rejects.toThrow('MEXC API temporarily unavailable');

      // Third call should succeed
      const result = await mexcService.getSymbolData('TESTUSDT');
      expect(result.success).toBe(true);
      expect(result.data.symbol).toBe('TESTUSDT');
    });
  });

  describe('Test Isolation', () => {
    it('should maintain clean state between test runs', async () => {
      const { mexcService } = testSetup;

      // Make some API calls
      await mexcService.getSymbolData('TESTUSDT');
      await mexcService.getServerTime();
      await mexcService.getActivityData('TEST');

      // Verify calls were made
      expect(mexcService.getSymbolData).toHaveBeenCalledTimes(1);
      expect(mexcService.getServerTime).toHaveBeenCalledTimes(1);
      expect(mexcService.getActivityData).toHaveBeenCalledTimes(1);

      // After this test, the afterEach should clean up
      // The next test should start with clean mocks
    });

    it('should start with clean mocks (verifies cleanup from previous test)', async () => {
      const { mexcService } = testSetup;

      // These should be 0 if cleanup worked properly
      expect(mexcService.getSymbolData).toHaveBeenCalledTimes(0);
      expect(mexcService.getServerTime).toHaveBeenCalledTimes(0);
      expect(mexcService.getActivityData).toHaveBeenCalledTimes(0);
    });
  });

  describe('Integration with Real Services', () => {
    it('should support both mock and real service configurations', () => {
      // In mock mode (current test setup)
      expect(typeof testSetup.mexcService.getSymbolData.mockClear).toBe('function');
      
      // Environment variables should be set for test mode
      expect(process.env.NODE_ENV).toBe('test');
      expect(process.env.MEXC_API_KEY).toContain('test');
    });

    it('should handle service cleanup without errors', () => {
      const { mexcService } = testSetup;
      
      // Cleanup should not throw errors
      expect(() => {
        mexcService.clearCache();
        mexcService.destroy();
      }).not.toThrow();
    });
  });
});