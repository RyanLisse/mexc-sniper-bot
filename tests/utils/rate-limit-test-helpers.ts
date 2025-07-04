/**
 * Rate Limit Test Helpers
 * 
 * Utilities for simulating various rate limit scenarios in tests
 */

import { vi } from 'vitest';

export interface RateLimitErrorScenario {
  type: 'email' | 'otp' | 'verification' | 'token_refresh' | 'mfa' | 'anonymous';
  error: any;
  expectedRetryAfter?: number;
  shouldRetry: boolean;
}

/**
 * Predefined rate limit error scenarios for testing
 */
export const rateLimitScenarios: Record<string, RateLimitErrorScenario> = {
  emailRateLimit: {
    type: 'email',
    error: {
      message: 'Email rate limit exceeded. Only 2 emails per hour are allowed.',
      status: 429,
      headers: { 'retry-after': '1800' }
    },
    expectedRetryAfter: 1800,
    shouldRetry: false
  },
  
  otpRateLimit: {
    type: 'otp',
    error: {
      message: 'OTP rate limit exceeded. Too many verification codes requested.',
      status: 429
    },
    expectedRetryAfter: 300,
    shouldRetry: true
  },
  
  mfaRateLimit: {
    type: 'mfa',
    error: {
      message: 'MFA rate limit exceeded. Please wait before trying again.',
      status: 429
    },
    expectedRetryAfter: 60,
    shouldRetry: true
  },
  
  anonymousRateLimit: {
    type: 'anonymous',
    error: {
      message: 'Anonymous sign-in rate limit exceeded. 30 per hour limit reached.',
      status: 429
    },
    expectedRetryAfter: 120,
    shouldRetry: true
  },
  
  verificationRateLimit: {
    type: 'verification',
    error: {
      message: 'Verification rate limit exceeded. Too many attempts.',
      status: 429
    },
    expectedRetryAfter: 300,
    shouldRetry: true
  },
  
  tokenRefreshRateLimit: {
    type: 'token_refresh',
    error: {
      message: 'Token refresh rate limit exceeded.',
      status: 429
    },
    expectedRetryAfter: 300,
    shouldRetry: true
  }
};

/**
 * Create a mock Supabase client that simulates rate limit errors
 */
export function createRateLimitMockSupabase(scenario: RateLimitErrorScenario) {
  return {
    auth: {
      signInWithPassword: vi.fn().mockRejectedValue(scenario.error),
      signUp: vi.fn().mockRejectedValue(scenario.error),
      signInWithOAuth: vi.fn().mockRejectedValue(scenario.error),
      signInWithOtp: vi.fn().mockRejectedValue(scenario.error),
      resend: vi.fn().mockRejectedValue(scenario.error),
      resetPasswordForEmail: vi.fn().mockRejectedValue(scenario.error),
      verifyOtp: vi.fn().mockRejectedValue(scenario.error),
      exchangeCodeForSession: vi.fn().mockRejectedValue(scenario.error),
      refreshSession: vi.fn().mockRejectedValue(scenario.error),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null })
    }
  };
}

/**
 * Create a mock Supabase client that recovers after retry attempts
 */
export function createRecoveryMockSupabase(scenario: RateLimitErrorScenario, failureCount: number = 2) {
  let attemptCount = 0;
  
  const mockMethod = vi.fn().mockImplementation(() => {
    attemptCount++;
    if (attemptCount <= failureCount) {
      return Promise.reject(scenario.error);
    }
    return Promise.resolve({
      data: { user: { id: 'test-user', email: 'test@example.com' }, session: { access_token: 'test-token' } },
      error: null
    });
  });
  
  return {
    auth: {
      signInWithPassword: mockMethod,
      signUp: mockMethod,
      signInWithOAuth: mockMethod,
      signInWithOtp: mockMethod,
      resend: mockMethod,
      resetPasswordForEmail: mockMethod,
      verifyOtp: mockMethod,
      exchangeCodeForSession: mockMethod,
      refreshSession: mockMethod,
      signOut: vi.fn().mockResolvedValue({ error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null })
    }
  };
}

/**
 * Create a mock fetch function that simulates rate limit responses
 */
export function createRateLimitMockFetch(scenario: RateLimitErrorScenario) {
  return vi.fn().mockImplementation(() => {
    return Promise.resolve({
      ok: false,
      status: scenario.error.status,
      statusText: 'Too Many Requests',
      headers: new Headers(scenario.error.headers || {}),
      json: () => Promise.resolve({
        error: scenario.error.message,
        message: scenario.error.message
      }),
      text: () => Promise.resolve(scenario.error.message)
    });
  });
}

/**
 * Simulate progressive recovery from rate limits
 */
export function createProgressiveRecoveryMockFetch(scenario: RateLimitErrorScenario, recoveryAttempt: number = 3) {
  let attemptCount = 0;
  
  return vi.fn().mockImplementation(() => {
    attemptCount++;
    
    if (attemptCount <= recoveryAttempt) {
      return Promise.resolve({
        ok: false,
        status: scenario.error.status,
        statusText: 'Too Many Requests',
        headers: new Headers(scenario.error.headers || {}),
        json: () => Promise.resolve({
          error: scenario.error.message,
          message: scenario.error.message
        }),
        text: () => Promise.resolve(scenario.error.message)
      });
    }
    
    return Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      json: () => Promise.resolve({ success: true }),
      text: () => Promise.resolve('Success')
    });
  });
}

