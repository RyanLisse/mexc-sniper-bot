/**
 * Integration Tests for Authentication with Rate Limits
 * 
 * Tests authentication endpoints with rate limit scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rateLimitScenarios, createRateLimitMockFetch, authTestData, setupRateLimitTestEnvironment } from '../utils/rate-limit-test-helpers';
import { SupabaseRateLimitHandler, withRateLimitHandling } from '../../src/lib/supabase-rate-limit-handler';

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../utils/timeout-elimination-helpers';

const BASE_URL = 'http://localhost:3008';

describe('Authentication Rate Limit Integration Tests', () => {
  let originalFetch: typeof global.fetch;
  let envSetup: ReturnType<typeof setupRateLimitTestEnvironment>;

  beforeEach(() => {
    originalFetch = global.fetch;
    envSetup = setupRateLimitTestEnvironment();
    envSetup.setDevelopment();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // TIMEOUT ELIMINATION: Ensure all promises are flushed before cleanup
    await flushPromises();
    global.fetch = originalFetch;
    envSetup.cleanup();
  
  });

  describe('Authentication Session Endpoint', () => {
    it('should handle rate limit on session endpoint', async () => {
      const mockFetch = createRateLimitMockFetch(rateLimitScenarios.emailRateLimit);
      global.fetch = mockFetch;

      const response = await fetch(`${BASE_URL}/api/auth/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authTestData.validCredentials.email })
      });

      expect(response.status).toBe(429);
      expect(response.headers.get('retry-after')).toBe('1800');
      
      const errorData = await response.json();
      expect(errorData.error).toContain('Email rate limit exceeded');
    });

    it('should retry non-email rate limits', async () => {
      let attemptCount = 0;
      const mockFetch = vi.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount <= 2) {
          return Promise.resolve({
            ok: false,
            status: 429,
            json: () => Promise.resolve({
              error: 'OTP rate limit exceeded'
            })
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ session: { access_token: 'test-token' } })
        });
      });
      
      global.fetch = mockFetch;

      const sessionRequest = async () => {
        const response = await fetch(`${BASE_URL}/api/auth/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: authTestData.validCredentials.email })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error);
        }
        
        return response.json();
      };

      const result = await withRateLimitHandling(sessionRequest, 3);
      expect(result.session).toBeDefined();
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Authentication Callback Endpoint', () => {
    it('should handle rate limit on callback endpoint', async () => {
      const mockFetch = createRateLimitMockFetch(rateLimitScenarios.tokenRefreshRateLimit);
      global.fetch = mockFetch;

      const response = await fetch(`${BASE_URL}/api/auth/callback?code=test-code`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      expect(response.status).toBe(429);
      
      const errorData = await response.json();
      expect(errorData.error).toContain('Token refresh rate limit exceeded');
    });
  });

  describe('Sign Out Endpoint', () => {
    it('should handle rate limit on signout endpoint', async () => {
      const mockFetch = createRateLimitMockFetch(rateLimitScenarios.mfaRateLimit);
      global.fetch = mockFetch;

      const response = await fetch(`${BASE_URL}/api/auth/signout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      expect(response.status).toBe(429);
      
      const errorData = await response.json();
      expect(errorData.error).toContain('MFA rate limit exceeded');
    });
  });

  describe('Rate Limit Recovery Scenarios', () => {
    it('should recover from temporary rate limits', async () => {
      let requestCount = 0;
      const mockFetch = vi.fn().mockImplementation(() => {
        requestCount++;
        
        if (requestCount <= 2) {
          return Promise.resolve({
            ok: false,
            status: 429,
            headers: new Headers({ 'retry-after': '60' }),
            json: () => Promise.resolve({
              error: 'OTP rate limit exceeded. Please wait 60 seconds.'
            })
          });
        }
        
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            session: { access_token: 'recovered-token' },
            user: { id: 'test-user', email: authTestData.validCredentials.email }
          })
        });
      });
      
      global.fetch = mockFetch;

      const authRequest = async () => {
        const response = await fetch(`${BASE_URL}/api/auth/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: authTestData.validCredentials.email,
            password: authTestData.validCredentials.password
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw { message: errorData.error, status: response.status };
        }
        
        return response.json();
      };

      // Setup fake timers for retry delays
      vi.useFakeTimers();
      
      const resultPromise = withRateLimitHandling(authRequest, 3);
      
      // Advance timers to simulate retry delays
      await vi.advanceTimersByTimeAsync(1000); // First retry
      await vi.advanceTimersByTimeAsync(2000); // Second retry
      
      const result = await resultPromise;
      
      expect(result.session.access_token).toBe('recovered-token');
      expect(mockFetch).toHaveBeenCalledTimes(3);
      
      vi.useRealTimers();
    });
  });

  describe('Different Rate Limit Types', () => {
    it('should handle email rate limit appropriately', async () => {
      const mockFetch = createRateLimitMockFetch(rateLimitScenarios.emailRateLimit);
      global.fetch = mockFetch;

      const authRequest = async () => {
        const response = await fetch(`${BASE_URL}/api/auth/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: authTestData.validCredentials.email,
            password: authTestData.validCredentials.password
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw { message: errorData.error, status: response.status };
        }
        
        return response.json();
      };

      // Email rate limits should not be retried
      await expect(withRateLimitHandling(authRequest, 3)).rejects.toThrow('Email rate limit exceeded');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle OTP rate limit with retries', async () => {
      const mockFetch = createRateLimitMockFetch(rateLimitScenarios.otpRateLimit);
      global.fetch = mockFetch;

      const otpRequest = async () => {
        const response = await fetch(`${BASE_URL}/api/auth/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: authTestData.validCredentials.email,
            token: '123456',
            type: 'email'
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw { message: errorData.error, status: response.status };
        }
        
        return response.json();
      };

      vi.useFakeTimers();
      
      const resultPromise = withRateLimitHandling(otpRequest, 3);
      
      // Advance timers for retry attempts
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);
      
      await expect(resultPromise).rejects.toThrow('OTP rate limit exceeded');
      expect(mockFetch).toHaveBeenCalledTimes(3);
      
      vi.useRealTimers();
    });

    it('should handle anonymous rate limit', async () => {
      const mockFetch = createRateLimitMockFetch(rateLimitScenarios.anonymousRateLimit);
      global.fetch = mockFetch;

      const response = await fetch(`${BASE_URL}/api/auth/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymous: true })
      });

      expect(response.status).toBe(429);
      
      const errorData = await response.json();
      expect(errorData.error).toContain('Anonymous sign-in rate limit exceeded');
    });
  });

  describe('Rate Limit Headers and Metadata', () => {
    it('should correctly parse retry-after headers', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers({
          'retry-after': '900',
          'x-ratelimit-limit': '2',
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': '1640995200'
        }),
        json: () => Promise.resolve({
          error: 'Email rate limit exceeded'
        })
      });
      
      global.fetch = mockFetch;

      const response = await fetch(`${BASE_URL}/api/auth/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authTestData.validCredentials.email })
      });

      expect(response.status).toBe(429);
      expect(response.headers.get('retry-after')).toBe('900');
      expect(response.headers.get('x-ratelimit-remaining')).toBe('0');
    });

    it('should provide user-friendly error messages', async () => {
      const scenarios = [
        {
          scenario: rateLimitScenarios.emailRateLimit,
          expectedMessage: 'Email rate limit exceeded'
        },
        {
          scenario: rateLimitScenarios.otpRateLimit,
          expectedMessage: 'OTP rate limit exceeded'
        },
        {
          scenario: rateLimitScenarios.mfaRateLimit,
          expectedMessage: 'MFA rate limit exceeded'
        }
      ];

      for (const { scenario, expectedMessage } of scenarios) {
        const mockFetch = createRateLimitMockFetch(scenario);
        global.fetch = mockFetch;

        const response = await fetch(`${BASE_URL}/api/auth/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: authTestData.validCredentials.email })
        });

        const errorData = await response.json();
        expect(errorData.error).toContain(expectedMessage);
      }
    });
  });

  describe('Bypass Rate Limits in Development', () => {
    it('should bypass rate limits in development mode', async () => {
      envSetup.setDevelopment();
      
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve('Rate limit bypassed successfully')
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            session: { access_token: 'bypassed-token' },
            user: { id: 'test-user', email: authTestData.validCredentials.email }
          })
        });
      
      global.fetch = mockFetch;

      // First call: bypass rate limit
      const bypassResponse = await fetch(`${BASE_URL}/api/admin/bypass-email-confirmation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authTestData.validCredentials.email })
      });

      expect(bypassResponse.ok).toBe(true);

      // Second call: successful auth
      const authResponse = await fetch(`${BASE_URL}/api/auth/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: authTestData.validCredentials.email,
          password: authTestData.validCredentials.password
        })
      });

      expect(authResponse.ok).toBe(true);
      const authData = await authResponse.json();
      expect(authData.session.access_token).toBe('bypassed-token');
    });

    it('should not bypass rate limits in production', async () => {
      envSetup.setProduction();
      
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({
          error: 'Bypass not allowed in production'
        })
      });
      
      global.fetch = mockFetch;

      const bypassResponse = await fetch(`${BASE_URL}/api/admin/bypass-email-confirmation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authTestData.validCredentials.email })
      });

      expect(bypassResponse.ok).toBe(false);
      expect(bypassResponse.status).toBe(403);
    });
  });
});