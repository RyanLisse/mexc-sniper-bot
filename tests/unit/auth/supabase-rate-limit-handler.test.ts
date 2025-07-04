/**
 * Unit Tests for SupabaseRateLimitHandler
 * 
 * Comprehensive test suite for the Supabase rate limit handler utility
 * covering all rate limit scenarios, error detection, and retry logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SupabaseRateLimitHandler, withRateLimitHandling, bypassRateLimitInDev } from '../../../src/lib/supabase-rate-limit-handler';

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../../utils/timeout-elimination-helpers';

describe('SupabaseRateLimitHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isRateLimitError', () => {
    it('should detect rate limit errors by message', () => {
      const rateLimitErrors = [
        { message: 'rate_limit_exceeded' },
        { message: 'too_many_requests' },
        { message: 'email_rate_limit_exceeded' },
        { message: 'Rate limit exceeded' },
        { message: 'Too many requests' },
        { message: 'signup_disabled' },
      ];

      rateLimitErrors.forEach(error => {
        expect(SupabaseRateLimitHandler.isRateLimitError(error)).toBe(true);
      });
    });

    it('should detect rate limit errors by status code', () => {
      const error = { status: 429, message: 'Too Many Requests' };
      expect(SupabaseRateLimitHandler.isRateLimitError(error)).toBe(true);
    });

    it('should detect rate limit errors by code', () => {
      const error = { code: 'RATE_LIMIT_EXCEEDED' };
      expect(SupabaseRateLimitHandler.isRateLimitError(error)).toBe(true);
    });

    it('should not detect non-rate-limit errors', () => {
      const nonRateLimitErrors = [
        { message: 'Invalid credentials' },
        { message: 'User not found' },
        { status: 401 },
        { code: 'UNAUTHORIZED' },
        null,
        undefined,
      ];

      nonRateLimitErrors.forEach(error => {
        expect(SupabaseRateLimitHandler.isRateLimitError(error)).toBe(false);
      });
    });
  });

  describe('analyzeRateLimitError', () => {
    it('should analyze email rate limit error', () => {
      const error = { message: 'email rate limit exceeded' };
      const result = SupabaseRateLimitHandler.analyzeRateLimitError(error);

      expect(result.isRateLimited).toBe(true);
      expect(result.limitType).toBe('email');
      expect(result.retryAfter).toBe(1800); // 30 minutes
      expect(result.message).toContain('Email rate limit exceeded');
      expect(result.suggestion).toContain('magic link');
    });

    it('should analyze OTP rate limit error', () => {
      const error = { message: 'otp rate limit exceeded' };
      const result = SupabaseRateLimitHandler.analyzeRateLimitError(error);

      expect(result.isRateLimited).toBe(true);
      expect(result.limitType).toBe('otp');
      expect(result.retryAfter).toBe(300); // 5 minutes default
      expect(result.message).toContain('OTP rate limit exceeded');
      expect(result.suggestion).toContain('alternative verification');
    });

    it('should analyze MFA rate limit error', () => {
      const error = { message: 'mfa rate limit exceeded' };
      const result = SupabaseRateLimitHandler.analyzeRateLimitError(error);

      expect(result.isRateLimited).toBe(true);
      expect(result.limitType).toBe('mfa');
      expect(result.retryAfter).toBe(60); // 1 minute
      expect(result.message).toContain('MFA rate limit exceeded');
      expect(result.suggestion).toContain('multi-factor authentication');
    });

    it('should analyze anonymous rate limit error', () => {
      const error = { message: 'anonymous rate limit exceeded' };
      const result = SupabaseRateLimitHandler.analyzeRateLimitError(error);

      expect(result.isRateLimited).toBe(true);
      expect(result.limitType).toBe('anonymous');
      expect(result.retryAfter).toBe(120); // 2 minutes
      expect(result.message).toContain('Anonymous sign-in rate limit exceeded');
      expect(result.suggestion).toContain('permanent account');
    });

    it('should parse retry-after from headers', () => {
      const error = {
        message: 'rate limit exceeded',
        headers: { 'retry-after': '600' }
      };
      const result = SupabaseRateLimitHandler.analyzeRateLimitError(error);

      expect(result.retryAfter).toBe(600);
    });

    it('should parse retry-after from message', () => {
      const error = { message: 'Rate limit exceeded, retry after 300 seconds' };
      const result = SupabaseRateLimitHandler.analyzeRateLimitError(error);

      expect(result.retryAfter).toBe(300);
    });

    it('should handle non-rate-limit errors', () => {
      const error = { message: 'Invalid credentials' };
      const result = SupabaseRateLimitHandler.analyzeRateLimitError(error);

      expect(result.isRateLimited).toBe(false);
      expect(result.message).toBe('Invalid credentials');
    });
  });

  describe('calculateBackoffDelay', () => {
    it('should calculate exponential backoff delays', () => {
      expect(SupabaseRateLimitHandler.calculateBackoffDelay(0)).toBe(1000);
      expect(SupabaseRateLimitHandler.calculateBackoffDelay(1)).toBe(2000);
      expect(SupabaseRateLimitHandler.calculateBackoffDelay(2)).toBe(4000);
      expect(SupabaseRateLimitHandler.calculateBackoffDelay(3)).toBe(8000);
      expect(SupabaseRateLimitHandler.calculateBackoffDelay(4)).toBe(16000);
      expect(SupabaseRateLimitHandler.calculateBackoffDelay(5)).toBe(32000);
    });

    it('should cap backoff delay at 32 seconds', () => {
      expect(SupabaseRateLimitHandler.calculateBackoffDelay(10)).toBe(32000);
      expect(SupabaseRateLimitHandler.calculateBackoffDelay(100)).toBe(32000);
    });
  });

  describe('shouldRetry', () => {
    it('should not retry non-rate-limit errors', () => {
      const rateLimitInfo = { isRateLimited: false, message: 'Invalid credentials' };
      expect(SupabaseRateLimitHandler.shouldRetry(rateLimitInfo, 0)).toBe(false);
    });

    it('should not retry email rate limits', () => {
      const rateLimitInfo = { 
        isRateLimited: true, 
        limitType: 'email' as const, 
        message: 'Email rate limit exceeded' 
      };
      expect(SupabaseRateLimitHandler.shouldRetry(rateLimitInfo, 0)).toBe(false);
    });

    it('should retry non-email rate limits up to 3 attempts', () => {
      const rateLimitInfo = { 
        isRateLimited: true, 
        limitType: 'otp' as const, 
        message: 'OTP rate limit exceeded' 
      };
      
      expect(SupabaseRateLimitHandler.shouldRetry(rateLimitInfo, 0)).toBe(true);
      expect(SupabaseRateLimitHandler.shouldRetry(rateLimitInfo, 1)).toBe(true);
      expect(SupabaseRateLimitHandler.shouldRetry(rateLimitInfo, 2)).toBe(true);
      expect(SupabaseRateLimitHandler.shouldRetry(rateLimitInfo, 3)).toBe(false);
    });
  });

  describe('formatTimeRemaining', () => {
    it('should format seconds correctly', () => {
      expect(SupabaseRateLimitHandler.formatTimeRemaining(30)).toBe('30 seconds');
      expect(SupabaseRateLimitHandler.formatTimeRemaining(1)).toBe('1 seconds');
    });

    it('should format minutes correctly', () => {
      expect(SupabaseRateLimitHandler.formatTimeRemaining(60)).toBe('1 minute');
      expect(SupabaseRateLimitHandler.formatTimeRemaining(120)).toBe('2 minutes');
      expect(SupabaseRateLimitHandler.formatTimeRemaining(90)).toBe('2 minutes');
    });

    it('should format hours correctly', () => {
      expect(SupabaseRateLimitHandler.formatTimeRemaining(3600)).toBe('1 hour');
      expect(SupabaseRateLimitHandler.formatTimeRemaining(7200)).toBe('2 hours');
      expect(SupabaseRateLimitHandler.formatTimeRemaining(5400)).toBe('2 hours');
    });
  });
});

describe('withRateLimitHandling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return result on successful operation', async () => {
    const operation = vi.fn().mockResolvedValue('success');
    
    const result = await withRateLimitHandling(operation);
    
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should throw non-rate-limit errors immediately', async () => {
    const error = new Error('Invalid credentials');
    const operation = vi.fn().mockRejectedValue(error);
    
    await expect(withRateLimitHandling(operation)).rejects.toThrow('Invalid credentials');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should throw email rate limit errors immediately', async () => {
    const error = { message: 'email rate limit exceeded' };
    const operation = vi.fn().mockRejectedValue(error);
    
    await expect(withRateLimitHandling(operation)).rejects.toEqual(error);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should use custom max retries', async () => {
    // Use a rate limit error with short retry time by including retry-after header
    const error = { 
      message: 'rate limit exceeded', 
      status: 429,
      headers: { 'retry-after': '0' }  // 0 seconds - no delay for testing
    };
    const operation = vi.fn().mockRejectedValue(error);
    
    // maxRetries: 2 means 2 total attempts (1 initial + 1 retry)
    const config = {
      maxRetries: 2,
      config: {
        baseDelay: 1,  // Minimal delay for testing
        maxDelay: 1,
        enableJitter: false,
        adaptiveRetry: false
      }
    };
    
    await expect(withRateLimitHandling(operation, config)).rejects.toEqual(error);
    expect(operation).toHaveBeenCalledTimes(2); // 2 total attempts
  });
});

describe('bypassRateLimitInDev', () => {
  let originalEnv: string | undefined;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
    originalFetch = global.fetch;
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // TIMEOUT ELIMINATION: Ensure all promises are flushed before cleanup
    await flushPromises();
    if (originalEnv !== undefined) {
      process.env.NODE_ENV = originalEnv;
    } else {
      delete process.env.NODE_ENV;
    }
    delete process.env.BYPASS_RATE_LIMITS;
    global.fetch = originalFetch;
  
  });

  it('should bypass rate limit in development environment', async () => {
    process.env.NODE_ENV = 'development';
    process.env.BYPASS_RATE_LIMITS = 'true';
    
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('Success')
    });
    global.fetch = mockFetch;

    const result = await bypassRateLimitInDev('test@example.com');

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith('/api/admin/bypass-email-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' })
    });
  });

  it('should not bypass rate limit in production environment', async () => {
    process.env.NODE_ENV = 'production';
    
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    const result = await bypassRateLimitInDev('test@example.com');

    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should handle fetch errors gracefully', async () => {
    process.env.NODE_ENV = 'development';
    process.env.BYPASS_RATE_LIMITS = 'true';
    
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    global.fetch = mockFetch;

    const result = await bypassRateLimitInDev('test@example.com');

    expect(result).toBe(false);
  });

  it('should handle non-ok responses gracefully', async () => {
    process.env.NODE_ENV = 'development';
    process.env.BYPASS_RATE_LIMITS = 'true';
    
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      text: () => Promise.resolve('Rate limit bypass failed')
    });
    global.fetch = mockFetch;

    const result = await bypassRateLimitInDev('test@example.com');

    expect(result).toBe(false);
  });
});

describe('Rate Limit Handler Integration Scenarios', () => {
  it('should handle complex rate limit scenarios', () => {
    // Test multiple rate limit types with valid error messages
    const scenarios = [
      {
        error: { message: 'Email rate limit exceeded. Please try again in 30 minutes.' },
        expectedType: 'email',
        shouldRetry: false
      },
      {
        error: { message: 'OTP verification rate limit exceeded' },
        expectedType: 'otp',
        shouldRetry: true
      },
      {
        error: { message: 'MFA rate limit exceeded' },
        expectedType: 'mfa',
        shouldRetry: true
      },
      {
        error: { message: 'Anonymous sign-in rate limit exceeded' },
        expectedType: 'anonymous',
        shouldRetry: true
      }
    ];

    scenarios.forEach(({ error, expectedType, shouldRetry }) => {
      const rateLimitInfo = SupabaseRateLimitHandler.analyzeRateLimitError(error);
      
      expect(rateLimitInfo.isRateLimited).toBe(true);
      expect(rateLimitInfo.limitType).toBe(expectedType);
      expect(SupabaseRateLimitHandler.shouldRetry(rateLimitInfo, 0)).toBe(shouldRetry);
    });
  });

  it('should provide appropriate user messaging', () => {
    const emailError = { message: 'email rate limit exceeded' };
    const emailResult = SupabaseRateLimitHandler.analyzeRateLimitError(emailError);
    
    expect(emailResult.message).toContain('Email rate limit exceeded');
    expect(emailResult.suggestion).toContain('magic link');
  });
});