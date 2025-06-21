/**
 * Test Suite for Extracted Agent Registry Schemas
 * 
 * Following TDD approach: writing tests before extracting agent registry-related
 * types and interfaces from agent-registry.ts
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  AgentStatusSchema,
  HealthThresholdsSchema,
  AgentHealthSchema,
  RegisteredAgentSchema,
  HealthCheckResultSchema,
  AgentRegistryStatsSchema,
  AgentRegistryOptionsSchema,
  SystemAlertSchema,
  AgentRecoveryResultSchema,
} from '../../src/schemas/agent-registry-schemas-extracted';

describe('Agent Registry Schemas - TDD Extraction Tests', () => {
  describe('AgentStatusSchema', () => {
    it('should validate all supported agent statuses', () => {
      const validStatuses = [
        'healthy',
        'degraded',
        'unhealthy',
        'unknown',
        'recovering'
      ];

      validStatuses.forEach(status => {
        expect(() => {
          AgentStatusSchema.parse(status);
        }).not.toThrow();
      });
    });

    it('should reject invalid agent statuses', () => {
      const invalidStatuses = [
        'active',
        'inactive',
        'disabled',
        '',
        123,
        null,
        undefined
      ];

      invalidStatuses.forEach(status => {
        expect(() => {
          AgentStatusSchema.parse(status);
        }).toThrow();
      });
    });
  });

  describe('HealthThresholdsSchema', () => {
    it('should validate complete health thresholds configuration', () => {
      const validThresholds = {
        responseTime: {
          warning: 3000,
          critical: 10000
        },
        errorRate: {
          warning: 0.1,
          critical: 0.3
        },
        consecutiveErrors: {
          warning: 3,
          critical: 5
        },
        uptime: {
          warning: 95,
          critical: 90
        },
        memoryUsage: {
          warning: 100,
          critical: 250
        },
        cpuUsage: {
          warning: 70,
          critical: 90
        }
      };

      expect(() => {
        HealthThresholdsSchema.parse(validThresholds);
      }).not.toThrow();
    });

    it('should validate strict health thresholds', () => {
      const strictThresholds = {
        responseTime: {
          warning: 1000,
          critical: 5000
        },
        errorRate: {
          warning: 0.05,
          critical: 0.15
        },
        consecutiveErrors: {
          warning: 2,
          critical: 3
        },
        uptime: {
          warning: 99,
          critical: 95
        },
        memoryUsage: {
          warning: 50,
          critical: 100
        },
        cpuUsage: {
          warning: 50,
          critical: 80
        }
      };

      expect(() => {
        HealthThresholdsSchema.parse(strictThresholds);
      }).not.toThrow();
    });

    it('should reject invalid health thresholds', () => {
      const invalidThresholds = {
        responseTime: {
          warning: -1000,    // invalid negative
          critical: 10000
        },
        errorRate: {
          warning: 1.5,      // invalid > 1
          critical: 0.3
        },
        consecutiveErrors: {
          warning: 0,        // invalid zero
          critical: 5
        },
        uptime: {
          warning: 150,      // invalid > 100
          critical: 90
        },
        memoryUsage: {
          warning: 100,
          critical: 'high'   // invalid type
        },
        cpuUsage: {
          warning: 70,
          critical: 90
        }
      };

      expect(() => {
        HealthThresholdsSchema.parse(invalidThresholds);
      }).toThrow();
    });
  });

  describe('AgentHealthSchema', () => {
    it('should validate complete agent health information', () => {
      const validHealth = {
        status: 'healthy' as const,
        lastChecked: new Date(),
        lastResponse: new Date(),
        responseTime: 150,
        errorCount: 2,
        errorRate: 0.05,
        consecutiveErrors: 0,
        uptime: 99.5,
        lastError: 'Connection timeout (resolved)',
        capabilities: ['trading', 'monitoring', 'analysis'],
        load: {
          current: 25,
          peak: 85,
          average: 35
        },
        memoryUsage: 75,
        cpuUsage: 45,
        cacheHitRate: 88.5,
        requestCount: 5000,
        successCount: 4975,
        lastRecoveryAttempt: new Date(),
        recoveryAttempts: 1,
        healthScore: 95,
        trends: {
          responseTime: 'improving' as const,
          errorRate: 'stable' as const,
          throughput: 'improving' as const
        }
      };

      expect(() => {
        AgentHealthSchema.parse(validHealth);
      }).not.toThrow();
    });

    it('should validate degraded agent health', () => {
      const degradedHealth = {
        status: 'degraded' as const,
        lastChecked: new Date(),
        lastResponse: new Date(Date.now() - 30000),
        responseTime: 4500,
        errorCount: 25,
        errorRate: 0.12,
        consecutiveErrors: 2,
        uptime: 92.0,
        lastError: 'High response time detected',
        capabilities: ['trading', 'monitoring'],
        load: {
          current: 75,
          peak: 95,
          average: 68
        },
        memoryUsage: 180,
        cpuUsage: 85,
        cacheHitRate: 65.2,
        requestCount: 3000,
        successCount: 2640,
        recoveryAttempts: 0,
        healthScore: 68,
        trends: {
          responseTime: 'degrading' as const,
          errorRate: 'degrading' as const,
          throughput: 'stable' as const
        }
      };

      expect(() => {
        AgentHealthSchema.parse(degradedHealth);
      }).not.toThrow();
    });

    it('should validate unhealthy agent health', () => {
      const unhealthyHealth = {
        status: 'unhealthy' as const,
        lastChecked: new Date(),
        lastResponse: null,  // No response
        responseTime: 15000,
        errorCount: 150,
        errorRate: 0.45,
        consecutiveErrors: 8,
        uptime: 75.5,
        lastError: 'Service unavailable - circuit breaker open',
        capabilities: [],
        load: {
          current: 0,
          peak: 100,
          average: 25
        },
        memoryUsage: 350,
        cpuUsage: 95,
        cacheHitRate: 15.0,
        requestCount: 1000,
        successCount: 550,
        lastRecoveryAttempt: new Date(Date.now() - 300000),
        recoveryAttempts: 5,
        healthScore: 25,
        trends: {
          responseTime: 'degrading' as const,
          errorRate: 'degrading' as const,
          throughput: 'degrading' as const
        }
      };

      expect(() => {
        AgentHealthSchema.parse(unhealthyHealth);
      }).not.toThrow();
    });

    it('should reject invalid agent health', () => {
      const invalidHealth = {
        status: 'broken',           // invalid status
        lastChecked: 'yesterday',   // invalid type
        lastResponse: new Date(),
        responseTime: -150,         // invalid negative
        errorCount: 'many',         // invalid type
        errorRate: 1.5,            // invalid > 1
        consecutiveErrors: 0,
        uptime: 150,               // invalid > 100
        capabilities: 'trading',    // should be array
        load: {
          current: -25,            // invalid negative
          peak: 85,
          average: 35
        },
        memoryUsage: 75,
        cpuUsage: 45,
        cacheHitRate: 150,         // invalid > 100
        requestCount: 5000,
        successCount: 4975,
        recoveryAttempts: 1,
        healthScore: 150,          // invalid > 100
        trends: {
          responseTime: 'unknown',  // invalid trend
          errorRate: 'stable',
          throughput: 'improving'
        }
      };

      expect(() => {
        AgentHealthSchema.parse(invalidHealth);
      }).toThrow();
    });
  });

  describe('RegisteredAgentSchema', () => {
    it('should validate complete registered agent', () => {
      const validAgent = {
        id: 'agent-trading-001',
        name: 'Primary Trading Agent',
        type: 'trading',
        instance: {}, // BaseAgent instance (mock for test)
        health: {
          status: 'healthy' as const,
          lastChecked: new Date(),
          lastResponse: new Date(),
          responseTime: 150,
          errorCount: 2,
          errorRate: 0.05,
          consecutiveErrors: 0,
          uptime: 99.5,
          capabilities: ['trading'],
          load: { current: 25, peak: 85, average: 35 },
          memoryUsage: 75,
          cpuUsage: 45,
          cacheHitRate: 88.5,
          requestCount: 5000,
          successCount: 4975,
          recoveryAttempts: 0,
          healthScore: 95,
          trends: {
            responseTime: 'stable' as const,
            errorRate: 'stable' as const,
            throughput: 'stable' as const
          }
        },
        registeredAt: new Date(),
        dependencies: ['market-data-agent', 'risk-engine'],
        priority: 10,
        tags: ['critical', 'production', 'high-frequency'],
        thresholds: {
          responseTime: { warning: 1000, critical: 5000 },
          errorRate: { warning: 0.05, critical: 0.15 },
          consecutiveErrors: { warning: 2, critical: 5 },
          uptime: { warning: 98, critical: 95 },
          memoryUsage: { warning: 100, critical: 200 },
          cpuUsage: { warning: 70, critical: 90 }
        },
        autoRecovery: true
      };

      expect(() => {
        RegisteredAgentSchema.parse(validAgent);
      }).not.toThrow();
    });

    it('should validate minimal registered agent', () => {
      const minimalAgent = {
        id: 'agent-simple',
        name: 'Simple Agent',
        type: 'monitoring',
        instance: {},
        health: {
          status: 'unknown' as const,
          lastChecked: new Date(),
          lastResponse: null,
          responseTime: 0,
          errorCount: 0,
          errorRate: 0,
          consecutiveErrors: 0,
          uptime: 0,
          capabilities: [],
          load: { current: 0, peak: 0, average: 0 },
          memoryUsage: 0,
          cpuUsage: 0,
          cacheHitRate: 0,
          requestCount: 0,
          successCount: 0,
          recoveryAttempts: 0,
          healthScore: 0,
          trends: {
            responseTime: 'stable' as const,
            errorRate: 'stable' as const,
            throughput: 'stable' as const
          }
        },
        registeredAt: new Date(),
        dependencies: [],
        priority: 1,
        tags: [],
        thresholds: {
          responseTime: { warning: 3000, critical: 10000 },
          errorRate: { warning: 0.1, critical: 0.3 },
          consecutiveErrors: { warning: 3, critical: 5 },
          uptime: { warning: 95, critical: 90 },
          memoryUsage: { warning: 100, critical: 250 },
          cpuUsage: { warning: 70, critical: 90 }
        },
        autoRecovery: false
      };

      expect(() => {
        RegisteredAgentSchema.parse(minimalAgent);
      }).not.toThrow();
    });

    it('should reject invalid registered agent', () => {
      const invalidAgent = {
        id: '',                     // invalid empty
        name: 'Test Agent',
        type: 123,                  // invalid type
        instance: {},
        health: {
          status: 'invalid',        // invalid status
          lastChecked: new Date(),
          responseTime: 150,
          errorCount: 2,
          errorRate: 0.05,
          consecutiveErrors: 0,
          uptime: 99.5,
          capabilities: [],
          load: { current: 25, peak: 85, average: 35 },
          memoryUsage: 75,
          cpuUsage: 45,
          cacheHitRate: 88.5,
          requestCount: 5000,
          successCount: 4975,
          recoveryAttempts: 0,
          healthScore: 95,
          trends: {
            responseTime: 'stable',
            errorRate: 'stable',
            throughput: 'stable'
          }
        },
        registeredAt: 'today',      // invalid type
        dependencies: 'none',       // should be array
        priority: -5,              // invalid negative
        tags: [],
        thresholds: {},            // invalid missing fields
        autoRecovery: 'yes'        // invalid type
      };

      expect(() => {
        RegisteredAgentSchema.parse(invalidAgent);
      }).toThrow();
    });
  });

  describe('HealthCheckResultSchema', () => {
    it('should validate successful health check result', () => {
      const successResult = {
        success: true,
        responseTime: 125,
        timestamp: new Date(),
        metadata: {
          endpoint: '/health',
          version: '1.2.3',
          region: 'us-east-1'
        },
        memoryUsage: 85,
        cpuUsage: 45,
        cacheHitRate: 92.5,
        requestCount: 1000,
        healthScore: 98
      };

      expect(() => {
        HealthCheckResultSchema.parse(successResult);
      }).not.toThrow();
    });

    it('should validate failed health check result', () => {
      const failureResult = {
        success: false,
        responseTime: 8500,
        timestamp: new Date(),
        error: 'Connection timeout after 8.5 seconds',
        metadata: {
          endpoint: '/health',
          retryAttempts: 3,
          lastError: 'ECONNRESET'
        },
        memoryUsage: 250,
        cpuUsage: 95,
        cacheHitRate: 25.0,
        requestCount: 50,
        healthScore: 15
      };

      expect(() => {
        HealthCheckResultSchema.parse(failureResult);
      }).not.toThrow();
    });

    it('should validate minimal health check result', () => {
      const minimalResult = {
        success: false,
        responseTime: 0,
        timestamp: new Date(),
        error: 'Agent not responding'
      };

      expect(() => {
        HealthCheckResultSchema.parse(minimalResult);
      }).not.toThrow();
    });

    it('should reject invalid health check result', () => {
      const invalidResult = {
        success: 'maybe',           // invalid type
        responseTime: -125,         // invalid negative
        timestamp: 'now',           // invalid type
        error: 123,                 // invalid type
        metadata: 'none',           // should be object
        memoryUsage: -85,           // invalid negative
        cpuUsage: 150,              // invalid > 100
        cacheHitRate: -92.5,        // invalid negative
        requestCount: 'many',       // invalid type
        healthScore: 150            // invalid > 100
      };

      expect(() => {
        HealthCheckResultSchema.parse(invalidResult);
      }).toThrow();
    });
  });

  describe('AgentRegistryStatsSchema', () => {
    it('should validate complete registry statistics', () => {
      const validStats = {
        totalAgents: 15,
        healthyAgents: 12,
        degradedAgents: 2,
        unhealthyAgents: 1,
        unknownAgents: 0,
        averageResponseTime: 425.5,
        totalHealthChecks: 45000,
        lastFullHealthCheck: new Date()
      };

      expect(() => {
        AgentRegistryStatsSchema.parse(validStats);
      }).not.toThrow();
    });

    it('should validate empty registry statistics', () => {
      const emptyStats = {
        totalAgents: 0,
        healthyAgents: 0,
        degradedAgents: 0,
        unhealthyAgents: 0,
        unknownAgents: 0,
        averageResponseTime: 0,
        totalHealthChecks: 0,
        lastFullHealthCheck: null
      };

      expect(() => {
        AgentRegistryStatsSchema.parse(emptyStats);
      }).not.toThrow();
    });

    it('should reject invalid registry statistics', () => {
      const invalidStats = {
        totalAgents: -15,           // invalid negative
        healthyAgents: 'most',      // invalid type
        degradedAgents: 2,
        unhealthyAgents: 1,
        unknownAgents: 0,
        averageResponseTime: 425.5,
        totalHealthChecks: 45000,
        lastFullHealthCheck: 'never' // invalid type
      };

      expect(() => {
        AgentRegistryStatsSchema.parse(invalidStats);
      }).toThrow();
    });
  });

  describe('AgentRegistryOptionsSchema', () => {
    it('should validate complete registry options', () => {
      const validOptions = {
        healthCheckInterval: 30000,
        maxHealthHistorySize: 100,
        defaultThresholds: {
          responseTime: { warning: 3000, critical: 10000 },
          errorRate: { warning: 0.1, critical: 0.3 },
          consecutiveErrors: { warning: 3, critical: 5 },
          uptime: { warning: 95, critical: 90 },
          memoryUsage: { warning: 100, critical: 250 },
          cpuUsage: { warning: 70, critical: 90 }
        },
        autoRecoveryEnabled: true,
        alertThresholds: {
          unhealthyAgentPercentage: 20,
          systemResponseTime: 5000,
          systemErrorRate: 0.15
        }
      };

      expect(() => {
        AgentRegistryOptionsSchema.parse(validOptions);
      }).not.toThrow();
    });

    it('should validate minimal registry options', () => {
      const minimalOptions = {
        healthCheckInterval: 60000
      };

      expect(() => {
        AgentRegistryOptionsSchema.parse(minimalOptions);
      }).not.toThrow();
    });

    it('should validate empty registry options', () => {
      const emptyOptions = {};

      expect(() => {
        AgentRegistryOptionsSchema.parse(emptyOptions);
      }).not.toThrow();
    });

    it('should reject invalid registry options', () => {
      const invalidOptions = {
        healthCheckInterval: -30000,  // invalid negative
        maxHealthHistorySize: 0,      // invalid zero
        defaultThresholds: 'default', // invalid type
        autoRecoveryEnabled: 'yes',   // invalid type
        alertThresholds: {
          unhealthyAgentPercentage: 150, // invalid > 100
          systemResponseTime: -5000,     // invalid negative
          systemErrorRate: 1.5           // invalid > 1
        }
      };

      expect(() => {
        AgentRegistryOptionsSchema.parse(invalidOptions);
      }).toThrow();
    });
  });

  describe('SystemAlertSchema', () => {
    it('should validate warning system alert', () => {
      const warningAlert = {
        type: 'warning' as const,
        message: 'System response time is elevated (4.2s average)',
        timestamp: new Date()
      };

      expect(() => {
        SystemAlertSchema.parse(warningAlert);
      }).not.toThrow();
    });

    it('should validate critical system alert', () => {
      const criticalAlert = {
        type: 'critical' as const,
        message: '25% of agents are unhealthy - system degradation detected',
        timestamp: new Date()
      };

      expect(() => {
        SystemAlertSchema.parse(criticalAlert);
      }).not.toThrow();
    });

    it('should reject invalid system alert', () => {
      const invalidAlert = {
        type: 'info',               // invalid type
        message: 123,               // invalid type
        timestamp: 'now'            // invalid type
      };

      expect(() => {
        SystemAlertSchema.parse(invalidAlert);
      }).toThrow();
    });
  });

  describe('AgentRecoveryResultSchema', () => {
    it('should validate successful recovery result', () => {
      const successRecovery = {
        success: true,
        agentId: 'agent-trading-001',
        strategy: 'restart',
        timestamp: new Date(),
        duration: 2500,
        previousStatus: 'unhealthy' as const,
        newStatus: 'healthy' as const,
        recoveryAttempt: 3
      };

      expect(() => {
        AgentRecoveryResultSchema.parse(successRecovery);
      }).not.toThrow();
    });

    it('should validate failed recovery result', () => {
      const failedRecovery = {
        success: false,
        agentId: 'agent-broken-002',
        strategy: 'full_reset',
        timestamp: new Date(),
        duration: 15000,
        previousStatus: 'unhealthy' as const,
        newStatus: 'unhealthy' as const,
        recoveryAttempt: 8,
        error: 'Recovery timeout - agent still unresponsive'
      };

      expect(() => {
        AgentRecoveryResultSchema.parse(failedRecovery);
      }).not.toThrow();
    });

    it('should reject invalid recovery result', () => {
      const invalidRecovery = {
        success: 'maybe',           // invalid type
        agentId: 123,               // invalid type
        strategy: '',               // invalid empty
        timestamp: 'today',         // invalid type
        duration: -2500,            // invalid negative
        previousStatus: 'broken',   // invalid status
        newStatus: 'healthy',
        recoveryAttempt: 0,         // invalid zero
        error: 456                  // invalid type
      };

      expect(() => {
        AgentRecoveryResultSchema.parse(invalidRecovery);
      }).toThrow();
    });
  });

  describe('Schema Integration Tests', () => {
    it('should validate complete agent registry workflow', () => {
      const workflowData = {
        options: {
          healthCheckInterval: 30000,
          maxHealthHistorySize: 50,
          autoRecoveryEnabled: true
        },
        agent: {
          id: 'integration-test-agent',
          name: 'Integration Test Agent',
          type: 'testing',
          instance: {},
          health: {
            status: 'healthy' as const,
            lastChecked: new Date(),
            lastResponse: new Date(),
            responseTime: 200,
            errorCount: 0,
            errorRate: 0,
            consecutiveErrors: 0,
            uptime: 100,
            capabilities: ['testing'],
            load: { current: 10, peak: 50, average: 20 },
            memoryUsage: 50,
            cpuUsage: 30,
            cacheHitRate: 95,
            requestCount: 100,
            successCount: 100,
            recoveryAttempts: 0,
            healthScore: 100,
            trends: {
              responseTime: 'stable' as const,
              errorRate: 'stable' as const,
              throughput: 'stable' as const
            }
          },
          registeredAt: new Date(),
          dependencies: [],
          priority: 5,
          tags: ['test'],
          thresholds: {
            responseTime: { warning: 1000, critical: 5000 },
            errorRate: { warning: 0.05, critical: 0.2 },
            consecutiveErrors: { warning: 2, critical: 4 },
            uptime: { warning: 98, critical: 95 },
            memoryUsage: { warning: 80, critical: 150 },
            cpuUsage: { warning: 60, critical: 85 }
          },
          autoRecovery: true
        },
        healthCheck: {
          success: true,
          responseTime: 200,
          timestamp: new Date(),
          healthScore: 100
        },
        stats: {
          totalAgents: 1,
          healthyAgents: 1,
          degradedAgents: 0,
          unhealthyAgents: 0,
          unknownAgents: 0,
          averageResponseTime: 200,
          totalHealthChecks: 1,
          lastFullHealthCheck: new Date()
        }
      };

      expect(() => {
        AgentRegistryOptionsSchema.parse(workflowData.options);
        RegisteredAgentSchema.parse(workflowData.agent);
        HealthCheckResultSchema.parse(workflowData.healthCheck);
        AgentRegistryStatsSchema.parse(workflowData.stats);
      }).not.toThrow();
    });

    it('should validate recovery and alert scenarios', () => {
      const alertingData = {
        status: 'recovering' as const,
        alert: {
          type: 'warning' as const,
          message: 'Agent recovery in progress',
          timestamp: new Date()
        },
        recovery: {
          success: true,
          agentId: 'recovery-test-agent',
          strategy: 'soft_restart',
          timestamp: new Date(),
          duration: 3000,
          previousStatus: 'degraded' as const,
          newStatus: 'healthy' as const,
          recoveryAttempt: 1
        },
        thresholds: {
          responseTime: { warning: 2000, critical: 8000 },
          errorRate: { warning: 0.08, critical: 0.25 },
          consecutiveErrors: { warning: 3, critical: 6 },
          uptime: { warning: 96, critical: 92 },
          memoryUsage: { warning: 120, critical: 200 },
          cpuUsage: { warning: 75, critical: 95 }
        }
      };

      expect(() => {
        AgentStatusSchema.parse(alertingData.status);
        SystemAlertSchema.parse(alertingData.alert);
        AgentRecoveryResultSchema.parse(alertingData.recovery);
        HealthThresholdsSchema.parse(alertingData.thresholds);
      }).not.toThrow();
    });
  });
});