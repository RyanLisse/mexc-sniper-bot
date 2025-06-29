/**
 * Test Suite for Extracted Safety Schemas
 * 
 * Following TDD approach: writing tests before extracting safety-related
 * types and interfaces from comprehensive-safety-coordinator.ts
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  ComprehensiveSafetyStatusSchema,
  SafetyActionSchema,
  SafetyAlertSchema,
  SafetyCoordinatorConfigSchema,
  SafetyMetricsSchema,
} from '@/src/schemas/safety-schemas-extracted';

describe('Safety Schemas - TDD Extraction Tests', () => {
  describe('SafetyCoordinatorConfigSchema', () => {
    it('should validate valid safety coordinator configuration', () => {
      const validConfig = {
        agentMonitoringInterval: 30000,
        riskAssessmentInterval: 60000,
        systemHealthCheckInterval: 120000,
        criticalViolationThreshold: 5,
        riskScoreThreshold: 80,
        agentAnomalyThreshold: 75,
        autoEmergencyShutdown: true,
        emergencyContactEnabled: true,
        safetyOverrideRequired: false,
        websocketEnabled: true,
        realTimeAlertsEnabled: true,
        consensusEnforcementEnabled: true,
        maxConcurrentPositions: 10
      };

      expect(() => {
        SafetyCoordinatorConfigSchema.parse(validConfig);
      }).not.toThrow();
    });

    it('should validate minimal safety coordinator configuration', () => {
      const minimalConfig = {
        agentMonitoringInterval: 30000,
        riskAssessmentInterval: 60000,
        systemHealthCheckInterval: 120000,
        criticalViolationThreshold: 5,
        riskScoreThreshold: 80,
        agentAnomalyThreshold: 75,
        autoEmergencyShutdown: false,
        emergencyContactEnabled: false,
        safetyOverrideRequired: false,
        websocketEnabled: false,
        realTimeAlertsEnabled: false,
        consensusEnforcementEnabled: false
      };

      expect(() => {
        SafetyCoordinatorConfigSchema.parse(minimalConfig);
      }).not.toThrow();
    });

    it('should reject invalid safety configuration with out-of-range values', () => {
      const invalidConfig = {
        agentMonitoringInterval: -1000, // invalid negative
        riskAssessmentInterval: 60000,
        systemHealthCheckInterval: 120000,
        criticalViolationThreshold: 150, // invalid > 100
        riskScoreThreshold: -10, // invalid negative
        agentAnomalyThreshold: 75,
        autoEmergencyShutdown: false,
        emergencyContactEnabled: false,
        safetyOverrideRequired: false,
        websocketEnabled: false,
        realTimeAlertsEnabled: false,
        consensusEnforcementEnabled: false
      };

      expect(() => {
        SafetyCoordinatorConfigSchema.parse(invalidConfig);
      }).toThrow();
    });
  });

  describe('ComprehensiveSafetyStatusSchema', () => {
    it('should validate complete safety status with all sections', () => {
      const validStatus = {
        overall: {
          safetyLevel: 'safe' as const,
          safetyScore: 95,
          lastUpdate: new Date().toISOString(),
          systemStatus: 'operational' as const
        },
        agents: {
          totalMonitored: 10,
          healthyCount: 9,
          degradedCount: 1,
          criticalCount: 0,
          offlineCount: 0,
          averagePerformance: 85,
          recentViolations: 2
        },
        risk: {
          overallRiskScore: 35,
          portfolioValue: 10000,
          exposureLevel: 0.25,
          valueAtRisk: 500,
          activeAlerts: 1,
          riskTrend: 'stable' as const
        },
        emergency: {
          systemActive: true,
          activeIncidents: 0,
          tradingHalted: false,
          lastEmergencyAction: null,
          emergencyLevel: 'none' as const
        },
        consensus: {
          pendingRequests: 2,
          recentDecisions: 15,
          averageApprovalRate: 85,
          consensusEfficiency: 92
        },
        realTime: {
          websocketConnected: true,
          activeSubscriptions: 5,
          messageRate: 12,
          alertsInLast5Min: 3
        }
      };

      expect(() => {
        ComprehensiveSafetyStatusSchema.parse(validStatus);
      }).not.toThrow();
    });

    it('should validate safety status in critical state', () => {
      const criticalStatus = {
        overall: {
          safetyLevel: 'critical' as const,
          safetyScore: 25,
          lastUpdate: new Date().toISOString(),
          systemStatus: 'critical' as const
        },
        agents: {
          totalMonitored: 10,
          healthyCount: 3,
          degradedCount: 4,
          criticalCount: 2,
          offlineCount: 1,
          averagePerformance: 35,
          recentViolations: 15
        },
        risk: {
          overallRiskScore: 90,
          portfolioValue: 8000,
          exposureLevel: 0.85,
          valueAtRisk: 3000,
          activeAlerts: 8,
          riskTrend: 'deteriorating' as const
        },
        emergency: {
          systemActive: true,
          activeIncidents: 3,
          tradingHalted: true,
          lastEmergencyAction: 'EMERGENCY_HALT',
          emergencyLevel: 'critical' as const
        },
        consensus: {
          pendingRequests: 0,
          recentDecisions: 5,
          averageApprovalRate: 45,
          consensusEfficiency: 30
        },
        realTime: {
          websocketConnected: false,
          activeSubscriptions: 0,
          messageRate: 0,
          alertsInLast5Min: 12
        }
      };

      expect(() => {
        ComprehensiveSafetyStatusSchema.parse(criticalStatus);
      }).not.toThrow();
    });

    it('should reject invalid safety status with wrong enum values', () => {
      const invalidStatus = {
        overall: {
          safetyLevel: 'unknown', // invalid enum value
          safetyScore: 150, // invalid > 100
          lastUpdate: new Date().toISOString(),
          systemStatus: 'broken' // invalid enum value
        },
        agents: {
          totalMonitored: -5, // invalid negative
          healthyCount: 9,
          degradedCount: 1,
          criticalCount: 0,
          offlineCount: 0,
          averagePerformance: 85,
          recentViolations: 2
        },
        risk: {
          overallRiskScore: 35,
          portfolioValue: 10000,
          exposureLevel: 0.25,
          valueAtRisk: 500,
          activeAlerts: 1,
          riskTrend: 'unknown' // invalid enum value
        },
        emergency: {
          systemActive: 'yes', // should be boolean
          activeIncidents: 0,
          tradingHalted: false,
          lastEmergencyAction: null,
          emergencyLevel: 'none'
        },
        consensus: {
          pendingRequests: 2,
          recentDecisions: 15,
          averageApprovalRate: 85,
          consensusEfficiency: 92
        },
        realTime: {
          websocketConnected: true,
          activeSubscriptions: 5,
          messageRate: 12,
          alertsInLast5Min: 3
        }
      };

      expect(() => {
        ComprehensiveSafetyStatusSchema.parse(invalidStatus);
      }).toThrow();
    });
  });

  describe('SafetyAlertSchema', () => {
    it('should validate valid safety alert', () => {
      const validAlert = {
        id: 'alert-123',
        type: 'agent_anomaly' as const,
        severity: 'high' as const,
        title: 'Agent Behavior Anomaly Detected',
        message: 'Agent trading-bot-1 showing unusual response patterns',
        source: 'safety-monitor-agent',
        timestamp: new Date().toISOString(),
        acknowledged: false,
        resolved: false,
        actions: ['investigate', 'restrict_agent', 'notify_admin'],
        metadata: {
          agentId: 'trading-bot-1',
          anomalyScore: 85,
          responseTime: 5000
        }
      };

      expect(() => {
        SafetyAlertSchema.parse(validAlert);
      }).not.toThrow();
    });

    it('should validate resolved safety alert', () => {
      const resolvedAlert = {
        id: 'alert-456',
        type: 'risk_breach' as const,
        severity: 'critical' as const,
        title: 'Risk Threshold Exceeded',
        message: 'Portfolio risk score exceeded 90%',
        source: 'risk-engine',
        timestamp: new Date().toISOString(),
        acknowledged: true,
        resolved: true,
        actions: ['reduce_exposure', 'halt_trading', 'send_notification'],
        metadata: {
          riskScore: 95,
          portfolioValue: 50000,
          threshold: 90
        }
      };

      expect(() => {
        SafetyAlertSchema.parse(resolvedAlert);
      }).not.toThrow();
    });

    it('should reject invalid safety alert with wrong types', () => {
      const invalidAlert = {
        id: 123, // should be string
        type: 'unknown_type', // invalid enum
        severity: 'extreme', // invalid enum
        title: 'Test Alert',
        message: 'Test message',
        source: 'test',
        timestamp: 'invalid-date', // invalid timestamp
        acknowledged: 'yes', // should be boolean
        resolved: false,
        actions: 'not-an-array', // should be array
        metadata: 'not-an-object' // should be object
      };

      expect(() => {
        SafetyAlertSchema.parse(invalidAlert);
      }).toThrow();
    });
  });

  describe('SafetyActionSchema', () => {
    it('should validate valid safety action', () => {
      const validAction = {
        id: 'action-789',
        type: 'restrict' as const,
        target: 'agent-trading-bot-1',
        reason: 'Anomalous behavior detected',
        executedAt: new Date().toISOString(),
        executedBy: 'safety-coordinator',
        success: true,
        impact: 'Agent trading capabilities restricted'
      };

      expect(() => {
        SafetyActionSchema.parse(validAction);
      }).not.toThrow();
    });

    it('should validate emergency halt action', () => {
      const emergencyAction = {
        id: 'action-emergency-001',
        type: 'emergency_halt' as const,
        target: 'all-trading-systems',
        reason: 'Critical risk threshold breached',
        executedAt: new Date().toISOString(),
        executedBy: 'emergency-safety-system',
        success: true,
        impact: 'All trading activities halted immediately'
      };

      expect(() => {
        SafetyActionSchema.parse(emergencyAction);
      }).not.toThrow();
    });

    it('should reject invalid safety action with missing fields', () => {
      const invalidAction = {
        id: 'action-invalid',
        type: 'unknown_action', // invalid enum
        // missing target, reason, executedAt, executedBy
        success: 'maybe', // should be boolean
        impact: 123 // should be string
      };

      expect(() => {
        SafetyActionSchema.parse(invalidAction);
      }).toThrow();
    });
  });

  describe('SafetyMetricsSchema', () => {
    it('should validate complete safety metrics', () => {
      const validMetrics = {
        agentMetrics: {
          averageResponseTime: 1500,
          averageSuccessRate: 95,
          averageConfidenceScore: 85,
          anomalyRate: 5,
          violationRate: 2
        },
        riskMetrics: {
          averageRiskScore: 45,
          riskTrend: 2.5,
          breachFrequency: 0.1,
          recoveryTime: 300
        },
        emergencyMetrics: {
          incidentCount: 3,
          responseTime: 120,
          resolutionTime: 1800,
          falsePositiveRate: 8
        },
        consensusMetrics: {
          averageProcessingTime: 5000,
          approvalRate: 78,
          timeoutRate: 5,
          consensusEffectiveness: 82
        },
        systemMetrics: {
          uptime: 99.8,
          availability: 99.9,
          reliability: 98.5,
          performanceScore: 92
        }
      };

      expect(() => {
        SafetyMetricsSchema.parse(validMetrics);
      }).not.toThrow();
    });

    it('should reject invalid metrics with negative values where inappropriate', () => {
      const invalidMetrics = {
        agentMetrics: {
          averageResponseTime: -1500, // invalid negative
          averageSuccessRate: 150, // invalid > 100
          averageConfidenceScore: 85,
          anomalyRate: 5,
          violationRate: 2
        },
        riskMetrics: {
          averageRiskScore: 45,
          riskTrend: 2.5,
          breachFrequency: -0.1, // invalid negative
          recoveryTime: 300
        },
        emergencyMetrics: {
          incidentCount: -3, // invalid negative
          responseTime: 120,
          resolutionTime: 1800,
          falsePositiveRate: 8
        },
        consensusMetrics: {
          averageProcessingTime: 5000,
          approvalRate: 78,
          timeoutRate: 5,
          consensusEffectiveness: 82
        },
        systemMetrics: {
          uptime: 99.8,
          availability: 99.9,
          reliability: 98.5,
          performanceScore: 92
        }
      };

      expect(() => {
        SafetyMetricsSchema.parse(invalidMetrics);
      }).toThrow();
    });
  });

  describe('Schema Integration Tests', () => {
    it('should validate full safety coordinator workflow data', () => {
      // Test that all schemas work together in a realistic scenario
      const workflowData = {
        config: {
          agentMonitoringInterval: 30000,
          riskAssessmentInterval: 60000,
          systemHealthCheckInterval: 120000,
          criticalViolationThreshold: 5,
          riskScoreThreshold: 80,
          agentAnomalyThreshold: 75,
          autoEmergencyShutdown: true,
          emergencyContactEnabled: true,
          safetyOverrideRequired: false,
          websocketEnabled: true,
          realTimeAlertsEnabled: true,
          consensusEnforcementEnabled: true
        },
        status: {
          overall: {
            safetyLevel: 'warning' as const,
            safetyScore: 65,
            lastUpdate: new Date().toISOString(),
            systemStatus: 'degraded' as const
          },
          agents: {
            totalMonitored: 5,
            healthyCount: 3,
            degradedCount: 2,
            criticalCount: 0,
            offlineCount: 0,
            averagePerformance: 75,
            recentViolations: 3
          },
          risk: {
            overallRiskScore: 70,
            portfolioValue: 25000,
            exposureLevel: 0.6,
            valueAtRisk: 2500,
            activeAlerts: 2,
            riskTrend: 'stable' as const
          },
          emergency: {
            systemActive: true,
            activeIncidents: 0,
            tradingHalted: false,
            lastEmergencyAction: null,
            emergencyLevel: 'low' as const
          },
          consensus: {
            pendingRequests: 1,
            recentDecisions: 10,
            averageApprovalRate: 80,
            consensusEfficiency: 88
          },
          realTime: {
            websocketConnected: true,
            activeSubscriptions: 3,
            messageRate: 8,
            alertsInLast5Min: 2
          }
        }
      };

      expect(() => {
        SafetyCoordinatorConfigSchema.parse(workflowData.config);
        ComprehensiveSafetyStatusSchema.parse(workflowData.status);
      }).not.toThrow();
    });
  });
});