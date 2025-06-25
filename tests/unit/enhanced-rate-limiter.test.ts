import { describe, it, expect, beforeEach, vi } from 'vitest';

// Import everything before mocking
import {
  checkRateLimit,
  logSecurityEvent,
  getSecurityEvents,
  getRateLimitStats,
  isIPSuspicious,
  getIPAnalysis,
  cleanupExpiredEntries,
  clearAllRateLimitData,
  clearSecurityEvents,
} from '../../src/lib/rate-limiter';

// Mock console output to reduce test noise
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'info').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'debug').mockImplementation(() => {});

// Mock the adaptive rate limiter in setup
beforeEach(async () => {
  // Mock the adaptive rate limiter service to avoid dependency issues
  const { adaptiveRateLimiter } = await import('../../src/services/adaptive-rate-limiter');
  
  // Replace methods with mocks that always allow requests (for testing traditional rate limiter)
  vi.spyOn(adaptiveRateLimiter, 'checkRateLimit').mockResolvedValue({
    allowed: true,
    remainingRequests: 100,
    resetTime: Date.now() + 60000,
    metadata: {
      algorithm: 'mock',
      currentWindowRequests: 1,
      averageResponseTime: 100,
      successRate: 1.0,
      adaptationFactor: 1.0,
      burstTokens: 100,
    },
  });
  
  vi.spyOn(adaptiveRateLimiter, 'recordResponse').mockResolvedValue(undefined);
});

