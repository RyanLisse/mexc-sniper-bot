/**
 * SafetyRule Value Object Unit Tests
 *
 * Comprehensive test suite for the SafetyRule value object covering:
 * - Value object creation and validation
 * - Business logic methods and rule evaluation
 * - Immutability and equality semantics
 * - State transitions and rule updates
 * - Static factory methods and utilities
 * - Edge cases and error handling
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainValidationError } from "@/src/domain/errors/trading-errors";
import { 
  SafetyRule, 
  type SafetyRuleAction,
  type SafetyRuleEvaluationContext,
  type SafetyRuleOperator, 
  type SafetyRulePriority,
  type SafetyRuleType
} from "@/src/domain/value-objects/safety/safety-rule";

describe("SafetyRule Value Object", () => {
  let validSafetyRuleProps: any;
  let mockContext: SafetyRuleEvaluationContext;

  beforeEach(() => {
    validSafetyRuleProps = {
      name: "Maximum Drawdown Rule",
      description: "Prevent portfolio drawdown from exceeding 15%",
      type: "drawdown_threshold" as SafetyRuleType,
      operator: "greater_than" as SafetyRuleOperator,
      threshold: 15.0,
      priority: "high" as SafetyRulePriority,
      action: "reduce_position" as SafetyRuleAction,
      isEnabled: true,
      portfolioScope: "all",
      symbolScope: "all",
      conditions: {},
      metadata: { category: "risk_management" },
    };

    mockContext = {
      currentValue: 20.0,
      portfolioId: "portfolio_123",
      symbol: "BTCUSDT",
      timestamp: new Date(),
      additionalData: {},
    };
  });

  describe("Value Object Creation", () => {
    it("should create a valid SafetyRule with proper validation", () => {
      const safetyRule = SafetyRule.create(validSafetyRuleProps);

      expect(safetyRule).toBeDefined();
      expect(safetyRule.id).toMatch(/^safety_rule_/);
      expect(safetyRule.name).toBe(validSafetyRuleProps.name);
      expect(safetyRule.type).toBe(validSafetyRuleProps.type);
      expect(safetyRule.threshold).toBe(validSafetyRuleProps.threshold);
      expect(safetyRule.isEnabled).toBe(true);
      expect(safetyRule.triggerCount).toBe(0);
      expect(safetyRule.createdAt).toBeInstanceOf(Date);
    });

    it("should restore from existing data", () => {
      const existingData = {
        ...validSafetyRuleProps,
        id: "safety_rule_existing_123",
        createdAt: new Date("2024-01-01"),
        triggerCount: 5,
        lastTriggered: new Date("2024-01-15"),
      };

      const safetyRule = SafetyRule.fromExisting(existingData);

      expect(safetyRule.id).toBe("safety_rule_existing_123");
      expect(safetyRule.triggerCount).toBe(5);
      expect(safetyRule.lastTriggered).toEqual(new Date("2024-01-15"));
    });

    it("should throw validation error for empty name", () => {
      const invalidProps = { ...validSafetyRuleProps, name: "" };

      expect(() => SafetyRule.create(invalidProps)).toThrow(DomainValidationError);
    });

    it("should throw validation error for invalid rule type", () => {
      const invalidProps = { ...validSafetyRuleProps, type: "invalid_type" };

      expect(() => SafetyRule.create(invalidProps)).toThrow(DomainValidationError);
    });

    it("should throw validation error for invalid operator", () => {
      const invalidProps = { ...validSafetyRuleProps, operator: "invalid_operator" };

      expect(() => SafetyRule.create(invalidProps)).toThrow(DomainValidationError);
    });

    it("should throw validation error for invalid priority", () => {
      const invalidProps = { ...validSafetyRuleProps, priority: "invalid_priority" };

      expect(() => SafetyRule.create(invalidProps)).toThrow(DomainValidationError);
    });

    it("should throw validation error for invalid action", () => {
      const invalidProps = { ...validSafetyRuleProps, action: "invalid_action" };

      expect(() => SafetyRule.create(invalidProps)).toThrow(DomainValidationError);
    });
  });

  describe("Business Rule Validations", () => {
    it("should validate drawdown threshold range (0-100%)", () => {
      const invalidProps1 = { 
        ...validSafetyRuleProps, 
        type: "drawdown_threshold", 
        threshold: -5.0 
      };
      const invalidProps2 = { 
        ...validSafetyRuleProps, 
        type: "drawdown_threshold", 
        threshold: 150.0 
      };

      expect(() => SafetyRule.create(invalidProps1)).toThrow(DomainValidationError);
      expect(() => SafetyRule.create(invalidProps2)).toThrow(DomainValidationError);
    });

    it("should validate position risk threshold range (0-50%)", () => {
      const invalidProps1 = { 
        ...validSafetyRuleProps, 
        type: "position_risk", 
        threshold: -2.0 
      };
      const invalidProps2 = { 
        ...validSafetyRuleProps, 
        type: "position_risk", 
        threshold: 75.0 
      };

      expect(() => SafetyRule.create(invalidProps1)).toThrow(DomainValidationError);
      expect(() => SafetyRule.create(invalidProps2)).toThrow(DomainValidationError);
    });

    it("should validate consecutive losses threshold (1-20, integer)", () => {
      const invalidProps1 = { 
        ...validSafetyRuleProps, 
        type: "consecutive_losses", 
        threshold: 0 
      };
      const invalidProps2 = { 
        ...validSafetyRuleProps, 
        type: "consecutive_losses", 
        threshold: 25 
      };
      const invalidProps3 = { 
        ...validSafetyRuleProps, 
        type: "consecutive_losses", 
        threshold: 5.5 
      };

      expect(() => SafetyRule.create(invalidProps1)).toThrow(DomainValidationError);
      expect(() => SafetyRule.create(invalidProps2)).toThrow(DomainValidationError);
      expect(() => SafetyRule.create(invalidProps3)).toThrow(DomainValidationError);
    });

    it("should validate leverage limit range (1-100)", () => {
      const invalidProps1 = { 
        ...validSafetyRuleProps, 
        type: "leverage_limit", 
        threshold: 0.5 
      };
      const invalidProps2 = { 
        ...validSafetyRuleProps, 
        type: "leverage_limit", 
        threshold: 150 
      };

      expect(() => SafetyRule.create(invalidProps1)).toThrow(DomainValidationError);
      expect(() => SafetyRule.create(invalidProps2)).toThrow(DomainValidationError);
    });

    it("should validate loss limit thresholds are positive", () => {
      const invalidProps1 = { 
        ...validSafetyRuleProps, 
        type: "daily_loss_limit", 
        threshold: -1000 
      };
      const invalidProps2 = { 
        ...validSafetyRuleProps, 
        type: "monthly_loss_limit", 
        threshold: 0 
      };

      expect(() => SafetyRule.create(invalidProps1)).toThrow(DomainValidationError);
      expect(() => SafetyRule.create(invalidProps2)).toThrow(DomainValidationError);
    });

    it("should reject critical priority with alert_only action", () => {
      const invalidProps = { 
        ...validSafetyRuleProps, 
        priority: "critical", 
        action: "alert_only" 
      };

      expect(() => SafetyRule.create(invalidProps)).toThrow(DomainValidationError);
    });

    it("should validate portfolio scope format", () => {
      const invalidProps = { 
        ...validSafetyRuleProps, 
        portfolioScope: "invalid_scope" 
      };

      expect(() => SafetyRule.create(invalidProps)).toThrow(DomainValidationError);
    });

    it("should validate symbol scope format", () => {
      const invalidProps = { 
        ...validSafetyRuleProps, 
        symbolScope: "BT" // Too short
      };

      expect(() => SafetyRule.create(invalidProps)).toThrow(DomainValidationError);
    });
  });

  describe("Rule Evaluation", () => {
    let safetyRule: SafetyRule;

    beforeEach(() => {
      safetyRule = SafetyRule.create(validSafetyRuleProps);
    });

    it("should evaluate greater_than operator correctly", () => {
      const context = { ...mockContext, currentValue: 20.0 }; // Above threshold of 15
      const result = safetyRule.evaluate(context);

      expect(result.isTriggered).toBe(true);
      expect(result.currentValue).toBe(20.0);
      expect(result.threshold).toBe(15.0);
      expect(result.variance).toBe(5.0);
      expect(result.variancePercentage).toBeCloseTo(33.33, 2);
      expect(result.severity).toBe("high");
      expect(result.recommendedAction).toBe("reduce_position");
    });

    it("should not trigger when threshold condition is not met", () => {
      const context = { ...mockContext, currentValue: 10.0 }; // Below threshold of 15
      const result = safetyRule.evaluate(context);

      expect(result.isTriggered).toBe(false);
      expect(result.message).toBe("Threshold condition not met");
    });

    it("should not evaluate disabled rules", () => {
      const disabledRule = safetyRule.disable();
      const result = disabledRule.evaluate(mockContext);

      expect(result.isTriggered).toBe(false);
      expect(result.message).toBe("Rule is disabled");
    });

    it("should evaluate less_than operator correctly", () => {
      const lessThanRule = SafetyRule.create({
        ...validSafetyRuleProps,
        operator: "less_than",
        threshold: 10.0,
      });

      const context = { ...mockContext, currentValue: 5.0 }; // Below threshold
      const result = lessThanRule.evaluate(context);

      expect(result.isTriggered).toBe(true);
      expect(result.variance).toBe(-5.0);
    });

    it("should evaluate equal_to operator correctly", () => {
      const equalRule = SafetyRule.create({
        ...validSafetyRuleProps,
        operator: "equal_to",
        threshold: 15.0,
      });

      const context = { ...mockContext, currentValue: 15.0 };
      const result = equalRule.evaluate(context);

      expect(result.isTriggered).toBe(true);
      expect(result.variance).toBe(0);
    });

    it("should evaluate greater_than_or_equal operator correctly", () => {
      const gteRule = SafetyRule.create({
        ...validSafetyRuleProps,
        operator: "greater_than_or_equal",
        threshold: 15.0,
      });

      const context1 = { ...mockContext, currentValue: 15.0 }; // Equal
      const context2 = { ...mockContext, currentValue: 20.0 }; // Greater

      expect(gteRule.evaluate(context1).isTriggered).toBe(true);
      expect(gteRule.evaluate(context2).isTriggered).toBe(true);
    });

    it("should evaluate less_than_or_equal operator correctly", () => {
      const lteRule = SafetyRule.create({
        ...validSafetyRuleProps,
        operator: "less_than_or_equal",
        threshold: 15.0,
      });

      const context1 = { ...mockContext, currentValue: 15.0 }; // Equal
      const context2 = { ...mockContext, currentValue: 10.0 }; // Less

      expect(lteRule.evaluate(context1).isTriggered).toBe(true);
      expect(lteRule.evaluate(context2).isTriggered).toBe(true);
    });
  });

  describe("Scope Application", () => {
    it("should apply rule to specific portfolio scope", () => {
      const portfolioRule = SafetyRule.create({
        ...validSafetyRuleProps,
        portfolioScope: "portfolio_123",
      });

      const context1 = { ...mockContext, portfolioId: "portfolio_123" };
      const context2 = { ...mockContext, portfolioId: "portfolio_456" };

      const result1 = portfolioRule.evaluate(context1);
      const result2 = portfolioRule.evaluate(context2);

      expect(result1.isTriggered).toBe(true); // Rule applies
      expect(result2.isTriggered).toBe(false); // Rule doesn't apply
      expect(result2.message).toBe("Rule scope does not match context");
    });

    it("should apply rule to specific symbol scope", () => {
      const symbolRule = SafetyRule.create({
        ...validSafetyRuleProps,
        symbolScope: "BTCUSDT",
      });

      const context1 = { ...mockContext, symbol: "BTCUSDT" };
      const context2 = { ...mockContext, symbol: "ETHUSDT" };

      const result1 = symbolRule.evaluate(context1);
      const result2 = symbolRule.evaluate(context2);

      expect(result1.isTriggered).toBe(true); // Rule applies
      expect(result2.isTriggered).toBe(false); // Rule doesn't apply
    });

    it("should apply rule with additional conditions", () => {
      const conditionalRule = SafetyRule.create({
        ...validSafetyRuleProps,
        conditions: { marketType: "spot", tradingMode: "auto" },
      });

      const context1 = { 
        ...mockContext, 
        additionalData: { marketType: "spot", tradingMode: "auto" } 
      };
      const context2 = { 
        ...mockContext, 
        additionalData: { marketType: "futures", tradingMode: "auto" } 
      };

      const result1 = conditionalRule.evaluate(context1);
      const result2 = conditionalRule.evaluate(context2);

      expect(result1.isTriggered).toBe(true); // Conditions match
      expect(result2.isTriggered).toBe(false); // Conditions don't match
    });
  });

  describe("State Transitions", () => {
    let safetyRule: SafetyRule;

    beforeEach(() => {
      safetyRule = SafetyRule.create(validSafetyRuleProps);
    });

    it("should enable and disable rule", () => {
      const disabledRule = safetyRule.disable();
      expect(disabledRule.isEnabled).toBe(false);
      expect(disabledRule).not.toBe(safetyRule); // New instance

      const reenabledRule = disabledRule.enable();
      expect(reenabledRule.isEnabled).toBe(true);
      expect(reenabledRule).not.toBe(disabledRule); // New instance
    });

    it("should return same instance when state doesn't change", () => {
      const enabledRule = safetyRule.enable(); // Already enabled
      expect(enabledRule).toBe(safetyRule); // Same instance

      const disabledRule = safetyRule.disable();
      const stillDisabledRule = disabledRule.disable(); // Already disabled
      expect(stillDisabledRule).toBe(disabledRule); // Same instance
    });

    it("should update threshold with validation", () => {
      const updatedRule = safetyRule.updateThreshold(25.0);

      expect(updatedRule.threshold).toBe(25.0);
      expect(updatedRule).not.toBe(safetyRule); // New instance
      expect(safetyRule.threshold).toBe(15.0); // Original unchanged
    });

    it("should throw error when updating threshold with invalid value", () => {
      expect(() => safetyRule.updateThreshold(150.0)).toThrow(DomainValidationError);
    });

    it("should update priority", () => {
      const updatedRule = safetyRule.updatePriority("critical");

      expect(updatedRule.priority).toBe("critical");
      expect(updatedRule).not.toBe(safetyRule); // New instance
    });

    it("should update action with validation", () => {
      const updatedRule = safetyRule.updateAction("emergency_stop");

      expect(updatedRule.action).toBe("emergency_stop");
      expect(updatedRule).not.toBe(safetyRule); // New instance
    });

    it("should throw error when updating to invalid action for priority", () => {
      const criticalRule = safetyRule.updatePriority("critical");
      expect(() => criticalRule.updateAction("alert_only")).toThrow(DomainValidationError);
    });

    it("should record trigger with timestamp", () => {
      const triggerTime = new Date("2024-01-15T10:30:00Z");
      const triggeredRule = safetyRule.recordTrigger(triggerTime);

      expect(triggeredRule.lastTriggered).toEqual(triggerTime);
      expect(triggeredRule.triggerCount).toBe(1);
      expect(triggeredRule).not.toBe(safetyRule); // New instance
    });

    it("should update conditions", () => {
      const newConditions = { marketType: "futures", leverage: "high" };
      const updatedRule = safetyRule.updateConditions(newConditions);

      expect(updatedRule.conditions).toEqual(newConditions);
      expect(updatedRule).not.toBe(safetyRule); // New instance
    });

    it("should update metadata", () => {
      const newMetadata = { source: "ai_generated", version: "2.0" };
      const updatedRule = safetyRule.updateMetadata(newMetadata);

      expect(updatedRule.metadata).toEqual({
        category: "risk_management",
        source: "ai_generated",
        version: "2.0",
      });
      expect(updatedRule).not.toBe(safetyRule); // New instance
    });
  });

  describe("Value Object Equality", () => {
    it("should be equal to another SafetyRule with same properties", () => {
      const sharedProps = {
        ...validSafetyRuleProps,
        id: "test_rule_123",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        triggerCount: 0,
      };

      const rule1 = SafetyRule.fromExisting(sharedProps);
      const rule2 = SafetyRule.fromExisting(sharedProps);

      expect(rule1.equals(rule2)).toBe(true);
    });

    it("should not be equal to SafetyRule with different properties", () => {
      const rule1 = SafetyRule.create(validSafetyRuleProps);
      const rule2 = SafetyRule.create({
        ...validSafetyRuleProps,
        threshold: 20.0,
      });

      expect(rule1.equals(rule2)).toBe(false);
    });

    it("should not be equal to null or undefined", () => {
      const rule = SafetyRule.create(validSafetyRuleProps);

      expect(rule.equals(null as any)).toBe(false);
      expect(rule.equals(undefined as any)).toBe(false);
    });
  });

  describe("Utility Methods", () => {
    let safetyRule: SafetyRule;

    beforeEach(() => {
      safetyRule = SafetyRule.create(validSafetyRuleProps);
    });

    it("should check portfolio applicability", () => {
      expect(safetyRule.isApplicableToPortfolio("portfolio_123")).toBe(true);
      expect(safetyRule.isApplicableToPortfolio("portfolio_456")).toBe(true); // "all" scope

      const portfolioRule = SafetyRule.create({
        ...validSafetyRuleProps,
        portfolioScope: "portfolio_123",
      });

      expect(portfolioRule.isApplicableToPortfolio("portfolio_123")).toBe(true);
      expect(portfolioRule.isApplicableToPortfolio("portfolio_456")).toBe(false);
    });

    it("should check symbol applicability", () => {
      expect(safetyRule.isApplicableToSymbol("BTCUSDT")).toBe(true);
      expect(safetyRule.isApplicableToSymbol("ETHUSDT")).toBe(true); // "all" scope

      const symbolRule = SafetyRule.create({
        ...validSafetyRuleProps,
        symbolScope: "BTCUSDT",
      });

      expect(symbolRule.isApplicableToSymbol("BTCUSDT")).toBe(true);
      expect(symbolRule.isApplicableToSymbol("ETHUSDT")).toBe(false);
    });

    it("should compare priorities correctly", () => {
      const lowRule = SafetyRule.create({ ...validSafetyRuleProps, priority: "low" });
      const mediumRule = SafetyRule.create({ ...validSafetyRuleProps, priority: "medium" });
      const highRule = SafetyRule.create({ ...validSafetyRuleProps, priority: "high" });
      const criticalRule = SafetyRule.create({ ...validSafetyRuleProps, priority: "critical" });

      expect(highRule.isPriorityHigherThan(mediumRule)).toBe(true);
      expect(criticalRule.isPriorityHigherThan(highRule)).toBe(true);
      expect(lowRule.isPriorityHigherThan(mediumRule)).toBe(false);
    });

    it("should check similarity between rules", () => {
      const similarRule = SafetyRule.create({
        ...validSafetyRuleProps,
        name: "Different Name",
        threshold: 15.0001, // Very close threshold
      });

      const differentRule = SafetyRule.create({
        ...validSafetyRuleProps,
        type: "position_risk",
      });

      expect(safetyRule.isSimilarTo(similarRule)).toBe(true);
      expect(safetyRule.isSimilarTo(differentRule)).toBe(false);
    });

    it("should calculate days since last triggered", () => {
      expect(safetyRule.getDaysSinceLastTriggered()).toBeNull(); // Never triggered

      const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
      const triggeredRule = safetyRule.recordTrigger(pastDate);

      expect(triggeredRule.getDaysSinceLastTriggered()).toBe(5);
    });

    it("should calculate trigger frequency", () => {
      expect(safetyRule.getTriggerFrequency()).toBe(0); // Never triggered

      const pastDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const oldRule = SafetyRule.fromExisting({
        ...validSafetyRuleProps,
        id: "test_rule",
        createdAt: pastDate,
        triggerCount: 5,
        lastTriggered: new Date(),
      });

      expect(oldRule.getTriggerFrequency()).toBe(0.5); // 5 triggers over 10 days
    });
  });

  describe("Static Factory Methods", () => {
    it("should create drawdown rule with default settings", () => {
      const rule = SafetyRule.createDrawdownRule(
        "Portfolio Drawdown Limit",
        20.0,
        "critical",
        "emergency_stop"
      );

      expect(rule.name).toBe("Portfolio Drawdown Limit");
      expect(rule.type).toBe("drawdown_threshold");
      expect(rule.threshold).toBe(20.0);
      expect(rule.priority).toBe("critical");
      expect(rule.action).toBe("emergency_stop");
      expect(rule.operator).toBe("greater_than");
      expect(rule.isEnabled).toBe(true);
    });

    it("should create position risk rule with default settings", () => {
      const rule = SafetyRule.createPositionRiskRule(
        "Position Size Limit",
        5.0,
        "medium",
        "reduce_position",
        "BTCUSDT"
      );

      expect(rule.name).toBe("Position Size Limit");
      expect(rule.type).toBe("position_risk");
      expect(rule.threshold).toBe(5.0);
      expect(rule.symbolScope).toBe("BTCUSDT");
    });

    it("should create consecutive loss rule with default settings", () => {
      const rule = SafetyRule.createConsecutiveLossRule(
        "Consecutive Loss Limit",
        5,
        "high",
        "halt_trading"
      );

      expect(rule.name).toBe("Consecutive Loss Limit");
      expect(rule.type).toBe("consecutive_losses");
      expect(rule.threshold).toBe(5);
      expect(rule.operator).toBe("greater_than_or_equal");
    });
  });

  describe("Formatting Methods", () => {
    let safetyRule: SafetyRule;

    beforeEach(() => {
      safetyRule = SafetyRule.create(validSafetyRuleProps);
    });

    it("should format toString correctly", () => {
      const result = safetyRule.toString();
      expect(result).toBe("Maximum Drawdown Rule (drawdown_threshold, high, enabled)");

      const disabledRule = safetyRule.disable();
      const disabledResult = disabledRule.toString();
      expect(disabledResult).toBe("Maximum Drawdown Rule (drawdown_threshold, high, disabled)");
    });

    it("should format summary string correctly", () => {
      const result = safetyRule.toSummaryString();
      expect(result).toBe("Maximum Drawdown Rule: > 15 → reduce_position");
    });
  });

  describe("Immutability", () => {
    let safetyRule: SafetyRule;

    beforeEach(() => {
      safetyRule = SafetyRule.create(validSafetyRuleProps);
    });

    it("should not allow modification of returned conditions object", () => {
      const conditions = safetyRule.conditions;
      conditions.newProperty = "test";

      // Original rule should not be affected
      expect(safetyRule.conditions).not.toHaveProperty("newProperty");
    });

    it("should not allow modification of returned metadata object", () => {
      const metadata = safetyRule.metadata;
      metadata.newProperty = "test";

      // Original rule should not be affected
      expect(safetyRule.metadata).not.toHaveProperty("newProperty");
    });

    it("should not allow modification of internal props", () => {
      // This should throw an error because props are frozen
      expect(() => {
        (safetyRule as any).props.threshold = 999;
      }).toThrow(TypeError);

      expect(safetyRule.threshold).toBe(15.0); // Should remain unchanged
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero threshold for percentage calculations", () => {
      const zeroRule = SafetyRule.create({
        ...validSafetyRuleProps,
        type: "custom",
        threshold: 0,
      });

      const context = { ...mockContext, currentValue: 10.0 };
      const result = zeroRule.evaluate(context);

      expect(result.variancePercentage).toBe(0);
      expect(result.variance).toBe(10.0);
    });

    it("should handle very small threshold differences for equality", () => {
      const equalRule = SafetyRule.create({
        ...validSafetyRuleProps,
        operator: "equal_to",
        threshold: 15.0,
      });

      const context = { ...mockContext, currentValue: 15.00005 }; // Very small difference
      const result = equalRule.evaluate(context);

      expect(result.isTriggered).toBe(true); // Should be considered equal
    });

    it("should handle empty conditions and metadata", () => {
      const rule = SafetyRule.create({
        ...validSafetyRuleProps,
        conditions: {},
        metadata: {},
      });

      expect(rule.conditions).toEqual({});
      expect(rule.metadata).toEqual({});
    });

    it("should handle evaluation with missing optional context fields", () => {
      const safetyRule = SafetyRule.create(validSafetyRuleProps);
      const context = {
        currentValue: 20.0,
        timestamp: new Date(),
      };

      const result = safetyRule.evaluate(context);
      expect(result.isTriggered).toBe(true); // Should work without portfolioId/symbol
    });
  });

  describe("Serialization", () => {
    it("should convert to plain object for persistence", () => {
      const safetyRule = SafetyRule.create(validSafetyRuleProps);
      const plainObject = safetyRule.toPlainObject();

      expect(plainObject).toHaveProperty("id");
      expect(plainObject).toHaveProperty("name");
      expect(plainObject).toHaveProperty("type");
      expect(plainObject).toHaveProperty("threshold");
      expect(plainObject).toHaveProperty("createdAt");
      expect(plainObject.name).toBe(validSafetyRuleProps.name);
      expect(plainObject.threshold).toBe(validSafetyRuleProps.threshold);
    });

    it("should recreate rule from plain object", () => {
      const originalRule = SafetyRule.create(validSafetyRuleProps);
      const plainObject = originalRule.toPlainObject();
      const recreatedRule = SafetyRule.fromExisting(plainObject);

      expect(recreatedRule.equals(originalRule)).toBe(true);
    });
  });
});