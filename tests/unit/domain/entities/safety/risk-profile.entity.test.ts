/**
 * RiskProfile Domain Entity Unit Tests
 *
 * Comprehensive test suite for the RiskProfile entity covering:
 * - Entity creation and validation
 * - Business logic methods
 * - Domain events generation
 * - Risk calculations and threshold evaluations
 * - State transitions and exposure management
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { RiskProfile } from "@/src/domain/entities/safety/risk-profile.entity";
import { DomainValidationError } from "@/src/domain/errors/trading-errors";
import {
  RiskProfileCreated,
  RiskThresholdViolated,
  RiskProfileUpdated,
} from "@/src/domain/events/safety-events";
import { CleanArchitectureAssertions } from "../../../../utils/clean-architecture-test-utilities";

describe("RiskProfile Entity", () => {
  let validRiskProfileProps: any;

  beforeEach(() => {
    validRiskProfileProps = {
      portfolioId: "portfolio_123",
      userId: "user_456",
      thresholds: {
        maxDrawdownPercent: 15.0,
        maxPositionRiskPercent: 5.0,
        maxPortfolioRiskPercent: 10.0,
        maxConcentrationPercent: 20.0,
        consecutiveLossThreshold: 5,
        dailyLossThreshold: 1000,
        monthlyLossThreshold: 5000,
      },
      exposures: {
        totalExposure: 50000,
        longExposure: 30000,
        shortExposure: 20000,
        leveragedExposure: 0,
        unrealizedPnL: 2500,
        realizedPnL: 1500,
      },
      riskToleranceLevel: "medium" as const,
      isActive: true,
    };
  });

  describe("Entity Creation", () => {
    it("should create a valid RiskProfile with proper validation", () => {
      const riskProfile = RiskProfile.create(validRiskProfileProps);

      CleanArchitectureAssertions.assertDomainEntity(riskProfile, "RiskProfile");
      expect(riskProfile.portfolioId).toBe(validRiskProfileProps.portfolioId);
      expect(riskProfile.userId).toBe(validRiskProfileProps.userId);
      expect(riskProfile.riskToleranceLevel).toBe(validRiskProfileProps.riskToleranceLevel);
      expect(riskProfile.isActive).toBe(true);
    });

    it("should generate RiskProfileCreated domain event on creation", () => {
      const riskProfile = RiskProfile.create(validRiskProfileProps);

      const events = riskProfile.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(RiskProfileCreated);
      expect(events[0].data.portfolioId).toBe(validRiskProfileProps.portfolioId);
    });

    it("should restore from existing data without generating events", () => {
      const existingData = {
        ...validRiskProfileProps,
        id: "risk_profile_existing",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-02"),
        version: 2,
      };

      const riskProfile = RiskProfile.fromExisting(existingData);

      expect(riskProfile.id).toBe("risk_profile_existing");
      expect(riskProfile.version).toBe(2);
      expect(riskProfile.getUncommittedEvents()).toHaveLength(0);
    });

    it("should throw validation error for invalid portfolio ID", () => {
      const invalidProps = { ...validRiskProfileProps, portfolioId: "" };

      expect(() => RiskProfile.create(invalidProps)).toThrow(DomainValidationError);
    });

    it("should throw validation error for invalid risk tolerance level", () => {
      const invalidProps = { ...validRiskProfileProps, riskToleranceLevel: "invalid" };

      expect(() => RiskProfile.create(invalidProps)).toThrow(DomainValidationError);
    });

    it("should throw validation error for negative threshold values", () => {
      const invalidProps = {
        ...validRiskProfileProps,
        thresholds: {
          ...validRiskProfileProps.thresholds,
          maxDrawdownPercent: -5.0,
        },
      };

      expect(() => RiskProfile.create(invalidProps)).toThrow(DomainValidationError);
    });

    it("should throw validation error for invalid threshold ranges", () => {
      const invalidProps = {
        ...validRiskProfileProps,
        thresholds: {
          ...validRiskProfileProps.thresholds,
          maxDrawdownPercent: 150.0, // > 100%
        },
      };

      expect(() => RiskProfile.create(invalidProps)).toThrow(DomainValidationError);
    });
  });

  describe("Risk Calculations", () => {
    let riskProfile: RiskProfile;

    beforeEach(() => {
      riskProfile = RiskProfile.create(validRiskProfileProps);
      riskProfile.markEventsAsCommitted();
    });

    it("should calculate drawdown percentage correctly", () => {
      const currentValue = 45000; // Down from initial 50000
      const initialValue = 50000;

      const drawdown = riskProfile.calculateDrawdownPercent(currentValue, initialValue);

      expect(drawdown).toBe(10.0); // (50000 - 45000) / 50000 * 100
    });

    it("should calculate portfolio concentration correctly", () => {
      const positionValue = 15000;
      const totalPortfolioValue = 50000;

      const concentration = riskProfile.calculateConcentrationPercent(positionValue, totalPortfolioValue);

      expect(concentration).toBe(30.0); // 15000 / 50000 * 100
    });

    it("should calculate total exposure ratio correctly", () => {
      const totalExposureRatio = riskProfile.calculateTotalExposureRatio();

      expect(totalExposureRatio).toBeCloseTo(1.0); // (30000 + 20000) / 50000
    });

    it("should calculate leverage ratio correctly", () => {
      const leverageRatio = riskProfile.calculateLeverageRatio();

      expect(leverageRatio).toBe(1.0); // No leveraged exposure in test data
    });

    it("should calculate net PnL correctly", () => {
      const netPnL = riskProfile.calculateNetPnL();

      expect(netPnL).toBe(4000); // 2500 + 1500
    });

    it("should calculate PnL percentage correctly", () => {
      const baseValue = 50000;
      const pnlPercent = riskProfile.calculatePnLPercent(baseValue);

      expect(pnlPercent).toBe(8.0); // 4000 / 50000 * 100
    });
  });

  describe("Threshold Evaluations", () => {
    let riskProfile: RiskProfile;

    beforeEach(() => {
      riskProfile = RiskProfile.create(validRiskProfileProps);
      riskProfile.markEventsAsCommitted();
    });

    it("should detect drawdown threshold violation", () => {
      const isViolated = riskProfile.isDrawdownThresholdViolated(20.0); // Above 15% threshold

      expect(isViolated).toBe(true);
    });

    it("should not detect drawdown violation within threshold", () => {
      const isViolated = riskProfile.isDrawdownThresholdViolated(10.0); // Below 15% threshold

      expect(isViolated).toBe(false);
    });

    it("should detect position risk threshold violation", () => {
      const positionValue = 3000;
      const portfolioValue = 50000;
      const isViolated = riskProfile.isPositionRiskThresholdViolated(positionValue, portfolioValue);

      expect(isViolated).toBe(true); // 6% > 5% threshold
    });

    it("should detect concentration threshold violation", () => {
      const positionValue = 12000; // 24% of portfolio
      const portfolioValue = 50000;
      const isViolated = riskProfile.isConcentrationThresholdViolated(positionValue, portfolioValue);

      expect(isViolated).toBe(true); // 24% > 20% threshold
    });

    it("should detect portfolio risk threshold violation", () => {
      const totalRiskExposure = 6000; // 12% of portfolio
      const portfolioValue = 50000;
      const isViolated = riskProfile.isPortfolioRiskThresholdViolated(totalRiskExposure, portfolioValue);

      expect(isViolated).toBe(true); // 12% > 10% threshold
    });

    it("should evaluate multiple thresholds and return comprehensive assessment", () => {
      const marketData = {
        portfolioValue: 45000,
        initialValue: 50000,
        positions: [
          { value: 15000, riskExposure: 2000 },
          { value: 10000, riskExposure: 1500 },
        ],
        consecutiveLosses: 6,
        dailyLoss: 1200,
        monthlyLoss: 4500,
      };

      const assessment = riskProfile.evaluateThresholds(marketData);

      expect(assessment.overallRisk).toBeGreaterThan(0);
      expect(assessment.violations).toContain("drawdown_threshold");
      expect(assessment.violations).toContain("consecutive_losses");
      expect(assessment.violations).toContain("daily_loss_threshold");
      expect(assessment.riskLevel).toBe("high");
    });
  });

  describe("Risk Level Assessment", () => {
    let riskProfile: RiskProfile;

    beforeEach(() => {
      riskProfile = RiskProfile.create(validRiskProfileProps);
      riskProfile.markEventsAsCommitted();
    });

    it("should return low risk for minimal violations", () => {
      const violations = ["minor_deviation"];
      const riskLevel = riskProfile.calculateRiskLevel(violations);

      expect(riskLevel).toBe("low");
    });

    it("should return medium risk for moderate violations", () => {
      const violations = ["position_risk", "concentration"];
      const riskLevel = riskProfile.calculateRiskLevel(violations);

      expect(riskLevel).toBe("medium");
    });

    it("should return high risk for significant violations", () => {
      const violations = ["drawdown_threshold", "portfolio_risk", "concentration"];
      const riskLevel = riskProfile.calculateRiskLevel(violations);

      expect(riskLevel).toBe("high");
    });

    it("should return critical risk for severe violations", () => {
      const violations = [
        "drawdown_threshold",
        "portfolio_risk",
        "concentration",
        "consecutive_losses",
        "daily_loss_threshold",
      ];
      const riskLevel = riskProfile.calculateRiskLevel(violations);

      expect(riskLevel).toBe("critical");
    });
  });

  describe("State Transitions", () => {
    let riskProfile: RiskProfile;

    beforeEach(() => {
      riskProfile = RiskProfile.create(validRiskProfileProps);
      riskProfile.markEventsAsCommitted();
    });

    it("should update thresholds and generate domain event", () => {
      const newThresholds = {
        ...validRiskProfileProps.thresholds,
        maxDrawdownPercent: 20.0,
        maxPositionRiskPercent: 7.0,
      };

      const updatedProfile = riskProfile.updateThresholds(newThresholds);

      expect(updatedProfile.thresholds.maxDrawdownPercent).toBe(20.0);
      expect(updatedProfile.thresholds.maxPositionRiskPercent).toBe(7.0);
      expect(updatedProfile.version).toBe(riskProfile.version + 1);

      const events = updatedProfile.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(RiskProfileUpdated);
    });

    it("should update exposures and generate domain event", () => {
      const newExposures = {
        ...validRiskProfileProps.exposures,
        totalExposure: 60000,
        unrealizedPnL: 3000,
      };

      const updatedProfile = riskProfile.updateExposures(newExposures);

      expect(updatedProfile.exposures.totalExposure).toBe(60000);
      expect(updatedProfile.exposures.unrealizedPnL).toBe(3000);
      expect(updatedProfile.version).toBe(riskProfile.version + 1);

      const events = updatedProfile.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(RiskProfileUpdated);
    });

    it("should activate profile and update status", () => {
      const inactiveProfile = RiskProfile.create({
        ...validRiskProfileProps,
        isActive: false,
      });
      inactiveProfile.markEventsAsCommitted();

      const activatedProfile = inactiveProfile.activate();

      expect(activatedProfile.isActive).toBe(true);
      expect(activatedProfile.version).toBe(inactiveProfile.version + 1);

      const events = activatedProfile.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(RiskProfileUpdated);
    });

    it("should deactivate profile and update status", () => {
      const deactivatedProfile = riskProfile.deactivate();

      expect(deactivatedProfile.isActive).toBe(false);
      expect(deactivatedProfile.version).toBe(riskProfile.version + 1);

      const events = deactivatedProfile.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(RiskProfileUpdated);
    });

    it("should change risk tolerance level", () => {
      const updatedProfile = riskProfile.changeRiskTolerance("aggressive");

      expect(updatedProfile.riskToleranceLevel).toBe("aggressive");
      expect(updatedProfile.version).toBe(riskProfile.version + 1);

      const events = updatedProfile.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(RiskProfileUpdated);
    });
  });

  describe("Threshold Violation Events", () => {
    let riskProfile: RiskProfile;

    beforeEach(() => {
      riskProfile = RiskProfile.create(validRiskProfileProps);
      riskProfile.markEventsAsCommitted();
    });

    it("should trigger threshold violation event for high-risk assessment", () => {
      const violationData = {
        violationType: "drawdown_threshold" as const,
        threshold: 15.0,
        currentValue: 20.0,
        severity: "high" as const,
        recommendedActions: ["Reduce position sizes", "Review risk parameters"],
      };

      const updatedProfile = riskProfile.triggerThresholdViolation(violationData);

      const events = updatedProfile.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(RiskThresholdViolated);

      const violationEvent = events[0] as RiskThresholdViolated;
      expect(violationEvent.data.violationType).toBe("drawdown_threshold");
      expect(violationEvent.data.severity).toBe("high");
      expect(violationEvent.data.recommendedActions).toHaveLength(2);
    });

    it("should trigger multiple violation events for comprehensive assessment", () => {
      const violationData1 = {
        violationType: "drawdown_threshold" as const,
        threshold: 15.0,
        currentValue: 20.0,
        severity: "high" as const,
        recommendedActions: ["Reduce exposure"],
      };

      const violationData2 = {
        violationType: "concentration_risk" as const,
        threshold: 20.0,
        currentValue: 25.0,
        severity: "medium" as const,
        recommendedActions: ["Diversify holdings"],
      };

      let updatedProfile = riskProfile.triggerThresholdViolation(violationData1);
      updatedProfile = updatedProfile.triggerThresholdViolation(violationData2);

      const events = updatedProfile.getUncommittedEvents();
      expect(events).toHaveLength(2);
      expect(events.every(e => e instanceof RiskThresholdViolated)).toBe(true);
    });
  });

  describe("Business Logic Validations", () => {
    it("should reject invalid threshold combinations", () => {
      const invalidProps = {
        ...validRiskProfileProps,
        thresholds: {
          ...validRiskProfileProps.thresholds,
          maxPositionRiskPercent: 15.0, // Greater than portfolio risk (10%)
        },
      };

      expect(() => RiskProfile.create(invalidProps)).toThrow(DomainValidationError);
    });

    it("should reject mismatched exposure values", () => {
      const invalidProps = {
        ...validRiskProfileProps,
        exposures: {
          totalExposure: 50000,
          longExposure: 30000,
          shortExposure: 30000, // Long + Short > Total
          leveragedExposure: 0,
          unrealizedPnL: 0,
          realizedPnL: 0,
        },
      };

      expect(() => RiskProfile.create(invalidProps)).toThrow(DomainValidationError);
    });

    it("should handle edge case calculations gracefully", () => {
      const edgeCaseProfile = RiskProfile.create({
        ...validRiskProfileProps,
        exposures: {
          totalExposure: 0,
          longExposure: 0,
          shortExposure: 0,
          leveragedExposure: 0,
          unrealizedPnL: 0,
          realizedPnL: 0,
        },
      });

      expect(edgeCaseProfile.calculateTotalExposureRatio()).toBe(0);
      expect(edgeCaseProfile.calculateLeverageRatio()).toBe(1.0);
      expect(edgeCaseProfile.calculateNetPnL()).toBe(0);
    });
  });

  describe("Risk Profile Recommendations", () => {
    let riskProfile: RiskProfile;

    beforeEach(() => {
      riskProfile = RiskProfile.create(validRiskProfileProps);
      riskProfile.markEventsAsCommitted();
    });

    it("should generate appropriate recommendations for risk tolerance level", () => {
      const conservativeProfile = RiskProfile.create({
        ...validRiskProfileProps,
        riskToleranceLevel: "conservative",
      });

      const recommendations = conservativeProfile.generateRecommendations();

      expect(recommendations).toContain("Maintain lower position sizes");
      expect(recommendations).toContain("Consider more conservative thresholds");
    });

    it("should generate different recommendations for aggressive tolerance", () => {
      const aggressiveProfile = RiskProfile.create({
        ...validRiskProfileProps,
        riskToleranceLevel: "aggressive",
      });

      const recommendations = aggressiveProfile.generateRecommendations();

      expect(recommendations).toContain("Monitor leverage usage carefully");
      expect(recommendations).toContain("Consider higher risk thresholds");
    });

    it("should include violation-specific recommendations", () => {
      const marketData = {
        portfolioValue: 40000, // High drawdown
        initialValue: 50000,
        positions: [{ value: 15000, riskExposure: 3000 }], // High concentration
        consecutiveLosses: 7, // Above threshold
        dailyLoss: 500,
        monthlyLoss: 2000,
      };

      const assessment = riskProfile.evaluateThresholds(marketData);
      const recommendations = riskProfile.generateRecommendationsForViolations(assessment.violations);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.includes("drawdown"))).toBe(true);
      expect(recommendations.some(r => r.includes("concentration"))).toBe(true);
    });
  });

  describe("Entity Invariants", () => {
    it("should maintain entity invariants after all operations", () => {
      let riskProfile = RiskProfile.create(validRiskProfileProps);
      
      // Perform multiple operations
      riskProfile = riskProfile.updateThresholds({
        ...riskProfile.thresholds,
        maxDrawdownPercent: 20.0,
      });
      
      riskProfile = riskProfile.updateExposures({
        ...riskProfile.exposures,
        totalExposure: 60000,
      });
      
      riskProfile = riskProfile.changeRiskTolerance("aggressive");
      
      // Verify entity integrity
      CleanArchitectureAssertions.assertDomainEntity(riskProfile, "RiskProfile");
      expect(riskProfile.portfolioId).toBe(validRiskProfileProps.portfolioId);
      expect(riskProfile.isActive).toBe(true);
      expect(riskProfile.version).toBeGreaterThan(1);
    });

    it("should prevent modification of entity after deactivation", () => {
      let riskProfile = RiskProfile.create(validRiskProfileProps);
      riskProfile = riskProfile.deactivate();

      expect(() => 
        riskProfile.updateThresholds({
          ...riskProfile.thresholds,
          maxDrawdownPercent: 25.0,
        })
      ).toThrow(DomainValidationError);
    });
  });
});