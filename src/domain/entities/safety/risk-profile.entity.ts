/**
 * RiskProfile Domain Entity
 * Represents a comprehensive risk management profile for trading portfolios
 */

import { z } from "zod";
import { AggregateRoot } from "../../base/aggregate-root";
import {
  BusinessRuleViolationError,
  DomainValidationError,
} from "../../errors/trading-errors";
import {
  type RiskProfileCreated,
  type RiskProfileUpdated,
  type RiskThresholdViolated,
  SafetyEventFactory,
} from "../../events/safety-events";

// Risk tolerance level enumeration
export type RiskToleranceLevel = "conservative" | "medium" | "aggressive";

// Risk violation types
export type RiskViolationType =
  | "drawdown_threshold"
  | "position_risk"
  | "portfolio_risk"
  | "concentration_risk"
  | "consecutive_losses"
  | "daily_loss_threshold"
  | "monthly_loss_threshold";

// Risk level assessment
export type RiskLevel = "low" | "medium" | "high" | "critical";

// Risk update types
export type RiskUpdateType = "thresholds" | "exposures" | "tolerance" | "status";

export interface RiskThresholds {
  readonly maxDrawdownPercent: number;
  readonly maxPositionRiskPercent: number;
  readonly maxPortfolioRiskPercent: number;
  readonly maxConcentrationPercent: number;
  readonly consecutiveLossThreshold: number;
  readonly dailyLossThreshold: number;
  readonly monthlyLossThreshold: number;
}

export interface RiskExposures {
  readonly totalExposure: number;
  readonly longExposure: number;
  readonly shortExposure: number;
  readonly leveragedExposure: number;
  readonly unrealizedPnL: number;
  readonly realizedPnL: number;
}

export interface ThresholdViolationData {
  readonly violationType: RiskViolationType;
  readonly threshold: number;
  readonly currentValue: number;
  readonly severity: "low" | "medium" | "high" | "critical";
  readonly recommendedActions: string[];
  readonly violationContext?: {
    readonly symbol?: string;
    readonly positionId?: string;
    readonly tradeId?: string;
    readonly timeframe?: string;
    readonly additionalMetrics?: Record<string, any>;
  };
}

export interface RiskAssessment {
  readonly overallRisk: number;
  readonly violations: RiskViolationType[];
  readonly riskLevel: RiskLevel;
  readonly recommendedActions: string[];
  readonly assessmentTimestamp: Date;
}

export interface MarketDataForRisk {
  readonly portfolioValue: number;
  readonly initialValue: number;
  readonly positions: Array<{
    readonly value: number;
    readonly riskExposure: number;
  }>;
  readonly consecutiveLosses: number;
  readonly dailyLoss: number;
  readonly monthlyLoss: number;
}

interface RiskProfileProps {
  readonly id: string;
  readonly portfolioId: string;
  readonly userId: string;
  readonly thresholds: RiskThresholds;
  readonly exposures: RiskExposures;
  readonly riskToleranceLevel: RiskToleranceLevel;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

// Validation schemas
const RiskThresholdsSchema = z.object({
  maxDrawdownPercent: z.number().min(0).max(100),
  maxPositionRiskPercent: z.number().min(0).max(100),
  maxPortfolioRiskPercent: z.number().min(0).max(100),
  maxConcentrationPercent: z.number().min(0).max(100),
  consecutiveLossThreshold: z.number().int().min(1),
  dailyLossThreshold: z.number().min(0),
  monthlyLossThreshold: z.number().min(0),
});

const RiskExposuresSchema = z.object({
  totalExposure: z.number().min(0),
  longExposure: z.number().min(0),
  shortExposure: z.number().min(0),
  leveragedExposure: z.number().min(0),
  unrealizedPnL: z.number(),
  realizedPnL: z.number(),
});

const RiskProfilePropsSchema = z.object({
  id: z.string().min(1),
  portfolioId: z.string().min(1),
  userId: z.string().min(1),
  thresholds: RiskThresholdsSchema,
  exposures: RiskExposuresSchema,
  riskToleranceLevel: z.enum(["conservative", "medium", "aggressive"]),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number().int().min(1),
});

export class RiskProfile extends AggregateRoot<string> {
  private constructor(private props: RiskProfileProps) {
    super(props.id);
  }