/**
 * Create rate limit error variations for testing edge cases
 */
export function createRateLimitErrorVariations() {
  return {
    // Different message formats
    emailVariations: [
      { message: 'rate_limit_exceeded', type: 'email' },
      { message: 'Email rate limit exceeded' },
      { message: 'TOO_MANY_REQUESTS', status: 429 },
      { message: 'signup_disabled' },
      { message: 'Rate limit: 2 emails per hour' },
    ],
    
    // Different error codes
    codeVariations: [
      { code: 'RATE_LIMIT_EXCEEDED' },
      { code: 'rate_limit_exceeded' },
      { code: 'TOO_MANY_REQUESTS' },
      { code: 'EMAIL_RATE_LIMIT_EXCEEDED' },
    ],
    
    // Different status codes
    statusVariations: [
      { status: 429 },
      { status: 429, message: 'Rate limit exceeded' },
      { status: 429, statusText: 'Too Many Requests' },
    ],
    
    // Header variations
    headerVariations: [
      { 
        message: 'Rate limit exceeded',
        headers: { 'retry-after': '60' }
      },
      {
        message: 'Rate limit exceeded',
        headers: { 'Retry-After': '300' }
      },
      {
        message: 'Rate limit exceeded',
        headers: { 'X-RateLimit-Reset': '1640995200' }
      }
    ]
  };
}

/**
 * Mock timers for testing retry logic
 */
export function setupRetryTimers() {
  vi.useFakeTimers();
  
  const advanceRetryAttempts = async (attempts: number) => {
    for (let i = 0; i < attempts; i++) {
      const delay = Math.min(1000 * Math.pow(2, i), 32000);
      await vi.advanceTimersByTimeAsync(delay);
    }
  };
  
  return {
    advanceRetryAttempts,
    cleanup: () => {
      vi.useRealTimers();
    }
  };
}

/**
 * Test data for authentication flows
 */
export const authTestData = {
  validCredentials: {
    email: 'ryan@ryanlisse.com',
    password: 'Testing2025!'
  },
  
  invalidCredentials: {
    email: 'invalid@example.com',
    password: 'wrongpassword'
  },
  
  testUsers: [
    { email: 'test1@example.com', password: 'Test123!' },
    { email: 'test2@example.com', password: 'Test456!' },
    { email: 'test3@example.com', password: 'Test789!' },
  ],
  
  rateLimitedUser: {
    email: 'ratelimited@example.com',
    password: 'Testing2025!'
  }
};

/**
 * Create a comprehensive test suite helper
 */
export function createRateLimitTestSuite(testName: string, scenarios: RateLimitErrorScenario[]) {
  return {
    name: testName,
    scenarios,
    runScenario: (scenario: RateLimitErrorScenario, testFn: (scenario: RateLimitErrorScenario) => void) => {
      testFn(scenario);
    },
    runAllScenarios: (testFn: (scenario: RateLimitErrorScenario) => void) => {
      scenarios.forEach(scenario => testFn(scenario));
    }
  };
}

/**
 * Assertion helpers for rate limit testing
 */
export const rateLimitAssertions = {
  expectRateLimitError: (result: any, expectedType?: string) => {
    expect(result.isRateLimited).toBe(true);
    if (expectedType) {
      expect(result.limitType).toBe(expectedType);
    }
    expect(result.message).toBeTruthy();
  },
  
  expectRetryBehavior: (shouldRetry: boolean, retryResult: boolean) => {
    expect(retryResult).toBe(shouldRetry);
  },
  
  expectBackoffDelay: (attempt: number, expectedDelay: number) => {
    expect(expectedDelay).toBe(Math.min(1000 * Math.pow(2, attempt), 32000));
  }
};

/**
 * Mock environment setup for rate limit testing
 */
export function setupRateLimitTestEnvironment() {
  const originalEnv = process.env;
  
  return {
    setDevelopment: () => {
      process.env = {
        ...originalEnv,
        NODE_ENV: 'development',
        NEXT_PUBLIC_SUPABASE_URL: 'https://test-project.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key'
      };
    },
    
    setProduction: () => {
      process.env = {
        ...originalEnv,
        NODE_ENV: 'production',
        NEXT_PUBLIC_SUPABASE_URL: 'https://prod-project.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'prod-anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'prod-service-role-key'
      };
    },
    
    cleanup: () => {
      process.env = originalEnv;
    }
  };
}

/**
 * Database helpers for rate limit testing
 */
export const rateLimitDbHelpers = {
  createRateLimitedUser: async (email: string) => {
    // Mock database interaction for creating rate limited users
    return {
      id: 'rate-limited-user-id',
      email,
      created_at: new Date().toISOString(),
      rate_limit_count: 3,
      rate_limit_reset: new Date(Date.now() + 1800000).toISOString() // 30 minutes from now
    };
  },
  
  resetRateLimits: async (email: string) => {
    // Mock database interaction for resetting rate limits
    return {
      success: true,
      email,
      reset_at: new Date().toISOString()
    };
  }
};