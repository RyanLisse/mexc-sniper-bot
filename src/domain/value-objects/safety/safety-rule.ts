/**
 * SafetyRule Value Object
 * Represents safety rules for trading risk management with validation and evaluation logic
 */

import { z } from "zod";
import { ValueObject } from "../../base/value-object";
import { DomainValidationError } from "../../errors/trading-errors";

// Safety rule types
export type SafetyRuleType =
  | "drawdown_threshold"
  | "position_risk"
  | "concentration_limit"
  | "consecutive_losses"
  | "daily_loss_limit"
  | "monthly_loss_limit"
  | "exposure_limit"
  | "leverage_limit"
  | "volatility_threshold"
  | "custom";

export type SafetyRulePriority = "low" | "medium" | "high" | "critical";

export type SafetyRuleOperator =
  | "greater_than"
  | "less_than"
  | "equal_to"
  | "greater_than_or_equal"
  | "less_than_or_equal";

export type SafetyRuleAction =
  | "alert_only"
  | "reduce_position"
  | "close_position"
  | "halt_trading"
  | "emergency_stop"
  | "custom_action";

interface SafetyRuleProps {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly type: SafetyRuleType;
  readonly operator: SafetyRuleOperator;
  readonly threshold: number;
  readonly priority: SafetyRulePriority;
  readonly action: SafetyRuleAction;
  readonly isEnabled: boolean;
  readonly portfolioScope: string; // "all" or specific portfolio ID
  readonly symbolScope: string; // "all" or specific symbol
  readonly conditions: Record<string, any>; // Additional conditions for complex rules
  readonly metadata: Record<string, any>; // Additional metadata for custom rules
  readonly createdAt: Date;
  readonly lastTriggered?: Date;
  readonly triggerCount: number;
}

// Validation schemas
const SafetyRuleTypeSchema = z.enum([
  "drawdown_threshold",
  "position_risk",
  "concentration_limit",
  "consecutive_losses",
  "daily_loss_limit",
  "monthly_loss_limit",
  "exposure_limit",
  "leverage_limit",
  "volatility_threshold",
  "custom",
]);

const SafetyRulePrioritySchema = z.enum(["low", "medium", "high", "critical"]);

const SafetyRuleOperatorSchema = z.enum([
  "greater_than",
  "less_than",
  "equal_to",
  "greater_than_or_equal",
  "less_than_or_equal",
]);

const SafetyRuleActionSchema = z.enum([
  "alert_only",
  "reduce_position",
  "close_position",
  "halt_trading",
  "emergency_stop",
  "custom_action",
]);

const SafetyRulePropsSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  type: SafetyRuleTypeSchema,
  operator: SafetyRuleOperatorSchema,
  threshold: z.number().finite(),
  priority: SafetyRulePrioritySchema,
  action: SafetyRuleActionSchema,
  isEnabled: z.boolean(),
  portfolioScope: z.string().min(1),
  symbolScope: z.string().min(1),
  conditions: z.record(z.any()),
  metadata: z.record(z.any()),
  createdAt: z.date(),
  lastTriggered: z.date().optional(),
  triggerCount: z.number().int().min(0),
});

export interface SafetyRuleEvaluationContext {
  currentValue: number;
  portfolioId?: string;
  symbol?: string;
  timestamp: Date;
  additionalData?: Record<string, any>;
}

export interface SafetyRuleEvaluationResult {
  isTriggered: boolean;
  currentValue: number;
  threshold: number;
  variance: number;
  variancePercentage: number;
  severity: SafetyRulePriority;
  recommendedAction: SafetyRuleAction;
  message: string;
  evaluatedAt: Date;
}

export class SafetyRule extends ValueObject<SafetyRuleProps> {
  private constructor(props: SafetyRuleProps) {
    super(props);
  }