  static create(props: {
    portfolioId: string;
    userId: string;
    thresholds: RiskThresholds;
    exposures: RiskExposures;
    riskToleranceLevel: RiskToleranceLevel;
    isActive?: boolean;
  }): RiskProfile {
    const id = `risk_profile_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = new Date();

    const riskProfileProps: RiskProfileProps = {
      id,
      portfolioId: props.portfolioId,
      userId: props.userId,
      thresholds: props.thresholds,
      exposures: props.exposures,
      riskToleranceLevel: props.riskToleranceLevel,
      isActive: props.isActive ?? true,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    const riskProfile = RiskProfile.createWithValidation(riskProfileProps);

    // Emit domain event
    riskProfile.addDomainEvent(
      SafetyEventFactory.createRiskProfileCreated(id, props.userId, {
        riskProfileId: id,
        userId: props.userId,
        portfolioId: props.portfolioId,
        thresholds: {
          maxDrawdownPercent: props.thresholds.maxDrawdownPercent,
          maxPositionRiskPercent: props.thresholds.maxPositionRiskPercent,
          maxPortfolioRiskPercent: props.thresholds.maxPortfolioRiskPercent,
          maxConcentrationPercent: props.thresholds.maxConcentrationPercent,
          consecutiveLossThreshold: props.thresholds.consecutiveLossThreshold,
          dailyLossThreshold: props.thresholds.dailyLossThreshold,
          monthlyLossThreshold: props.thresholds.monthlyLossThreshold,
        },
        exposures: {
          totalExposure: props.exposures.totalExposure,
          longExposure: props.exposures.longExposure,
          shortExposure: props.exposures.shortExposure,
          leveragedExposure: props.exposures.leveragedExposure,
          unrealizedPnL: props.exposures.unrealizedPnL,
          realizedPnL: props.exposures.realizedPnL,
        },
        riskToleranceLevel: props.riskToleranceLevel,
        isActive: props.isActive ?? true,
      })
    );

    return riskProfile;
  }

  static fromExisting(props: RiskProfileProps): RiskProfile {
    return RiskProfile.createWithValidation(props);
  }

  private static createWithValidation(props: RiskProfileProps): RiskProfile {
    // Validate props
    const validationResult = RiskProfilePropsSchema.safeParse(props);
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      throw new DomainValidationError(
        firstError.path.join("."),
        "invalid value",
        firstError.message
      );
    }

    // Business rule validations
    RiskProfile.validateBusinessRules(props);

    return new RiskProfile(props);
  }

  private static validateBusinessRules(props: RiskProfileProps): void {
    // Validate threshold relationships
    if (props.thresholds.maxPositionRiskPercent > props.thresholds.maxPortfolioRiskPercent) {
      throw new DomainValidationError(
        "thresholds.maxPositionRiskPercent",
        props.thresholds.maxPositionRiskPercent,
        "Position risk threshold cannot exceed portfolio risk threshold"
      );
    }

    // Validate exposure consistency
    const calculatedTotal = props.exposures.longExposure + props.exposures.shortExposure;
    if (calculatedTotal > props.exposures.totalExposure) {
      throw new DomainValidationError(
        "exposures",
        props.exposures,
        "Long and short exposures cannot exceed total exposure"
      );
    }

    // Validate threshold values are reasonable
    if (props.thresholds.maxDrawdownPercent <= 0) {
      throw new DomainValidationError(
        "thresholds.maxDrawdownPercent",
        props.thresholds.maxDrawdownPercent,
        "Drawdown threshold must be positive"
      );
    }

    if (props.thresholds.consecutiveLossThreshold <= 0) {
      throw new DomainValidationError(
        "thresholds.consecutiveLossThreshold",
        props.thresholds.consecutiveLossThreshold,
        "Consecutive loss threshold must be positive"
      );
    }
  }

  // Getters
  get id(): string {
    return this.props.id;
  }

  get portfolioId(): string {
    return this.props.portfolioId;
  }

  get userId(): string {
    return this.props.userId;
  }

  get thresholds(): RiskThresholds {
    return this.props.thresholds;
  }

  get exposures(): RiskExposures {
    return this.props.exposures;
  }

  get riskToleranceLevel(): RiskToleranceLevel {
    return this.props.riskToleranceLevel;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get version(): number {
    return this.props.version;
  }

  // Risk calculation methods
  calculateDrawdownPercent(currentValue: number, initialValue: number): number {
    if (initialValue <= 0) return 0;
    const drawdown = Math.max(0, initialValue - currentValue);
    return (drawdown / initialValue) * 100;
  }

  calculateConcentrationPercent(positionValue: number, totalPortfolioValue: number): number {
    if (totalPortfolioValue <= 0) return 0;
    return (positionValue / totalPortfolioValue) * 100;
  }

  calculateTotalExposureRatio(): number {
    if (this.props.exposures.totalExposure <= 0) return 0;
    const netExposure = this.props.exposures.longExposure + this.props.exposures.shortExposure;
    return netExposure / this.props.exposures.totalExposure;
  }

  calculateLeverageRatio(): number {
    if (this.props.exposures.totalExposure <= 0) return 1.0;
    return 1.0 + (this.props.exposures.leveragedExposure / this.props.exposures.totalExposure);
  }

  calculateNetPnL(): number {
    return this.props.exposures.unrealizedPnL + this.props.exposures.realizedPnL;
  }

  calculatePnLPercent(baseValue: number): number {
    if (baseValue <= 0) return 0;
    return (this.calculateNetPnL() / baseValue) * 100;
  }

  // Threshold evaluation methods
  isDrawdownThresholdViolated(currentDrawdownPercent: number): boolean {
    return currentDrawdownPercent > this.props.thresholds.maxDrawdownPercent;
  }

  isPositionRiskThresholdViolated(positionValue: number, portfolioValue: number): boolean {
    const positionRiskPercent = this.calculateConcentrationPercent(positionValue, portfolioValue);
    return positionRiskPercent > this.props.thresholds.maxPositionRiskPercent;
  }

  isConcentrationThresholdViolated(positionValue: number, portfolioValue: number): boolean {
    const concentrationPercent = this.calculateConcentrationPercent(positionValue, portfolioValue);
    return concentrationPercent > this.props.thresholds.maxConcentrationPercent;
  }

  isPortfolioRiskThresholdViolated(totalRiskExposure: number, portfolioValue: number): boolean {
    const portfolioRiskPercent = this.calculateConcentrationPercent(totalRiskExposure, portfolioValue);
    return portfolioRiskPercent > this.props.thresholds.maxPortfolioRiskPercent;
  }

  evaluateThresholds(marketData: MarketDataForRisk): RiskAssessment {
    const violations: RiskViolationType[] = [];
    
    // Check drawdown threshold
    const drawdownPercent = this.calculateDrawdownPercent(marketData.portfolioValue, marketData.initialValue);
    if (this.isDrawdownThresholdViolated(drawdownPercent)) {
      violations.push("drawdown_threshold");
    }

    // Check position risks
    for (const position of marketData.positions) {
      if (this.isPositionRiskThresholdViolated(position.value, marketData.portfolioValue)) {
        violations.push("position_risk");
        break;
      }
    }

    // Check concentration risks
    for (const position of marketData.positions) {
      if (this.isConcentrationThresholdViolated(position.value, marketData.portfolioValue)) {
        violations.push("concentration_risk");
        break;
      }
    }

    // Check portfolio risk
    const totalRiskExposure = marketData.positions.reduce((total, pos) => total + pos.riskExposure, 0);
    if (this.isPortfolioRiskThresholdViolated(totalRiskExposure, marketData.portfolioValue)) {
      violations.push("portfolio_risk");
    }

    // Check consecutive losses
    if (marketData.consecutiveLosses > this.props.thresholds.consecutiveLossThreshold) {
      violations.push("consecutive_losses");
    }

    // Check daily loss threshold
    if (marketData.dailyLoss > this.props.thresholds.dailyLossThreshold) {
      violations.push("daily_loss_threshold");
    }

    // Check monthly loss threshold
    if (marketData.monthlyLoss > this.props.thresholds.monthlyLossThreshold) {
      violations.push("monthly_loss_threshold");
    }

    // Calculate overall risk level
    const riskLevel = this.calculateRiskLevel(violations);
    const overallRisk = this.calculateOverallRiskScore(violations);
    const recommendedActions = this.generateRecommendationsForViolations(violations);

    return {
      overallRisk,
      violations,
      riskLevel,
      recommendedActions,
      assessmentTimestamp: new Date(),
    };
  }

  calculateRiskLevel(violations: RiskViolationType[]): RiskLevel {
    if (violations.length === 0) return "low";
    if (violations.length <= 2) return "medium";
    if (violations.length <= 4) return "high";
    return "critical";
  }

  private calculateOverallRiskScore(violations: RiskViolationType[]): number {
    const weights: Record<RiskViolationType, number> = {
      drawdown_threshold: 0.25,
      position_risk: 0.15,
      portfolio_risk: 0.20,
      concentration_risk: 0.15,
      consecutive_losses: 0.10,
      daily_loss_threshold: 0.08,
      monthly_loss_threshold: 0.07,
    };

    return violations.reduce((score, violation) => score + (weights[violation] || 0.1), 0);
  }

  // Business logic methods
  updateThresholds(newThresholds: RiskThresholds): RiskProfile {
    if (!this.props.isActive) {
      throw new DomainValidationError(
        "isActive",
        this.props.isActive,
        "Cannot update thresholds for inactive risk profile"
      );
    }

    const updatedProfile = this.updateProps({
      thresholds: newThresholds,
      updatedAt: new Date(),
      version: this.props.version + 1,
    });

    // Emit domain event
    updatedProfile.addDomainEvent(
      SafetyEventFactory.createRiskProfileUpdated(this.props.id, this.props.userId, {
        riskProfileId: this.props.id,
        userId: this.props.userId,
        portfolioId: this.props.portfolioId,
        changeType: "thresholds",
        previousValues: this.props.thresholds,
        newValues: newThresholds,
        updatedBy: "USER",
        reason: "Manual threshold update",
      })
    );

    return updatedProfile;
  }

  updateExposures(newExposures: RiskExposures): RiskProfile {
    const updatedProfile = this.updateProps({
      exposures: newExposures,
      updatedAt: new Date(),
      version: this.props.version + 1,
    });

    // Emit domain event
    updatedProfile.addDomainEvent(
      SafetyEventFactory.createRiskProfileUpdated(this.props.id, this.props.userId, {
        riskProfileId: this.props.id,
        userId: this.props.userId,
        portfolioId: this.props.portfolioId,
        changeType: "exposures",
        previousValues: this.props.exposures,
        newValues: newExposures,
        updatedBy: "SYSTEM",
        reason: "Exposure update from market data",
      })
    );

    return updatedProfile;
  }

  changeRiskTolerance(newTolerance: RiskToleranceLevel): RiskProfile {
    const updatedProfile = this.updateProps({
      riskToleranceLevel: newTolerance,
      updatedAt: new Date(),
      version: this.props.version + 1,
    });

    // Emit domain event
    updatedProfile.addDomainEvent(
      SafetyEventFactory.createRiskProfileUpdated(this.props.id, this.props.userId, {
        riskProfileId: this.props.id,
        userId: this.props.userId,
        portfolioId: this.props.portfolioId,
        changeType: "tolerance",
        previousValues: { riskToleranceLevel: this.props.riskToleranceLevel },
        newValues: { riskToleranceLevel: newTolerance },
        updatedBy: "USER",
        reason: "Risk tolerance level change",
      })
    );

    return updatedProfile;
  }

  activate(): RiskProfile {
    if (this.props.isActive) {
      return this;
    }

    const updatedProfile = this.updateProps({
      isActive: true,
      updatedAt: new Date(),
      version: this.props.version + 1,
    });

    // Emit domain event
    updatedProfile.addDomainEvent(
      SafetyEventFactory.createRiskProfileUpdated(this.props.id, this.props.userId, {
        riskProfileId: this.props.id,
        userId: this.props.userId,
        portfolioId: this.props.portfolioId,
        changeType: "status",
        previousValues: { isActive: false },
        newValues: { isActive: true },
        updatedBy: "USER",
        reason: "Risk profile activation",
      })
    );

    return updatedProfile;
  }

  deactivate(): RiskProfile {
    if (!this.props.isActive) {
      return this;
    }

    const updatedProfile = this.updateProps({
      isActive: false,
      updatedAt: new Date(),
      version: this.props.version + 1,
    });

    // Emit domain event
    updatedProfile.addDomainEvent(
      SafetyEventFactory.createRiskProfileUpdated(this.props.id, this.props.userId, {
        riskProfileId: this.props.id,
        userId: this.props.userId,
        portfolioId: this.props.portfolioId,
        changeType: "status",
        previousValues: { isActive: true },
        newValues: { isActive: false },
        updatedBy: "USER",
        reason: "Risk profile deactivation",
      })
    );

    return updatedProfile;
  }

  triggerThresholdViolation(violationData: ThresholdViolationData): RiskProfile {
    const updatedProfile = this.updateProps({
      updatedAt: new Date(),
      version: this.props.version + 1,
    });

    // Emit domain event
    updatedProfile.addDomainEvent(
      SafetyEventFactory.createRiskThresholdViolated(this.props.id, this.props.userId, {
        riskProfileId: this.props.id,
        userId: this.props.userId,
        portfolioId: this.props.portfolioId,
        violationType: violationData.violationType,
        threshold: violationData.threshold,
        currentValue: violationData.currentValue,
        severity: violationData.severity,
        recommendedActions: violationData.recommendedActions,
        violationContext: violationData.violationContext || {},
        detectedAt: new Date(),
      })
    );

    return updatedProfile;
  }

  // Recommendation methods
  generateRecommendations(): string[] {
    const recommendations: string[] = [];

    switch (this.props.riskToleranceLevel) {
      case "conservative":
        recommendations.push("Maintain lower position sizes");
        recommendations.push("Consider more conservative thresholds");
        recommendations.push("Implement strict stop-loss mechanisms");
        break;
      case "medium":
        recommendations.push("Balance risk and reward opportunities");
        recommendations.push("Monitor exposure levels regularly");
        recommendations.push("Diversify across different assets");
        break;
      case "aggressive":
        recommendations.push("Monitor leverage usage carefully");
        recommendations.push("Consider higher risk thresholds");
        recommendations.push("Implement dynamic risk management");
        break;
    }

    return recommendations;
  }

  generateRecommendationsForViolations(violations: RiskViolationType[]): string[] {
    const recommendations: string[] = [];

    for (const violation of violations) {
      switch (violation) {
        case "drawdown_threshold":
          recommendations.push("Reduce overall portfolio exposure");
          recommendations.push("Review position sizing strategy");
          break;
        case "position_risk":
          recommendations.push("Reduce individual position sizes");
          recommendations.push("Implement tighter stop-losses");
          break;
        case "portfolio_risk":
          recommendations.push("Decrease total risk exposure");
          recommendations.push("Consider hedging strategies");
          break;
        case "concentration_risk":
          recommendations.push("Diversify holdings across more assets");
          recommendations.push("Reduce concentration in single positions");
          break;
        case "consecutive_losses":
          recommendations.push("Pause trading temporarily");
          recommendations.push("Review trading strategy");
          break;
        case "daily_loss_threshold":
          recommendations.push("Stop trading for the day");
          recommendations.push("Analyze recent trades");
          break;
        case "monthly_loss_threshold":
          recommendations.push("Review monthly trading performance");
          recommendations.push("Consider strategy adjustments");
          break;
      }
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  // Helper method to create updated instance
  private updateProps(updates: Partial<RiskProfileProps>): RiskProfile {
    const updatedProps = { ...this.props, ...updates };
    const updatedRiskProfile = RiskProfile.fromExisting(updatedProps);
    updatedRiskProfile.markAsModified();
    return updatedRiskProfile;
  }

  // Method to mark events as committed (for testing)
  markEventsAsCommitted(): void {
    this.clearDomainEvents();
  }

  // Get uncommitted events (overridden for type safety)
  getUncommittedEvents(): readonly (RiskProfileCreated | RiskProfileUpdated | RiskThresholdViolated)[] {
    return this.getDomainEvents() as readonly (RiskProfileCreated | RiskProfileUpdated | RiskThresholdViolated)[];
  }

  // Convert to plain object for persistence
  toPlainObject(): RiskProfileProps {
    return { ...this.props };
  }
}