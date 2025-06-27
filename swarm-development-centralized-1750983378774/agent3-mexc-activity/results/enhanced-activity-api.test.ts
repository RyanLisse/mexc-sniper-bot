/**
 * Enhanced MEXC Activity API Tests
 * 
 * AGENT 3: MEXC Activity API Fix Specialist
 * Comprehensive test suite for all activity API fixes:
 * - Single currency fetch with error handling
 * - Bulk operations with partial failures
 * - Recent activity checking logic
 * - Caching with TTL
 * - Edge cases: empty strings, large batches, malformed responses
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnhancedUnifiedMexcCoreModule } from './enhanced-unified-mexc-core';
import type { 
  ActivityData, 
  ActivityResponse, 
  MexcServiceResponse 
} from '@/src/schemas/unified/mexc-api-schemas';

// Mock dependencies
const mockCoreClient = {
  getActivityData: vi.fn(),
  getCalendarListings: vi.fn(),
  getSymbolsByVcoinId: vi.fn(),
  getAllSymbols: vi.fn(),
  getServerTime: vi.fn(),
  getSymbolInfoBasic: vi.fn(),
};

const mockCacheLayer = {
  getOrSet: vi.fn(),
  getOrSetWithCustomTTL: vi.fn(),
};

describe('Enhanced MEXC Activity API Integration', () => {
  let enhancedCore: EnhancedUnifiedMexcCoreModule;

  beforeEach(() => {
    vi.clearAllMocks();
    enhancedCore = new EnhancedUnifiedMexcCoreModule(
      mockCoreClient as any,
      mockCacheLayer as any
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getActivityData - Enhanced Single Currency Fetch', () => {
    it('should handle successful activity data fetch with normalization', async () => {
      const mockApiResponse = {
        success: true,
        data: [
          {
            activityId: 'test-activity-1',
            currency: 'FCAT',
            currencyId: 'test-currency-id',
            activityType: 'SUN_SHINE',
          },
        ],
        timestamp: Date.now(),
      };

      mockCacheLayer.getOrSetWithCustomTTL.mockImplementation(async (key, fn) => {
        return await fn();
      });

      mockCoreClient.getActivityData.mockResolvedValue(mockApiResponse);

      const result = await enhancedCore.getActivityData('FCAT');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0]).toMatchObject({
        activityId: 'test-activity-1',
        currency: 'FCAT',
        activityType: 'SUN_SHINE',
      });
      expect(result.executionTimeMs).toBeDefined();
    });

    it('should validate and reject empty currency strings', async () => {
      const result = await enhancedCore.getActivityData('');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Currency cannot be empty');
      expect(mockCoreClient.getActivityData).not.toHaveBeenCalled();
    });

    it('should validate and reject overly long currency strings', async () => {
      const longCurrency = 'A'.repeat(25);
      const result = await enhancedCore.getActivityData(longCurrency);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Currency too long');
      expect(mockCoreClient.getActivityData).not.toHaveBeenCalled();
    });

    it('should normalize currency input (trim and uppercase)', async () => {
      mockCacheLayer.getOrSetWithCustomTTL.mockImplementation(async (key, fn) => {
        return await fn();
      });

      mockCoreClient.getActivityData.mockResolvedValue({
        success: true,
        data: [],
        timestamp: Date.now(),
      });

      await enhancedCore.getActivityData('  fcat  ');

      expect(mockCoreClient.getActivityData).toHaveBeenCalledWith('FCAT');
    });

    it('should handle malformed API responses gracefully', async () => {
      mockCacheLayer.getOrSetWithCustomTTL.mockImplementation(async (key, fn) => {
        return await fn();
      });

      // Mock malformed response
      mockCoreClient.getActivityData.mockResolvedValue({
        success: true,
        data: null, // Malformed data
        timestamp: Date.now(),
      });

      const result = await enhancedCore.getActivityData('FCAT');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]); // Should normalize to empty array
    });

    it('should handle API errors with detailed error messages', async () => {
      mockCacheLayer.getOrSetWithCustomTTL.mockImplementation(async (key, fn) => {
        return await fn();
      });

      mockCoreClient.getActivityData.mockRejectedValue(new Error('API Rate Limit Exceeded'));

      const result = await enhancedCore.getActivityData('FCAT');

      expect(result.success).toBe(false);
      expect(result.error).toBe('API Rate Limit Exceeded');
      expect(result.executionTimeMs).toBeDefined();
    });

    it('should use caching with proper TTL', async () => {
      const mockCachedResponse = {
        success: true,
        data: [{ activityId: 'cached', currency: 'FCAT', currencyId: '1', activityType: 'CACHED' }],
        timestamp: Date.now(),
        cached: true,
      };

      mockCacheLayer.getOrSetWithCustomTTL.mockResolvedValue(mockCachedResponse);

      const result = await enhancedCore.getActivityData('FCAT');

      expect(result.success).toBe(true);
      expect(result.cached).toBe(true);
      expect(mockCacheLayer.getOrSetWithCustomTTL).toHaveBeenCalledWith(
        'activity:FCAT',
        expect.any(Function),
        5000 // 5 second TTL
      );
    });
  });

  describe('getBulkActivityData - Enhanced Bulk Operations', () => {
    it('should handle successful bulk requests with proper batching', async () => {
      const currencies = ['FCAT', 'BTC', 'ETH'];
      
      // Mock individual responses
      vi.spyOn(enhancedCore, 'getActivityData')
        .mockResolvedValueOnce({
          success: true,
          data: [{ activityId: '1', currency: 'FCAT', currencyId: '1', activityType: 'SUN_SHINE' }],
          timestamp: Date.now(),
        })
        .mockResolvedValueOnce({
          success: true,
          data: [{ activityId: '2', currency: 'BTC', currencyId: '2', activityType: 'PROMOTION' }],
          timestamp: Date.now(),
        })
        .mockResolvedValueOnce({
          success: true,
          data: [],
          timestamp: Date.now(),
        });

      const result = await enhancedCore.getBulkActivityData(currencies);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      expect(result.metadata).toMatchObject({
        totalRequests: 3,
        successCount: 3,
        failureCount: 0,
        batchCount: 1,
        batchSize: 5,
      });
    });

    it('should handle partial failures correctly - include both successes and failures', async () => {
      const currencies = ['FCAT', 'INVALID'];
      
      vi.spyOn(enhancedCore, 'getActivityData')
        .mockResolvedValueOnce({
          success: true,
          data: [{ activityId: '1', currency: 'FCAT', currencyId: '1', activityType: 'SUN_SHINE' }],
          timestamp: Date.now(),
        })
        .mockResolvedValueOnce({
          success: false,
          error: 'Currency not found',
          timestamp: Date.now(),
        });

      const result = await enhancedCore.getBulkActivityData(currencies);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2); // Both success and failure included
      expect(result.data![0].success).toBe(true);
      expect(result.data![1].success).toBe(false);
      expect(result.metadata).toMatchObject({
        totalRequests: 2,
        successCount: 1,
        failureCount: 1,
      });
    });

    it('should handle large batch sizes with proper chunking', async () => {
      const largeCurrencyList = Array.from({ length: 15 }, (_, i) => `COIN${i}`);
      
      vi.spyOn(enhancedCore, 'getActivityData').mockResolvedValue({
        success: true,
        data: [],
        timestamp: Date.now(),
      });

      const result = await enhancedCore.getBulkActivityData(largeCurrencyList, {
        batchSize: 5,
        maxRetries: 2,
        rateLimitDelay: 100,
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(15);
      expect(result.metadata?.batchCount).toBe(3); // 15 currencies / 5 per batch = 3 batches
      expect(result.metadata?.batchSize).toBe(5);
    });

    it('should validate input and reject empty currency arrays', async () => {
      const result = await enhancedCore.getBulkActivityData([]);

      expect(result.success).toBe(false);
      expect(result.error).toContain('At least one currency required');
    });

    it('should validate input and reject too many currencies', async () => {
      const tooManyCurrencies = Array.from({ length: 101 }, (_, i) => `COIN${i}`);
      
      const result = await enhancedCore.getBulkActivityData(tooManyCurrencies);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Too many currencies');
    });

    it('should handle currencies with empty strings properly', async () => {
      const currencies = ['FCAT', '', 'BTC'];
      
      const result = await enhancedCore.getBulkActivityData(currencies);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid bulk request');
    });
  });

  describe('hasRecentActivity - Enhanced Activity Checking', () => {
    it('should return true for currencies with recent activities', async () => {
      const currentTime = Date.now();
      
      vi.spyOn(enhancedCore, 'getActivityData').mockResolvedValue({
        success: true,
        data: [{ activityId: '1', currency: 'FCAT', currencyId: '1', activityType: 'SUN_SHINE' }],
        timestamp: currentTime, // Recent timestamp
      });

      const result = await enhancedCore.hasRecentActivity('FCAT');

      expect(result).toBe(true);
    });

    it('should return false for currencies with no activities', async () => {
      vi.spyOn(enhancedCore, 'getActivityData').mockResolvedValue({
        success: true,
        data: [], // No activities
        timestamp: Date.now(),
      });

      const result = await enhancedCore.hasRecentActivity('BTC');

      expect(result).toBe(false);
    });

    it('should return false for failed activity requests', async () => {
      vi.spyOn(enhancedCore, 'getActivityData').mockResolvedValue({
        success: false,
        error: 'API Error',
        timestamp: Date.now(),
      });

      const result = await enhancedCore.hasRecentActivity('INVALID');

      expect(result).toBe(false);
    });

    it('should return false for old activity data outside timeframe', async () => {
      const oldTime = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
      
      vi.spyOn(enhancedCore, 'getActivityData').mockResolvedValue({
        success: true,
        data: [{ activityId: '1', currency: 'FCAT', currencyId: '1', activityType: 'SUN_SHINE' }],
        timestamp: oldTime, // Old timestamp
      });

      const result = await enhancedCore.hasRecentActivity('FCAT', 24 * 60 * 60 * 1000);

      expect(result).toBe(false);
    });

    it('should validate timeframe parameters', async () => {
      // Too short timeframe
      const result1 = await enhancedCore.hasRecentActivity('FCAT', 30000); // 30 seconds
      expect(result1).toBe(false);

      // Too long timeframe  
      const result2 = await enhancedCore.hasRecentActivity('FCAT', 31 * 24 * 60 * 60 * 1000); // 31 days
      expect(result2).toBe(false);
    });

    it('should handle string timestamps correctly', async () => {
      const currentTime = Date.now();
      
      vi.spyOn(enhancedCore, 'getActivityData').mockResolvedValue({
        success: true,
        data: [{ activityId: '1', currency: 'FCAT', currencyId: '1', activityType: 'SUN_SHINE' }],
        timestamp: new Date(currentTime).toISOString(), // String timestamp
      });

      const result = await enhancedCore.hasRecentActivity('FCAT');

      expect(result).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle network timeouts gracefully', async () => {
      mockCacheLayer.getOrSetWithCustomTTL.mockImplementation(async (key, fn) => {
        return await fn();
      });

      mockCoreClient.getActivityData.mockRejectedValue(new Error('Network timeout'));

      const result = await enhancedCore.getActivityData('FCAT');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network timeout');
      expect(result.executionTimeMs).toBeDefined();
    });

    it('should handle malformed activity data structures', async () => {
      mockCacheLayer.getOrSetWithCustomTTL.mockImplementation(async (key, fn) => {
        return await fn();
      });

      // Mock response with malformed activity data
      mockCoreClient.getActivityData.mockResolvedValue({
        success: true,
        data: {
          // Wrong structure - should be array
          activities: [
            { id: '1', name: 'FCAT', type: 'SUN_SHINE' }
          ]
        },
        timestamp: Date.now(),
      });

      const result = await enhancedCore.getActivityData('FCAT');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]); // Should normalize to empty array
    });

    it('should handle rate limiting with exponential backoff in retries', async () => {
      const currencies = ['FCAT'];
      
      // Mock the private method to avoid actual delays in tests
      const getActivityDataSpy = vi.spyOn(enhancedCore, 'getActivityData')
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockResolvedValueOnce({
          success: true,
          data: [],
          timestamp: Date.now(),
        });

      const result = await enhancedCore.getBulkActivityData(currencies, {
        batchSize: 1,
        maxRetries: 2,
        rateLimitDelay: 10, // Short delay for testing
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('should handle concurrent requests efficiently', async () => {
      const currencies = ['FCAT', 'BTC', 'ETH'];
      const startTime = Date.now();
      
      vi.spyOn(enhancedCore, 'getActivityData').mockImplementation(async (currency) => {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          success: true,
          data: [{ activityId: '1', currency, currencyId: '1', activityType: 'TEST' }],
          timestamp: Date.now(),
        };
      });

      const result = await enhancedCore.getBulkActivityData(currencies, {
        batchSize: 3, // Process all at once
        rateLimitDelay: 50,
      });

      const executionTime = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      // Should be faster than sequential (3 * 100ms + delays)
      expect(executionTime).toBeLessThan(500);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle bulk requests efficiently with metadata tracking', async () => {
      const currencies = Array.from({ length: 20 }, (_, i) => `COIN${i}`);
      
      vi.spyOn(enhancedCore, 'getActivityData').mockResolvedValue({
        success: true,
        data: [],
        timestamp: Date.now(),
      });

      const result = await enhancedCore.getBulkActivityData(currencies, {
        batchSize: 10,
        maxRetries: 1,
        rateLimitDelay: 10,
      });

      expect(result.success).toBe(true);
      expect(result.metadata).toMatchObject({
        totalRequests: 20,
        successCount: 20,
        failureCount: 0,
        batchCount: 2,
        batchSize: 10,
      });
    });

    it('should provide detailed execution metrics', async () => {
      mockCacheLayer.getOrSetWithCustomTTL.mockImplementation(async (key, fn) => {
        return await fn();
      });

      mockCoreClient.getActivityData.mockResolvedValue({
        success: true,
        data: [],
        timestamp: Date.now(),
      });

      const result = await enhancedCore.getActivityData('FCAT');

      expect(result.executionTimeMs).toBeDefined();
      expect(typeof result.executionTimeMs).toBe('number');
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
});