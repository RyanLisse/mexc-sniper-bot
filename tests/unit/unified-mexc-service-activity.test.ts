import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnifiedMexcServiceV2 } from '../../src/services/unified-mexc-service-v2';
import type { ActivityData, ActivityResponse } from '../../src/schemas/mexc-schemas';

describe('UnifiedMexcService - Activity API Integration (Phase 1)', () => {
  let mexcService: UnifiedMexcServiceV2;

  beforeEach(() => {
    mexcService = new UnifiedMexcServiceV2({
      enableCaching: false, // Disable caching for tests
      enableCircuitBreaker: false,
    });
  });

  describe('getActivityData', () => {
    it('should fetch activity data for a single currency', async () => {
      // Mock the HTTP request
      const mockResponse: ActivityResponse = {
        data: [
          {
            activityId: 'test-activity-1',
            currency: 'FCAT',
            currencyId: 'test-currency-id',
            activityType: 'SUN_SHINE',
          },
        ],
        code: 0,
        msg: 'success',
        timestamp: Date.now(),
      };

      // Mock the core client's makeRequest method
      vi.spyOn((mexcService as any).coreClient, 'makeRequest').mockResolvedValue(mockResponse);

      const result = await mexcService.getActivityData('FCAT');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0]).toMatchObject({
        activityId: 'test-activity-1',
        currency: 'FCAT',
        activityType: 'SUN_SHINE',
      });
      expect(result.executionTimeMs).toBeDefined();
    });

    it('should handle API errors gracefully', async () => {
      // Mock API error response
      vi.spyOn((mexcService as any).coreClient, 'makeRequest').mockRejectedValue(new Error('API Error'));

      const result = await mexcService.getActivityData('INVALID');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to fetch activity data');
      expect(result.executionTimeMs).toBeDefined();
    });

    it('should handle network errors', async () => {
      // Mock network error
      vi.spyOn((mexcService as any).coreClient, 'makeRequest').mockRejectedValue(new Error('Network error'));

      const result = await mexcService.getActivityData('FCAT');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Activity API error: Network error');
      expect(result.executionTimeMs).toBeDefined();
    });

    it('should use correct endpoint and parameters', async () => {
      const makeRequestSpy = vi.spyOn((mexcService as any).coreClient, 'makeRequest').mockResolvedValue({
        data: [], 
        code: 0, 
        msg: 'success', 
        timestamp: Date.now()
      });

      await mexcService.getActivityData('FCAT');

      expect(makeRequestSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/operateactivity/activity/list/by/currencies'),
        expect.objectContaining({
          method: 'GET'
        })
      );
    });
  });

  describe('getBulkActivityData', () => {
    it('should fetch activity data for multiple currencies', async () => {
      const currencies = ['FCAT', 'BTC', 'ETH'];

      // Mock successful responses for all currencies
      vi.spyOn(mexcService, 'getActivityData')
        .mockResolvedValueOnce({
          success: true,
          data: [{ activityId: '1', currency: 'FCAT', currencyId: '1', activityType: 'SUN_SHINE' }],
          timestamp: new Date().toISOString(),
        })
        .mockResolvedValueOnce({
          success: true,
          data: [{ activityId: '2', currency: 'BTC', currencyId: '2', activityType: 'PROMOTION' }],
          timestamp: new Date().toISOString(),
        })
        .mockResolvedValueOnce({
          success: true,
          data: [],
          timestamp: new Date().toISOString(),
        });

      const result = await mexcService.getBulkActivityData(currencies, { batchSize: 2 });

      expect(result.success).toBe(true);
      expect(result.data?.size).toBe(2); // FCAT and BTC have activities, ETH has none (empty array not added to results)
      expect(result.data?.get('FCAT')).toHaveLength(1);
      expect(result.data?.get('BTC')).toHaveLength(1);
      expect(result.data?.has('ETH')).toBe(false); // ETH not in results because it has no activities
      expect(result.metadata?.totalCurrencies).toBe(3);
      expect(result.metadata?.successfulFetches).toBe(2);
      expect(result.executionTimeMs).toBeDefined();
    });

    it('should handle partial failures in bulk operations', async () => {
      const currencies = ['FCAT', 'INVALID'];

      vi.spyOn(mexcService, 'getActivityData')
        .mockResolvedValueOnce({
          success: true,
          data: [{ activityId: '1', currency: 'FCAT', currencyId: '1', activityType: 'SUN_SHINE' }],
          timestamp: new Date().toISOString(),
        })
        .mockResolvedValueOnce({
          success: false,
          error: 'Currency not found',
          timestamp: new Date().toISOString(),
        });

      const result = await mexcService.getBulkActivityData(currencies);

      expect(result.success).toBe(true);
      expect(result.data?.size).toBe(1); // Only FCAT succeeded
      expect(result.data?.get('FCAT')).toHaveLength(1);
      expect(result.data?.has('INVALID')).toBe(false); // INVALID not in results due to error
      expect(result.metadata?.errors).toBe(1);
    });

    it('should respect rate limiting with delays', async () => {
      const currencies = ['FCAT', 'BTC'];
      const startTime = Date.now();

      vi.spyOn(mexcService, 'getActivityData').mockResolvedValue({
        success: true,
        data: [],
        timestamp: new Date().toISOString(),
      });

      await mexcService.getBulkActivityData(currencies, {
        batchSize: 1,
        rateLimitDelay: 100
      });

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Should take at least 100ms due to rate limiting delay
      expect(executionTime).toBeGreaterThanOrEqual(90); // Allow some tolerance
    });
  });

  describe('hasRecentActivity', () => {
    it('should return true when currency has activities', async () => {
      vi.spyOn(mexcService, 'getActivityData').mockResolvedValue({
        success: true,
        data: [{ activityId: '1', currency: 'FCAT', currencyId: '1', activityType: 'SUN_SHINE' }],
        timestamp: new Date().toISOString(),
      });

      const result = await mexcService.hasRecentActivity('FCAT');

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
      expect(result.metadata?.activityCount).toBe(1);
      expect(result.metadata?.activities).toHaveLength(1);
    });

    it('should return false when currency has no activities', async () => {
      vi.spyOn(mexcService, 'getActivityData').mockResolvedValue({
        success: true,
        data: [],
        timestamp: new Date().toISOString(),
      });

      const result = await mexcService.hasRecentActivity('BTC');

      expect(result.success).toBe(true);
      expect(result.data).toBe(false);
      expect(result.metadata?.activityCount).toBe(0);
    });

    it('should handle errors from getActivityData', async () => {
      vi.spyOn(mexcService, 'getActivityData').mockResolvedValue({
        success: false,
        error: 'API Error',
        timestamp: new Date().toISOString(),
      });

      const result = await mexcService.hasRecentActivity('INVALID');

      expect(result.success).toBe(false);
      expect(result.data).toBe(false);
      expect(result.error).toContain('API Error');
    });
  });

  describe('Activity API Integration with Caching', () => {
    beforeEach(() => {
      mexcService = new UnifiedMexcServiceV2({
        enableCaching: true,
        cacheTTL: 5000, // 5 seconds as specified in user preferences
      });
    });

    it('should cache activity data responses', async () => {
      const mockResponse: ActivityResponse = {
        data: [
          {
            activityId: 'cached-activity',
            currency: 'FCAT',
            currencyId: 'cached-id',
            activityType: 'SUN_SHINE',
          },
        ],
        code: 0,
        msg: 'success',
        timestamp: Date.now(),
      };

      const makeRequestSpy = vi.spyOn((mexcService as any).coreClient, 'makeRequest')
        .mockResolvedValue(mockResponse);

      // First call should hit the API
      const result1 = await mexcService.getActivityData('FCAT');
      expect(result1.success).toBe(true);

      // Second call should use cache (makeRequest should only be called once)
      const result2 = await mexcService.getActivityData('FCAT');
      expect(result2.success).toBe(true);
      
      // API should only be called once due to caching
      expect(makeRequestSpy).toHaveBeenCalledTimes(1);
    });

    it('should respect cache TTL', async () => {
      const mexcServiceShortTTL = new UnifiedMexcServiceV2({
        enableCaching: true,
        cacheTTL: 100, // 100ms for quick test
      });

      const makeRequestSpy = vi.spyOn((mexcServiceShortTTL as any).coreClient, 'makeRequest')
        .mockResolvedValue({
          data: [], 
          code: 0, 
          msg: 'success', 
          timestamp: Date.now()
        });

      // First call
      await mexcServiceShortTTL.getActivityData('FCAT');
      expect(makeRequestSpy).toHaveBeenCalledTimes(1);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Second call should hit API again
      await mexcServiceShortTTL.getActivityData('FCAT');
      expect(makeRequestSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty currency string', async () => {
      const result = await mexcService.getActivityData('');

      // Should still make the request but likely get an error
      expect(result.success).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should handle very large batch sizes gracefully', async () => {
      const largeCurrencyList = Array.from({ length: 100 }, (_, i) => `COIN${i}`);

      vi.spyOn(mexcService, 'getActivityData').mockResolvedValue({
        success: true,
        data: [],
        timestamp: new Date().toISOString(),
      });

      const result = await mexcService.getBulkActivityData(largeCurrencyList, { 
        batchSize: 50, 
        rateLimitDelay: 0 // Disable rate limiting delay for test performance 
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.totalCurrencies).toBe(100);
    });

    it('should handle malformed API responses', async () => {
      vi.spyOn((mexcService as any).coreClient, 'makeRequest').mockResolvedValue({
        code: 1, 
        msg: 'error', 
        data: null, // Error response
      });

      const result = await mexcService.getActivityData('FCAT');

      expect(result.success).toBe(false);
      expect(result.error).toContain('error');
    });
  });
});