describe('Enhanced Rate Limiter', () => {
  beforeEach(() => {
    // Clear all rate limiter state before each test
    clearAllRateLimitData();
  });

  describe('Security Event Logging', () => {
    it('should log security events with timestamps', () => {
      logSecurityEvent({
        type: 'AUTH_ATTEMPT',
        ip: '192.168.1.1',
        endpoint: '/api/auth',
        userAgent: 'test-agent',
        userId: 'user123',
        metadata: { success: true },
      });

      const events = getSecurityEvents(10);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'AUTH_ATTEMPT',
        ip: '192.168.1.1',
        endpoint: '/api/auth',
        userAgent: 'test-agent',
        userId: 'user123',
      });
      expect(events[0].timestamp).toBeTypeOf('number');
    });

    it('should filter events by type', () => {
      logSecurityEvent({
        type: 'AUTH_ATTEMPT',
        ip: '192.168.1.1',
        endpoint: '/api/auth',
      });

      logSecurityEvent({
        type: 'RATE_LIMIT_EXCEEDED',
        ip: '192.168.1.2',
        endpoint: '/api/auth',
      });

      const authEvents = getSecurityEvents(10, 'AUTH_ATTEMPT');
      const rateLimitEvents = getSecurityEvents(10, 'RATE_LIMIT_EXCEEDED');

      expect(authEvents).toHaveLength(1);
      expect(authEvents[0].type).toBe('AUTH_ATTEMPT');
      expect(rateLimitEvents).toHaveLength(1);
      expect(rateLimitEvents[0].type).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should limit stored events to prevent memory bloat', () => {
      // Log more than 1000 events
      for (let i = 0; i < 1100; i++) {
        logSecurityEvent({
          type: 'AUTH_ATTEMPT',
          ip: `192.168.1.${i % 255}`,
          endpoint: '/api/auth',
        });
      }

      const events = getSecurityEvents(2000);
      expect(events.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('Enhanced Rate Limiting', () => {
    it('should track first and last attempt times', async () => {
      const result1 = await checkRateLimit('192.168.1.1', '/api/auth', 'auth');
      expect(result1.success).toBe(true);
      expect(result1.isFirstViolation).toBe(false);

      // Make multiple attempts to exceed the current limit (50 for auth)
      for (let i = 0; i < 49; i++) {
        await checkRateLimit('192.168.1.1', '/api/auth', 'auth');
      }

      // This should exceed the limit (51st attempt)
      const result2 = await checkRateLimit('192.168.1.1', '/api/auth', 'auth');
      expect(result2.success).toBe(false);
      expect(result2.isFirstViolation).toBe(true);

      // Next attempt should not be first violation
      const result3 = await checkRateLimit('192.168.1.1', '/api/auth', 'auth');
      expect(result3.success).toBe(false);
      expect(result3.isFirstViolation).toBe(false);
    });

    it('should log authentication attempts', async () => {
      await checkRateLimit('192.168.1.1', '/api/auth', 'auth', 'test-agent', 'user123');

      const events = getSecurityEvents(10, 'AUTH_ATTEMPT');
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'AUTH_ATTEMPT',
        ip: '192.168.1.1',
        endpoint: '/api/auth',
        userAgent: 'test-agent',
        userId: 'user123',
      });
    });

    it('should log rate limit violations', async () => {
      // Clear security events before test
      clearSecurityEvents();
      
      // Exceed rate limit (current limit is 50 for auth)
      for (let i = 0; i < 51; i++) {
        await checkRateLimit('192.168.1.1', '/api/auth', 'auth');
      }

      const events = getSecurityEvents(10, 'RATE_LIMIT_EXCEEDED');
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].ip).toBe('192.168.1.1');
    });

    it('should detect suspicious activity', async () => {
      // Clear security events before test
      clearSecurityEvents();
      
      // Make many attempts to trigger suspicious activity detection (need > 2 * limit)
      // Current auth limit is 50, so we need > 100 attempts
      for (let i = 0; i < 101; i++) {
        await checkRateLimit('192.168.1.1', '/api/auth', 'auth');
      }

      const events = getSecurityEvents(10, 'SUSPICIOUS_ACTIVITY');
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].metadata?.pattern).toBe('excessive_auth_attempts');
    });
  });

  describe('IP Analysis', () => {
    it('should identify suspicious IPs', async () => {
      // Clear all state before test
      clearAllRateLimitData();
      
      // Create enough violations for an IP to be suspicious (need >3 violations)
      // Auth limit is 50 per 15 minutes, so 55 attempts will cause 5 violations
      for (let i = 0; i < 55; i++) {
        await checkRateLimit('192.168.1.1', '/api/auth', 'auth');
      }

      expect(isIPSuspicious('192.168.1.1')).toBe(true);
      expect(isIPSuspicious('192.168.1.2')).toBe(false);
    });

    it('should provide detailed IP analysis', async () => {
      // Clear all state before test
      clearAllRateLimitData();
      
      // Generate some activity for an IP (within limit)
      for (let i = 0; i < 49; i++) {
        await checkRateLimit('192.168.1.1', '/api/auth', 'auth');
      }

      // Exceed rate limit to create violations
      for (let i = 0; i < 5; i++) {
        await checkRateLimit('192.168.1.1', '/api/auth', 'auth');
      }

      const analysis = getIPAnalysis('192.168.1.1');
      expect(analysis.totalAttempts).toBeGreaterThan(0);
      expect(analysis.violations).toBeGreaterThan(0);
      expect(analysis.lastActivity).toBeTypeOf('number');
      expect(['low', 'medium', 'high']).toContain(analysis.riskLevel);
      expect(analysis.isCurrentlyLimited).toBe(true);
    });

    it('should calculate risk levels correctly', async () => {
      // Clear all state before test
      clearAllRateLimitData();
      
      // Low risk - few attempts, no violations
      await checkRateLimit('192.168.1.1', '/api/auth', 'auth');
      let analysis = getIPAnalysis('192.168.1.1');
      expect(analysis.riskLevel).toBe('low');

      // Medium risk - some violations (need >2 violations for medium)
      // Auth limit is 50 per 15 minutes, so 53 attempts will cause 3 violations
      for (let i = 0; i < 53; i++) {
        await checkRateLimit('192.168.1.2', '/api/auth', 'auth');
      }
      analysis = getIPAnalysis('192.168.1.2');
      expect(analysis.riskLevel).toBe('medium');

      // High risk - many violations (need >5 violations for high)
      // 56 attempts will cause 6 violations
      for (let i = 0; i < 56; i++) {
        await checkRateLimit('192.168.1.3', '/api/auth', 'auth');
      }
      analysis = getIPAnalysis('192.168.1.3');
      expect(analysis.riskLevel).toBe('high');
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide rate limit statistics', async () => {
      // Clear all state before test
      clearAllRateLimitData();
      
      // Generate some activity
      await checkRateLimit('192.168.1.1', '/api/auth', 'auth');
      await checkRateLimit('192.168.1.2', '/api/auth', 'auth');

      // Cause a violation (need 51 attempts to exceed current limit of 50)
      for (let i = 0; i < 51; i++) {
        await checkRateLimit('192.168.1.3', '/api/auth', 'auth');
      }

      const stats = getRateLimitStats();
      expect(stats.activeEntries).toBeGreaterThan(0);
      expect(stats.totalSecurityEvents).toBeGreaterThan(0);
      expect(stats.recentViolations).toBeGreaterThan(0);
      expect(Array.isArray(stats.topOffenders)).toBe(true);
    });

    it('should identify top offenders', async () => {
      // Create violations for multiple IPs (need to exceed limit of 50)
      for (let i = 0; i < 53; i++) {
        await checkRateLimit('192.168.1.1', '/api/auth', 'auth');
      }

      for (let i = 0; i < 51; i++) {
        await checkRateLimit('192.168.1.2', '/api/auth', 'auth');
      }

      const stats = getRateLimitStats();
      expect(stats.topOffenders.length).toBeGreaterThan(0);
      expect(stats.topOffenders[0].ip).toBe('192.168.1.1'); // Should be top offender
      expect(stats.topOffenders[0].violations).toBeGreaterThan(0);
    });
  });
});
