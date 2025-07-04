/**
 * Unit tests for EmergencyStop Domain Entity
 * Tests emergency stop creation, validation, execution lifecycle, and business logic
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  EmergencyStop,
  EmergencyStopStatus,
  EmergencyActionType,
  TriggerConditionType,
  TriggerPriority,
  TriggerCondition,
  EmergencyAction,
  ActionResult,
} from '../../../../../src/domain/entities/safety/emergency-stop.entity';
import { DomainValidationError } from '../../../../../src/domain/errors/trading-errors';

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../../../../utils/timeout-elimination-helpers';

describe('EmergencyStop Domain Entity', () => {
  let validTriggerConditions: TriggerCondition[];
  let validEmergencyActions: EmergencyAction[];
  let validEmergencyStopProps: any;
  let marketData: Record<string, any>;

  beforeEach(() => {
    validTriggerConditions = [
      {
        type: 'drawdown_threshold' as TriggerConditionType,
        threshold: 20,
        description: 'Maximum drawdown of 20%',
        priority: 'high' as TriggerPriority,
      },
      {
        type: 'consecutive_losses' as TriggerConditionType,
        threshold: 5,
        description: 'Maximum 5 consecutive losses',
        priority: 'critical' as TriggerPriority,
      },
    ];

    validEmergencyActions = [
      {
        type: 'close_all_positions' as EmergencyActionType,
        priority: 1,
        description: 'Close all open positions immediately',
        timeout: 5000,
        retryCount: 3,
        canRunInParallel: false,
      },
      {
        type: 'cancel_all_orders' as EmergencyActionType,
        priority: 2,
        description: 'Cancel all pending orders',
        timeout: 3000,
        retryCount: 2,
        canRunInParallel: true,
      },
      {
        type: 'notify_admin' as EmergencyActionType,
        priority: 3,
        description: 'Send notification to administrators',
        timeout: 1000,
        retryCount: 1,
        canRunInParallel: true,
      },
    ];

    validEmergencyStopProps = {
      portfolioId: 'portfolio-123',
      userId: 'user-456',
      triggerConditions: validTriggerConditions,
      emergencyActions: validEmergencyActions,
      isActive: true,
      autoExecute: true,
    };

    marketData = {
      currentDrawdown: 15,
      maxPositionRisk: 8,
      consecutiveLosses: 3,
      dailyLoss: 500,
      monthlyLoss: 2000,
      portfolioExposure: 75,
      volatility: 25,
    };
  });

  describe('EmergencyStop Creation', () => {
    it('should create emergency stop with valid props', () => {
      const emergencyStop = EmergencyStop.create(validEmergencyStopProps);

      expect(emergencyStop.portfolioId).toBe('portfolio-123');
      expect(emergencyStop.userId).toBe('user-456');
      expect(emergencyStop.triggerConditions).toEqual(validTriggerConditions);
      expect(emergencyStop.emergencyActions).toEqual(validEmergencyActions);
      expect(emergencyStop.status).toBe(EmergencyStopStatus.ARMED);
      expect(emergencyStop.isActive).toBe(true);
      expect(emergencyStop.autoExecute).toBe(true);
      expect(emergencyStop.id).toBeDefined();
      expect(emergencyStop.createdAt).toBeInstanceOf(Date);
      expect(emergencyStop.updatedAt).toBeInstanceOf(Date);
      expect(emergencyStop.version).toBe(1);
      expect(emergencyStop.actionResults).toHaveLength(0);
      expect(emergencyStop.totalExecutionTime).toBe(0);
      expect(emergencyStop.failedActions).toHaveLength(0);
    });

    it('should create emergency stop with default values', () => {
      const propsWithoutDefaults = {
        portfolioId: 'portfolio-123',
        userId: 'user-456',
        triggerConditions: validTriggerConditions,
        emergencyActions: validEmergencyActions,
      };

      const emergencyStop = EmergencyStop.create(propsWithoutDefaults);

      expect(emergencyStop.isActive).toBe(true);
      expect(emergencyStop.autoExecute).toBe(true);
    });

    it('should create emergency stop with custom configuration', () => {
      const customProps = {
        ...validEmergencyStopProps,
        isActive: false,
        autoExecute: false,
      };

      const emergencyStop = EmergencyStop.create(customProps);

      expect(emergencyStop.isActive).toBe(false);
      expect(emergencyStop.autoExecute).toBe(false);
    });

    it('should emit domain event on creation', () => {
      const emergencyStop = EmergencyStop.create(validEmergencyStopProps);
      const events = emergencyStop.getUncommittedEvents();

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('EmergencyStopCreated');
      expect(events[0].aggregateId).toBe(emergencyStop.id);
    });
  });

  describe('EmergencyStop Validation', () => {
    it('should reject emergency stop with empty trigger conditions', () => {
      const invalidProps = {
        ...validEmergencyStopProps,
        triggerConditions: [],
      };

      expect(() => EmergencyStop.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject emergency stop with empty emergency actions', () => {
      const invalidProps = {
        ...validEmergencyStopProps,
        emergencyActions: [],
      };

      expect(() => EmergencyStop.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject invalid threshold for percentage-based conditions', () => {
      const invalidProps = {
        ...validEmergencyStopProps,
        triggerConditions: [
          {
            type: 'drawdown_threshold' as TriggerConditionType,
            threshold: 150, // > 100%
            description: 'Invalid threshold',
            priority: 'high' as TriggerPriority,
          },
        ],
      };

      expect(() => EmergencyStop.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject negative threshold for percentage-based conditions', () => {
      const invalidProps = {
        ...validEmergencyStopProps,
        triggerConditions: [
          {
            type: 'position_risk' as TriggerConditionType,
            threshold: -5, // Negative
            description: 'Invalid threshold',
            priority: 'medium' as TriggerPriority,
          },
        ],
      };

      expect(() => EmergencyStop.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject non-integer threshold for consecutive losses', () => {
      const invalidProps = {
        ...validEmergencyStopProps,
        triggerConditions: [
          {
            type: 'consecutive_losses' as TriggerConditionType,
            threshold: 5.5, // Non-integer
            description: 'Invalid threshold',
            priority: 'high' as TriggerPriority,
          },
        ],
      };

      expect(() => EmergencyStop.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject duplicate action priorities', () => {
      const invalidProps = {
        ...validEmergencyStopProps,
        emergencyActions: [
          {
            type: 'close_all_positions' as EmergencyActionType,
            priority: 1,
            description: 'Action 1',
            timeout: 5000,
            retryCount: 3,
          },
          {
            type: 'cancel_all_orders' as EmergencyActionType,
            priority: 1, // Duplicate priority
            description: 'Action 2',
            timeout: 3000,
            retryCount: 2,
          },
        ],
      };

      expect(() => EmergencyStop.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject actions with negative timeouts', () => {
      const invalidProps = {
        ...validEmergencyStopProps,
        emergencyActions: [
          {
            type: 'notify_admin' as EmergencyActionType,
            priority: 1,
            description: 'Invalid action',
            timeout: -1000, // Negative timeout
            retryCount: 1,
          },
        ],
      };

      expect(() => EmergencyStop.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject actions with timeout below minimum', () => {
      const invalidProps = {
        ...validEmergencyStopProps,
        emergencyActions: [
          {
            type: 'send_alert' as EmergencyActionType,
            priority: 1,
            description: 'Invalid action',
            timeout: 500, // < 1000ms minimum
            retryCount: 1,
          },
        ],
      };

      expect(() => EmergencyStop.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject empty IDs', () => {
      const invalidProps = {
        ...validEmergencyStopProps,
        portfolioId: '',
      };

      expect(() => EmergencyStop.create(invalidProps)).toThrow(DomainValidationError);
    });
  });

  describe('Trigger Condition Evaluation', () => {
    let emergencyStop: EmergencyStop;

    beforeEach(() => {
      emergencyStop = EmergencyStop.create(validEmergencyStopProps);
    });

    it('should evaluate drawdown condition correctly', () => {
      const condition = validTriggerConditions[0]; // drawdown_threshold: 20
      const result = emergencyStop.evaluateTriggerCondition(condition, {
        currentDrawdown: 25, // > 20
      });

      expect(result.isTriggered).toBe(true);
      expect(result.actualValue).toBe(25);
      expect(result.threshold).toBe(20);
      expect(result.severity).toBe('high');
      expect(result.message).toContain('25 >= 20');
    });

    it('should evaluate consecutive losses condition correctly', () => {
      const condition = validTriggerConditions[1]; // consecutive_losses: 5
      const result = emergencyStop.evaluateTriggerCondition(condition, {
        consecutiveLosses: 6, // > 5
      });

      expect(result.isTriggered).toBe(true);
      expect(result.actualValue).toBe(6);
      expect(result.threshold).toBe(5);
      expect(result.severity).toBe('critical');
    });

    it('should not trigger when condition is not met', () => {
      const condition = validTriggerConditions[0]; // drawdown_threshold: 20
      const result = emergencyStop.evaluateTriggerCondition(condition, {
        currentDrawdown: 15, // < 20
      });

      expect(result.isTriggered).toBe(false);
      expect(result.actualValue).toBe(15);
      expect(result.threshold).toBe(20);
      expect(result.message).toContain('15 < 20');
    });

    it('should handle missing market data gracefully', () => {
      const condition = validTriggerConditions[0];
      const result = emergencyStop.evaluateTriggerCondition(condition, {});

      expect(result.isTriggered).toBe(false);
      expect(result.actualValue).toBe(0); // Default value
    });

    it('should evaluate all trigger conditions', () => {
      const evaluation = emergencyStop.evaluateTriggerConditions({
        currentDrawdown: 25, // Triggers first condition
        consecutiveLosses: 6, // Triggers second condition
      });

      expect(evaluation.isEmergencyTriggered).toBe(true);
      expect(evaluation.triggeredConditions).toHaveLength(2);
      expect(evaluation.highestSeverity).toBe('critical');
      expect(evaluation.prioritizedConditions[0].priority).toBe('critical'); // Highest priority first
    });

    it('should not trigger when no conditions are met', () => {
      const evaluation = emergencyStop.evaluateTriggerConditions({
        currentDrawdown: 10, // < 20
        consecutiveLosses: 3, // < 5
      });

      expect(evaluation.isEmergencyTriggered).toBe(false);
      expect(evaluation.triggeredConditions).toHaveLength(0);
      expect(evaluation.highestSeverity).toBe('low');
    });

    it('should prioritize conditions correctly', () => {
      const multiConditionStop = EmergencyStop.create({
        ...validEmergencyStopProps,
        triggerConditions: [
          {
            type: 'drawdown_threshold' as TriggerConditionType,
            threshold: 15,
            description: 'Low priority condition',
            priority: 'low' as TriggerPriority,
          },
          {
            type: 'position_risk' as TriggerConditionType,
            threshold: 10,
            description: 'Medium priority condition',
            priority: 'medium' as TriggerPriority,
          },
          {
            type: 'consecutive_losses' as TriggerConditionType,
            threshold: 3,
            description: 'Critical priority condition',
            priority: 'critical' as TriggerPriority,
          },
        ],
      });

      const evaluation = multiConditionStop.evaluateTriggerConditions({
        currentDrawdown: 20, // Triggers low priority
        maxPositionRisk: 15, // Triggers medium priority
        consecutiveLosses: 5, // Triggers critical priority
      });

      expect(evaluation.prioritizedConditions[0].priority).toBe('critical');
      expect(evaluation.prioritizedConditions[1].priority).toBe('medium');
      expect(evaluation.prioritizedConditions[2].priority).toBe('low');
    });
  });

  describe('Emergency Stop Execution Lifecycle', () => {
    let emergencyStop: EmergencyStop;

    beforeEach(() => {
      emergencyStop = EmergencyStop.create(validEmergencyStopProps);
      emergencyStop.markEventsAsCommitted(); // Clear creation event
    });

    it('should trigger emergency stop successfully', () => {
      const triggeredStop = emergencyStop.trigger('Drawdown exceeded threshold', {
        drawdown: 25,
        portfolio: 'main',
      });

      expect(triggeredStop.status).toBe(EmergencyStopStatus.TRIGGERED);
      expect(triggeredStop.triggerReason).toBe('Drawdown exceeded threshold');
      expect(triggeredStop.triggerData).toEqual({ drawdown: 25, portfolio: 'main' });
      expect(triggeredStop.lastTriggered).toBeInstanceOf(Date);
      expect(triggeredStop.version).toBe(2);

      const events = triggeredStop.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('EmergencyStopTriggered');
    });

    it('should reject triggering inactive emergency stop', () => {
      const inactiveStop = emergencyStop.deactivate();

      expect(() => inactiveStop.trigger('Test reason')).toThrow(DomainValidationError);
    });

    it('should reject triggering already triggered emergency stop', () => {
      const triggeredStop = emergencyStop.trigger('First trigger');

      expect(() => triggeredStop.trigger('Second trigger')).toThrow(DomainValidationError);
    });

    it('should execute actions successfully', () => {
      const triggeredStop = emergencyStop.trigger('Test trigger');
      triggeredStop.markEventsAsCommitted();

      const actionResults: ActionResult[] = [
        {
          actionType: 'close_all_positions',
          success: true,
          duration: 2000,
        },
        {
          actionType: 'cancel_all_orders',
          success: true,
          duration: 1500,
        },
      ];

      const executingStop = triggeredStop.executeActions(actionResults);

      expect(executingStop.status).toBe(EmergencyStopStatus.EXECUTING);
      expect(executingStop.actionResults).toEqual(actionResults);
      expect(executingStop.totalExecutionTime).toBe(3500);
      expect(executingStop.failedActions).toHaveLength(0);
      expect(executingStop.version).toBe(3);
    });

    it('should handle failed actions', () => {
      const triggeredStop = emergencyStop.trigger('Test trigger');

      const actionResults: ActionResult[] = [
        {
          actionType: 'close_all_positions',
          success: false,
          duration: 1000,
          error: 'Connection timeout',
        },
        {
          actionType: 'cancel_all_orders',
          success: true,
          duration: 1500,
        },
      ];

      const partialFailureStop = triggeredStop.executeActions(actionResults);

      expect(partialFailureStop.status).toBe(EmergencyStopStatus.PARTIAL_FAILURE);
      expect(partialFailureStop.failedActions).toHaveLength(1);
      expect(partialFailureStop.failedActions[0].error).toBe('Connection timeout');
    });

    it('should mark as failed when all actions fail', () => {
      const triggeredStop = emergencyStop.trigger('Test trigger');

      const actionResults: ActionResult[] = [
        {
          actionType: 'close_all_positions',
          success: false,
          duration: 1000,
          error: 'Error 1',
        },
        {
          actionType: 'cancel_all_orders',
          success: false,
          duration: 1500,
          error: 'Error 2',
        },
      ];

      const failedStop = triggeredStop.executeActions(actionResults);

      expect(failedStop.status).toBe(EmergencyStopStatus.FAILED);
      expect(failedStop.failedActions).toHaveLength(2);
    });

    it('should complete successfully', () => {
      const triggeredStop = emergencyStop.trigger('Test trigger');
      const executingStop = triggeredStop.executeActions([
        { actionType: 'close_all_positions', success: true, duration: 2000 },
      ]);
      executingStop.markEventsAsCommitted();

      const completedStop = executingStop.markAsCompleted();

      expect(completedStop.status).toBe(EmergencyStopStatus.COMPLETED);
      expect(completedStop.completedAt).toBeInstanceOf(Date);
      expect(completedStop.version).toBe(4);

      const events = completedStop.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('EmergencyStopCompleted');
    });

    it('should complete from partial failure state', () => {
      const triggeredStop = emergencyStop.trigger('Test trigger');
      const partialFailureStop = triggeredStop.executeActions([
        { actionType: 'close_all_positions', success: true, duration: 2000 },
        { actionType: 'cancel_all_orders', success: false, duration: 1000, error: 'Failed' },
      ]);

      const completedStop = partialFailureStop.markAsCompleted();

      expect(completedStop.status).toBe(EmergencyStopStatus.COMPLETED);
      expect(completedStop.completedAt).toBeInstanceOf(Date);
    });

    it('should reject completion from invalid states', () => {
      expect(() => emergencyStop.markAsCompleted()).toThrow(DomainValidationError);

      const triggeredStop = emergencyStop.trigger('Test trigger');
      expect(() => triggeredStop.markAsCompleted()).toThrow(DomainValidationError);
    });

    it('should mark as failed with reason', () => {
      const triggeredStop = emergencyStop.trigger('Test trigger');
      triggeredStop.markEventsAsCommitted();

      const failedStop = triggeredStop.markAsFailed('System error occurred');

      expect(failedStop.status).toBe(EmergencyStopStatus.FAILED);
      expect(failedStop.failureReason).toBe('System error occurred');
      expect(failedStop.completedAt).toBeInstanceOf(Date);

      const events = failedStop.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('EmergencyStopFailed');
    });

    it('should reject marking already completed stop as failed', () => {
      const triggeredStop = emergencyStop.trigger('Test trigger');
      const executingStop = triggeredStop.executeActions([
        { actionType: 'close_all_positions', success: true, duration: 2000 },
      ]);
      const completedStop = executingStop.markAsCompleted();

      expect(() => completedStop.markAsFailed('Test reason')).toThrow(DomainValidationError);
    });
  });

  describe('Coordination Plan Generation', () => {
    let emergencyStop: EmergencyStop;

    beforeEach(() => {
      const complexActions: EmergencyAction[] = [
        {
          type: 'close_all_positions',
          priority: 1, // Highest priority, sequential
          description: 'Close positions first',
          timeout: 5000,
          retryCount: 3,
          canRunInParallel: false,
        },
        {
          type: 'cancel_all_orders',
          priority: 2, // Second priority, can run in parallel
          description: 'Cancel orders',
          timeout: 3000,
          retryCount: 2,
          canRunInParallel: true,
        },
        {
          type: 'notify_admin',
          priority: 2, // Same priority, can run in parallel
          description: 'Notify admin',
          timeout: 1000,
          retryCount: 1,
          canRunInParallel: true,
        },
        {
          type: 'send_alert',
          priority: 3, // Lower priority, sequential
          description: 'Send alert',
          timeout: 2000,
          retryCount: 1,
          canRunInParallel: false,
        },
      ];

      emergencyStop = EmergencyStop.create({
        ...validEmergencyStopProps,
        emergencyActions: complexActions,
      });
    });

    it('should create coordination plan with parallel and sequential groups', () => {
      const plan = emergencyStop.createCoordinationPlan();

      expect(plan.parallelGroups).toHaveLength(1);
      expect(plan.parallelGroups[0]).toHaveLength(2); // cancel_all_orders and notify_admin
      expect(plan.sequentialSteps).toHaveLength(2); // close_all_positions and send_alert
      expect(plan.totalEstimatedTime).toBe(10000); // 5000 + max(3000, 1000) + 2000
      expect(plan.criticalPath).toHaveLength(2); // Priority 1 and 2 actions
    });

    it('should prioritize actions correctly in coordination plan', () => {
      const plan = emergencyStop.createCoordinationPlan();

      // First sequential action should be highest priority
      expect(plan.sequentialSteps[0].priority).toBe(1);
      expect(plan.sequentialSteps[0].type).toBe('close_all_positions');

      // Parallel group should contain same-priority actions
      const parallelTypes = plan.parallelGroups[0].map(action => action.type);
      expect(parallelTypes).toContain('cancel_all_orders');
      expect(parallelTypes).toContain('notify_admin');
    });
  });

  describe('Execution Summary Generation', () => {
    let emergencyStop: EmergencyStop;

    beforeEach(() => {
      emergencyStop = EmergencyStop.create(validEmergencyStopProps);
    });

    it('should generate execution summary for successful execution', () => {
      const triggeredStop = emergencyStop.trigger('Test trigger');
      const executedStop = triggeredStop.executeActions([
        { actionType: 'close_all_positions', success: true, duration: 2000 },
        { actionType: 'cancel_all_orders', success: true, duration: 1500 },
        { actionType: 'notify_admin', success: true, duration: 500 },
      ]);

      const summary = executedStop.generateExecutionSummary();

      expect(summary.totalActions).toBe(3);
      expect(summary.successfulActions).toBe(3);
      expect(summary.failedActions).toBe(0);
      expect(summary.totalExecutionTime).toBe(4000);
      expect(summary.averageActionTime).toBe(4000 / 3);
      expect(summary.overallSuccess).toBe(true);
      expect(summary.criticalActionsFailed).toBe(false);
    });

    it('should generate execution summary for partial failure', () => {
      const triggeredStop = emergencyStop.trigger('Test trigger');
      const executedStop = triggeredStop.executeActions([
        { actionType: 'close_all_positions', success: false, duration: 2000, error: 'Failed' },
        { actionType: 'cancel_all_orders', success: true, duration: 1500 },
        { actionType: 'notify_admin', success: true, duration: 500 },
      ]);

      const summary = executedStop.generateExecutionSummary();

      expect(summary.totalActions).toBe(3);
      expect(summary.successfulActions).toBe(2);
      expect(summary.failedActions).toBe(1);
      expect(summary.overallSuccess).toBe(false);
      expect(summary.criticalActionsFailed).toBe(true); // close_all_positions is priority 1 (critical)
    });

    it('should handle empty execution summary', () => {
      const summary = emergencyStop.generateExecutionSummary();

      expect(summary.totalActions).toBe(0);
      expect(summary.successfulActions).toBe(0);
      expect(summary.failedActions).toBe(0);
      expect(summary.averageActionTime).toBe(0);
      expect(summary.overallSuccess).toBe(false);
    });
  });

  describe('Emergency Stop State Management', () => {
    let emergencyStop: EmergencyStop;

    beforeEach(() => {
      emergencyStop = EmergencyStop.create(validEmergencyStopProps);
    });

    it('should reset completed emergency stop', () => {
      const triggeredStop = emergencyStop.trigger('Test trigger');
      const executedStop = triggeredStop.executeActions([
        { actionType: 'close_all_positions', success: true, duration: 2000 },
      ]);
      const completedStop = executedStop.markAsCompleted();

      const resetStop = completedStop.reset();

      expect(resetStop.status).toBe(EmergencyStopStatus.ARMED);
      expect(resetStop.lastTriggered).toBeUndefined();
      expect(resetStop.triggerReason).toBeUndefined();
      expect(resetStop.triggerData).toBeUndefined();
      expect(resetStop.actionResults).toHaveLength(0);
      expect(resetStop.totalExecutionTime).toBe(0);
      expect(resetStop.failedActions).toHaveLength(0);
      expect(resetStop.completedAt).toBeUndefined();
      expect(resetStop.failureReason).toBeUndefined();
    });

    it('should reset failed emergency stop', () => {
      const triggeredStop = emergencyStop.trigger('Test trigger');
      const failedStop = triggeredStop.markAsFailed('System error');

      const resetStop = failedStop.reset();

      expect(resetStop.status).toBe(EmergencyStopStatus.ARMED);
      expect(resetStop.failureReason).toBeUndefined();
    });

    it('should reject resetting non-final states', () => {
      expect(() => emergencyStop.reset()).toThrow(DomainValidationError);

      const triggeredStop = emergencyStop.trigger('Test trigger');
      expect(() => triggeredStop.reset()).toThrow(DomainValidationError);
    });

    it('should recover from failed state', () => {
      const triggeredStop = emergencyStop.trigger('Test trigger');
      const failedStop = triggeredStop.markAsFailed('System error');

      const recoveredStop = failedStop.recover('Issue resolved');

      expect(recoveredStop.status).toBe(EmergencyStopStatus.ARMED);
      expect(recoveredStop.failureReason).toBeUndefined();
    });

    it('should reject recovery from non-failed state', () => {
      expect(() => emergencyStop.recover('Test recovery')).toThrow(DomainValidationError);
    });

    it('should activate inactive emergency stop', () => {
      const inactiveStop = emergencyStop.deactivate();
      const activatedStop = inactiveStop.activate();

      expect(activatedStop.isActive).toBe(true);
      expect(activatedStop.status).toBe(EmergencyStopStatus.ARMED);
    });

    it('should not change state when already active', () => {
      const stillActive = emergencyStop.activate();

      expect(stillActive).toBe(emergencyStop); // Same instance
    });

    it('should deactivate active emergency stop', () => {
      const deactivatedStop = emergencyStop.deactivate();

      expect(deactivatedStop.isActive).toBe(false);
      expect(deactivatedStop.status).toBe(EmergencyStopStatus.INACTIVE);
    });

    it('should not change state when already inactive', () => {
      const inactiveStop = emergencyStop.deactivate();
      const stillInactive = inactiveStop.deactivate();

      expect(stillInactive).toBe(inactiveStop); // Same instance
    });
  });

  describe('Configuration Updates', () => {
    let emergencyStop: EmergencyStop;

    beforeEach(() => {
      emergencyStop = EmergencyStop.create(validEmergencyStopProps);
    });

    it('should update trigger conditions', () => {
      const newConditions: TriggerCondition[] = [
        {
          type: 'daily_loss_threshold',
          threshold: 1000,
          description: 'Daily loss limit',
          priority: 'medium',
        },
      ];

      const updatedStop = emergencyStop.updateTriggerConditions(newConditions);

      expect(updatedStop.triggerConditions).toEqual(newConditions);
      expect(updatedStop.version).toBe(2);
    });

    it('should reject empty trigger conditions update', () => {
      expect(() => emergencyStop.updateTriggerConditions([])).toThrow(DomainValidationError);
    });

    it('should update emergency actions', () => {
      const newActions: EmergencyAction[] = [
        {
          type: 'halt_trading',
          priority: 1,
          description: 'Stop all trading',
          timeout: 2000,
          retryCount: 1,
        },
      ];

      const updatedStop = emergencyStop.updateEmergencyActions(newActions);

      expect(updatedStop.emergencyActions).toEqual(newActions);
      expect(updatedStop.version).toBe(2);
    });

    it('should reject empty emergency actions update', () => {
      expect(() => emergencyStop.updateEmergencyActions([])).toThrow(DomainValidationError);
    });

    it('should enable auto execution', () => {
      const manualStop = EmergencyStop.create({
        ...validEmergencyStopProps,
        autoExecute: false,
      });

      const autoExecuteStop = manualStop.enableAutoExecution();

      expect(autoExecuteStop.autoExecute).toBe(true);
    });

    it('should not change state when auto execution already enabled', () => {
      const stillAutoExecute = emergencyStop.enableAutoExecution();

      expect(stillAutoExecute).toBe(emergencyStop); // Same instance
    });

    it('should disable auto execution', () => {
      const manualStop = emergencyStop.disableAutoExecution();

      expect(manualStop.autoExecute).toBe(false);
    });
  });

  describe('EmergencyStop from Existing', () => {
    it('should create emergency stop from existing props', () => {
      const existingProps = {
        id: 'existing-emergency-stop-123',
        portfolioId: 'portfolio-789',
        userId: 'user-abc',
        triggerConditions: validTriggerConditions,
        emergencyActions: validEmergencyActions,
        status: EmergencyStopStatus.COMPLETED,
        isActive: false,
        autoExecute: true,
        lastTriggered: new Date('2024-01-15'),
        triggerReason: 'Test trigger',
        triggerData: { test: 'data' },
        actionResults: [],
        totalExecutionTime: 5000,
        failedActions: [],
        completedAt: new Date('2024-01-15'),
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-15'),
        version: 3,
      };

      const emergencyStop = EmergencyStop.fromExisting(existingProps);

      expect(emergencyStop.id).toBe('existing-emergency-stop-123');
      expect(emergencyStop.portfolioId).toBe('portfolio-789');
      expect(emergencyStop.userId).toBe('user-abc');
      expect(emergencyStop.status).toBe(EmergencyStopStatus.COMPLETED);
      expect(emergencyStop.isActive).toBe(false);
      expect(emergencyStop.triggerReason).toBe('Test trigger');
      expect(emergencyStop.totalExecutionTime).toBe(5000);
      expect(emergencyStop.version).toBe(3);
    });

    it('should validate existing props', () => {
      const invalidExistingProps = {
        id: 'existing-emergency-stop-123',
        portfolioId: '', // Invalid empty ID
        userId: 'user-abc',
        triggerConditions: validTriggerConditions,
        emergencyActions: validEmergencyActions,
        status: EmergencyStopStatus.ARMED,
        isActive: true,
        autoExecute: true,
        actionResults: [],
        totalExecutionTime: 0,
        failedActions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      };

      expect(() => EmergencyStop.fromExisting(invalidExistingProps)).toThrow(DomainValidationError);
    });
  });

  describe('EmergencyStop Serialization', () => {
    it('should convert to plain object', () => {
      const emergencyStop = EmergencyStop.create(validEmergencyStopProps);
      const plainObject = emergencyStop.toPlainObject();

      expect(plainObject.id).toBe(emergencyStop.id);
      expect(plainObject.portfolioId).toBe(emergencyStop.portfolioId);
      expect(plainObject.userId).toBe(emergencyStop.userId);
      expect(plainObject.triggerConditions).toEqual(emergencyStop.triggerConditions);
      expect(plainObject.emergencyActions).toEqual(emergencyStop.emergencyActions);
      expect(plainObject.status).toBe(emergencyStop.status);
      expect(plainObject.isActive).toBe(emergencyStop.isActive);
      expect(plainObject.autoExecute).toBe(emergencyStop.autoExecute);
      expect(plainObject.createdAt).toBe(emergencyStop.createdAt);
      expect(plainObject.updatedAt).toBe(emergencyStop.updatedAt);
      expect(plainObject.version).toBe(emergencyStop.version);
    });
  });

  describe('Domain Events', () => {
    it('should emit creation event with correct data', () => {
      const emergencyStop = EmergencyStop.create(validEmergencyStopProps);
      const events = emergencyStop.getUncommittedEvents();

      expect(events).toHaveLength(1);
      
      const creationEvent = events[0];
      expect(creationEvent.type).toBe('EmergencyStopCreated');
      expect(creationEvent.aggregateId).toBe(emergencyStop.id);
      expect(creationEvent.userId).toBe('user-456');
      expect(creationEvent.data.emergencyStopId).toBe(emergencyStop.id);
      expect(creationEvent.data.portfolioId).toBe('portfolio-123');
      expect(creationEvent.data.triggerConditions).toEqual(validTriggerConditions);
      expect(creationEvent.data.emergencyActions).toEqual(validEmergencyActions);
    });

    it('should emit trigger event with correct data', () => {
      const emergencyStop = EmergencyStop.create(validEmergencyStopProps);
      emergencyStop.markEventsAsCommitted();

      const triggeredStop = emergencyStop.trigger('Drawdown exceeded', { drawdown: 25 });
      const events = triggeredStop.getUncommittedEvents();

      expect(events).toHaveLength(1);
      
      const triggerEvent = events[0];
      expect(triggerEvent.type).toBe('EmergencyStopTriggered');
      expect(triggerEvent.data.reason).toBe('Drawdown exceeded');
      expect(triggerEvent.data.triggerData).toEqual({ drawdown: 25 });
      expect(triggerEvent.data.scheduledActions).toHaveLength(3);
    });

    it('should emit completion event with execution summary', () => {
      const emergencyStop = EmergencyStop.create(validEmergencyStopProps);
      const triggeredStop = emergencyStop.trigger('Test trigger');
      const executedStop = triggeredStop.executeActions([
        { actionType: 'close_all_positions', success: true, duration: 2000 },
      ]);
      executedStop.markEventsAsCommitted();

      const completedStop = executedStop.markAsCompleted();
      const events = completedStop.getUncommittedEvents();

      expect(events).toHaveLength(1);
      
      const completionEvent = events[0];
      expect(completionEvent.type).toBe('EmergencyStopCompleted');
      expect(completionEvent.data.executionSummary).toBeDefined();
      expect(completionEvent.data.actionResults).toHaveLength(1);
    });

    it('should emit failure event with error details', () => {
      const emergencyStop = EmergencyStop.create(validEmergencyStopProps);
      const triggeredStop = emergencyStop.trigger('Test trigger');
      triggeredStop.markEventsAsCommitted();

      const failedStop = triggeredStop.markAsFailed('System failure');
      const events = failedStop.getUncommittedEvents();

      expect(events).toHaveLength(1);
      
      const failureEvent = events[0];
      expect(failureEvent.type).toBe('EmergencyStopFailed');
      expect(failureEvent.data.failureReason).toBe('System failure');
      expect(failureEvent.data.failedActions).toBeDefined();
    });

    it('should clear events when marked as committed', () => {
      const emergencyStop = EmergencyStop.create(validEmergencyStopProps);
      expect(emergencyStop.getUncommittedEvents()).toHaveLength(1);

      emergencyStop.markEventsAsCommitted();
      expect(emergencyStop.getUncommittedEvents()).toHaveLength(0);
    });
  });

  describe('Performance Tests', () => {
    it('should create emergency stops efficiently', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        EmergencyStop.create({
          ...validEmergencyStopProps,
          portfolioId: `portfolio-${i}`,
        });
      }
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500); // Should create 100 stops in under 500ms
    });

    it('should evaluate trigger conditions efficiently', () => {
      const emergencyStop = EmergencyStop.create(validEmergencyStopProps);
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        emergencyStop.evaluateTriggerConditions({
          currentDrawdown: i % 50,
          consecutiveLosses: i % 10,
        });
      }
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should evaluate 1000 times in under 100ms
    });

    it('should generate coordination plans efficiently', () => {
      const emergencyStop = EmergencyStop.create(validEmergencyStopProps);
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        emergencyStop.createCoordinationPlan();
      }
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(50); // Should generate 1000 plans in under 50ms
    });
  });
});