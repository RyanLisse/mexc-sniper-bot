/**
 * Test Suite for Extracted Agent Cache Schemas
 * 
 * Following TDD approach: writing tests before extracting agent cache-related
 * types and interfaces from enhanced-agent-cache.ts
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  AgentCacheConfigSchema,
  AgentCacheMetricsSchema,
  CachedAgentResponseSchema,
  WorkflowCacheEntrySchema,
  AgentHealthCacheSchema,
  AgentCacheAnalyticsSchema,
} from '@/src/schemas/agent-cache-schemas-extracted';

describe('Agent Cache Schemas - TDD Extraction Tests', () => {
  describe('AgentCacheConfigSchema', () => {
    it('should validate valid agent cache configuration', () => {
      const validConfig = {
        defaultTTL: 300000, // 5 minutes
        maxRetries: 3,
        enablePerformanceTracking: true,
        enableWorkflowCaching: true,
        enableHealthCaching: true,
        cacheWarmupEnabled: true
      };

      expect(() => {
        AgentCacheConfigSchema.parse(validConfig);
      }).not.toThrow();
    });

    it('should validate minimal agent cache configuration', () => {
      const minimalConfig = {
        defaultTTL: 60000, // 1 minute
        maxRetries: 1,
        enablePerformanceTracking: false,
        enableWorkflowCaching: false,
        enableHealthCaching: false,
        cacheWarmupEnabled: false
      };

      expect(() => {
        AgentCacheConfigSchema.parse(minimalConfig);
      }).not.toThrow();
    });

    it('should reject invalid agent cache configuration', () => {
      const invalidConfig = {
        defaultTTL: -5000, // invalid negative
        maxRetries: 0, // invalid zero
        enablePerformanceTracking: 'yes', // invalid type
        enableWorkflowCaching: true,
        enableHealthCaching: true,
        cacheWarmupEnabled: true
      };

      expect(() => {
        AgentCacheConfigSchema.parse(invalidConfig);
      }).toThrow();
    });
  });

  describe('AgentCacheMetricsSchema', () => {
    it('should validate complete agent cache metrics', () => {
      const validMetrics = {
        agentId: 'agent-001',
        totalExecutions: 1500,
        successfulExecutions: 1425,
        failedExecutions: 75,
        avgResponseTime: 250.5,
        errorRate: 5.0,
        lastActivity: Date.now(),
        cacheHits: 850,
        cacheSets: 1500,
        throughput: 12.5
      };

      expect(() => {
        AgentCacheMetricsSchema.parse(validMetrics);
      }).not.toThrow();
    });

    it('should validate metrics with zero values', () => {
      const zeroMetrics = {
        agentId: 'agent-new',
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        avgResponseTime: 0,
        errorRate: 0,
        lastActivity: Date.now(),
        cacheHits: 0,
        cacheSets: 0,
        throughput: 0
      };

      expect(() => {
        AgentCacheMetricsSchema.parse(zeroMetrics);
      }).not.toThrow();
    });

    it('should reject invalid agent cache metrics', () => {
      const invalidMetrics = {
        agentId: '', // invalid empty string
        totalExecutions: -100, // invalid negative
        successfulExecutions: 1425,
        failedExecutions: 'many', // invalid type
        avgResponseTime: 250.5,
        errorRate: 150, // invalid > 100
        lastActivity: 'yesterday', // invalid type
        cacheHits: 850,
        cacheSets: 1500,
        throughput: 12.5
      };

      expect(() => {
        AgentCacheMetricsSchema.parse(invalidMetrics);
      }).toThrow();
    });
  });

  describe('CachedAgentResponseSchema', () => {
    it('should validate complete cached agent response', () => {
      const validResponse = {
        // Base AgentResponse fields
        success: true,
        data: { result: 'test response' },
        metadata: {
          agentId: 'agent-001',
          timestamp: new Date().toISOString(),
          executionTime: 150,
          fromCache: true,
          cached: true
        },
        // Cache-specific metadata
        cacheMetadata: {
          cacheKey: 'agent-001:input-hash:context-hash',
          cacheLevel: 'L1' as const,
          cacheTimestamp: Date.now(),
          originalTimestamp: Date.now() - 300000,
          hitCount: 25,
          performanceScore: 95.5
        }
      };

      expect(() => {
        CachedAgentResponseSchema.parse(validResponse);
      }).not.toThrow();
    });

    it('should validate cached response with minimal metadata', () => {
      const minimalResponse = {
        success: false,
        data: null,
        error: 'Processing failed',
        metadata: {
          agentId: 'agent-002',
          timestamp: new Date().toISOString(),
          executionTime: 75,
          fromCache: true,
          cached: true
        },
        cacheMetadata: {
          cacheKey: 'agent-002:input-hash',
          cacheLevel: 'L2' as const,
          cacheTimestamp: Date.now(),
          originalTimestamp: Date.now() - 600000,
          hitCount: 1
        }
      };

      expect(() => {
        CachedAgentResponseSchema.parse(minimalResponse);
      }).not.toThrow();
    });

    it('should reject invalid cached agent response', () => {
      const invalidResponse = {
        success: 'maybe', // invalid type
        data: { result: 'test response' },
        metadata: {
          agentId: 123, // invalid type
          timestamp: 'not-a-date',
          executionTime: -50, // invalid negative
          fromCache: true,
          cached: true
        },
        cacheMetadata: {
          cacheKey: '', // invalid empty
          cacheLevel: 'L4', // invalid enum
          cacheTimestamp: 'now', // invalid type
          originalTimestamp: Date.now(),
          hitCount: -5 // invalid negative
        }
      };

      expect(() => {
        CachedAgentResponseSchema.parse(invalidResponse);
      }).toThrow();
    });
  });

  describe('WorkflowCacheEntrySchema', () => {
    it('should validate complete workflow cache entry', () => {
      const validEntry = {
        workflowId: 'workflow-123',
        agentSequence: ['agent-001', 'agent-002', 'agent-003'],
        results: {
          'agent-001': { success: true, data: 'result1' },
          'agent-002': { success: true, data: 'result2' },
          'agent-003': { success: true, data: 'result3' }
        },
        finalResult: { status: 'completed', output: 'final result' },
        executionTime: 1250,
        timestamp: Date.now(),
        dependencies: ['data-source-1', 'external-api'],
        metadata: {
          success: true,
          errorCount: 0,
          handoffCount: 2,
          confidence: 95.5
        }
      };

      expect(() => {
        WorkflowCacheEntrySchema.parse(validEntry);
      }).not.toThrow();
    });

    it('should validate workflow with errors and handoffs', () => {
      const errorEntry = {
        workflowId: 'workflow-456',
        agentSequence: ['agent-001', 'agent-002'],
        results: {
          'agent-001': { success: false, error: 'failed' },
          'agent-002': { success: true, data: 'recovered' }
        },
        finalResult: { status: 'partial_success', output: 'recovered result' },
        executionTime: 2500,
        timestamp: Date.now(),
        dependencies: ['unreliable-service'],
        metadata: {
          success: false,
          errorCount: 3,
          handoffCount: 5,
          confidence: 60.0
        }
      };

      expect(() => {
        WorkflowCacheEntrySchema.parse(errorEntry);
      }).not.toThrow();
    });

    it('should reject invalid workflow cache entry', () => {
      const invalidEntry = {
        workflowId: 123, // invalid type
        agentSequence: 'single-agent', // should be array
        results: 'no-results', // should be Map
        finalResult: { status: 'completed', output: 'final result' },
        executionTime: -1250, // invalid negative
        timestamp: 'yesterday', // invalid type
        dependencies: 'none', // should be array
        metadata: {
          success: 'yes', // invalid type
          errorCount: -1, // invalid negative
          handoffCount: 2,
          confidence: 150 // invalid > 100
        }
      };

      expect(() => {
        WorkflowCacheEntrySchema.parse(invalidEntry);
      }).toThrow();
    });
  });

  describe('AgentHealthCacheSchema', () => {
    it('should validate healthy agent status', () => {
      const healthyAgent = {
        agentId: 'agent-001',
        status: 'healthy' as const,
        lastCheck: Date.now(),
        responseTime: 125.5,
        errorRate: 2.1,
        cacheHitRate: 85.5,
        metadata: {
          uptime: 99.9,
          totalRequests: 50000,
          successfulRequests: 48950,
          averageResponseTime: 130.2
        }
      };

      expect(() => {
        AgentHealthCacheSchema.parse(healthyAgent);
      }).not.toThrow();
    });

    it('should validate degraded agent status', () => {
      const degradedAgent = {
        agentId: 'agent-002',
        status: 'degraded' as const,
        lastCheck: Date.now(),
        responseTime: 500.0,
        errorRate: 15.5,
        cacheHitRate: 45.2,
        metadata: {
          uptime: 85.5,
          totalRequests: 10000,
          successfulRequests: 8450,
          averageResponseTime: 475.8
        }
      };

      expect(() => {
        AgentHealthCacheSchema.parse(degradedAgent);
      }).not.toThrow();
    });

    it('should validate unhealthy agent status', () => {
      const unhealthyAgent = {
        agentId: 'agent-003',
        status: 'unhealthy' as const,
        lastCheck: Date.now(),
        responseTime: 2000.0,
        errorRate: 45.0,
        cacheHitRate: 15.0,
        metadata: {
          uptime: 55.2,
          totalRequests: 1000,
          successfulRequests: 550,
          averageResponseTime: 1850.5
        }
      };

      expect(() => {
        AgentHealthCacheSchema.parse(unhealthyAgent);
      }).not.toThrow();
    });

    it('should reject invalid agent health cache', () => {
      const invalidHealth = {
        agentId: '', // invalid empty
        status: 'unknown', // invalid enum
        lastCheck: 'never', // invalid type
        responseTime: -125.5, // invalid negative
        errorRate: 150, // invalid > 100
        cacheHitRate: -10, // invalid negative
        metadata: {
          uptime: 150, // invalid > 100
          totalRequests: -1000, // invalid negative
          successfulRequests: 48950,
          averageResponseTime: 'slow' // invalid type
        }
      };

      expect(() => {
        AgentHealthCacheSchema.parse(invalidHealth);
      }).toThrow();
    });
  });

  describe('AgentCacheAnalyticsSchema', () => {
    it('should validate complete cache analytics', () => {
      const validAnalytics = {
        agentPerformance: {
          'agent-001': {
            hitRate: 85.5,
            averageResponseTime: 150.2,
            errorRate: 2.1,
            cacheEfficiency: 92.5,
            totalRequests: 50000
          },
          'agent-002': {
            hitRate: 75.0,
            averageResponseTime: 200.5,
            errorRate: 5.5,
            cacheEfficiency: 88.2,
            totalRequests: 25000
          }
        },
        workflowEfficiency: {
          totalWorkflows: 1500,
          cachedWorkflows: 1200,
          cacheHitRate: 80.0,
          averageExecutionTime: 850.5,
          timesSaved: 12500
        },
        healthMonitoring: {
          healthyAgents: 8,
          degradedAgents: 2,
          unhealthyAgents: 1,
          averageResponseTime: 175.5,
          systemLoad: 65.2
        },
        recommendations: [
          'Increase cache TTL for agent-001',
          'Monitor agent-003 health status',
          'Optimize workflow caching for pattern X'
        ]
      };

      expect(() => {
        AgentCacheAnalyticsSchema.parse(validAnalytics);
      }).not.toThrow();
    });

    it('should validate analytics with empty performance data', () => {
      const emptyAnalytics = {
        agentPerformance: {},
        workflowEfficiency: {
          totalWorkflows: 0,
          cachedWorkflows: 0,
          cacheHitRate: 0,
          averageExecutionTime: 0,
          timesSaved: 0
        },
        healthMonitoring: {
          healthyAgents: 0,
          degradedAgents: 0,
          unhealthyAgents: 0,
          averageResponseTime: 0,
          systemLoad: 0
        },
        recommendations: []
      };

      expect(() => {
        AgentCacheAnalyticsSchema.parse(emptyAnalytics);
      }).not.toThrow();
    });

    it('should reject invalid cache analytics', () => {
      const invalidAnalytics = {
        agentPerformance: {
          'agent-001': {
            hitRate: 150, // invalid > 100
            averageResponseTime: -150.2, // invalid negative
            errorRate: 2.1,
            cacheEfficiency: 92.5,
            totalRequests: 'many' // invalid type
          }
        },
        workflowEfficiency: {
          totalWorkflows: -1500, // invalid negative
          cachedWorkflows: 1200,
          cacheHitRate: 80.0,
          averageExecutionTime: 850.5,
          timesSaved: 12500
        },
        healthMonitoring: {
          healthyAgents: -1, // invalid negative
          degradedAgents: 2,
          unhealthyAgents: 1,
          averageResponseTime: 175.5,
          systemLoad: 150 // invalid > 100
        },
        recommendations: 'no recommendations' // should be array
      };

      expect(() => {
        AgentCacheAnalyticsSchema.parse(invalidAnalytics);
      }).toThrow();
    });
  });

  describe('Schema Integration Tests', () => {
    it('should validate complete agent cache system data', () => {
      const systemData = {
        config: {
          defaultTTL: 300000,
          maxRetries: 3,
          enablePerformanceTracking: true,
          enableWorkflowCaching: true,
          enableHealthCaching: true,
          cacheWarmupEnabled: true
        },
        metrics: {
          agentId: 'agent-001',
          totalExecutions: 1500,
          successfulExecutions: 1425,
          failedExecutions: 75,
          avgResponseTime: 250.5,
          errorRate: 5.0,
          lastActivity: Date.now(),
          cacheHits: 850,
          cacheSets: 1500,
          throughput: 12.5
        },
        health: {
          agentId: 'agent-001',
          status: 'healthy' as const,
          lastCheck: Date.now(),
          responseTime: 125.5,
          errorRate: 2.1,
          cacheHitRate: 85.5,
          metadata: {
            uptime: 99.9,
            totalRequests: 50000,
            successfulRequests: 48950,
            averageResponseTime: 130.2
          }
        }
      };

      expect(() => {
        AgentCacheConfigSchema.parse(systemData.config);
        AgentCacheMetricsSchema.parse(systemData.metrics);
        AgentHealthCacheSchema.parse(systemData.health);
      }).not.toThrow();
    });

    it('should validate workflow integration scenario', () => {
      const workflowData = {
        entry: {
          workflowId: 'workflow-integration-test',
          agentSequence: ['agent-001', 'agent-002'],
          results: {
            'agent-001': { success: true, data: 'step1' },
            'agent-002': { success: true, data: 'step2' }
          },
          finalResult: { completed: true },
          executionTime: 500,
          timestamp: Date.now(),
          dependencies: ['external-api'],
          metadata: {
            success: true,
            errorCount: 0,
            handoffCount: 1,
            confidence: 98.5
          }
        },
        response: {
          success: true,
          data: { completed: true },
          metadata: {
            agentId: 'workflow-manager',
            timestamp: new Date().toISOString(),
            executionTime: 500,
            fromCache: true,
            cached: true
          },
          cacheMetadata: {
            cacheKey: 'workflow-integration-test',
            cacheLevel: 'L1' as const,
            cacheTimestamp: Date.now(),
            originalTimestamp: Date.now() - 100000,
            hitCount: 5,
            performanceScore: 98.5
          }
        }
      };

      expect(() => {
        WorkflowCacheEntrySchema.parse(workflowData.entry);
        CachedAgentResponseSchema.parse(workflowData.response);
      }).not.toThrow();
    });
  });
});