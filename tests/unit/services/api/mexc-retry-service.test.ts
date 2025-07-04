/**
 * Unit tests for MexcRetryService
 * Tests retry logic, error classification, backoff strategies, rate limiting, and adaptive retry mechanisms
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  MexcRetryService,
} from '../../../../src/services/api/mexc-retry-service';
import type {
  ErrorClassification,
  RateLimitInfo,
  RequestContext,
  RetryConfig,
} from '../../../../src/services/api/mexc-api-types';

describe('MexcRetryService', () => {
  let retryService: MexcRetryService;
  let mockConsole: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();

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

    retryService = new MexcRetryService();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Constructor and Configuration', () => {
    it('should create retry service with default configuration', () => {
      const config = retryService.getRetryConfig();

      expect(config).toMatchObject({
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        retryableStatusCodes: [429, 500, 502, 503, 504],
        jitterFactor: 0.1,
        adaptiveRetry: true,
      });
    });

    it('should create retry service with custom configuration', () => {
      const customConfig: Partial<RetryConfig> = {
        maxRetries: 5,
        baseDelay: 2000,
        maxDelay: 60000,
        backoffMultiplier: 1.5,
        retryableStatusCodes: [429, 500, 503],
        jitterFactor: 0.2,
        adaptiveRetry: false,
      };

      const customRetryService = new MexcRetryService(customConfig);
      const config = customRetryService.getRetryConfig();

      expect(config).toMatchObject(customConfig);
    });

    it('should update retry configuration', () => {
      const updates: Partial<RetryConfig> = {
        maxRetries: 7,
        baseDelay: 1500,
      };

      retryService.updateRetryConfig(updates);
      const config = retryService.getRetryConfig();

      expect(config.maxRetries).toBe(7);
      expect(config.baseDelay).toBe(1500);
      expect(config.maxDelay).toBe(30000); // Should preserve existing
    });

    it('should return copy of config to prevent mutation', () => {
      const config1 = retryService.getRetryConfig();
      const config2 = retryService.getRetryConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Different objects
    });
  });

  describe('Error Classification', () => {
    it('should classify network errors as retryable', () => {
      const networkErrors = [
        new Error('Connection timeout'),
        new Error('ECONNRESET'),
        new Error('socket hang up'),
        new Error('network connection failed'),
      ];

      networkErrors.forEach(error => {
        const classification = retryService.classifyError(error);
        
        expect(classification).toMatchObject({
          isRetryable: true,
          category: 'network',
          severity: 'medium',
          suggestedDelay: 1000,
        });
      });
    });

    it('should classify rate limit errors as retryable with longer delay', () => {
      const rateLimitErrors = [
        new Error('Rate limit exceeded'),
        new Error('HTTP 429: Too Many Requests'),
      ];

      rateLimitErrors.forEach(error => {
        const classification = retryService.classifyError(error);
        
        expect(classification).toMatchObject({
          isRetryable: true,
          category: 'rate_limit',
          severity: 'low',
          suggestedDelay: 4000, // baseDelay * 4
          suggestedBackoff: 2.5,
        });
      });
    });

    it('should classify server errors as retryable', () => {
      const serverErrors = [
        new Error('HTTP 500: Internal Server Error'),
        new Error('HTTP 502: Bad Gateway'),
        new Error('HTTP 503: Service Unavailable'),
        new Error('HTTP 504: Gateway Timeout'),
      ];

      serverErrors.forEach(error => {
        const classification = retryService.classifyError(error);
        
        expect(classification).toMatchObject({
          isRetryable: true,
          category: 'server',
          severity: 'high',
          suggestedDelay: 2000, // baseDelay * 2
        });
      });
    });

    it('should classify authentication errors as non-retryable', () => {
      const authErrors = [
        new Error('HTTP 401: Unauthorized'),
        new Error('HTTP 403: Forbidden'),
        new Error('Invalid signature'),
        new Error('Unauthorized access'),
      ];

      authErrors.forEach(error => {
        const classification = retryService.classifyError(error);
        
        expect(classification).toMatchObject({
          isRetryable: false,
          category: 'authentication',
          severity: 'critical',
        });
      });
    });

    it('should classify client errors as non-retryable', () => {
      const clientErrors = [
        new Error('HTTP 400: Bad Request'),
        new Error('HTTP 404: Not Found'),
        new Error('Invalid parameter'),
        new Error('Bad request format'),
      ];

      clientErrors.forEach(error => {
        const classification = retryService.classifyError(error);
        
        expect(classification).toMatchObject({
          isRetryable: false,
          category: 'client',
          severity: 'medium',
        });
      });
    });

    it('should classify timeout errors as retryable', () => {
      const timeoutError = new Error('Request timeout after 5000ms');
      const classification = retryService.classifyError(timeoutError);

      expect(classification).toMatchObject({
        isRetryable: true,
        category: 'timeout',
        severity: 'medium',
        suggestedDelay: 1500, // baseDelay * 1.5
      });
    });

    it('should classify unknown errors as retryable with caution', () => {
      const unknownError = new Error('Some unknown error occurred');
      const classification = retryService.classifyError(unknownError);

      expect(classification).toMatchObject({
        isRetryable: true,
        category: 'network',
        severity: 'medium',
        suggestedDelay: 1000,
      });
    });

    it('should handle case-insensitive error messages', () => {
      const upperCaseError = new Error('RATE LIMIT EXCEEDED');
      const mixedCaseError = new Error('RaTe LiMiT ExCeEdEd');

      [upperCaseError, mixedCaseError].forEach(error => {
        const classification = retryService.classifyError(error);
        expect(classification.category).toBe('rate_limit');
      });
    });
  });

  describe('Retry Decision Making', () => {
    it('should not retry when max attempts reached', () => {
      const error = new Error('Network timeout');
      const shouldRetry = retryService.shouldRetry(error, 3, 3);

      expect(shouldRetry).toBe(false);
    });

    it('should retry for retryable errors within limit', () => {
      const error = new Error('Network timeout');
      const shouldRetry = retryService.shouldRetry(error, 2, 3);

      expect(shouldRetry).toBe(true);
    });

    it('should not retry for non-retryable errors', () => {
      const error = new Error('HTTP 401: Unauthorized');
      const shouldRetry = retryService.shouldRetry(error, 1, 3);

      expect(shouldRetry).toBe(false);
    });

    it('should handle edge case of attempt equal to maxRetries', () => {
      const error = new Error('Network timeout');
      const shouldRetry = retryService.shouldRetry(error, 3, 3);

      expect(shouldRetry).toBe(false);
    });
  });

  describe('Retry Delay Calculation', () => {
    it('should calculate exponential backoff correctly', () => {
      const delay1 = retryService.calculateRetryDelay(1);
      const delay2 = retryService.calculateRetryDelay(2);
      const delay3 = retryService.calculateRetryDelay(3);

      // Should follow exponential pattern: base * multiplier^(attempt-1)
      expect(delay1).toBeCloseTo(1000, -50); // ~1000ms with jitter
      expect(delay2).toBeCloseTo(2000, -200); // ~2000ms with jitter
      expect(delay3).toBeCloseTo(4000, -400); // ~4000ms with jitter
    });

    it('should cap delay at maxDelay', () => {
      const customService = new MexcRetryService({
        baseDelay: 1000,
        maxDelay: 5000,
        backoffMultiplier: 2,
      });

      const largeAttemptDelay = customService.calculateRetryDelay(10);
      expect(largeAttemptDelay).toBeLessThanOrEqual(5000);
    });

    it('should ensure minimum delay', () => {
      const delay = retryService.calculateRetryDelay(1);
      expect(delay).toBeGreaterThanOrEqual(1000); // Base delay minimum
    });

    it('should add jitter to prevent thundering herd', () => {
      const delays: number[] = [];
      for (let i = 0; i < 10; i++) {
        delays.push(retryService.calculateRetryDelay(2));
      }

      // Delays should vary due to jitter
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });

    it('should calculate delay with error classification', () => {
      const rateLimitError = new Error('Rate limit exceeded');
      const networkError = new Error('Network timeout');

      const rateLimitDelay = retryService.calculateRetryDelayWithClassification(1, rateLimitError);
      const networkDelay = retryService.calculateRetryDelayWithClassification(1, networkError);

      expect(rateLimitDelay).toBeGreaterThan(networkDelay);
    });

    it('should handle null lastError gracefully', () => {
      const delay = retryService.calculateRetryDelayWithClassification(2, null);
      expect(delay).toBeCloseTo(2000, -200); // Should fall back to standard calculation
    });

    it('should apply suggested backoff from error classification', () => {
      const rateLimitError = new Error('Rate limit exceeded');
      
      const delay1 = retryService.calculateRetryDelayWithClassification(1, rateLimitError);
      const delay2 = retryService.calculateRetryDelayWithClassification(2, rateLimitError);

      expect(delay2).toBeGreaterThan(delay1);
    });
  });

  describe('Rate Limiting Handling', () => {
    it('should handle rate limit response correctly', async () => {
      const response = {
        status: 429,
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-limit': '1000',
          'x-ratelimit-reset': '1640995200',
          'retry-after': '60',
        },
      };

      const rateLimitInfo = await retryService.recordRateLimitingResponse(response);

      expect(rateLimitInfo).toMatchObject({
        remaining: 0,
        limit: 1000,
        resetTime: 1640995200000, // Converted to milliseconds
        retryAfter: 60000, // Converted to milliseconds
      });
    });

    it('should return null for non-rate-limit responses', async () => {
      const response = {
        status: 200,
        headers: {},
      };

      const rateLimitInfo = await retryService.recordRateLimitingResponse(response);

      expect(rateLimitInfo).toBeNull();
    });

    it('should handle missing rate limit headers', async () => {
      const response = {
        status: 429,
        headers: {},
      };

      const rateLimitInfo = await retryService.recordRateLimitingResponse(response);

      expect(rateLimitInfo).toMatchObject({
        remaining: 0,
        limit: 1000,
        resetTime: 0,
        retryAfter: 60000,
      });
    });

    it('should handle rate limit error with appropriate delay', async () => {
      const rateLimitInfo: RateLimitInfo = {
        remaining: 0,
        limit: 1000,
        resetTime: Date.now() + 30000, // 30 seconds in future
        retryAfter: 60000, // 60 seconds
      };

      const promise = retryService.handleRateLimitError(rateLimitInfo);
      
      // Advance timers to complete the delay
      vi.advanceTimersByTime(30000);
      
      await promise;

      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('Rate limited'),
        expect.any(String)
      );
    });

    it('should calculate appropriate delay for rate limiting', async () => {
      const futureResetTime = Date.now() + 5000; // 5 seconds in future
      const rateLimitInfo: RateLimitInfo = {
        remaining: 0,
        limit: 1000,
        resetTime: futureResetTime,
        retryAfter: 10000, // 10 seconds
      };

      const startTime = Date.now();
      const promise = retryService.handleRateLimitError(rateLimitInfo);
      
      // Should wait until reset time + buffer
      vi.advanceTimersByTime(6000); // Reset time + 1 second buffer
      
      await promise;
      
      // Verify appropriate delay was used
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('6000ms'),
        expect.any(String)
      );
    });
  });

  describe('Adaptive Retry Mechanism', () => {
    it('should track success rate correctly', () => {
      // Simulate successful requests
      retryService.updateSuccessRate(true);
      retryService.updateSuccessRate(true);
      retryService.updateSuccessRate(false); // One failure
      
      const stats = retryService.getRetryStats();
      expect(stats.recentErrors).toBe(1);
    });

    it('should limit recent errors to 100', () => {
      // Simulate many failures
      for (let i = 0; i < 150; i++) {
        retryService.updateSuccessRate(false);
      }
      
      const stats = retryService.getRetryStats();
      expect(stats.recentErrors).toBe(100);
    });

    it('should return appropriate adaptive multiplier based on success rate', () => {
      // Simulate low success rate scenario
      for (let i = 0; i < 60; i++) {
        retryService.updateSuccessRate(false);
      }
      
      const multiplier = retryService.getAdaptiveRetryMultiplier();
      expect(multiplier).toBe(2.0); // Should double delay for low success rate
    });

    it('should return normal multiplier for good success rate', () => {
      // Simulate good success rate scenario
      for (let i = 0; i < 5; i++) {
        retryService.updateSuccessRate(true);
      }
      
      const multiplier = retryService.getAdaptiveRetryMultiplier();
      expect(multiplier).toBe(1.0); // Normal delay
    });

    it('should return medium multiplier for moderate success rate', () => {
      // Simulate moderate success rate scenario
      for (let i = 0; i < 25; i++) {
        retryService.updateSuccessRate(false);
      }
      
      const multiplier = retryService.getAdaptiveRetryMultiplier();
      expect(multiplier).toBe(1.5); // 50% increase
    });

    it('should not use adaptive retry when disabled', () => {
      const nonAdaptiveService = new MexcRetryService({ adaptiveRetry: false });
      
      // Simulate many failures
      for (let i = 0; i < 60; i++) {
        nonAdaptiveService.updateSuccessRate(false);
      }
      
      const multiplier = nonAdaptiveService.getAdaptiveRetryMultiplier();
      expect(multiplier).toBe(1.0); // Should remain normal
    });
  });

  describe('Retry Execution', () => {
    it('should execute operation successfully on first attempt', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      const context: RequestContext = {
        requestId: 'test-123',
        priority: 'medium',
        endpoint: '/api/v3/test',
        attempt: 1,
        startTime: Date.now(),
      };

      const result = await retryService.executeWithRetry(mockOperation, context);

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
      expect(context.attempt).toBe(1);
    });

    it('should retry on retryable errors and eventually succeed', async () => {
      const mockOperation = vi.fn()
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Server error'))
        .mockResolvedValue('success');

      const context: RequestContext = {
        requestId: 'test-123',
        priority: 'medium',
        endpoint: '/api/v3/test',
        attempt: 1,
        startTime: Date.now(),
      };

      const promise = retryService.executeWithRetry(mockOperation, context);
      
      // Advance through retry delays
      vi.advanceTimersByTime(1000); // First retry
      vi.advanceTimersByTime(2000); // Second retry
      
      const result = await promise;

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(3);
      expect(context.attempt).toBe(3);
    });

    it('should throw error when max retries exceeded', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Persistent network error'));
      const context: RequestContext = {
        requestId: 'test-123',
        priority: 'medium',
        endpoint: '/api/v3/test',
        attempt: 1,
        startTime: Date.now(),
      };

      const promise = retryService.executeWithRetry(mockOperation, context, 2);
      
      // Advance through all retry delays
      vi.advanceTimersByTime(1000); // First retry
      vi.advanceTimersByTime(2000); // Second retry
      
      await expect(promise).rejects.toThrow('Persistent network error');
      expect(mockOperation).toHaveBeenCalledTimes(3); // Original + 2 retries
    });

    it('should not retry non-retryable errors', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('HTTP 401: Unauthorized'));
      const context: RequestContext = {
        requestId: 'test-123',
        priority: 'medium',
        endpoint: '/api/v3/test',
        attempt: 1,
        startTime: Date.now(),
      };

      await expect(retryService.executeWithRetry(mockOperation, context)).rejects.toThrow('HTTP 401: Unauthorized');
      expect(mockOperation).toHaveBeenCalledTimes(1); // No retries
    });

    it('should use custom maxRetries when provided', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Network error'));
      const context: RequestContext = {
        requestId: 'test-123',
        priority: 'medium',
        endpoint: '/api/v3/test',
        attempt: 1,
        startTime: Date.now(),
      };

      const promise = retryService.executeWithRetry(mockOperation, context, 1);
      
      // Advance through retry delay
      vi.advanceTimersByTime(1000);
      
      await expect(promise).rejects.toThrow('Network error');
      expect(mockOperation).toHaveBeenCalledTimes(2); // Original + 1 retry
    });

    it('should log retry attempts with context', async () => {
      const mockOperation = vi.fn()
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValue('success');

      const context: RequestContext = {
        requestId: 'test-123',
        priority: 'medium',
        endpoint: '/api/v3/test',
        attempt: 1,
        startTime: Date.now(),
      };

      const promise = retryService.executeWithRetry(mockOperation, context);
      
      vi.advanceTimersByTime(1000); // First retry
      
      await promise;

      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('Request failed (attempt 1/4)'),
        expect.objectContaining({
          error: 'Network timeout',
          endpoint: '/api/v3/test',
          requestId: 'test-123',
        })
      );
    });

    it('should handle non-Error thrown values', async () => {
      const mockOperation = vi.fn().mockRejectedValue('String error');
      const context: RequestContext = {
        requestId: 'test-123',
        priority: 'medium',
        endpoint: '/api/v3/test',
        attempt: 1,
        startTime: Date.now(),
      };

      await expect(retryService.executeWithRetry(mockOperation, context)).rejects.toThrow('String error');
    });

    it('should apply adaptive retry multiplier to delays', async () => {
      // Set up low success rate to trigger adaptive retry
      for (let i = 0; i < 60; i++) {
        retryService.updateSuccessRate(false);
      }

      const mockOperation = vi.fn()
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValue('success');

      const context: RequestContext = {
        requestId: 'test-123',
        priority: 'medium',
        endpoint: '/api/v3/test',
        attempt: 1,
        startTime: Date.now(),
      };

      const promise = retryService.executeWithRetry(mockOperation, context);
      
      // Should have longer delay due to adaptive retry
      vi.advanceTimersByTime(2000); // Doubled delay
      
      await promise;

      expect(mockOperation).toHaveBeenCalledTimes(2);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track retry statistics correctly', () => {
      const initialStats = retryService.getRetryStats();
      
      expect(initialStats).toMatchObject({
        successRate: 1.0,
        recentErrors: 0,
        lastRateLimitReset: 0,
      });
    });

    it('should update last rate limit reset time', async () => {
      const response = {
        status: 429,
        headers: {
          'x-ratelimit-reset': '1640995200',
        },
      };

      await retryService.recordRateLimitingResponse(response);
      const stats = retryService.getRetryStats();

      expect(stats.lastRateLimitReset).toBe(1640995200000);
    });

    it('should track success rate changes', () => {
      retryService.updateSuccessRate(true);
      retryService.updateSuccessRate(false);
      retryService.updateSuccessRate(true);

      const stats = retryService.getRetryStats();
      expect(stats.recentErrors).toBe(1);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle very large attempt numbers gracefully', () => {
      const delay = retryService.calculateRetryDelay(100);
      expect(delay).toBeLessThanOrEqual(30000); // Should be capped at maxDelay
    });

    it('should handle zero or negative backoff multiplier', () => {
      const customService = new MexcRetryService({
        backoffMultiplier: 0,
      });

      const delay = customService.calculateRetryDelay(3);
      expect(delay).toBeGreaterThanOrEqual(1000); // Should still respect minimum
    });

    it('should handle very small jitter factor', () => {
      const customService = new MexcRetryService({
        jitterFactor: 0.001,
      });

      const delays: number[] = [];
      for (let i = 0; i < 10; i++) {
        delays.push(customService.calculateRetryDelay(2));
      }

      // Should still add some variation
      const avgDelay = delays.reduce((a, b) => a + b) / delays.length;
      expect(avgDelay).toBeCloseTo(2000, -100);
    });

    it('should handle empty error message', () => {
      const emptyError = new Error('');
      const classification = retryService.classifyError(emptyError);
      
      expect(classification.isRetryable).toBe(true);
      expect(classification.category).toBe('network');
    });

    it('should handle errors with special characters', () => {
      const specialError = new Error('Ошибка сети: тайм-аут подключения');
      const classification = retryService.classifyError(specialError);
      
      expect(classification).toBeDefined();
    });

    it('should handle future reset time correctly', async () => {
      const futureTime = Date.now() + 60000; // 1 minute in future
      const rateLimitInfo: RateLimitInfo = {
        remaining: 0,
        limit: 1000,
        resetTime: futureTime,
        retryAfter: 30000,
      };

      const promise = retryService.handleRateLimitError(rateLimitInfo);
      
      // Should wait until reset time + buffer (31 seconds)
      vi.advanceTimersByTime(31000);
      
      await promise;
      
      expect(mockConsole.warn).toHaveBeenCalled();
    });

    it('should handle past reset time gracefully', async () => {
      const pastTime = Date.now() - 60000; // 1 minute in past
      const rateLimitInfo: RateLimitInfo = {
        remaining: 0,
        limit: 1000,
        resetTime: pastTime,
        retryAfter: 5000,
      };

      const promise = retryService.handleRateLimitError(rateLimitInfo);
      
      // Should use retryAfter delay
      vi.advanceTimersByTime(5000);
      
      await promise;
      
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('5000ms'),
        expect.any(String)
      );
    });
  });

  describe('Configuration Updates', () => {
    it('should preserve unmodified configuration when updating', () => {
      const originalConfig = retryService.getRetryConfig();
      const originalMaxDelay = originalConfig.maxDelay;

      retryService.updateRetryConfig({ maxRetries: 5 });

      const updatedConfig = retryService.getRetryConfig();
      expect(updatedConfig.maxRetries).toBe(5);
      expect(updatedConfig.maxDelay).toBe(originalMaxDelay);
    });

    it('should handle empty configuration updates', () => {
      const originalConfig = retryService.getRetryConfig();
      
      retryService.updateRetryConfig({});
      
      const updatedConfig = retryService.getRetryConfig();
      expect(updatedConfig).toEqual(originalConfig);
    });
  });
});