  static create(
    props: Omit<SafetyRuleProps, "id" | "createdAt" | "triggerCount">
  ): SafetyRule {
    const safetyRuleProps: SafetyRuleProps = {
      ...props,
      id: `safety_rule_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      createdAt: new Date(),
      triggerCount: 0,
    };

    return SafetyRule.createWithValidation(safetyRuleProps);
  }

  static fromExisting(props: SafetyRuleProps): SafetyRule {
    return SafetyRule.createWithValidation(props);
  }

  private static createWithValidation(props: SafetyRuleProps): SafetyRule {
    // Validate props
    const validationResult = SafetyRulePropsSchema.safeParse(props);
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      throw new DomainValidationError(
        firstError.path.join("."),
        "invalid value",
        firstError.message
      );
    }

    // Business rule validations
    SafetyRule.validateBusinessRules(props);

    return new SafetyRule(props);
  }

  private static validateBusinessRules(props: SafetyRuleProps): void {
    // Validate threshold ranges based on rule type
    switch (props.type) {
      case "drawdown_threshold":
      case "concentration_limit":
        if (props.threshold <= 0 || props.threshold > 100) {
          throw new DomainValidationError(
            "threshold",
            props.threshold,
            "Percentage-based thresholds must be between 0 and 100"
          );
        }
        break;

      case "position_risk":
        if (props.threshold <= 0 || props.threshold > 50) {
          throw new DomainValidationError(
            "threshold",
            props.threshold,
            "Position risk threshold must be between 0 and 50 percent"
          );
        }
        break;

      case "consecutive_losses":
        if (
          props.threshold <= 0 ||
          props.threshold > 20 ||
          !Number.isInteger(props.threshold)
        ) {
          throw new DomainValidationError(
            "threshold",
            props.threshold,
            "Consecutive losses threshold must be a positive integer between 1 and 20"
          );
        }
        break;

      case "leverage_limit":
        if (props.threshold <= 1 || props.threshold > 100) {
          throw new DomainValidationError(
            "threshold",
            props.threshold,
            "Leverage limit must be between 1 and 100"
          );
        }
        break;

      case "daily_loss_limit":
      case "monthly_loss_limit":
        if (props.threshold <= 0) {
          throw new DomainValidationError(
            "threshold",
            props.threshold,
            "Loss limit thresholds must be positive"
          );
        }
        break;
    }

    // Validate action compatibility with priority
    if (props.priority === "critical" && props.action === "alert_only") {
      throw new DomainValidationError(
        "action",
        props.action,
        "Critical priority rules cannot have alert_only action"
      );
    }

    // Validate scope formats
    if (
      props.portfolioScope !== "all" &&
      !props.portfolioScope.startsWith("portfolio_")
    ) {
      throw new DomainValidationError(
        "portfolioScope",
        props.portfolioScope,
        "Portfolio scope must be 'all' or start with 'portfolio_'"
      );
    }

    if (props.symbolScope !== "all" && props.symbolScope.length < 3) {
      throw new DomainValidationError(
        "symbolScope",
        props.symbolScope,
        "Symbol scope must be 'all' or a valid symbol (minimum 3 characters)"
      );
    }
  }

  // Getters
  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string {
    return this.props.description;
  }

  get type(): SafetyRuleType {
    return this.props.type;
  }

  get operator(): SafetyRuleOperator {
    return this.props.operator;
  }

  get threshold(): number {
    return this.props.threshold;
  }

  get priority(): SafetyRulePriority {
    return this.props.priority;
  }

  get action(): SafetyRuleAction {
    return this.props.action;
  }

  get isEnabled(): boolean {
    return this.props.isEnabled;
  }

  get portfolioScope(): string {
    return this.props.portfolioScope;
  }

  get symbolScope(): string {
    return this.props.symbolScope;
  }

  get conditions(): Record<string, any> {
    return { ...this.props.conditions };
  }

  get metadata(): Record<string, any> {
    return { ...this.props.metadata };
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get lastTriggered(): Date | undefined {
    return this.props.lastTriggered;
  }

  get triggerCount(): number {
    return this.props.triggerCount;
  }

  // Business logic methods
  evaluate(context: SafetyRuleEvaluationContext): SafetyRuleEvaluationResult {
    if (!this.isEnabled) {
      return this.createNonTriggeredResult(context, "Rule is disabled");
    }

    if (!this.appliesToContext(context)) {
      return this.createNonTriggeredResult(
        context,
        "Rule scope does not match context"
      );
    }

    const isTriggered = this.evaluateCondition(context.currentValue);
    const variance = context.currentValue - this.threshold;
    const variancePercentage =
      this.threshold !== 0 ? (variance / this.threshold) * 100 : 0;

    if (isTriggered) {
      return {
        isTriggered: true,
        currentValue: context.currentValue,
        threshold: this.threshold,
        variance,
        variancePercentage,
        severity: this.priority,
        recommendedAction: this.action,
        message: this.generateTriggerMessage(context),
        evaluatedAt: context.timestamp,
      };
    }

    return this.createNonTriggeredResult(
      context,
      "Threshold condition not met"
    );
  }

  private evaluateCondition(currentValue: number): boolean {
    switch (this.operator) {
      case "greater_than":
        return currentValue > this.threshold;
      case "less_than":
        return currentValue < this.threshold;
      case "equal_to":
        return Math.abs(currentValue - this.threshold) < 0.0001;
      case "greater_than_or_equal":
        return currentValue >= this.threshold;
      case "less_than_or_equal":
        return currentValue <= this.threshold;
      default:
        return false;
    }
  }

  private appliesToContext(context: SafetyRuleEvaluationContext): boolean {
    // Check portfolio scope
    if (
      this.portfolioScope !== "all" &&
      context.portfolioId !== this.portfolioScope
    ) {
      return false;
    }

    // Check symbol scope
    if (this.symbolScope !== "all" && context.symbol !== this.symbolScope) {
      return false;
    }

    // Check additional conditions
    if (Object.keys(this.conditions).length > 0 && context.additionalData) {
      for (const [key, expectedValue] of Object.entries(this.conditions)) {
        if (context.additionalData[key] !== expectedValue) {
          return false;
        }
      }
    }

    return true;
  }

  private createNonTriggeredResult(
    context: SafetyRuleEvaluationContext,
    reason: string
  ): SafetyRuleEvaluationResult {
    const variance = context.currentValue - this.threshold;
    const variancePercentage =
      this.threshold !== 0 ? (variance / this.threshold) * 100 : 0;

    return {
      isTriggered: false,
      currentValue: context.currentValue,
      threshold: this.threshold,
      variance,
      variancePercentage,
      severity: this.priority,
      recommendedAction: this.action,
      message: reason,
      evaluatedAt: context.timestamp,
    };
  }

  private generateTriggerMessage(context: SafetyRuleEvaluationContext): string {
    const operatorText = this.getOperatorText();
    return `${this.name}: ${context.currentValue} ${operatorText} ${this.threshold} (${this.type})`;
  }

  private getOperatorText(): string {
    switch (this.operator) {
      case "greater_than":
        return ">";
      case "less_than":
        return "<";
      case "equal_to":
        return "=";
      case "greater_than_or_equal":
        return ">=";
      case "less_than_or_equal":
        return "<=";
      default:
        return "?";
    }
  }

  // State transition methods (return new instances)
  enable(): SafetyRule {
    if (this.isEnabled) {
      return this;
    }

    return SafetyRule.fromExisting({
      ...this.props,
      isEnabled: true,
    });
  }

  disable(): SafetyRule {
    if (!this.isEnabled) {
      return this;
    }

    return SafetyRule.fromExisting({
      ...this.props,
      isEnabled: false,
    });
  }

  updateThreshold(newThreshold: number): SafetyRule {
    const updatedProps = {
      ...this.props,
      threshold: newThreshold,
    };

    // Validate the new threshold
    SafetyRule.validateBusinessRules(updatedProps);

    return SafetyRule.fromExisting(updatedProps);
  }

  updatePriority(newPriority: SafetyRulePriority): SafetyRule {
    return SafetyRule.fromExisting({
      ...this.props,
      priority: newPriority,
    });
  }

  updateAction(newAction: SafetyRuleAction): SafetyRule {
    const updatedProps = {
      ...this.props,
      action: newAction,
    };

    // Validate the new action
    SafetyRule.validateBusinessRules(updatedProps);

    return SafetyRule.fromExisting(updatedProps);
  }

  recordTrigger(timestamp: Date = new Date()): SafetyRule {
    return SafetyRule.fromExisting({
      ...this.props,
      lastTriggered: timestamp,
      triggerCount: this.props.triggerCount + 1,
    });
  }

  updateConditions(newConditions: Record<string, any>): SafetyRule {
    return SafetyRule.fromExisting({
      ...this.props,
      conditions: { ...newConditions },
    });
  }

  updateMetadata(newMetadata: Record<string, any>): SafetyRule {
    return SafetyRule.fromExisting({
      ...this.props,
      metadata: { ...this.props.metadata, ...newMetadata },
    });
  }

  // Utility methods
  isApplicableToPortfolio(portfolioId: string): boolean {
    return this.portfolioScope === "all" || this.portfolioScope === portfolioId;
  }

  isApplicableToSymbol(symbol: string): boolean {
    return this.symbolScope === "all" || this.symbolScope === symbol;
  }

  isPriorityHigherThan(other: SafetyRule): boolean {
    const priorityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
    return priorityOrder[this.priority] > priorityOrder[other.priority];
  }

  isSimilarTo(other: SafetyRule): boolean {
    return (
      this.type === other.type &&
      this.portfolioScope === other.portfolioScope &&
      this.symbolScope === other.symbolScope &&
      Math.abs(this.threshold - other.threshold) < 0.0001
    );
  }

  getDaysSinceLastTriggered(): number | null {
    if (!this.lastTriggered) {
      return null;
    }
    const diffMs = Date.now() - this.lastTriggered.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  getTriggerFrequency(): number {
    if (!this.lastTriggered) {
      return 0;
    }
    const daysSinceCreation = Math.max(
      1,
      Math.floor(
        (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      )
    );
    return this.triggerCount / daysSinceCreation;
  }

  // Formatting methods
  toString(): string {
    const status = this.isEnabled ? "enabled" : "disabled";
    return `${this.name} (${this.type}, ${this.priority}, ${status})`;
  }

  toSummaryString(): string {
    const operatorText = this.getOperatorText();
    return `${this.name}: ${operatorText} ${this.threshold} → ${this.action}`;
  }

  // Static utility methods
  static createDrawdownRule(
    name: string,
    thresholdPercent: number,
    priority: SafetyRulePriority = "high",
    action: SafetyRuleAction = "reduce_position",
    portfolioScope: string = "all"
  ): SafetyRule {
    return SafetyRule.create({
      name,
      description: `Maximum drawdown threshold of ${thresholdPercent}%`,
      type: "drawdown_threshold",
      operator: "greater_than",
      threshold: thresholdPercent,
      priority,
      action,
      isEnabled: true,
      portfolioScope,
      symbolScope: "all",
      conditions: {},
      metadata: { autoGenerated: true, ruleCategory: "risk_management" },
    });
  }

  static createPositionRiskRule(
    name: string,
    thresholdPercent: number,
    priority: SafetyRulePriority = "medium",
    action: SafetyRuleAction = "alert_only",
    symbolScope: string = "all"
  ): SafetyRule {
    return SafetyRule.create({
      name,
      description: `Position risk limit of ${thresholdPercent}%`,
      type: "position_risk",
      operator: "greater_than",
      threshold: thresholdPercent,
      priority,
      action,
      isEnabled: true,
      portfolioScope: "all",
      symbolScope,
      conditions: {},
      metadata: { autoGenerated: true, ruleCategory: "position_management" },
    });
  }

  static createConsecutiveLossRule(
    name: string,
    maxLosses: number,
    priority: SafetyRulePriority = "high",
    action: SafetyRuleAction = "halt_trading"
  ): SafetyRule {
    return SafetyRule.create({
      name,
      description: `Maximum ${maxLosses} consecutive losses`,
      type: "consecutive_losses",
      operator: "greater_than_or_equal",
      threshold: maxLosses,
      priority,
      action,
      isEnabled: true,
      portfolioScope: "all",
      symbolScope: "all",
      conditions: {},
      metadata: { autoGenerated: true, ruleCategory: "trading_behavior" },
    });
  }

  // Convert to plain object for persistence
  toPlainObject(): SafetyRuleProps {
    return { ...this.props };
  }
}
