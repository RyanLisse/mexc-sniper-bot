/**
 * EmergencyStop Domain Entity Unit Tests
 *
 * Comprehensive test suite for the EmergencyStop entity covering:
 * - Entity creation and validation
 * - Emergency action coordination
 * - Domain events generation
 * - Trigger condition evaluation
 * - Execution tracking and failure handling
 * - Recovery and completion workflows
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EmergencyStop } from "@/src/domain/entities/safety/emergency-stop.entity";
import { DomainValidationError } from "@/src/domain/errors/trading-errors";
import {
  EmergencyStopCreated,
  EmergencyStopTriggered,
  EmergencyStopCompleted,
  EmergencyStopFailed,
} from "@/src/domain/events/safety-events";
import { CleanArchitectureAssertions } from "../../../../utils/clean-architecture-test-utilities";

describe("EmergencyStop Entity", () => {
  let validEmergencyStopProps: any;

  beforeEach(() => {
    validEmergencyStopProps = {
      portfolioId: "portfolio_123",
      userId: "user_456",
      triggerConditions: [
        {
          type: "drawdown_threshold" as const,
          threshold: 20.0,
          description: "Maximum drawdown exceeded",
          priority: "high" as const,
        },
        {
          type: "position_risk" as const,
          threshold: 10.0,
          description: "Individual position risk too high",
          priority: "medium" as const,
        },
      ],
      emergencyActions: [
        {
          type: "close_all_positions" as const,
          priority: 1,
          description: "Close all open positions immediately",
          timeout: 30000,
          retryCount: 3,
        },
        {
          type: "cancel_all_orders" as const,
          priority: 2,
          description: "Cancel all pending orders",
          timeout: 15000,
          retryCount: 2,
        },
        {
          type: "notify_admin" as const,
          priority: 3,
          description: "Send emergency notification to administrators",
          timeout: 5000,
          retryCount: 1,
        },
      ],
      isActive: true,
      autoExecute: true,
    };
  });

  describe("Entity Creation", () => {
    it("should create a valid EmergencyStop with proper validation", () => {
      const emergencyStop = EmergencyStop.create(validEmergencyStopProps);

      CleanArchitectureAssertions.assertDomainEntity(emergencyStop, "EmergencyStop");
      expect(emergencyStop.portfolioId).toBe(validEmergencyStopProps.portfolioId);
      expect(emergencyStop.userId).toBe(validEmergencyStopProps.userId);
      expect(emergencyStop.isActive).toBe(true);
      expect(emergencyStop.autoExecute).toBe(true);
    });

    it("should generate EmergencyStopCreated domain event on creation", () => {
      const emergencyStop = EmergencyStop.create(validEmergencyStopProps);

      const events = emergencyStop.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(EmergencyStopCreated);
      expect(events[0].data.portfolioId).toBe(validEmergencyStopProps.portfolioId);
    });

    it("should restore from existing data without generating events", () => {
      const existingData = {
        ...validEmergencyStopProps,
        id: "emergency_stop_existing",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-02"),
        version: 2,
        status: "armed" as const,
        lastTriggered: new Date("2024-01-01T10:30:00Z"),
      };

      const emergencyStop = EmergencyStop.fromExisting(existingData);

      expect(emergencyStop.id).toBe("emergency_stop_existing");
      expect(emergencyStop.version).toBe(2);
      expect(emergencyStop.status).toBe("armed");
      expect(emergencyStop.getUncommittedEvents()).toHaveLength(0);
    });

    it("should throw validation error for empty trigger conditions", () => {
      const invalidProps = { ...validEmergencyStopProps, triggerConditions: [] };

      expect(() => EmergencyStop.create(invalidProps)).toThrow(DomainValidationError);
    });

    it("should throw validation error for empty emergency actions", () => {
      const invalidProps = { ...validEmergencyStopProps, emergencyActions: [] };

      expect(() => EmergencyStop.create(invalidProps)).toThrow(DomainValidationError);
    });

    it("should throw validation error for invalid threshold values", () => {
      const invalidProps = {
        ...validEmergencyStopProps,
        triggerConditions: [
          {
            type: "drawdown_threshold" as const,
            threshold: -5.0, // Negative threshold
            description: "Invalid threshold",
            priority: "high" as const,
          },
        ],
      };

      expect(() => EmergencyStop.create(invalidProps)).toThrow(DomainValidationError);
    });

    it("should throw validation error for duplicate action priorities", () => {
      const invalidProps = {
        ...validEmergencyStopProps,
        emergencyActions: [
          {
            type: "close_all_positions" as const,
            priority: 1,
            description: "First action",
            timeout: 30000,
            retryCount: 3,
          },
          {
            type: "cancel_all_orders" as const,
            priority: 1, // Duplicate priority
            description: "Second action",
            timeout: 15000,
            retryCount: 2,
          },
        ],
      };

      expect(() => EmergencyStop.create(invalidProps)).toThrow(DomainValidationError);
    });
  });

  describe("Trigger Condition Evaluation", () => {
    let emergencyStop: EmergencyStop;

    beforeEach(() => {
      emergencyStop = EmergencyStop.create(validEmergencyStopProps);
      emergencyStop.markEventsAsCommitted();
    });

    it("should evaluate single trigger condition correctly", () => {
      const marketData = { currentDrawdown: 25.0 }; // Above 20% threshold

      const result = emergencyStop.evaluateTriggerCondition(
        emergencyStop.triggerConditions[0],
        marketData
      );

      expect(result.isTriggered).toBe(true);
      expect(result.actualValue).toBe(25.0);
      expect(result.threshold).toBe(20.0);
      expect(result.severity).toBe("high");
    });

    it("should evaluate multiple trigger conditions", () => {
      const marketData = {
        currentDrawdown: 25.0, // Above 20% threshold
        maxPositionRisk: 15.0, // Above 10% threshold
      };

      const results = emergencyStop.evaluateTriggerConditions(marketData);

      expect(results.triggeredConditions).toHaveLength(2);
      expect(results.isEmergencyTriggered).toBe(true);
      expect(results.highestSeverity).toBe("high");
    });

    it("should not trigger when conditions are not met", () => {
      const marketData = {
        currentDrawdown: 15.0, // Below 20% threshold
        maxPositionRisk: 8.0, // Below 10% threshold
      };

      const results = emergencyStop.evaluateTriggerConditions(marketData);

      expect(results.triggeredConditions).toHaveLength(0);
      expect(results.isEmergencyTriggered).toBe(false);
      expect(results.highestSeverity).toBe("low");
    });

    it("should prioritize conditions by severity", () => {
      const marketData = {
        currentDrawdown: 25.0, // High priority trigger
        maxPositionRisk: 12.0, // Medium priority trigger
      };

      const results = emergencyStop.evaluateTriggerConditions(marketData);

      expect(results.prioritizedConditions[0].priority).toBe("high");
      expect(results.prioritizedConditions[1].priority).toBe("medium");
    });

    it("should handle custom trigger condition types", () => {
      const customEmergencyStop = EmergencyStop.create({
        ...validEmergencyStopProps,
        triggerConditions: [
          {
            type: "consecutive_losses" as const,
            threshold: 5,
            description: "Too many consecutive losses",
            priority: "medium" as const,
          },
        ],
      });

      const marketData = { consecutiveLosses: 7 };

      const results = customEmergencyStop.evaluateTriggerConditions(marketData);

      expect(results.isEmergencyTriggered).toBe(true);
      expect(results.triggeredConditions[0].type).toBe("consecutive_losses");
    });
  });

  describe("Emergency Action Execution", () => {
    let emergencyStop: EmergencyStop;

    beforeEach(() => {
      emergencyStop = EmergencyStop.create(validEmergencyStopProps);
      emergencyStop.markEventsAsCommitted();
    });

    it("should trigger emergency stop and generate domain event", () => {
      const triggerReason = "Portfolio drawdown exceeded 20%";
      const triggerData = { currentDrawdown: 25.0 };

      const triggeredStop = emergencyStop.trigger(triggerReason, triggerData);

      expect(triggeredStop.status).toBe("triggered");
      expect(triggeredStop.lastTriggered).toBeInstanceOf(Date);
      expect(triggeredStop.version).toBe(emergencyStop.version + 1);

      const events = triggeredStop.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(EmergencyStopTriggered);

      const triggerEvent = events[0] as EmergencyStopTriggered;
      expect(triggerEvent.data.reason).toBe(triggerReason);
      expect(triggerEvent.data.triggerData).toEqual(triggerData);
    });

    it("should execute emergency actions in priority order", () => {
      const mockExecutionResults = [
        { actionType: "close_all_positions", success: true, duration: 15000 },
        { actionType: "cancel_all_orders", success: true, duration: 8000 },
        { actionType: "notify_admin", success: true, duration: 2000 },
      ];

      const executedStop = emergencyStop.executeActions(mockExecutionResults);

      expect(executedStop.status).toBe("executing");
      expect(executedStop.actionResults).toHaveLength(3);
      expect(executedStop.actionResults[0].actionType).toBe("close_all_positions");
      expect(executedStop.totalExecutionTime).toBe(25000);
    });

    it("should handle partial action failures gracefully", () => {
      const mockExecutionResults = [
        { actionType: "close_all_positions", success: true, duration: 15000 },
        { 
          actionType: "cancel_all_orders", 
          success: false, 
          duration: 5000, 
          error: "API timeout" 
        },
        { actionType: "notify_admin", success: true, duration: 2000 },
      ];

      const executedStop = emergencyStop.executeActions(mockExecutionResults);

      expect(executedStop.status).toBe("partial_failure");
      expect(executedStop.actionResults.filter(r => r.success)).toHaveLength(2);
      expect(executedStop.actionResults.filter(r => !r.success)).toHaveLength(1);
      expect(executedStop.failedActions).toHaveLength(1);
    });

    it("should mark emergency stop as completed when all actions succeed", () => {
      const mockExecutionResults = [
        { actionType: "close_all_positions", success: true, duration: 15000 },
        { actionType: "cancel_all_orders", success: true, duration: 8000 },
        { actionType: "notify_admin", success: true, duration: 2000 },
      ];

      let executedStop = emergencyStop.executeActions(mockExecutionResults);
      executedStop = executedStop.markAsCompleted();

      expect(executedStop.status).toBe("completed");
      expect(executedStop.completedAt).toBeInstanceOf(Date);

      const events = executedStop.getUncommittedEvents();
      expect(events.some(e => e instanceof EmergencyStopCompleted)).toBe(true);
    });

    it("should mark emergency stop as failed when critical actions fail", () => {
      const mockExecutionResults = [
        { 
          actionType: "close_all_positions", 
          success: false, 
          duration: 5000, 
          error: "Exchange connection failed" 
        },
        { actionType: "notify_admin", success: true, duration: 2000 },
      ];

      let executedStop = emergencyStop.executeActions(mockExecutionResults);
      executedStop = executedStop.markAsFailed("Critical action failed");

      expect(executedStop.status).toBe("failed");
      expect(executedStop.failureReason).toBe("Critical action failed");

      const events = executedStop.getUncommittedEvents();
      expect(events.some(e => e instanceof EmergencyStopFailed)).toBe(true);
    });
  });

  describe("Action Coordination", () => {
    let emergencyStop: EmergencyStop;

    beforeEach(() => {
      emergencyStop = EmergencyStop.create(validEmergencyStopProps);
      emergencyStop.markEventsAsCommitted();
    });

    it("should coordinate parallel actions when possible", () => {
      const parallelActions = [
        {
          type: "cancel_all_orders" as const,
          priority: 1,
          description: "Cancel pending orders",
          timeout: 15000,
          retryCount: 2,
          canRunInParallel: true,
        },
        {
          type: "notify_admin" as const,
          priority: 1, // Same priority for parallel execution
          description: "Notify administrators",
          timeout: 5000,
          retryCount: 1,
          canRunInParallel: true,
        },
      ];

      const parallelEmergencyStop = EmergencyStop.create({
        ...validEmergencyStopProps,
        emergencyActions: parallelActions,
      });

      const coordinationPlan = parallelEmergencyStop.createCoordinationPlan();

      expect(coordinationPlan.parallelGroups).toHaveLength(1);
      expect(coordinationPlan.parallelGroups[0]).toHaveLength(2);
      expect(coordinationPlan.totalEstimatedTime).toBeLessThan(20000); // Less than sequential
    });

    it("should handle sequential actions with dependencies", () => {
      const sequentialActions = [
        {
          type: "close_all_positions" as const,
          priority: 1,
          description: "Close positions first",
          timeout: 30000,
          retryCount: 3,
        },
        {
          type: "cancel_all_orders" as const,
          priority: 2,
          description: "Then cancel orders",
          timeout: 15000,
          retryCount: 2,
          dependsOn: ["close_all_positions"],
        },
      ];

      const sequentialEmergencyStop = EmergencyStop.create({
        ...validEmergencyStopProps,
        emergencyActions: sequentialActions,
      });

      const coordinationPlan = sequentialEmergencyStop.createCoordinationPlan();

      expect(coordinationPlan.sequentialSteps).toHaveLength(2);
      expect(coordinationPlan.totalEstimatedTime).toBe(45000); // Sum of timeouts
    });

    it("should generate comprehensive execution summary", () => {
      const mockResults = [
        { actionType: "close_all_positions", success: true, duration: 12000 },
        { actionType: "cancel_all_orders", success: true, duration: 6000 },
        { actionType: "notify_admin", success: true, duration: 1500 },
      ];

      const executedStop = emergencyStop.executeActions(mockResults);
      const summary = executedStop.generateExecutionSummary();

      expect(summary.totalActions).toBe(3);
      expect(summary.successfulActions).toBe(3);
      expect(summary.failedActions).toBe(0);
      expect(summary.totalExecutionTime).toBe(19500);
      expect(summary.averageActionTime).toBe(6500);
      expect(summary.overallSuccess).toBe(true);
    });
  });

  describe("Recovery and Reset", () => {
    let emergencyStop: EmergencyStop;

    beforeEach(() => {
      emergencyStop = EmergencyStop.create(validEmergencyStopProps);
      emergencyStop.markEventsAsCommitted();
    });

    it("should reset emergency stop after successful completion", () => {
      let processedStop = emergencyStop.trigger("Test trigger", {});
      processedStop = processedStop.executeActions([
        { actionType: "close_all_positions", success: true, duration: 10000 },
      ]);
      processedStop = processedStop.markAsCompleted();

      const resetStop = processedStop.reset();

      expect(resetStop.status).toBe("armed");
      expect(resetStop.lastTriggered).toBeUndefined();
      expect(resetStop.actionResults).toHaveLength(0);
      expect(resetStop.totalExecutionTime).toBe(0);
      expect(resetStop.version).toBe(processedStop.version + 1);
    });

    it("should allow manual recovery from failed state", () => {
      let failedStop = emergencyStop.trigger("Test trigger", {});
      failedStop = failedStop.markAsFailed("Test failure");

      const recoveredStop = failedStop.recover("Manual intervention completed");

      expect(recoveredStop.status).toBe("armed");
      expect(recoveredStop.failureReason).toBeUndefined();
      expect(recoveredStop.version).toBe(failedStop.version + 1);
    });

    it("should deactivate emergency stop when no longer needed", () => {
      const deactivatedStop = emergencyStop.deactivate();

      expect(deactivatedStop.isActive).toBe(false);
      expect(deactivatedStop.status).toBe("inactive");
      expect(deactivatedStop.version).toBe(emergencyStop.version + 1);
    });

    it("should reactivate deactivated emergency stop", () => {
      let deactivatedStop = emergencyStop.deactivate();
      const reactivatedStop = deactivatedStop.activate();

      expect(reactivatedStop.isActive).toBe(true);
      expect(reactivatedStop.status).toBe("armed");
      expect(reactivatedStop.version).toBe(deactivatedStop.version + 1);
    });
  });

  describe("Configuration Updates", () => {
    let emergencyStop: EmergencyStop;

    beforeEach(() => {
      emergencyStop = EmergencyStop.create(validEmergencyStopProps);
      emergencyStop.markEventsAsCommitted();
    });

    it("should update trigger conditions", () => {
      const newConditions = [
        {
          type: "drawdown_threshold" as const,
          threshold: 25.0, // Increased from 20%
          description: "Updated maximum drawdown threshold",
          priority: "high" as const,
        },
      ];

      const updatedStop = emergencyStop.updateTriggerConditions(newConditions);

      expect(updatedStop.triggerConditions).toHaveLength(1);
      expect(updatedStop.triggerConditions[0].threshold).toBe(25.0);
      expect(updatedStop.version).toBe(emergencyStop.version + 1);
    });

    it("should update emergency actions", () => {
      const newActions = [
        {
          type: "reduce_positions" as const,
          priority: 1,
          description: "Reduce position sizes by 50%",
          timeout: 20000,
          retryCount: 2,
        },
      ];

      const updatedStop = emergencyStop.updateEmergencyActions(newActions);

      expect(updatedStop.emergencyActions).toHaveLength(1);
      expect(updatedStop.emergencyActions[0].type).toBe("reduce_positions");
      expect(updatedStop.version).toBe(emergencyStop.version + 1);
    });

    it("should toggle auto-execution setting", () => {
      const manualStop = emergencyStop.disableAutoExecution();

      expect(manualStop.autoExecute).toBe(false);
      expect(manualStop.version).toBe(emergencyStop.version + 1);

      const autoStop = manualStop.enableAutoExecution();

      expect(autoStop.autoExecute).toBe(true);
      expect(autoStop.version).toBe(manualStop.version + 1);
    });
  });

  describe("Business Logic Validations", () => {
    it("should prevent triggering when already triggered", () => {
      let emergencyStop = EmergencyStop.create(validEmergencyStopProps);
      emergencyStop = emergencyStop.trigger("First trigger", {});

      expect(() => 
        emergencyStop.trigger("Second trigger", {})
      ).toThrow(DomainValidationError);
    });

    it("should prevent execution when not triggered", () => {
      const emergencyStop = EmergencyStop.create(validEmergencyStopProps);

      expect(() => 
        emergencyStop.executeActions([
          { actionType: "close_all_positions", success: true, duration: 10000 },
        ])
      ).toThrow(DomainValidationError);
    });

    it("should prevent reset when not completed or failed", () => {
      let emergencyStop = EmergencyStop.create(validEmergencyStopProps);
      emergencyStop = emergencyStop.trigger("Test trigger", {});

      expect(() => emergencyStop.reset()).toThrow(DomainValidationError);
    });

    it("should validate action timeout values", () => {
      const invalidProps = {
        ...validEmergencyStopProps,
        emergencyActions: [
          {
            type: "close_all_positions" as const,
            priority: 1,
            description: "Invalid action",
            timeout: -1000, // Invalid negative timeout
            retryCount: 3,
          },
        ],
      };

      expect(() => EmergencyStop.create(invalidProps)).toThrow(DomainValidationError);
    });
  });

  describe("Entity Invariants", () => {
    it("should maintain entity invariants after all operations", () => {
      let emergencyStop = EmergencyStop.create(validEmergencyStopProps);
      
      // Perform complete workflow
      emergencyStop = emergencyStop.trigger("Test emergency", { drawdown: 25.0 });
      emergencyStop = emergencyStop.executeActions([
        { actionType: "close_all_positions", success: true, duration: 10000 },
        { actionType: "notify_admin", success: true, duration: 2000 },
      ]);
      emergencyStop = emergencyStop.markAsCompleted();
      emergencyStop = emergencyStop.reset();
      
      // Verify entity integrity
      CleanArchitectureAssertions.assertDomainEntity(emergencyStop, "EmergencyStop");
      expect(emergencyStop.portfolioId).toBe(validEmergencyStopProps.portfolioId);
      expect(emergencyStop.isActive).toBe(true);
      expect(emergencyStop.status).toBe("armed");
    });

    it("should prevent operations on inactive emergency stops", () => {
      let emergencyStop = EmergencyStop.create(validEmergencyStopProps);
      emergencyStop = emergencyStop.deactivate();

      expect(() => 
        emergencyStop.trigger("Should fail", {})
      ).toThrow(DomainValidationError);
    });
  });
});