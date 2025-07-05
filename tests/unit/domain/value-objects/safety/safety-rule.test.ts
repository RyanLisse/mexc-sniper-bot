/**
 * Unit tests for SafetyRule Value Object
 * Tests safety rule creation, validation, evaluation, and business logic
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  SafetyRule,
  SafetyRuleType,
  SafetyRulePriority,
  SafetyRuleOperator,
  SafetyRuleAction,
  SafetyRuleEvaluationContext,
} from '@/domain/value-objects/safety/safety-rule';
import { DomainValidationError } from '@/domain/errors/trading-errors';

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '@utils/timeout-utilities';

describe('SafetyRule Value Object', () => {
  let validRuleProps: any;
  let drawdownRuleProps: any;
  let positionRiskRuleProps: any;
  let consecutiveLossRuleProps: any;
  let evaluationContext: SafetyRuleEvaluationContext;

  beforeEach(() => {
    // Base valid rule props
    validRuleProps = {
      name: 'Test Safety Rule',
      description: 'A test safety rule for validation',
      type: 'drawdown_threshold' as SafetyRuleType,
      operator: 'greater_than' as SafetyRuleOperator,
      threshold: 10,
      priority: 'medium' as SafetyRulePriority,
      action: 'alert_only' as SafetyRuleAction,
      isEnabled: true,
      portfolioScope: 'all',
      symbolScope: 'all',
      conditions: {},
      metadata: {},
    };

    // Drawdown rule props
    drawdownRuleProps = {
      ...validRuleProps,
      name: 'Max Drawdown 15%',
      description: 'Maximum portfolio drawdown of 15%',
      type: 'drawdown_threshold' as SafetyRuleType,
      threshold: 15,
      priority: 'high' as SafetyRulePriority,
      action: 'reduce_position' as SafetyRuleAction,
    };

    // Position risk rule props
    positionRiskRuleProps = {
      ...validRuleProps,
      name: 'Position Risk 5%',
      description: 'Maximum position risk of 5%',
      type: 'position_risk' as SafetyRuleType,
      threshold: 5,
      priority: 'medium' as SafetyRulePriority,
      action: 'alert_only' as SafetyRuleAction,
      symbolScope: 'BTCUSDT',
    };

    // Consecutive loss rule props
    consecutiveLossRuleProps = {
      ...validRuleProps,
      name: 'Max 5 Consecutive Losses',
      description: 'Maximum 5 consecutive trading losses',
      type: 'consecutive_losses' as SafetyRuleType,
      operator: 'greater_than_or_equal' as SafetyRuleOperator,
      threshold: 5,
      priority: 'critical' as SafetyRulePriority,
      action: 'halt_trading' as SafetyRuleAction,
    };

    // Evaluation context
    evaluationContext = {
      currentValue: 20,
      portfolioId: 'portfolio_123',
      symbol: 'BTCUSDT',
      timestamp: new Date(),
      additionalData: {},
    };
  });

  describe('SafetyRule Creation', () => {
    it('should create rule with valid props', () => {
      const rule = SafetyRule.create(validRuleProps);

      expect(rule.name).toBe('Test Safety Rule');
      expect(rule.description).toBe('A test safety rule for validation');
      expect(rule.type).toBe('drawdown_threshold');
      expect(rule.operator).toBe('greater_than');
      expect(rule.threshold).toBe(10);
      expect(rule.priority).toBe('medium');
      expect(rule.action).toBe('alert_only');
      expect(rule.isEnabled).toBe(true);
      expect(rule.portfolioScope).toBe('all');
      expect(rule.symbolScope).toBe('all');
      expect(rule.id).toBeDefined();
      expect(rule.createdAt).toBeInstanceOf(Date);
      expect(rule.triggerCount).toBe(0);
      expect(rule.lastTriggered).toBeUndefined();
    });

    it('should create drawdown rule', () => {
      const rule = SafetyRule.create(drawdownRuleProps);

      expect(rule.type).toBe('drawdown_threshold');
      expect(rule.threshold).toBe(15);
      expect(rule.priority).toBe('high');
      expect(rule.action).toBe('reduce_position');
    });

    it('should create position risk rule', () => {
      const rule = SafetyRule.create(positionRiskRuleProps);

      expect(rule.type).toBe('position_risk');
      expect(rule.threshold).toBe(5);
      expect(rule.symbolScope).toBe('BTCUSDT');
    });

    it('should create consecutive loss rule', () => {
      const rule = SafetyRule.create(consecutiveLossRuleProps);

      expect(rule.type).toBe('consecutive_losses');
      expect(rule.operator).toBe('greater_than_or_equal');
      expect(rule.threshold).toBe(5);
      expect(rule.priority).toBe('critical');
      expect(rule.action).toBe('halt_trading');
    });

    it('should create rule with conditions and metadata', () => {
      const ruleWithExtras = {
        ...validRuleProps,
        conditions: { minVolume: 1000, tradingHours: true },
        metadata: { category: 'risk', automated: true },
      };

      const rule = SafetyRule.create(ruleWithExtras);

      expect(rule.conditions).toEqual({ minVolume: 1000, tradingHours: true });
      expect(rule.metadata).toEqual({ category: 'risk', automated: true });
    });
  });

  describe('SafetyRule Validation', () => {
    it('should reject rule with empty name', () => {
      const invalidProps = {
        ...validRuleProps,
        name: '',
      };

      expect(() => SafetyRule.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject rule with long name', () => {
      const invalidProps = {
        ...validRuleProps,
        name: 'a'.repeat(101), // > 100 characters
      };

      expect(() => SafetyRule.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject rule with empty description', () => {
      const invalidProps = {
        ...validRuleProps,
        description: '',
      };

      expect(() => SafetyRule.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject rule with long description', () => {
      const invalidProps = {
        ...validRuleProps,
        description: 'a'.repeat(501), // > 500 characters
      };

      expect(() => SafetyRule.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject drawdown rule with invalid threshold', () => {
      const invalidProps = {
        ...drawdownRuleProps,
        threshold: 150, // > 100%
      };

      expect(() => SafetyRule.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject drawdown rule with negative threshold', () => {
      const invalidProps = {
        ...drawdownRuleProps,
        threshold: -5, // < 0%
      };

      expect(() => SafetyRule.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject position risk rule with invalid threshold', () => {
      const invalidProps = {
        ...positionRiskRuleProps,
        threshold: 75, // > 50%
      };

      expect(() => SafetyRule.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject consecutive loss rule with invalid threshold', () => {
      const invalidProps = {
        ...consecutiveLossRuleProps,
        threshold: 25, // > 20
      };

      expect(() => SafetyRule.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject consecutive loss rule with non-integer threshold', () => {
      const invalidProps = {
        ...consecutiveLossRuleProps,
        threshold: 5.5, // Not an integer
      };

      expect(() => SafetyRule.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject leverage rule with invalid threshold', () => {
      const invalidProps = {
        ...validRuleProps,
        type: 'leverage_limit' as SafetyRuleType,
        threshold: 0.5, // < 1
      };

      expect(() => SafetyRule.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject loss limit rule with negative threshold', () => {
      const invalidProps = {
        ...validRuleProps,
        type: 'daily_loss_limit' as SafetyRuleType,
        threshold: -1000,
      };

      expect(() => SafetyRule.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject critical priority with alert_only action', () => {
      const invalidProps = {
        ...validRuleProps,
        priority: 'critical' as SafetyRulePriority,
        action: 'alert_only' as SafetyRuleAction,
      };

      expect(() => SafetyRule.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject invalid portfolio scope', () => {
      const invalidProps = {
        ...validRuleProps,
        portfolioScope: 'invalid_scope',
      };

      expect(() => SafetyRule.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject invalid symbol scope', () => {
      const invalidProps = {
        ...validRuleProps,
        symbolScope: 'BT', // < 3 characters
      };

      expect(() => SafetyRule.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should accept valid portfolio scope', () => {
      const validProps = {
        ...validRuleProps,
        portfolioScope: 'portfolio_123',
      };

      expect(() => SafetyRule.create(validProps)).not.toThrow();
    });

    it('should accept valid symbol scope', () => {
      const validProps = {
        ...validRuleProps,
        symbolScope: 'BTCUSDT',
      };

      expect(() => SafetyRule.create(validProps)).not.toThrow();
    });
  });

  describe('SafetyRule Evaluation', () => {
    let rule: SafetyRule;

    beforeEach(() => {
      rule = SafetyRule.create({
        ...validRuleProps,
        threshold: 15,
        operator: 'greater_than' as SafetyRuleOperator,
      });
    });

    it('should trigger when condition is met', () => {
      const context: SafetyRuleEvaluationContext = {
        ...evaluationContext,
        currentValue: 20, // > 15
      };

      const result = rule.evaluate(context);

      expect(result.isTriggered).toBe(true);
      expect(result.currentValue).toBe(20);
      expect(result.threshold).toBe(15);
      expect(result.variance).toBe(5);
      expect(result.variancePercentage).toBe((5 / 15) * 100);
      expect(result.severity).toBe('medium');
      expect(result.recommendedAction).toBe('alert_only');
      expect(result.message).toContain('Test Safety Rule');
      expect(result.evaluatedAt).toBeInstanceOf(Date);
    });

    it('should not trigger when condition is not met', () => {
      const context: SafetyRuleEvaluationContext = {
        ...evaluationContext,
        currentValue: 10, // < 15
      };

      const result = rule.evaluate(context);

      expect(result.isTriggered).toBe(false);
      expect(result.message).toBe('Threshold condition not met');
    });

    it('should not trigger when rule is disabled', () => {
      const disabledRule = rule.disable();
      const context: SafetyRuleEvaluationContext = {
        ...evaluationContext,
        currentValue: 20, // > 15
      };

      const result = disabledRule.evaluate(context);

      expect(result.isTriggered).toBe(false);
      expect(result.message).toBe('Rule is disabled');
    });

    it('should not trigger when portfolio scope does not match', () => {
      const scopedRule = SafetyRule.create({
        ...validRuleProps,
        portfolioScope: 'portfolio_456',
        threshold: 15,
      });

      const context: SafetyRuleEvaluationContext = {
        ...evaluationContext,
        portfolioId: 'portfolio_123', // Different portfolio
        currentValue: 20,
      };

      const result = scopedRule.evaluate(context);

      expect(result.isTriggered).toBe(false);
      expect(result.message).toBe('Rule scope does not match context');
    });

    it('should not trigger when symbol scope does not match', () => {
      const scopedRule = SafetyRule.create({
        ...validRuleProps,
        symbolScope: 'ETHUSDT',
        threshold: 15,
      });

      const context: SafetyRuleEvaluationContext = {
        ...evaluationContext,
        symbol: 'BTCUSDT', // Different symbol
        currentValue: 20,
      };

      const result = scopedRule.evaluate(context);

      expect(result.isTriggered).toBe(false);
      expect(result.message).toBe('Rule scope does not match context');
    });

    it('should evaluate different operators correctly', () => {
      const testCases = [
        { operator: 'greater_than', threshold: 15, value: 20, expected: true },
        { operator: 'greater_than', threshold: 15, value: 10, expected: false },
        { operator: 'less_than', threshold: 15, value: 10, expected: true },
        { operator: 'less_than', threshold: 15, value: 20, expected: false },
        { operator: 'equal_to', threshold: 15, value: 15, expected: true },
        { operator: 'equal_to', threshold: 15, value: 15.00005, expected: true }, // Within tolerance
        { operator: 'equal_to', threshold: 15, value: 14, expected: false },
        { operator: 'greater_than_or_equal', threshold: 15, value: 15, expected: true },
        { operator: 'greater_than_or_equal', threshold: 15, value: 16, expected: true },
        { operator: 'greater_than_or_equal', threshold: 15, value: 14, expected: false },
        { operator: 'less_than_or_equal', threshold: 15, value: 15, expected: true },
        { operator: 'less_than_or_equal', threshold: 15, value: 14, expected: true },
        { operator: 'less_than_or_equal', threshold: 15, value: 16, expected: false },
      ];

      testCases.forEach(({ operator, threshold, value, expected }) => {
        const testRule = SafetyRule.create({
          ...validRuleProps,
          operator: operator as SafetyRuleOperator,
          threshold,
        });

        const context: SafetyRuleEvaluationContext = {
          ...evaluationContext,
          currentValue: value,
        };

        const result = testRule.evaluate(context);
        expect(result.isTriggered).toBe(expected);
      });
    });

    it('should check additional conditions', () => {
      const conditionalRule = SafetyRule.create({
        ...validRuleProps,
        threshold: 15,
        conditions: { minVolume: 1000, market: 'crypto' },
      });

      const contextWithConditions: SafetyRuleEvaluationContext = {
        ...evaluationContext,
        currentValue: 20,
        additionalData: { minVolume: 1000, market: 'crypto' },
      };

      const contextWithoutConditions: SafetyRuleEvaluationContext = {
        ...evaluationContext,
        currentValue: 20,
        additionalData: { minVolume: 500, market: 'stock' },
      };

      expect(conditionalRule.evaluate(contextWithConditions).isTriggered).toBe(true);
      expect(conditionalRule.evaluate(contextWithoutConditions).isTriggered).toBe(false);
    });
  });

  describe('SafetyRule State Transitions', () => {
    let rule: SafetyRule;

    beforeEach(() => {
      rule = SafetyRule.create(validRuleProps);
    });

    it('should enable disabled rule', () => {
      const disabledRule = rule.disable();
      const enabledRule = disabledRule.enable();

      expect(disabledRule.isEnabled).toBe(false);
      expect(enabledRule.isEnabled).toBe(true);
    });

    it('should disable enabled rule', () => {
      const disabledRule = rule.disable();

      expect(rule.isEnabled).toBe(true);
      expect(disabledRule.isEnabled).toBe(false);
    });

    it('should not change state when already in target state', () => {
      const stillEnabled = rule.enable();
      const stillDisabled = rule.disable().disable();

      expect(stillEnabled).toBe(rule); // Same instance
      expect(stillDisabled.isEnabled).toBe(false);
    });

    it('should update threshold', () => {
      const updatedRule = rule.updateThreshold(25);

      expect(rule.threshold).toBe(10);
      expect(updatedRule.threshold).toBe(25);
    });

    it('should validate threshold update', () => {
      const drawdownRule = SafetyRule.create(drawdownRuleProps);

      expect(() => drawdownRule.updateThreshold(150)).toThrow(DomainValidationError);
    });

    it('should update priority', () => {
      const updatedRule = rule.updatePriority('critical');

      expect(rule.priority).toBe('medium');
      expect(updatedRule.priority).toBe('critical');
    });

    it('should update action', () => {
      const updatedRule = rule.updateAction('close_position');

      expect(rule.action).toBe('alert_only');
      expect(updatedRule.action).toBe('close_position');
    });

    it('should validate action update', () => {
      const criticalRule = SafetyRule.create({
        ...validRuleProps,
        priority: 'critical' as SafetyRulePriority,
        action: 'halt_trading' as SafetyRuleAction,
      });

      expect(() => criticalRule.updateAction('alert_only')).toThrow(DomainValidationError);
    });

    it('should record trigger', () => {
      const timestamp = new Date();
      const triggeredRule = rule.recordTrigger(timestamp);

      expect(rule.triggerCount).toBe(0);
      expect(rule.lastTriggered).toBeUndefined();
      expect(triggeredRule.triggerCount).toBe(1);
      expect(triggeredRule.lastTriggered).toBe(timestamp);
    });

    it('should record multiple triggers', () => {
      const firstTrigger = rule.recordTrigger();
      const secondTrigger = firstTrigger.recordTrigger();

      expect(secondTrigger.triggerCount).toBe(2);
    });

    it('should update conditions', () => {
      const newConditions = { newCondition: 'value' };
      const updatedRule = rule.updateConditions(newConditions);

      expect(updatedRule.conditions).toEqual(newConditions);
    });

    it('should update metadata', () => {
      const ruleWithMetadata = SafetyRule.create({
        ...validRuleProps,
        metadata: { existing: 'value' },
      });

      const updatedRule = ruleWithMetadata.updateMetadata({ new: 'data' });

      expect(updatedRule.metadata).toEqual({ existing: 'value', new: 'data' });
    });
  });

  describe('SafetyRule Utility Methods', () => {
    let rule: SafetyRule;
    let otherRule: SafetyRule;

    beforeEach(() => {
      rule = SafetyRule.create(validRuleProps);
      otherRule = SafetyRule.create({
        ...validRuleProps,
        name: 'Other Rule',
        priority: 'low' as SafetyRulePriority,
      });
    });

    it('should check portfolio applicability', () => {
      const scopedRule = SafetyRule.create({
        ...validRuleProps,
        portfolioScope: 'portfolio_123',
      });

      expect(rule.isApplicableToPortfolio('any-portfolio')).toBe(true);
      expect(scopedRule.isApplicableToPortfolio('portfolio_123')).toBe(true);
      expect(scopedRule.isApplicableToPortfolio('portfolio_456')).toBe(false);
    });

    it('should check symbol applicability', () => {
      const scopedRule = SafetyRule.create({
        ...validRuleProps,
        symbolScope: 'BTCUSDT',
      });

      expect(rule.isApplicableToSymbol('ETHUSDT')).toBe(true);
      expect(scopedRule.isApplicableToSymbol('BTCUSDT')).toBe(true);
      expect(scopedRule.isApplicableToSymbol('ETHUSDT')).toBe(false);
    });

    it('should compare priority levels', () => {
      const lowRule = SafetyRule.create({
        ...validRuleProps,
        priority: 'low' as SafetyRulePriority,
      });
      const highRule = SafetyRule.create({
        ...validRuleProps,
        priority: 'high' as SafetyRulePriority,
      });
      const criticalRule = SafetyRule.create({
        ...validRuleProps,
        priority: 'critical' as SafetyRulePriority,
      });

      expect(highRule.isPriorityHigherThan(lowRule)).toBe(true);
      expect(criticalRule.isPriorityHigherThan(highRule)).toBe(true);
      expect(lowRule.isPriorityHigherThan(highRule)).toBe(false);
    });

    it('should check rule similarity', () => {
      const similarRule = SafetyRule.create({
        ...validRuleProps,
        name: 'Different Name',
        threshold: 10.00001, // Very close threshold
      });

      const differentRule = SafetyRule.create({
        ...validRuleProps,
        type: 'position_risk' as SafetyRuleType,
      });

      expect(rule.isSimilarTo(similarRule)).toBe(true);
      expect(rule.isSimilarTo(differentRule)).toBe(false);
    });

    it('should calculate days since last triggered', () => {
      const newRule = SafetyRule.create(validRuleProps);
      const oldDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
      const triggeredRule = newRule.recordTrigger(oldDate);

      expect(newRule.getDaysSinceLastTriggered()).toBeNull();
      expect(triggeredRule.getDaysSinceLastTriggered()).toBe(5);
    });

    it('should calculate trigger frequency', () => {
      const pastDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const ruleFromPast = SafetyRule.fromExisting({
        ...validRuleProps,
        id: 'test-rule',
        createdAt: pastDate,
        triggerCount: 5,
        lastTriggered: new Date(),
      });

      const frequency = ruleFromPast.getTriggerFrequency();
      expect(frequency).toBe(0.5); // 5 triggers in 10 days = 0.5 triggers per day
    });

    it('should return zero frequency for untriggered rule', () => {
      expect(rule.getTriggerFrequency()).toBe(0);
    });
  });

  describe('SafetyRule Factory Methods', () => {
    it('should create drawdown rule', () => {
      const rule = SafetyRule.createDrawdownRule('Max Drawdown', 20, 'high', 'close_position');

      expect(rule.name).toBe('Max Drawdown');
      expect(rule.type).toBe('drawdown_threshold');
      expect(rule.threshold).toBe(20);
      expect(rule.priority).toBe('high');
      expect(rule.action).toBe('close_position');
      expect(rule.operator).toBe('greater_than');
      expect(rule.portfolioScope).toBe('all');
      expect(rule.symbolScope).toBe('all');
      expect(rule.metadata.autoGenerated).toBe(true);
    });

    it('should create position risk rule', () => {
      const rule = SafetyRule.createPositionRiskRule('Position Risk', 10, 'medium', 'reduce_position', 'BTCUSDT');

      expect(rule.name).toBe('Position Risk');
      expect(rule.type).toBe('position_risk');
      expect(rule.threshold).toBe(10);
      expect(rule.priority).toBe('medium');
      expect(rule.action).toBe('reduce_position');
      expect(rule.symbolScope).toBe('BTCUSDT');
      expect(rule.metadata.ruleCategory).toBe('position_management');
    });

    it('should create consecutive loss rule', () => {
      const rule = SafetyRule.createConsecutiveLossRule('Max Losses', 3, 'critical', 'emergency_stop');

      expect(rule.name).toBe('Max Losses');
      expect(rule.type).toBe('consecutive_losses');
      expect(rule.threshold).toBe(3);
      expect(rule.priority).toBe('critical');
      expect(rule.action).toBe('emergency_stop');
      expect(rule.operator).toBe('greater_than_or_equal');
      expect(rule.metadata.ruleCategory).toBe('trading_behavior');
    });
  });

  describe('SafetyRule Formatting', () => {
    let rule: SafetyRule;

    beforeEach(() => {
      rule = SafetyRule.create(validRuleProps);
    });

    it('should format to string', () => {
      const formatted = rule.toString();

      expect(formatted).toBe('Test Safety Rule (drawdown_threshold, medium, enabled)');
    });

    it('should format disabled rule to string', () => {
      const disabledRule = rule.disable();
      const formatted = disabledRule.toString();

      expect(formatted).toContain('disabled');
    });

    it('should format to summary string', () => {
      const formatted = rule.toSummaryString();

      expect(formatted).toBe('Test Safety Rule: > 10 → alert_only');
    });

    it('should format different operators in summary', () => {
      const testCases = [
        { operator: 'greater_than', symbol: '>' },
        { operator: 'less_than', symbol: '<' },
        { operator: 'equal_to', symbol: '=' },
        { operator: 'greater_than_or_equal', symbol: '>=' },
        { operator: 'less_than_or_equal', symbol: '<=' },
      ];

      testCases.forEach(({ operator, symbol }) => {
        const testRule = SafetyRule.create({
          ...validRuleProps,
          operator: operator as SafetyRuleOperator,
        });

        expect(testRule.toSummaryString()).toContain(symbol);
      });
    });
  });

  describe('SafetyRule from Existing', () => {
    it('should create rule from existing props', () => {
      const existingProps = {
        id: 'existing-rule-123',
        name: 'Existing Rule',
        description: 'An existing safety rule',
        type: 'position_risk' as SafetyRuleType,
        operator: 'less_than' as SafetyRuleOperator,
        threshold: 25,
        priority: 'critical' as SafetyRulePriority,
        action: 'halt_trading' as SafetyRuleAction,
        isEnabled: false,
        portfolioScope: 'portfolio_456',
        symbolScope: 'ETHUSDT',
        conditions: { test: 'value' },
        metadata: { source: 'import' },
        createdAt: new Date('2024-01-01'),
        lastTriggered: new Date('2024-01-15'),
        triggerCount: 5,
      };

      const rule = SafetyRule.fromExisting(existingProps);

      expect(rule.id).toBe('existing-rule-123');
      expect(rule.name).toBe('Existing Rule');
      expect(rule.type).toBe('position_risk');
      expect(rule.threshold).toBe(25);
      expect(rule.isEnabled).toBe(false);
      expect(rule.triggerCount).toBe(5);
      expect(rule.lastTriggered).toEqual(new Date('2024-01-15'));
    });

    it('should validate existing props', () => {
      const invalidExistingProps = {
        id: 'existing-rule-123',
        name: '', // Invalid empty name
        description: 'Valid description',
        type: 'drawdown_threshold' as SafetyRuleType,
        operator: 'greater_than' as SafetyRuleOperator,
        threshold: 15,
        priority: 'medium' as SafetyRulePriority,
        action: 'alert_only' as SafetyRuleAction,
        isEnabled: true,
        portfolioScope: 'all',
        symbolScope: 'all',
        conditions: {},
        metadata: {},
        createdAt: new Date(),
        triggerCount: 0,
      };

      expect(() => SafetyRule.fromExisting(invalidExistingProps)).toThrow(DomainValidationError);
    });
  });

  describe('SafetyRule Serialization', () => {
    it('should convert to plain object', () => {
      const rule = SafetyRule.create(validRuleProps);
      const plainObject = rule.toPlainObject();

      expect(plainObject.id).toBe(rule.id);
      expect(plainObject.name).toBe(rule.name);
      expect(plainObject.description).toBe(rule.description);
      expect(plainObject.type).toBe(rule.type);
      expect(plainObject.operator).toBe(rule.operator);
      expect(plainObject.threshold).toBe(rule.threshold);
      expect(plainObject.priority).toBe(rule.priority);
      expect(plainObject.action).toBe(rule.action);
      expect(plainObject.isEnabled).toBe(rule.isEnabled);
      expect(plainObject.portfolioScope).toBe(rule.portfolioScope);
      expect(plainObject.symbolScope).toBe(rule.symbolScope);
      expect(plainObject.conditions).toEqual(rule.conditions);
      expect(plainObject.metadata).toEqual(rule.metadata);
      expect(plainObject.createdAt).toBe(rule.createdAt);
      expect(plainObject.triggerCount).toBe(rule.triggerCount);
    });
  });

  describe('Performance Tests', () => {
    it('should create rules efficiently', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        SafetyRule.create({
          ...validRuleProps,
          name: `Rule ${i}`,
          threshold: i % 100,
        });
      }
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500); // Should create 1000 rules in under 500ms
    });

    it('should evaluate rules efficiently', () => {
      const rule = SafetyRule.create(validRuleProps);
      const context: SafetyRuleEvaluationContext = {
        ...evaluationContext,
        currentValue: 20,
      };

      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        rule.evaluate({
          ...context,
          currentValue: i % 50, // Vary the value
        });
      }
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should evaluate 1000 times in under 100ms
    });
  });
});