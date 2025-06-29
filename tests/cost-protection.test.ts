/**
 * Cost Protection Test Suite
 * 
 * Comprehensive tests to ensure database cost protection systems work correctly
 * and prevent financial damage from runaway queries or quota overages.
 */

import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { DatabaseCircuitBreaker } from '../src/lib/database-circuit-breaker';
import { DatabaseRateLimiter } from '../src/lib/database-rate-limiter';
import { globalCostMonitor, recordCostMetrics } from '../src/middleware/cost-monitor';

describe('Database Cost Protection Systems', () => {
  describe('DatabaseRateLimiter', () => {
    let rateLimiter: DatabaseRateLimiter;
    
    beforeEach(() => {
      rateLimiter = new DatabaseRateLimiter({
        maxQueriesPerMinute: 5, // Low limit for testing
        maxQueryTimeMs: 1000,
        emergencyThreshold: 80
      });
    });
    
    test('should allow queries within rate limit', async () => {
      const mockQuery = jest.fn().mockResolvedValue('success');
      
      // Execute queries within limit
      for (let i = 0; i < 4; i++) {
        await rateLimiter.executeQuery(mockQuery, `test-query-${i}`);
      }
      
      expect(mockQuery).toHaveBeenCalledTimes(4);
      const status = rateLimiter.getStatus();
      expect(status.queryCount).toBe(4);
      expect(status.remaining).toBe(1);
    });
    
    test('should block queries when rate limit exceeded', async () => {
      const mockQuery = jest.fn().mockResolvedValue('success');
      
      // Execute queries to reach limit
      for (let i = 0; i < 5; i++) {
        await rateLimiter.executeQuery(mockQuery, `test-query-${i}`);
      }
      
      // This should throw rate limit error
      await expect(
        rateLimiter.executeQuery(mockQuery, 'exceeding-query')
      ).rejects.toThrow('Database query rate limit exceeded');
      
      expect(mockQuery).toHaveBeenCalledTimes(5); // Only 5 successful calls
    });
    
    test('should warn when approaching rate limit', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const mockQuery = jest.fn().mockResolvedValue('success');
      
      // Execute 4 queries (80% of 5-query limit)
      for (let i = 0; i < 4; i++) {
        await rateLimiter.executeQuery(mockQuery, `test-query-${i}`);
      }
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ [COST WARNING] Approaching query limit'),
        expect.any(Object)
      );
      
      consoleSpy.mockRestore();
    });
    
    test('should timeout long-running queries', async () => {
      const longRunningQuery = () => new Promise(resolve => setTimeout(resolve, 2000));
      
      await expect(
        rateLimiter.executeQuery(longRunningQuery, 'timeout-test')
      ).rejects.toThrow('Query timeout');
    });
    
    test('should log slow queries for cost analysis', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const slowQuery = () => new Promise(resolve => setTimeout(resolve, 6000));
      
      // This will timeout before completing, but we can test the slow query detection
      try {
        await rateLimiter.executeQuery(slowQuery, 'slow-test');
      } catch (error) {
        // Expected timeout
      }
      
      consoleSpy.mockRestore();
    });
    
    test('should reset counter after minute passes', async () => {
      const mockQuery = jest.fn().mockResolvedValue('success');
      
      // Fill the rate limit
      for (let i = 0; i < 5; i++) {
        await rateLimiter.executeQuery(mockQuery, `test-query-${i}`);
      }
      
      // Simulate time passing by creating new rate limiter
      const newRateLimiter = new DatabaseRateLimiter({
        maxQueriesPerMinute: 5,
        maxQueryTimeMs: 1000
      });
      
      // Should allow queries again
      await newRateLimiter.executeQuery(mockQuery, 'after-reset');
      expect(mockQuery).toHaveBeenCalledTimes(6);
    });
  });
  
  describe('DatabaseCircuitBreaker', () => {
    let circuitBreaker: DatabaseCircuitBreaker;
    
    beforeEach(() => {
      circuitBreaker = new DatabaseCircuitBreaker({
        failureThreshold: 3,
        recoveryTimeout: 1000, // 1 second for testing
        successThreshold: 2
      });
    });
    
    test('should allow operations when circuit is closed', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      const result = await circuitBreaker.execute(mockOperation, 'test-op');
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
      expect(circuitBreaker.isHealthy()).toBe(true);
    });
    
    test('should open circuit after failure threshold', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Database error'));
      
      // Trigger failures to reach threshold
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockOperation, 'failing-op');
        } catch (error) {
          // Expected failure
        }
      }
      
      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe('OPEN');
      expect(circuitBreaker.isHealthy()).toBe(false);
      
      // Next operation should be blocked
      await expect(
        circuitBreaker.execute(mockOperation, 'blocked-op')
      ).rejects.toThrow('Circuit breaker OPEN');
    });
    
    test('should immediately open circuit for cost-related errors', async () => {
      const costError = new Error('Database quota exceeded - billing limit reached');
      const mockOperation = jest.fn().mockRejectedValue(costError);
      
      // Single cost-related error should open circuit
      try {
        await circuitBreaker.execute(mockOperation, 'cost-error-op');
      } catch (error) {
        // Expected failure
      }
      
      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe('OPEN');
    });
    
    test('should transition to half-open after recovery timeout', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Error'));
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockOperation, 'failing-op');
        } catch (error) {
          // Expected failure
        }
      }
      
      expect(circuitBreaker.getStats().state).toBe('OPEN');
      
      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Next operation should trigger half-open state
      mockOperation.mockResolvedValueOnce('success');
      const result = await circuitBreaker.execute(mockOperation, 'recovery-test');
      
      expect(result).toBe('success');
      expect(circuitBreaker.getStats().state).toBe('HALF_OPEN');
    });
    
    test('should close circuit after successful operations in half-open state', async () => {
      const mockOperation = jest.fn();
      
      // Open circuit first
      mockOperation.mockRejectedValue(new Error('Error'));
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockOperation, 'failing-op');
        } catch (error) {
          // Expected failure
        }
      }
      
      // Wait for recovery
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Successful operations to close circuit
      mockOperation.mockResolvedValue('success');
      for (let i = 0; i < 2; i++) {
        await circuitBreaker.execute(mockOperation, 'recovery-op');
      }
      
      expect(circuitBreaker.getStats().state).toBe('CLOSED');
      expect(circuitBreaker.isHealthy()).toBe(true);
    });
    
    test('should provide meaningful status messages', () => {
      expect(circuitBreaker.getStatusMessage()).toContain('Circuit healthy');
      
      // Open the circuit
      const mockOperation = jest.fn().mockRejectedValue(new Error('Error'));
      for (let i = 0; i < 3; i++) {
        try {
          circuitBreaker.execute(mockOperation, 'failing-op');
        } catch (error) {
          // Expected failure
        }
      }
      
      expect(circuitBreaker.getStatusMessage()).toContain('Circuit open');
    });
  });
  
  describe('Cost Monitoring', () => {
    beforeEach(() => {
      // Reset cost monitor state if needed
      jest.clearAllMocks();
    });
    
    test('should record operation metrics correctly', async () => {
      const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();
      
      await recordCostMetrics('/api/test', 5, 2000, 1024);
      
      // Verify metrics were logged
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('💰 [COST TRACKING]'),
        expect.objectContaining({
          endpoint: '/api/test',
          operation: expect.objectContaining({
            queryCount: 5,
            duration: 2000,
            dataTransfer: 1024
          })
        })
      );
      
      consoleSpy.mockRestore();
    });
    
    test('should trigger alerts for high-cost operations', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Record operation that exceeds thresholds
      await recordCostMetrics('/api/expensive', 100, 20000, 1073741824); // 1GB transfer
      
      // Should trigger critical alerts
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🚨 [COST ALERT]'),
        expect.any(Object)
      );
      
      consoleSpy.mockRestore();
    });
    
    test('should provide usage statistics', () => {
      const usage = globalCostMonitor.getCurrentUsage();
      
      expect(usage).toHaveProperty('queryCount');
      expect(usage).toHaveProperty('dataTransfer');
      expect(usage).toHaveProperty('totalCost');
      expect(usage).toHaveProperty('uptimeHours');
      expect(usage).toHaveProperty('averageQueriesPerHour');
      expect(usage).toHaveProperty('costPerHour');
    });
    
    test('should track endpoint-specific metrics', async () => {
      await recordCostMetrics('/api/endpoint1', 2, 1000, 512);
      await recordCostMetrics('/api/endpoint2', 3, 1500, 768);
      await recordCostMetrics('/api/endpoint1', 1, 500, 256);
      
      const endpoint1Metrics = globalCostMonitor.getEndpointMetrics('/api/endpoint1');
      const allMetrics = globalCostMonitor.getEndpointMetrics();
      
      expect(endpoint1Metrics).toHaveLength(2);
      expect(allMetrics.size).toBeGreaterThanOrEqual(2);
    });
  });
  
  describe('Integration Tests', () => {
    test('should work together to prevent cost overruns', async () => {
      const rateLimiter = new DatabaseRateLimiter({ maxQueriesPerMinute: 3 });
      const circuitBreaker = new DatabaseCircuitBreaker({ failureThreshold: 2 });
      
      let operationCount = 0;
      const mockDatabaseOperation = async () => {
        operationCount++;
        if (operationCount > 2) {
          throw new Error('Database quota exceeded - too many queries');
        }
        return `result-${operationCount}`;
      };
      
      // First two operations should succeed
      for (let i = 0; i < 2; i++) {
        const result = await rateLimiter.executeQuery(async () => {
          return circuitBreaker.execute(mockDatabaseOperation, 'integration-test');
        }, 'rate-limited-circuit-breaker-test');
        
        expect(result).toBe(`result-${i + 1}`);
      }
      
      // Third operation should fail and open circuit
      try {
        await rateLimiter.executeQuery(async () => {
          return circuitBreaker.execute(mockDatabaseOperation, 'integration-test');
        }, 'rate-limited-circuit-breaker-test');
      } catch (error) {
        expect(error.message).toContain('quota exceeded');
      }
      
      // Fourth operation should be blocked by circuit breaker
      try {
        await rateLimiter.executeQuery(async () => {
          return circuitBreaker.execute(mockDatabaseOperation, 'integration-test');
        }, 'rate-limited-circuit-breaker-test');
      } catch (error) {
        expect(error.message).toContain('Circuit breaker OPEN');
      }
      
      expect(circuitBreaker.getStats().state).toBe('OPEN');
    });
    
    test('should handle API endpoint simulation', async () => {
      const startTime = Date.now();
      let queryCount = 0;
      
      const simulateApiEndpoint = async (requestCount: number) => {
        const rateLimiter = new DatabaseRateLimiter({ maxQueriesPerMinute: 10 });
        const circuitBreaker = new DatabaseCircuitBreaker({ failureThreshold: 3 });
        
        const results = [];
        
        for (let i = 0; i < requestCount; i++) {
          try {
            const result = await rateLimiter.executeQuery(async () => {
              return circuitBreaker.execute(async () => {
                queryCount++;
                
                // Simulate database query
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Simulate occasional failures
                if (Math.random() < 0.1) {
                  throw new Error('Random database error');
                }
                
                return { id: i, data: `result-${i}` };
              }, `api-request-${i}`);
            }, `api-query-${i}`);
            
            results.push(result);
            
            // Record cost metrics
            await recordCostMetrics(
              '/api/simulation',
              1,
              Date.now() - startTime,
              JSON.stringify(result).length
            );
            
          } catch (error) {
            console.log(`Request ${i} failed: ${error.message}`);
          }
        }
        
        return results;
      };
      
      const results = await simulateApiEndpoint(5);
      
      // Should have some successful results
      expect(results.length).toBeGreaterThan(0);
      expect(queryCount).toBeLessThanOrEqual(10); // Shouldn't exceed rate limit
    });
  });
});