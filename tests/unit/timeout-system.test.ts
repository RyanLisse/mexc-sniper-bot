/**
 * Timeout System Test Suite
 * 
 * Tests to verify the timeout utilities and monitoring system work correctly
 * to prevent hanging tests and ensure CI/CD pipeline reliability.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { 
  createTimeoutPromise,
  getTestTimeout,
  globalTimeoutMonitor,
  setTestTimeout,
  TimeoutMonitor,
  timeoutPromise,
  withApiTimeout,
  withDatabaseTimeout,
  withRetryTimeout, 
  withTimeout,
  withWebSocketTimeout
} from '../utils/timeout-utilities';

describe('Timeout System Verification', () => {
  // Set standard timeout for unit tests (3 seconds)
  const TEST_TIMEOUT = setTestTimeout('unit');
  
  let testMonitor: TimeoutMonitor;

  beforeEach(() => {
    testMonitor = new TimeoutMonitor();
    // Reset environment variables for consistent testing
    process.env.ENABLE_TIMEOUT_MONITORING = 'true';
    process.env.TIMEOUT_WARNING_THRESHOLD = '0.8';
    process.env.TIMEOUT_ERROR_REPORTING = 'true';
  });

  afterEach(() => {
    testMonitor.cleanup();
    globalTimeoutMonitor.cleanup();
  });

  describe('Timeout Configuration', () => {
    it('should return correct timeouts for different test types', () => {
      expect(getTestTimeout('unit')).toBe(3000);      // Further optimized for faster tests
      expect(getTestTimeout('integration')).toBe(10000);  // Further optimized for faster tests
      expect(getTestTimeout('auto-sniping')).toBe(8000); // Further optimized for faster tests
      expect(getTestTimeout('performance')).toBe(15000);  // Further optimized for faster tests
      expect(getTestTimeout('safety')).toBe(10000);       // Further optimized for faster tests
      expect(getTestTimeout('agents')).toBe(8000);       // Further optimized for faster tests
      expect(getTestTimeout('e2e')).toBe(30000);          // Further optimized for faster tests
    });

    it('should respect environment variable overrides', () => {
      process.env.TEST_TIMEOUT_UNIT = '15000';
      expect(getTestTimeout('unit')).toBe(15000);
    });

    it('should use fallback values for invalid environment variables', () => {
      process.env.TEST_TIMEOUT_UNIT = 'invalid';
      expect(getTestTimeout('unit')).toBe(3000); // Should fallback to optimized default
    });
  });

  describe('Timeout Wrapper Functions', () => {
    it('should complete fast operations successfully', async () => {
      const result = await withTimeout(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'success';
      }, { testType: 'unit' });

      expect(result.result).toBe('success');
      expect(result.timedOut).toBe(false);
      expect(result.duration).toBeGreaterThan(90);
      expect(result.duration).toBeLessThan(500); // Increased tolerance for test environments
    });

    it('should timeout slow operations', async () => {
      await expect(withTimeout(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return 'should not reach here';
      }, { testType: 'unit', timeout: 200 })).rejects.toThrow('timed out after 200ms');
    });

    it('should provide warnings for operations approaching timeout', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const result = await withTimeout(async () => {
        await new Promise(resolve => setTimeout(resolve, 350));
        return 'completed';
      }, { 
        testType: 'unit', 
        timeout: 400,
        warningThreshold: 0.7,
        enableMonitoring: true 
      });

      expect(result.result).toBe('completed');
      expect(result.warnings.length).toBeGreaterThan(0);
      
      consoleSpy.mockRestore();
    });
  });

  describe('Database Timeout Wrapper', () => {
    it('should complete fast database operations', async () => {
      const mockDbOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { rows: [{ id: 1, name: 'test' }] };
      };

      const result = await withDatabaseTimeout(mockDbOperation);
      expect(result.rows).toHaveLength(1);
    });

    it('should timeout slow database operations', async () => {
      const slowDbOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { rows: [] };
      };

      await expect(withDatabaseTimeout(slowDbOperation, 200))
        .rejects.toThrow('database operation');
    });
  });

  describe('API Timeout Wrapper', () => {
    it('should complete fast API operations', async () => {
      const mockApiCall = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { data: 'api response' };
      };

      const result = await withApiTimeout(mockApiCall);
      expect(result.data).toBe('api response');
    });

    it('should timeout slow API operations', async () => {
      const slowApiCall = async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { data: 'should not reach here' };
      };

      await expect(withApiTimeout(slowApiCall, 200))
        .rejects.toThrow('API operation');
    });
  });

  describe('WebSocket Timeout Wrapper', () => {
    it('should complete fast WebSocket operations', async () => {
      const mockWsOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { connected: true };
      };

      const result = await withWebSocketTimeout(mockWsOperation);
      expect(result.connected).toBe(true);
    });

    it('should timeout slow WebSocket operations', async () => {
      const slowWsOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { connected: false };
      };

      await expect(withWebSocketTimeout(slowWsOperation, 200))
        .rejects.toThrow('WebSocket operation');
    });
  });

  describe('Timeout Monitor', () => {
    it('should track active timeouts and intervals', () => {
      const timeout1 = testMonitor.setTimeout(() => {}, 1000);
      const timeout2 = testMonitor.setTimeout(() => {}, 2000);
      const interval1 = testMonitor.setInterval(() => {}, 500);

      const activeCount = testMonitor.getActiveCount();
      expect(activeCount.timeouts).toBe(2);
      expect(activeCount.intervals).toBe(1);

      testMonitor.clearTimeout(timeout1);
      const afterClearCount = testMonitor.getActiveCount();
      expect(afterClearCount.timeouts).toBe(1);
      expect(afterClearCount.intervals).toBe(1);
    });

    it('should cleanup all tracked timeouts and intervals', () => {
      testMonitor.setTimeout(() => {}, 1000);
      testMonitor.setTimeout(() => {}, 2000);
      testMonitor.setInterval(() => {}, 500);
      testMonitor.setInterval(() => {}, 1000);

      expect(testMonitor.getActiveCount().timeouts).toBe(2);
      expect(testMonitor.getActiveCount().intervals).toBe(2);

      testMonitor.cleanup();

      expect(testMonitor.getActiveCount().timeouts).toBe(0);
      expect(testMonitor.getActiveCount().intervals).toBe(0);
    });
  });

  describe('Retry with Timeout', () => {
    it('should succeed on first attempt', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        return `success on attempt ${attempts}`;
      };

      const result = await withRetryTimeout(operation, {
        maxRetries: 3,
        timeout: 1000,
        testType: 'unit'
      });

      expect(result).toBe('success on attempt 1');
      expect(attempts).toBe(1);
    });

    it('should retry failed operations', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error(`Attempt ${attempts} failed`);
        }
        return `success on attempt ${attempts}`;
      };

      const result = await withRetryTimeout(operation, {
        maxRetries: 3,
        timeout: 1000,
        retryDelay: 100,
        testType: 'unit'
      });

      expect(result).toBe('success on attempt 3');
      expect(attempts).toBe(3);
    });

    it('should fail after max retries', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        throw new Error(`Attempt ${attempts} failed`);
      };

      await expect(withRetryTimeout(operation, {
        maxRetries: 2,
        timeout: 1000,
        retryDelay: 100,
        testType: 'unit'
      })).rejects.toThrow('Operation failed after 2 attempts');

      expect(attempts).toBe(2);
    });

    it('should timeout during retry operations', async () => {
      const operation = async () => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return 'should not reach here';
      };

      await expect(withRetryTimeout(operation, {
        maxRetries: 3,
        timeout: 500,
        testType: 'unit'
      })).rejects.toThrow('Operation failed after 3 attempts');
    });
  });

  describe('Enhanced Promise Timeout', () => {
    it('should complete fast promises with performance monitoring', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const fastPromise = new Promise<string>(resolve => {
        setTimeout(() => resolve('fast result'), 50);
      });

      const result = await timeoutPromise(fastPromise, 1000, 'Fast operation');
      expect(result).toBe('fast result');
      
      // Should not warn for fast operations
      expect(consoleSpy).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should warn for slow but successful operations', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const slowPromise = new Promise<string>(resolve => {
        setTimeout(() => resolve('slow result'), 350);
      });

      const result = await timeoutPromise(slowPromise, 400, 'Slow operation');
      expect(result).toBe('slow result');
      
      // Should warn since operation took >70% of timeout
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Slow operation took')
      );
      
      consoleSpy.mockRestore();
    });

    it('should timeout extremely slow operations', async () => {
      const verySlowPromise = new Promise<string>(resolve => {
        setTimeout(() => resolve('should not complete'), 1000);
      });

      await expect(timeoutPromise(verySlowPromise, 200, 'Very slow operation'))
        .rejects.toThrow('Very slow operation timed out after 200ms');
    });
  });

  describe('Global Timeout Monitor Integration', () => {
    it('should integrate with global timeout monitor', () => {
      const initialCount = globalTimeoutMonitor.getActiveCount();
      
      globalTimeoutMonitor.setTimeout(() => {}, 1000);
      globalTimeoutMonitor.setInterval(() => {}, 500);
      
      const afterAddCount = globalTimeoutMonitor.getActiveCount();
      expect(afterAddCount.timeouts).toBe(initialCount.timeouts + 1);
      expect(afterAddCount.intervals).toBe(initialCount.intervals + 1);
      
      globalTimeoutMonitor.cleanup();
      
      const afterCleanupCount = globalTimeoutMonitor.getActiveCount();
      expect(afterCleanupCount.timeouts).toBe(0);
      expect(afterCleanupCount.intervals).toBe(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle operations that throw non-timeout errors', async () => {
      const operation = async () => {
        throw new Error('Business logic error');
      };

      await expect(withTimeout(operation, { testType: 'unit' }))
        .rejects.toThrow('Business logic error');
    });

    it('should handle invalid timeout configurations gracefully', () => {
      process.env.TEST_TIMEOUT_UNIT = '-1000';
      expect(getTestTimeout('unit')).toBe(3000); // Should use optimized fallback
    });

    it('should work with monitoring disabled', async () => {
      process.env.ENABLE_TIMEOUT_MONITORING = 'false';
      
      const result = await withTimeout(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'completed';
      }, { testType: 'unit', enableMonitoring: false });

      expect(result.result).toBe('completed');
      expect(result.warnings).toHaveLength(0);
    });
  });
});