/**
 * Test Suite for Extracted Cache Manager Schemas
 * 
 * Following TDD approach: writing tests before extracting cache management-related
 * types and interfaces from cache-manager.ts
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  CacheAnalyticsSchema,
  CacheCleanupResultSchema,
  CacheConfigSchema,
  CacheDataTypeSchema,
  CacheEntrySchema,
  CacheInvalidationStrategySchema,
  CacheMetricsSchema,
  CacheOptimizationResultSchema,
  CacheSizeBreakdownSchema,
  TTLConfigSchema,
} from '@/src/schemas/cache-manager-schemas-extracted';

describe('Cache Manager Schemas - TDD Extraction Tests', () => {
  describe('CacheEntrySchema', () => {
    it('should validate complete cache entry with all fields', () => {
      const validEntry = {
        key: 'cache-key-123',
        value: { result: 'test data', items: [1, 2, 3] },
        timestamp: Date.now(),
        expiresAt: Date.now() + 300000,
        accessCount: 25,
        lastAccessed: Date.now() - 60000,
        metadata: {
          type: 'api_response',
          source: 'mexc-api',
          size: 1024,
          dependencies: ['user-session', 'market-data']
        }
      };

      expect(() => {
        CacheEntrySchema.parse(validEntry);
      }).not.toThrow();
    });

    it('should validate minimal cache entry without metadata', () => {
      const minimalEntry = {
        key: 'simple-key',
        value: 'simple string value',
        timestamp: Date.now(),
        expiresAt: Date.now() + 60000,
        accessCount: 0,
        lastAccessed: Date.now()
      };

      expect(() => {
        CacheEntrySchema.parse(minimalEntry);
      }).not.toThrow();
    });

    it('should validate cache entry with complex nested value', () => {
      const complexEntry = {
        key: 'nested-data',
        value: {
          user: { id: 123, name: 'Test User' },
          preferences: { theme: 'dark', notifications: true },
          history: [
            { action: 'login', timestamp: Date.now() },
            { action: 'view_dashboard', timestamp: Date.now() }
          ]
        },
        timestamp: Date.now(),
        expiresAt: Date.now() + 1800000,
        accessCount: 5,
        lastAccessed: Date.now() - 30000,
        metadata: {
          type: 'session_data',
          source: 'user-service',
          size: 2048
        }
      };

      expect(() => {
        CacheEntrySchema.parse(complexEntry);
      }).not.toThrow();
    });

    it('should reject invalid cache entry with missing required fields', () => {
      const invalidEntry = {
        key: '',  // invalid empty string
        value: { result: 'test' },
        timestamp: 'not-a-number',  // invalid type
        expiresAt: Date.now() + 300000,
        accessCount: -5,  // invalid negative
        lastAccessed: Date.now()
      };

      expect(() => {
        CacheEntrySchema.parse(invalidEntry);
      }).toThrow();
    });
  });

  describe('CacheConfigSchema', () => {
    it('should validate complete cache configuration', () => {
      const validConfig = {
        maxSize: 5000,
        defaultTTL: 300000,  // 5 minutes
        cleanupInterval: 600000,  // 10 minutes
        enableMetrics: true,
        enablePersistence: true,
        persistenceFile: '/var/cache/app-cache.json'
      };

      expect(() => {
        CacheConfigSchema.parse(validConfig);
      }).not.toThrow();
    });

    it('should validate minimal cache configuration', () => {
      const minimalConfig = {
        maxSize: 1000,
        defaultTTL: 60000,
        cleanupInterval: 120000,
        enableMetrics: false
      };

      expect(() => {
        CacheConfigSchema.parse(minimalConfig);
      }).not.toThrow();
    });

    it('should validate disabled cleanup configuration', () => {
      const noCleanupConfig = {
        maxSize: 2000,
        defaultTTL: 180000,
        cleanupInterval: 0,  // Disabled cleanup
        enableMetrics: true,
        enablePersistence: false
      };

      expect(() => {
        CacheConfigSchema.parse(noCleanupConfig);
      }).not.toThrow();
    });

    it('should reject invalid cache configuration', () => {
      const invalidConfig = {
        maxSize: -1000,  // invalid negative
        defaultTTL: 'forever',  // invalid type
        cleanupInterval: 600000,
        enableMetrics: 'yes',  // invalid type
        enablePersistence: true,
        persistenceFile: 123  // invalid type
      };

      expect(() => {
        CacheConfigSchema.parse(invalidConfig);
      }).toThrow();
    });
  });

  describe('CacheMetricsSchema', () => {
    it('should validate complete cache metrics', () => {
      const validMetrics = {
        hits: 1500,
        misses: 250,
        sets: 1750,
        deletes: 150,
        evictions: 75,
        totalSize: 4250,
        memoryUsage: 4352000,  // bytes
        hitRate: 85.71,
        averageAccessTime: 2.5,
        lastCleanup: Date.now()
      };

      expect(() => {
        CacheMetricsSchema.parse(validMetrics);
      }).not.toThrow();
    });

    it('should validate empty cache metrics', () => {
      const emptyMetrics = {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        evictions: 0,
        totalSize: 0,
        memoryUsage: 0,
        hitRate: 0,
        averageAccessTime: 0,
        lastCleanup: Date.now()
      };

      expect(() => {
        CacheMetricsSchema.parse(emptyMetrics);
      }).not.toThrow();
    });

    it('should validate high-activity cache metrics', () => {
      const highActivityMetrics = {
        hits: 50000,
        misses: 5000,
        sets: 55000,
        deletes: 10000,
        evictions: 2500,
        totalSize: 4800,
        memoryUsage: 4915200,
        hitRate: 90.91,
        averageAccessTime: 1.2,
        lastCleanup: Date.now() - 300000
      };

      expect(() => {
        CacheMetricsSchema.parse(highActivityMetrics);
      }).not.toThrow();
    });

    it('should reject invalid cache metrics', () => {
      const invalidMetrics = {
        hits: -100,  // invalid negative
        misses: 250,
        sets: 'many',  // invalid type
        deletes: 150,
        evictions: 75,
        totalSize: 4250,
        memoryUsage: 4352000,
        hitRate: 150,  // invalid > 100
        averageAccessTime: -2.5,  // invalid negative
        lastCleanup: 'yesterday'  // invalid type
      };

      expect(() => {
        CacheMetricsSchema.parse(invalidMetrics);
      }).toThrow();
    });
  });

  describe('CacheAnalyticsSchema', () => {
    it('should validate complete cache analytics', () => {
      const validAnalytics = {
        performance: {
          hits: 1500,
          misses: 250,
          sets: 1750,
          deletes: 150,
          evictions: 75,
          totalSize: 4250,
          memoryUsage: 4352000,
          hitRate: 85.71,
          averageAccessTime: 2.5,
          lastCleanup: Date.now()
        },
        topKeys: [
          { key: 'user-session-123', hits: 150, lastAccessed: Date.now() },
          { key: 'api-response-456', hits: 120, lastAccessed: Date.now() - 30000 },
          { key: 'pattern-data-789', hits: 95, lastAccessed: Date.now() - 60000 }
        ],
        typeBreakdown: {
          api_response: { count: 500, size: 512000, hitRate: 88.5 },
          session_data: { count: 200, size: 204800, hitRate: 92.1 },
          pattern_detection: { count: 150, size: 153600, hitRate: 75.2 },
          query_result: { count: 300, size: 307200, hitRate: 82.7 }
        },
        recommendations: [
          'Increase TTL for session_data (high hit rate)',
          'Review pattern_detection caching strategy (low hit rate)',
          'Consider L2 cache optimization for api_response'
        ]
      };

      expect(() => {
        CacheAnalyticsSchema.parse(validAnalytics);
      }).not.toThrow();
    });

    it('should validate analytics with empty collections', () => {
      const emptyAnalytics = {
        performance: {
          hits: 0,
          misses: 0,
          sets: 0,
          deletes: 0,
          evictions: 0,
          totalSize: 0,
          memoryUsage: 0,
          hitRate: 0,
          averageAccessTime: 0,
          lastCleanup: Date.now()
        },
        topKeys: [],
        typeBreakdown: {},
        recommendations: []
      };

      expect(() => {
        CacheAnalyticsSchema.parse(emptyAnalytics);
      }).not.toThrow();
    });

    it('should reject invalid cache analytics', () => {
      const invalidAnalytics = {
        performance: {
          hits: 'many',  // invalid type in nested metrics
          misses: 250,
          sets: 1750,
          deletes: 150,
          evictions: 75,
          totalSize: 4250,
          memoryUsage: 4352000,
          hitRate: 85.71,
          averageAccessTime: 2.5,
          lastCleanup: Date.now()
        },
        topKeys: 'no-keys',  // should be array
        typeBreakdown: {
          api_response: { count: -500, size: 512000, hitRate: 88.5 }  // invalid negative count
        },
        recommendations: 'no recommendations'  // should be array
      };

      expect(() => {
        CacheAnalyticsSchema.parse(invalidAnalytics);
      }).toThrow();
    });
  });

  describe('CacheDataTypeSchema', () => {
    it('should validate all supported cache data types', () => {
      const validTypes = [
        'agent_response',
        'api_response', 
        'pattern_detection',
        'query_result',
        'session_data',
        'user_preferences',
        'workflow_result',
        'performance_metrics',
        'health_status'
      ];

      validTypes.forEach(type => {
        expect(() => {
          CacheDataTypeSchema.parse(type);
        }).not.toThrow();
      });
    });

    it('should reject invalid cache data types', () => {
      const invalidTypes = [
        'unknown_type',
        'custom_data',
        '',
        123,
        null,
        undefined
      ];

      invalidTypes.forEach(type => {
        expect(() => {
          CacheDataTypeSchema.parse(type);
        }).toThrow();
      });
    });
  });

  describe('CacheInvalidationStrategySchema', () => {
    it('should validate all supported invalidation strategies', () => {
      const validStrategies = [
        'time_based',
        'event_based', 
        'manual',
        'smart'
      ];

      validStrategies.forEach(strategy => {
        expect(() => {
          CacheInvalidationStrategySchema.parse(strategy);
        }).not.toThrow();
      });
    });

    it('should reject invalid invalidation strategies', () => {
      const invalidStrategies = [
        'automatic',
        'hybrid',
        'aggressive',
        '',
        123,
        true
      ];

      invalidStrategies.forEach(strategy => {
        expect(() => {
          CacheInvalidationStrategySchema.parse(strategy);
        }).toThrow();
      });
    });
  });

  describe('TTLConfigSchema', () => {
    it('should validate complete TTL configuration', () => {
      const validTTLConfig = {
        agent_response: 300000,       // 5 minutes
        api_response: 120000,         // 2 minutes
        pattern_detection: 600000,    // 10 minutes
        query_result: 60000,          // 1 minute
        session_data: 1800000,        // 30 minutes
        user_preferences: 3600000,    // 1 hour
        workflow_result: 900000,      // 15 minutes
        performance_metrics: 30000,   // 30 seconds
        health_status: 15000          // 15 seconds
      };

      expect(() => {
        TTLConfigSchema.parse(validTTLConfig);
      }).not.toThrow();
    });

    it('should validate minimal TTL configuration', () => {
      const minimalTTLConfig = {
        agent_response: 60000,
        api_response: 60000,
        pattern_detection: 60000,
        query_result: 60000,
        session_data: 60000,
        user_preferences: 60000,
        workflow_result: 60000,
        performance_metrics: 60000,
        health_status: 60000
      };

      expect(() => {
        TTLConfigSchema.parse(minimalTTLConfig);
      }).not.toThrow();
    });

    it('should reject invalid TTL configuration', () => {
      const invalidTTLConfig = {
        agent_response: -300000,      // invalid negative
        api_response: 120000,
        pattern_detection: 'forever', // invalid type
        query_result: 60000,
        session_data: 1800000,
        user_preferences: 3600000,
        workflow_result: 0,           // invalid zero
        performance_metrics: 30000,
        health_status: 15000
      };

      expect(() => {
        TTLConfigSchema.parse(invalidTTLConfig);
      }).toThrow();
    });
  });

  describe('CacheSizeBreakdownSchema', () => {
    it('should validate cache size breakdown', () => {
      const validBreakdown = {
        L1: 1500,
        L2: 2500,
        L3: 1000,
        total: 5000
      };

      expect(() => {
        CacheSizeBreakdownSchema.parse(validBreakdown);
      }).not.toThrow();
    });

    it('should validate empty cache breakdown', () => {
      const emptyBreakdown = {
        L1: 0,
        L2: 0,
        L3: 0,
        total: 0
      };

      expect(() => {
        CacheSizeBreakdownSchema.parse(emptyBreakdown);
      }).not.toThrow();
    });

    it('should reject invalid cache breakdown', () => {
      const invalidBreakdown = {
        L1: -100,        // invalid negative
        L2: 2500,
        L3: 'unknown',   // invalid type
        total: 5000
      };

      expect(() => {
        CacheSizeBreakdownSchema.parse(invalidBreakdown);
      }).toThrow();
    });
  });

  describe('CacheCleanupResultSchema', () => {
    it('should validate cache cleanup results', () => {
      const validResult = {
        L1: 25,
        L2: 150,
        L3: 75,
        total: 250
      };

      expect(() => {
        CacheCleanupResultSchema.parse(validResult);
      }).not.toThrow();
    });

    it('should validate no cleanup needed result', () => {
      const noCleanupResult = {
        L1: 0,
        L2: 0, 
        L3: 0,
        total: 0
      };

      expect(() => {
        CacheCleanupResultSchema.parse(noCleanupResult);
      }).not.toThrow();
    });

    it('should reject invalid cleanup result', () => {
      const invalidResult = {
        L1: 25,
        L2: -150,        // invalid negative
        L3: 75,
        total: 'many'    // invalid type
      };

      expect(() => {
        CacheCleanupResultSchema.parse(invalidResult);
      }).toThrow();
    });
  });

  describe('CacheOptimizationResultSchema', () => {
    it('should validate cache optimization results', () => {
      const validOptimization = {
        evicted: 125,
        promoted: 75
      };

      expect(() => {
        CacheOptimizationResultSchema.parse(validOptimization);
      }).not.toThrow();
    });

    it('should validate no optimization needed result', () => {
      const noOptimizationResult = {
        evicted: 0,
        promoted: 0
      };

      expect(() => {
        CacheOptimizationResultSchema.parse(noOptimizationResult);
      }).not.toThrow();
    });

    it('should reject invalid optimization result', () => {
      const invalidOptimization = {
        evicted: -125,      // invalid negative  
        promoted: 'many'    // invalid type
      };

      expect(() => {
        CacheOptimizationResultSchema.parse(invalidOptimization);
      }).toThrow();
    });
  });

  describe('Schema Integration Tests', () => {
    it('should validate complete cache management workflow', () => {
      const workflowData = {
        config: {
          maxSize: 5000,
          defaultTTL: 300000,
          cleanupInterval: 600000,
          enableMetrics: true,
          enablePersistence: true
        },
        entry: {
          key: 'workflow-test-key',
          value: { result: 'workflow test data' },
          timestamp: Date.now(),
          expiresAt: Date.now() + 300000,
          accessCount: 5,
          lastAccessed: Date.now(),
          metadata: {
            type: 'workflow_result',
            source: 'test-service',
            size: 512
          }
        },
        metrics: {
          hits: 1000,
          misses: 200,
          sets: 1200,
          deletes: 100,
          evictions: 50,
          totalSize: 3500,
          memoryUsage: 3584000,
          hitRate: 83.33,
          averageAccessTime: 2.1,
          lastCleanup: Date.now()
        },
        breakdown: {
          L1: 1000,
          L2: 1500,
          L3: 1000,
          total: 3500
        }
      };

      expect(() => {
        CacheConfigSchema.parse(workflowData.config);
        CacheEntrySchema.parse(workflowData.entry);
        CacheMetricsSchema.parse(workflowData.metrics);
        CacheSizeBreakdownSchema.parse(workflowData.breakdown);
      }).not.toThrow();
    });

    it('should validate cache analytics integration', () => {
      const analyticsData = {
        ttlConfig: {
          agent_response: 300000,
          api_response: 120000,
          pattern_detection: 600000,
          query_result: 60000,
          session_data: 1800000,
          user_preferences: 3600000,
          workflow_result: 900000,
          performance_metrics: 30000,
          health_status: 15000
        },
        dataType: 'pattern_detection',
        strategy: 'smart',
        cleanupResult: {
          L1: 10,
          L2: 25,
          L3: 15,
          total: 50
        },
        optimizationResult: {
          evicted: 30,
          promoted: 20
        }
      };

      expect(() => {
        TTLConfigSchema.parse(analyticsData.ttlConfig);
        CacheDataTypeSchema.parse(analyticsData.dataType);
        CacheInvalidationStrategySchema.parse(analyticsData.strategy);
        CacheCleanupResultSchema.parse(analyticsData.cleanupResult);
        CacheOptimizationResultSchema.parse(analyticsData.optimizationResult);
      }).not.toThrow();
    });
  });
});