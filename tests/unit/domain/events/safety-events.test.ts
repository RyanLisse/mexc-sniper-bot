/**
 * Unit tests for Safety Domain Events
 * Tests safety event interfaces, factory methods, and event structure validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  EmergencyStopCreated,
  EmergencyStopTriggered,
  EmergencyStopCompleted,
  EmergencyStopFailed,
  RiskProfileCreated,
  RiskProfileUpdated,
  RiskThresholdViolated,
  SafetyAlertCreated,
  SafetyAlertResolved,
  SafetyDomainEvent,
  SafetyEventFactory,
} from '../../../../src/domain/events/safety-events';

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../../../utils/timeout-elimination-helpers';

describe('Safety Domain Events', () => {
  let testTimestamp: Date;
  let testEmergencyStopId: string;
  let testRiskProfileId: string;
  let testUserId: string;
  let testPortfolioId: string;
  let testAlertId: string;

  beforeEach(() => {
    testTimestamp = new Date();
    testEmergencyStopId = 'emergency-123';
    testRiskProfileId = 'risk-456';
    testUserId = 'user-789';
    testPortfolioId = 'portfolio-101';
    testAlertId = 'alert-202';
  });

  describe('Emergency Stop Events', () => {
    describe('EmergencyStopCreated', () => {
      it('should create valid emergency stop created event', () => {
        const data: EmergencyStopCreated['data'] = {
          emergencyStopId: testEmergencyStopId,
          userId: testUserId,
          portfolioId: testPortfolioId,
          triggerConditions: [
            {
              type: 'drawdown_threshold',
              threshold: 10.0,
              description: 'Maximum drawdown of 10%',
              priority: 'high',
            },
            {
              type: 'consecutive_losses',
              threshold: 5,
              description: 'Five consecutive losses',
              priority: 'medium',
            },
          ],
          emergencyActions: [
            {
              type: 'close_all_positions',
              priority: 1,
              description: 'Close all open positions immediately',
              timeout: 30000,
              retryCount: 3,
            },
            {
              type: 'cancel_pending_orders',
              priority: 2,
              description: 'Cancel all pending orders',
              timeout: 15000,
              retryCount: 2,
            },
          ],
          isActive: true,
          autoExecute: true,
        };

        const event: EmergencyStopCreated = {
          type: 'emergency_stop.created',
          aggregateId: testEmergencyStopId,
          userId: testUserId,
          payload: data,
          occurredAt: testTimestamp,
          data,
        };

        expect(event.type).toBe('emergency_stop.created');
        expect(event.aggregateId).toBe(testEmergencyStopId);
        expect(event.userId).toBe(testUserId);
        expect(event.data.emergencyStopId).toBe(testEmergencyStopId);
        expect(event.data.triggerConditions).toHaveLength(2);
        expect(event.data.emergencyActions).toHaveLength(2);
        expect(event.data.isActive).toBe(true);
        expect(event.data.autoExecute).toBe(true);
      });

      it('should handle multiple trigger conditions with different priorities', () => {
        const data: EmergencyStopCreated['data'] = {
          emergencyStopId: testEmergencyStopId,
          userId: testUserId,
          portfolioId: testPortfolioId,
          triggerConditions: [
            {
              type: 'position_risk',
              threshold: 15.0,
              description: 'Single position risk exceeds 15%',
              priority: 'critical',
            },
            {
              type: 'daily_loss',
              threshold: 5.0,
              description: 'Daily loss exceeds 5%',
              priority: 'high',
            },
            {
              type: 'volatility_spike',
              threshold: 50.0,
              description: 'Market volatility spike above 50%',
              priority: 'low',
            },
          ],
          emergencyActions: [
            {
              type: 'pause_trading',
              priority: 1,
              description: 'Pause all trading activities',
              timeout: 5000,
              retryCount: 1,
            },
          ],
          isActive: false,
          autoExecute: false,
        };

        const event: EmergencyStopCreated = {
          type: 'emergency_stop.created',
          aggregateId: testEmergencyStopId,
          userId: testUserId,
          payload: data,
          occurredAt: testTimestamp,
          data,
        };

        expect(event.data.triggerConditions).toHaveLength(3);
        expect(event.data.triggerConditions[0].priority).toBe('critical');
        expect(event.data.triggerConditions[1].priority).toBe('high');
        expect(event.data.triggerConditions[2].priority).toBe('low');
        expect(event.data.isActive).toBe(false);
        expect(event.data.autoExecute).toBe(false);
      });
    });

    describe('EmergencyStopTriggered', () => {
      it('should create valid emergency stop triggered event', () => {
        const triggeredAt = new Date();
        const data: EmergencyStopTriggered['data'] = {
          emergencyStopId: testEmergencyStopId,
          userId: testUserId,
          portfolioId: testPortfolioId,
          reason: 'Drawdown threshold exceeded',
          triggerData: {
            currentDrawdown: 12.5,
            threshold: 10.0,
            portfolioValue: 87500.00,
            initialValue: 100000.00,
          },
          triggeredAt,
          scheduledActions: [
            {
              actionType: 'close_all_positions',
              priority: 1,
              timeout: 30000,
              retryCount: 3,
            },
            {
              actionType: 'notify_user',
              priority: 2,
              timeout: 5000,
              retryCount: 1,
            },
          ],
        };

        const event: EmergencyStopTriggered = {
          type: 'emergency_stop.triggered',
          aggregateId: testEmergencyStopId,
          userId: testUserId,
          payload: data,
          occurredAt: testTimestamp,
          data,
        };

        expect(event.type).toBe('emergency_stop.triggered');
        expect(event.data.reason).toBe('Drawdown threshold exceeded');
        expect(event.data.triggerData.currentDrawdown).toBe(12.5);
        expect(event.data.triggerData.threshold).toBe(10.0);
        expect(event.data.triggeredAt).toBe(triggeredAt);
        expect(event.data.scheduledActions).toHaveLength(2);
      });

      it('should handle complex trigger data scenarios', () => {
        const data: EmergencyStopTriggered['data'] = {
          emergencyStopId: testEmergencyStopId,
          userId: testUserId,
          portfolioId: testPortfolioId,
          reason: 'Multiple risk factors triggered simultaneously',
          triggerData: {
            consecutiveLosses: 6,
            dailyLoss: 8.5,
            volatilityIndex: 65.0,
            openPositions: 15,
            exposureLevel: 85.0,
            correlationRisk: 0.95,
          },
          triggeredAt: new Date(),
          scheduledActions: [
            {
              actionType: 'emergency_position_closure',
              priority: 1,
              timeout: 60000,
              retryCount: 5,
            },
          ],
        };

        expect(data.triggerData.consecutiveLosses).toBe(6);
        expect(data.triggerData.volatilityIndex).toBe(65.0);
        expect(data.triggerData.correlationRisk).toBe(0.95);
      });
    });

    describe('EmergencyStopCompleted', () => {
      it('should create valid emergency stop completed event', () => {
        const triggeredAt = new Date(Date.now() - 300000); // 5 minutes ago
        const completedAt = new Date();

        const data: EmergencyStopCompleted['data'] = {
          emergencyStopId: testEmergencyStopId,
          userId: testUserId,
          portfolioId: testPortfolioId,
          triggeredAt,
          completedAt,
          executionSummary: {
            totalActions: 3,
            successfulActions: 3,
            failedActions: 0,
            totalExecutionTime: 45000,
            averageActionTime: 15000,
            overallSuccess: true,
          },
          actionResults: [
            {
              actionType: 'close_all_positions',
              success: true,
              duration: 25000,
            },
            {
              actionType: 'cancel_pending_orders',
              success: true,
              duration: 10000,
            },
            {
              actionType: 'notify_user',
              success: true,
              duration: 2000,
            },
          ],
        };

        const event: EmergencyStopCompleted = {
          type: 'emergency_stop.completed',
          aggregateId: testEmergencyStopId,
          userId: testUserId,
          payload: data,
          occurredAt: testTimestamp,
          data,
        };

        expect(event.type).toBe('emergency_stop.completed');
        expect(event.data.triggeredAt).toBe(triggeredAt);
        expect(event.data.completedAt).toBe(completedAt);
        expect(event.data.executionSummary.overallSuccess).toBe(true);
        expect(event.data.executionSummary.totalActions).toBe(3);
        expect(event.data.executionSummary.failedActions).toBe(0);
        expect(event.data.actionResults).toHaveLength(3);
      });

      it('should handle partial success scenarios', () => {
        const data: EmergencyStopCompleted['data'] = {
          emergencyStopId: testEmergencyStopId,
          userId: testUserId,
          portfolioId: testPortfolioId,
          triggeredAt: new Date(Date.now() - 180000),
          completedAt: new Date(),
          executionSummary: {
            totalActions: 4,
            successfulActions: 3,
            failedActions: 1,
            totalExecutionTime: 75000,
            averageActionTime: 18750,
            overallSuccess: false,
          },
          actionResults: [
            {
              actionType: 'close_positions',
              success: true,
              duration: 30000,
            },
            {
              actionType: 'cancel_orders',
              success: false,
              duration: 15000,
              error: 'Exchange timeout',
            },
            {
              actionType: 'update_risk_profile',
              success: true,
              duration: 5000,
            },
          ],
        };

        expect(data.executionSummary.overallSuccess).toBe(false);
        expect(data.executionSummary.failedActions).toBe(1);
        expect(data.actionResults[1].success).toBe(false);
        expect(data.actionResults[1].error).toBe('Exchange timeout');
      });
    });

    describe('EmergencyStopFailed', () => {
      it('should create valid emergency stop failed event', () => {
        const triggeredAt = new Date(Date.now() - 120000); // 2 minutes ago
        const failedAt = new Date();

        const data: EmergencyStopFailed['data'] = {
          emergencyStopId: testEmergencyStopId,
          userId: testUserId,
          portfolioId: testPortfolioId,
          triggeredAt,
          failedAt,
          failureReason: 'Exchange connection lost during emergency stop execution',
          failedActions: [
            {
              actionType: 'close_all_positions',
              error: 'Connection timeout',
              attemptsCount: 3,
            },
            {
              actionType: 'cancel_pending_orders',
              error: 'API rate limit exceeded',
              attemptsCount: 2,
            },
          ],
          partialResults: [
            {
              actionType: 'notify_user',
              success: true,
              duration: 1500,
            },
          ],
        };

        const event: EmergencyStopFailed = {
          type: 'emergency_stop.failed',
          aggregateId: testEmergencyStopId,
          userId: testUserId,
          payload: data,
          occurredAt: testTimestamp,
          data,
        };

        expect(event.type).toBe('emergency_stop.failed');
        expect(event.data.failureReason).toBe('Exchange connection lost during emergency stop execution');
        expect(event.data.failedActions).toHaveLength(2);
        expect(event.data.partialResults).toHaveLength(1);
        expect(event.data.failedActions[0].attemptsCount).toBe(3);
        expect(event.data.partialResults![0].success).toBe(true);
      });

      it('should handle total failure without partial results', () => {
        const data: EmergencyStopFailed['data'] = {
          emergencyStopId: testEmergencyStopId,
          userId: testUserId,
          portfolioId: testPortfolioId,
          triggeredAt: new Date(Date.now() - 60000),
          failedAt: new Date(),
          failureReason: 'Critical system error',
          failedActions: [
            {
              actionType: 'emergency_shutdown',
              error: 'System unavailable',
              attemptsCount: 1,
            },
          ],
        };

        expect(data.partialResults).toBeUndefined();
        expect(data.failedActions).toHaveLength(1);
      });
    });
  });

  describe('Risk Profile Events', () => {
    describe('RiskProfileCreated', () => {
      it('should create valid risk profile created event', () => {
        const data: RiskProfileCreated['data'] = {
          riskProfileId: testRiskProfileId,
          userId: testUserId,
          portfolioId: testPortfolioId,
          thresholds: {
            maxDrawdownPercent: 15.0,
            maxPositionRiskPercent: 5.0,
            maxPortfolioRiskPercent: 20.0,
            maxConcentrationPercent: 25.0,
            consecutiveLossThreshold: 5,
            dailyLossThreshold: 3.0,
            monthlyLossThreshold: 10.0,
          },
          exposures: {
            totalExposure: 85000.00,
            longExposure: 50000.00,
            shortExposure: 35000.00,
            leveragedExposure: 170000.00,
            unrealizedPnL: 2500.00,
            realizedPnL: 1500.00,
          },
          riskToleranceLevel: 'moderate',
          isActive: true,
        };

        const event: RiskProfileCreated = {
          type: 'risk_profile.created',
          aggregateId: testRiskProfileId,
          userId: testUserId,
          payload: data,
          occurredAt: testTimestamp,
          data,
        };

        expect(event.type).toBe('risk_profile.created');
        expect(event.data.riskProfileId).toBe(testRiskProfileId);
        expect(event.data.thresholds.maxDrawdownPercent).toBe(15.0);
        expect(event.data.exposures.totalExposure).toBe(85000.00);
        expect(event.data.riskToleranceLevel).toBe('moderate');
        expect(event.data.isActive).toBe(true);
      });

      it('should handle different risk tolerance levels', () => {
        const toleranceLevels = ['conservative', 'moderate', 'aggressive', 'high_risk'];

        toleranceLevels.forEach(level => {
          const data: RiskProfileCreated['data'] = {
            riskProfileId: `${testRiskProfileId}-${level}`,
            userId: testUserId,
            portfolioId: testPortfolioId,
            thresholds: {
              maxDrawdownPercent: 10.0,
              maxPositionRiskPercent: 3.0,
              maxPortfolioRiskPercent: 15.0,
              maxConcentrationPercent: 20.0,
              consecutiveLossThreshold: 3,
              dailyLossThreshold: 2.0,
              monthlyLossThreshold: 8.0,
            },
            exposures: {
              totalExposure: 50000.00,
              longExposure: 30000.00,
              shortExposure: 20000.00,
              leveragedExposure: 100000.00,
              unrealizedPnL: 0.00,
              realizedPnL: 0.00,
            },
            riskToleranceLevel: level,
            isActive: true,
          };

          expect(data.riskToleranceLevel).toBe(level);
        });
      });
    });

    describe('RiskProfileUpdated', () => {
      it('should create valid risk profile updated event', () => {
        const data: RiskProfileUpdated['data'] = {
          riskProfileId: testRiskProfileId,
          userId: testUserId,
          portfolioId: testPortfolioId,
          changeType: 'thresholds',
          previousValues: {
            maxDrawdownPercent: 15.0,
            maxPositionRiskPercent: 5.0,
          },
          newValues: {
            maxDrawdownPercent: 12.0,
            maxPositionRiskPercent: 4.0,
          },
          updatedBy: 'USER',
          reason: 'User requested more conservative risk settings',
        };

        const event: RiskProfileUpdated = {
          type: 'risk_profile.updated',
          aggregateId: testRiskProfileId,
          userId: testUserId,
          payload: data,
          occurredAt: testTimestamp,
          data,
        };

        expect(event.type).toBe('risk_profile.updated');
        expect(event.data.changeType).toBe('thresholds');
        expect(event.data.previousValues.maxDrawdownPercent).toBe(15.0);
        expect(event.data.newValues.maxDrawdownPercent).toBe(12.0);
        expect(event.data.updatedBy).toBe('USER');
        expect(event.data.reason).toBe('User requested more conservative risk settings');
      });

      it('should handle different change types and update sources', () => {
        const changeTypes: Array<'thresholds' | 'exposures' | 'tolerance' | 'status'> = 
          ['thresholds', 'exposures', 'tolerance', 'status'];
        const updateSources: Array<'USER' | 'SYSTEM' | 'AUTO_ADJUSTMENT'> = 
          ['USER', 'SYSTEM', 'AUTO_ADJUSTMENT'];

        changeTypes.forEach(changeType => {
          updateSources.forEach(updatedBy => {
            const data: RiskProfileUpdated['data'] = {
              riskProfileId: testRiskProfileId,
              userId: testUserId,
              portfolioId: testPortfolioId,
              changeType,
              previousValues: { testField: 'old_value' },
              newValues: { testField: 'new_value' },
              updatedBy,
            };

            expect(data.changeType).toBe(changeType);
            expect(data.updatedBy).toBe(updatedBy);
          });
        });
      });
    });

    describe('RiskThresholdViolated', () => {
      it('should create valid risk threshold violated event', () => {
        const detectedAt = new Date();
        const data: RiskThresholdViolated['data'] = {
          riskProfileId: testRiskProfileId,
          userId: testUserId,
          portfolioId: testPortfolioId,
          violationType: 'drawdown_threshold',
          threshold: 15.0,
          currentValue: 18.5,
          severity: 'high',
          recommendedActions: [
            'Close risky positions',
            'Reduce position sizes',
            'Implement stop losses',
          ],
          violationContext: {
            symbol: 'BTCUSDT',
            positionId: 'pos-123',
            tradeId: 'trade-456',
            timeframe: '1h',
            additionalMetrics: {
              volatility: 65.0,
              correlation: 0.85,
              exposure: 25000.00,
            },
          },
          detectedAt,
        };

        const event: RiskThresholdViolated = {
          type: 'risk_threshold.violated',
          aggregateId: testRiskProfileId,
          userId: testUserId,
          payload: data,
          occurredAt: testTimestamp,
          data,
        };

        expect(event.type).toBe('risk_threshold.violated');
        expect(event.data.violationType).toBe('drawdown_threshold');
        expect(event.data.threshold).toBe(15.0);
        expect(event.data.currentValue).toBe(18.5);
        expect(event.data.severity).toBe('high');
        expect(event.data.recommendedActions).toHaveLength(3);
        expect(event.data.violationContext.symbol).toBe('BTCUSDT');
        expect(event.data.detectedAt).toBe(detectedAt);
      });

      it('should handle different violation types and severities', () => {
        const violationTypes: Array<
          | 'drawdown_threshold'
          | 'position_risk'
          | 'portfolio_risk'
          | 'concentration_risk'
          | 'consecutive_losses'
          | 'daily_loss_threshold'
          | 'monthly_loss_threshold'
        > = [
          'drawdown_threshold',
          'position_risk',
          'portfolio_risk',
          'concentration_risk',
          'consecutive_losses',
          'daily_loss_threshold',
          'monthly_loss_threshold',
        ];

        const severities: Array<'low' | 'medium' | 'high' | 'critical'> = 
          ['low', 'medium', 'high', 'critical'];

        violationTypes.forEach(violationType => {
          severities.forEach(severity => {
            const data: RiskThresholdViolated['data'] = {
              riskProfileId: testRiskProfileId,
              userId: testUserId,
              portfolioId: testPortfolioId,
              violationType,
              threshold: 10.0,
              currentValue: 15.0,
              severity,
              recommendedActions: ['Test action'],
              violationContext: {},
              detectedAt: new Date(),
            };

            expect(data.violationType).toBe(violationType);
            expect(data.severity).toBe(severity);
          });
        });
      });
    });
  });

  describe('Safety Alert Events', () => {
    describe('SafetyAlertCreated', () => {
      it('should create valid safety alert created event', () => {
        const data: SafetyAlertCreated['data'] = {
          alertId: testAlertId,
          userId: testUserId,
          portfolioId: testPortfolioId,
          alertType: 'RISK_WARNING',
          severity: 'medium',
          title: 'Position Risk Approaching Threshold',
          message: 'Your BTCUSDT position is approaching the maximum risk threshold of 5%',
          sourceEntity: 'risk_profile',
          sourceEntityId: testRiskProfileId,
          requiresAction: true,
          suggestedActions: [
            'Reduce position size',
            'Set stop loss',
            'Monitor closely',
          ],
          metadata: {
            symbol: 'BTCUSDT',
            currentRisk: 4.5,
            threshold: 5.0,
            positionValue: 22500.00,
          },
        };

        const event: SafetyAlertCreated = {
          type: 'safety_alert.created',
          aggregateId: testAlertId,
          userId: testUserId,
          payload: data,
          occurredAt: testTimestamp,
          data,
        };

        expect(event.type).toBe('safety_alert.created');
        expect(event.data.alertId).toBe(testAlertId);
        expect(event.data.alertType).toBe('RISK_WARNING');
        expect(event.data.severity).toBe('medium');
        expect(event.data.title).toBe('Position Risk Approaching Threshold');
        expect(event.data.requiresAction).toBe(true);
        expect(event.data.suggestedActions).toHaveLength(3);
        expect(event.data.metadata.symbol).toBe('BTCUSDT');
      });

      it('should handle different alert types', () => {
        const alertTypes: Array<
          | 'RISK_WARNING'
          | 'THRESHOLD_BREACH'
          | 'EMERGENCY_TRIGGER'
          | 'SYSTEM_ANOMALY'
        > = ['RISK_WARNING', 'THRESHOLD_BREACH', 'EMERGENCY_TRIGGER', 'SYSTEM_ANOMALY'];

        alertTypes.forEach(alertType => {
          const data: SafetyAlertCreated['data'] = {
            alertId: `${testAlertId}-${alertType.toLowerCase()}`,
            userId: testUserId,
            portfolioId: testPortfolioId,
            alertType,
            severity: 'medium',
            title: `Test ${alertType} Alert`,
            message: `This is a test ${alertType} alert`,
            sourceEntity: 'trading_engine',
            sourceEntityId: 'engine-123',
            requiresAction: true,
            metadata: {},
          };

          expect(data.alertType).toBe(alertType);
        });
      });

      it('should handle alerts without required action', () => {
        const data: SafetyAlertCreated['data'] = {
          alertId: testAlertId,
          userId: testUserId,
          portfolioId: testPortfolioId,
          alertType: 'SYSTEM_ANOMALY',
          severity: 'low',
          title: 'Minor System Anomaly Detected',
          message: 'A minor anomaly was detected but no action is required',
          sourceEntity: 'trading_engine',
          sourceEntityId: 'engine-123',
          requiresAction: false,
          metadata: {
            anomalyType: 'latency_spike',
            duration: 5000,
          },
        };

        expect(data.requiresAction).toBe(false);
        expect(data.suggestedActions).toBeUndefined();
      });
    });

    describe('SafetyAlertResolved', () => {
      it('should create valid safety alert resolved event', () => {
        const resolvedAt = new Date();
        const data: SafetyAlertResolved['data'] = {
          alertId: testAlertId,
          userId: testUserId,
          portfolioId: testPortfolioId,
          resolvedAt,
          resolvedBy: 'USER',
          resolutionMethod: 'Manual position adjustment',
          actionsTaken: [
            'Reduced BTCUSDT position by 50%',
            'Set stop loss at 2% below entry',
            'Updated risk monitoring parameters',
          ],
          outcome: 'SUCCESSFUL',
          notes: 'Risk brought back within acceptable limits',
        };

        const event: SafetyAlertResolved = {
          type: 'safety_alert.resolved',
          aggregateId: testAlertId,
          userId: testUserId,
          payload: data,
          occurredAt: testTimestamp,
          data,
        };

        expect(event.type).toBe('safety_alert.resolved');
        expect(event.data.alertId).toBe(testAlertId);
        expect(event.data.resolvedAt).toBe(resolvedAt);
        expect(event.data.resolvedBy).toBe('USER');
        expect(event.data.resolutionMethod).toBe('Manual position adjustment');
        expect(event.data.actionsTaken).toHaveLength(3);
        expect(event.data.outcome).toBe('SUCCESSFUL');
        expect(event.data.notes).toBe('Risk brought back within acceptable limits');
      });

      it('should handle different resolution sources and outcomes', () => {
        const resolvedBySources: Array<'USER' | 'SYSTEM' | 'AUTO_RESOLUTION'> = 
          ['USER', 'SYSTEM', 'AUTO_RESOLUTION'];
        const outcomes: Array<'SUCCESSFUL' | 'PARTIAL' | 'FAILED'> = 
          ['SUCCESSFUL', 'PARTIAL', 'FAILED'];

        resolvedBySources.forEach(resolvedBy => {
          outcomes.forEach(outcome => {
            const data: SafetyAlertResolved['data'] = {
              alertId: `${testAlertId}-${resolvedBy}-${outcome}`,
              userId: testUserId,
              portfolioId: testPortfolioId,
              resolvedAt: new Date(),
              resolvedBy,
              resolutionMethod: `${resolvedBy} resolution`,
              actionsTaken: ['Test action'],
              outcome,
            };

            expect(data.resolvedBy).toBe(resolvedBy);
            expect(data.outcome).toBe(outcome);
          });
        });
      });

      it('should handle resolution without notes', () => {
        const data: SafetyAlertResolved['data'] = {
          alertId: testAlertId,
          userId: testUserId,
          portfolioId: testPortfolioId,
          resolvedAt: new Date(),
          resolvedBy: 'SYSTEM',
          resolutionMethod: 'Automatic risk adjustment',
          actionsTaken: ['Triggered emergency stop'],
          outcome: 'PARTIAL',
        };

        expect(data.notes).toBeUndefined();
        expect(data.outcome).toBe('PARTIAL');
      });
    });
  });

  describe('SafetyEventFactory', () => {
    describe('createEmergencyStopCreated', () => {
      it('should create emergency stop created event with factory', () => {
        const data: EmergencyStopCreated['data'] = {
          emergencyStopId: testEmergencyStopId,
          userId: testUserId,
          portfolioId: testPortfolioId,
          triggerConditions: [
            {
              type: 'test_condition',
              threshold: 10,
              description: 'Test condition',
              priority: 'medium',
            },
          ],
          emergencyActions: [
            {
              type: 'test_action',
              priority: 1,
              description: 'Test action',
              timeout: 5000,
              retryCount: 1,
            },
          ],
          isActive: true,
          autoExecute: false,
        };

        const event = SafetyEventFactory.createEmergencyStopCreated(
          testEmergencyStopId,
          testUserId,
          data
        );

        expect(event.type).toBe('emergency_stop.created');
        expect(event.aggregateId).toBe(testEmergencyStopId);
        expect(event.userId).toBe(testUserId);
        expect(event.data).toBe(data);
        expect(event.payload).toBe(data);
        expect(event.occurredAt).toBeInstanceOf(Date);
        expect(event.eventId).toMatch(/^emergency-stop-created-\d+-[a-z0-9]+$/);
      });

      it('should generate unique event IDs', () => {
        const data: EmergencyStopCreated['data'] = {
          emergencyStopId: testEmergencyStopId,
          userId: testUserId,
          portfolioId: testPortfolioId,
          triggerConditions: [],
          emergencyActions: [],
          isActive: true,
          autoExecute: false,
        };

        const event1 = SafetyEventFactory.createEmergencyStopCreated('stop-1', 'user-1', data);
        const event2 = SafetyEventFactory.createEmergencyStopCreated('stop-2', 'user-2', data);

        expect(event1.eventId).not.toBe(event2.eventId);
        expect(event1.eventId).toMatch(/^emergency-stop-created-/);
        expect(event2.eventId).toMatch(/^emergency-stop-created-/);
      });
    });

    describe('createEmergencyStopTriggered', () => {
      it('should create emergency stop triggered event with factory', () => {
        const data: EmergencyStopTriggered['data'] = {
          emergencyStopId: testEmergencyStopId,
          userId: testUserId,
          portfolioId: testPortfolioId,
          reason: 'Test trigger',
          triggerData: { test: 'data' },
          triggeredAt: new Date(),
          scheduledActions: [],
        };

        const event = SafetyEventFactory.createEmergencyStopTriggered(
          testEmergencyStopId,
          testUserId,
          data
        );

        expect(event.type).toBe('emergency_stop.triggered');
        expect(event.aggregateId).toBe(testEmergencyStopId);
        expect(event.data).toBe(data);
        expect(event.eventId).toMatch(/^emergency-stop-triggered-\d+-[a-z0-9]+$/);
      });
    });

    describe('createEmergencyStopCompleted', () => {
      it('should create emergency stop completed event with factory', () => {
        const data: EmergencyStopCompleted['data'] = {
          emergencyStopId: testEmergencyStopId,
          userId: testUserId,
          portfolioId: testPortfolioId,
          triggeredAt: new Date(Date.now() - 60000),
          completedAt: new Date(),
          executionSummary: {
            totalActions: 1,
            successfulActions: 1,
            failedActions: 0,
            totalExecutionTime: 5000,
            averageActionTime: 5000,
            overallSuccess: true,
          },
          actionResults: [],
        };

        const event = SafetyEventFactory.createEmergencyStopCompleted(
          testEmergencyStopId,
          testUserId,
          data
        );

        expect(event.type).toBe('emergency_stop.completed');
        expect(event.data).toBe(data);
        expect(event.eventId).toMatch(/^emergency-stop-completed-\d+-[a-z0-9]+$/);
      });
    });

    describe('createEmergencyStopFailed', () => {
      it('should create emergency stop failed event with factory', () => {
        const data: EmergencyStopFailed['data'] = {
          emergencyStopId: testEmergencyStopId,
          userId: testUserId,
          portfolioId: testPortfolioId,
          triggeredAt: new Date(Date.now() - 60000),
          failedAt: new Date(),
          failureReason: 'Test failure',
          failedActions: [],
        };

        const event = SafetyEventFactory.createEmergencyStopFailed(
          testEmergencyStopId,
          testUserId,
          data
        );

        expect(event.type).toBe('emergency_stop.failed');
        expect(event.data).toBe(data);
        expect(event.eventId).toMatch(/^emergency-stop-failed-\d+-[a-z0-9]+$/);
      });
    });

    describe('createRiskProfileCreated', () => {
      it('should create risk profile created event with factory', () => {
        const data: RiskProfileCreated['data'] = {
          riskProfileId: testRiskProfileId,
          userId: testUserId,
          portfolioId: testPortfolioId,
          thresholds: {
            maxDrawdownPercent: 10.0,
            maxPositionRiskPercent: 3.0,
            maxPortfolioRiskPercent: 15.0,
            maxConcentrationPercent: 20.0,
            consecutiveLossThreshold: 3,
            dailyLossThreshold: 2.0,
            monthlyLossThreshold: 8.0,
          },
          exposures: {
            totalExposure: 50000.00,
            longExposure: 30000.00,
            shortExposure: 20000.00,
            leveragedExposure: 100000.00,
            unrealizedPnL: 0.00,
            realizedPnL: 0.00,
          },
          riskToleranceLevel: 'moderate',
          isActive: true,
        };

        const event = SafetyEventFactory.createRiskProfileCreated(
          testRiskProfileId,
          testUserId,
          data
        );

        expect(event.type).toBe('risk_profile.created');
        expect(event.aggregateId).toBe(testRiskProfileId);
        expect(event.data).toBe(data);
        expect(event.eventId).toMatch(/^risk-profile-created-\d+-[a-z0-9]+$/);
      });
    });

    describe('createRiskProfileUpdated', () => {
      it('should create risk profile updated event with factory', () => {
        const data: RiskProfileUpdated['data'] = {
          riskProfileId: testRiskProfileId,
          userId: testUserId,
          portfolioId: testPortfolioId,
          changeType: 'thresholds',
          previousValues: { test: 'old' },
          newValues: { test: 'new' },
          updatedBy: 'USER',
        };

        const event = SafetyEventFactory.createRiskProfileUpdated(
          testRiskProfileId,
          testUserId,
          data
        );

        expect(event.type).toBe('risk_profile.updated');
        expect(event.data).toBe(data);
        expect(event.eventId).toMatch(/^risk-profile-updated-\d+-[a-z0-9]+$/);
      });
    });

    describe('createRiskThresholdViolated', () => {
      it('should create risk threshold violated event with factory', () => {
        const data: RiskThresholdViolated['data'] = {
          riskProfileId: testRiskProfileId,
          userId: testUserId,
          portfolioId: testPortfolioId,
          violationType: 'drawdown_threshold',
          threshold: 10.0,
          currentValue: 15.0,
          severity: 'high',
          recommendedActions: ['Test action'],
          violationContext: {},
          detectedAt: new Date(),
        };

        const event = SafetyEventFactory.createRiskThresholdViolated(
          testRiskProfileId,
          testUserId,
          data
        );

        expect(event.type).toBe('risk_threshold.violated');
        expect(event.data).toBe(data);
        expect(event.eventId).toMatch(/^risk-threshold-violated-\d+-[a-z0-9]+$/);
      });
    });

    describe('createSafetyAlertCreated', () => {
      it('should create safety alert created event with factory', () => {
        const data: SafetyAlertCreated['data'] = {
          alertId: testAlertId,
          userId: testUserId,
          portfolioId: testPortfolioId,
          alertType: 'RISK_WARNING',
          severity: 'medium',
          title: 'Test Alert',
          message: 'Test alert message',
          sourceEntity: 'test_entity',
          sourceEntityId: 'test-123',
          requiresAction: false,
          metadata: {},
        };

        const event = SafetyEventFactory.createSafetyAlertCreated(
          testAlertId,
          testUserId,
          data
        );

        expect(event.type).toBe('safety_alert.created');
        expect(event.aggregateId).toBe(testAlertId);
        expect(event.data).toBe(data);
        expect(event.eventId).toMatch(/^safety-alert-created-\d+-[a-z0-9]+$/);
      });
    });

    describe('createSafetyAlertResolved', () => {
      it('should create safety alert resolved event with factory', () => {
        const data: SafetyAlertResolved['data'] = {
          alertId: testAlertId,
          userId: testUserId,
          portfolioId: testPortfolioId,
          resolvedAt: new Date(),
          resolvedBy: 'USER',
          resolutionMethod: 'Test resolution',
          actionsTaken: ['Test action'],
          outcome: 'SUCCESSFUL',
        };

        const event = SafetyEventFactory.createSafetyAlertResolved(
          testAlertId,
          testUserId,
          data
        );

        expect(event.type).toBe('safety_alert.resolved');
        expect(event.data).toBe(data);
        expect(event.eventId).toMatch(/^safety-alert-resolved-\d+-[a-z0-9]+$/);
      });
    });
  });

  describe('Union Type and Type Safety', () => {
    it('should support all event types in SafetyDomainEvent union', () => {
      const events: SafetyDomainEvent[] = [
        SafetyEventFactory.createEmergencyStopCreated('stop-1', 'user-1', {
          emergencyStopId: 'stop-1',
          userId: 'user-1',
          portfolioId: 'portfolio-1',
          triggerConditions: [],
          emergencyActions: [],
          isActive: true,
          autoExecute: false,
        }),
        SafetyEventFactory.createRiskProfileCreated('risk-1', 'user-1', {
          riskProfileId: 'risk-1',
          userId: 'user-1',
          portfolioId: 'portfolio-1',
          thresholds: {
            maxDrawdownPercent: 10.0,
            maxPositionRiskPercent: 3.0,
            maxPortfolioRiskPercent: 15.0,
            maxConcentrationPercent: 20.0,
            consecutiveLossThreshold: 3,
            dailyLossThreshold: 2.0,
            monthlyLossThreshold: 8.0,
          },
          exposures: {
            totalExposure: 50000.00,
            longExposure: 30000.00,
            shortExposure: 20000.00,
            leveragedExposure: 100000.00,
            unrealizedPnL: 0.00,
            realizedPnL: 0.00,
          },
          riskToleranceLevel: 'moderate',
          isActive: true,
        }),
        SafetyEventFactory.createSafetyAlertCreated('alert-1', 'user-1', {
          alertId: 'alert-1',
          userId: 'user-1',
          portfolioId: 'portfolio-1',
          alertType: 'RISK_WARNING',
          severity: 'medium',
          title: 'Test Alert',
          message: 'Test message',
          sourceEntity: 'test',
          sourceEntityId: 'test-1',
          requiresAction: false,
          metadata: {},
        }),
      ];

      expect(events).toHaveLength(3);
      events.forEach(event => {
        expect(event.type).toBeDefined();
        expect(event.aggregateId).toBeDefined();
        expect(event.userId).toBeDefined();
        expect(event.data).toBeDefined();
        expect(event.payload).toBeDefined();
        expect(event.occurredAt).toBeInstanceOf(Date);
      });

      // Type discrimination should work
      events.forEach(event => {
        switch (event.type) {
          case 'emergency_stop.created':
            expect(event.data.emergencyStopId).toBeDefined();
            expect(event.data.triggerConditions).toBeDefined();
            break;
          case 'risk_profile.created':
            expect(event.data.riskProfileId).toBeDefined();
            expect(event.data.thresholds).toBeDefined();
            break;
          case 'safety_alert.created':
            expect(event.data.alertId).toBeDefined();
            expect(event.data.alertType).toBeDefined();
            break;
        }
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle events with minimal required data', () => {
      const minimalData: EmergencyStopCreated['data'] = {
        emergencyStopId: 'minimal',
        userId: 'user',
        portfolioId: 'portfolio',
        triggerConditions: [],
        emergencyActions: [],
        isActive: false,
        autoExecute: false,
      };

      const event = SafetyEventFactory.createEmergencyStopCreated(
        'minimal',
        'user',
        minimalData
      );

      expect(event.data.triggerConditions).toHaveLength(0);
      expect(event.data.emergencyActions).toHaveLength(0);
    });

    it('should handle events with empty objects and arrays', () => {
      const data: RiskThresholdViolated['data'] = {
        riskProfileId: 'test',
        userId: 'user',
        portfolioId: 'portfolio',
        violationType: 'position_risk',
        threshold: 0,
        currentValue: 0,
        severity: 'low',
        recommendedActions: [],
        violationContext: {},
        detectedAt: new Date(),
      };

      const event = SafetyEventFactory.createRiskThresholdViolated(
        'test',
        'user',
        data
      );

      expect(event.data.recommendedActions).toHaveLength(0);
      expect(event.data.violationContext).toEqual({});
    });

    it('should handle numeric edge cases', () => {
      const data: RiskProfileCreated['data'] = {
        riskProfileId: 'test',
        userId: 'user',
        portfolioId: 'portfolio',
        thresholds: {
          maxDrawdownPercent: 0.001,
          maxPositionRiskPercent: 99.999,
          maxPortfolioRiskPercent: Infinity,
          maxConcentrationPercent: -0,
          consecutiveLossThreshold: 0,
          dailyLossThreshold: NaN,
          monthlyLossThreshold: 0.0,
        },
        exposures: {
          totalExposure: -1000.00,
          longExposure: 0.01,
          shortExposure: -0.01,
          leveragedExposure: 1e10,
          unrealizedPnL: -Infinity,
          realizedPnL: Infinity,
        },
        riskToleranceLevel: '',
        isActive: false,
      };

      const event = SafetyEventFactory.createRiskProfileCreated(
        'test',
        'user',
        data
      );

      expect(event.data.thresholds.maxDrawdownPercent).toBe(0.001);
      expect(event.data.thresholds.maxPortfolioRiskPercent).toBe(Infinity);
      expect(event.data.exposures.totalExposure).toBe(-1000.00);
      expect(event.data.exposures.realizedPnL).toBe(Infinity);
    });
  });

  describe('Performance Tests', () => {
    it('should create events efficiently through factory', () => {
      const startTime = Date.now();
      const eventCount = 1000;

      for (let i = 0; i < eventCount; i++) {
        SafetyEventFactory.createSafetyAlertCreated(`alert-${i}`, `user-${i}`, {
          alertId: `alert-${i}`,
          userId: `user-${i}`,
          portfolioId: `portfolio-${i}`,
          alertType: 'RISK_WARNING',
          severity: 'low',
          title: `Alert ${i}`,
          message: `Test alert ${i}`,
          sourceEntity: 'test',
          sourceEntityId: `test-${i}`,
          requiresAction: false,
          metadata: {},
        });
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(200); // Should create 1000 events in under 200ms
    });

    it('should handle large metadata objects efficiently', () => {
      const largeMetadata: Record<string, any> = {};
      for (let i = 0; i < 100; i++) {
        largeMetadata[`field${i}`] = `value${i}`.repeat(10);
      }

      const data: SafetyAlertCreated['data'] = {
        alertId: testAlertId,
        userId: testUserId,
        portfolioId: testPortfolioId,
        alertType: 'SYSTEM_ANOMALY',
        severity: 'low',
        title: 'Large Metadata Test',
        message: 'Testing large metadata handling',
        sourceEntity: 'test',
        sourceEntityId: 'test-123',
        requiresAction: false,
        metadata: largeMetadata,
      };

      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        SafetyEventFactory.createSafetyAlertCreated(`alert-${i}`, `user-${i}`, data);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should handle large objects efficiently
    });
  });
});