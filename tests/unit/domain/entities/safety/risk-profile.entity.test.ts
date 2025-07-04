/**
 * Unit tests for RiskProfile Domain Entity
 * Tests risk profile creation, validation, calculations, and business logic
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  RiskProfile,
  RiskToleranceLevel,
  RiskViolationType,
  RiskLevel,
  RiskThresholds,
  RiskExposures,
  MarketDataForRisk,
  ThresholdViolationData,
} from '../../../../../src/domain/entities/safety/risk-profile.entity';
import { DomainValidationError } from '../../../../../src/domain/errors/trading-errors';

describe('RiskProfile Domain Entity', () => {
  let validThresholds: RiskThresholds;
  let validExposures: RiskExposures;
  let validRiskProfileProps: any;
  let marketDataForRisk: MarketDataForRisk;

  beforeEach(() => {
    validThresholds = {
      maxDrawdownPercent: 20,
      maxPositionRiskPercent: 10,
      maxPortfolioRiskPercent: 25,
      maxConcentrationPercent: 15,
      consecutiveLossThreshold: 5,
      dailyLossThreshold: 1000,
      monthlyLossThreshold: 5000,
    };

    validExposures = {
      totalExposure: 100000,
      longExposure: 60000,
      shortExposure: 30000,
      leveragedExposure: 10000,
      unrealizedPnL: 5000,
      realizedPnL: 2000,
    };

    validRiskProfileProps = {
      portfolioId: 'portfolio-123',
      userId: 'user-456',
      thresholds: validThresholds,
      exposures: validExposures,
      riskToleranceLevel: 'medium' as RiskToleranceLevel,
      isActive: true,
    };

    marketDataForRisk = {
      portfolioValue: 100000,
      initialValue: 120000,
      positions: [
        { value: 15000, riskExposure: 5000 },
        { value: 25000, riskExposure: 8000 },
        { value: 10000, riskExposure: 3000 },
      ],
      consecutiveLosses: 3,
      dailyLoss: 500,
      monthlyLoss: 2000,
    };
  });

  describe('RiskProfile Creation', () => {
    it('should create risk profile with valid props', () => {
      const riskProfile = RiskProfile.create(validRiskProfileProps);

      expect(riskProfile.portfolioId).toBe('portfolio-123');
      expect(riskProfile.userId).toBe('user-456');
      expect(riskProfile.thresholds).toEqual(validThresholds);
      expect(riskProfile.exposures).toEqual(validExposures);
      expect(riskProfile.riskToleranceLevel).toBe('medium');
      expect(riskProfile.isActive).toBe(true);
      expect(riskProfile.id).toBeDefined();
      expect(riskProfile.createdAt).toBeInstanceOf(Date);
      expect(riskProfile.updatedAt).toBeInstanceOf(Date);
      expect(riskProfile.version).toBe(1);
    });

    it('should create risk profile with default active status', () => {
      const propsWithoutActive = {
        ...validRiskProfileProps,
        isActive: undefined,
      };

      const riskProfile = RiskProfile.create(propsWithoutActive);

      expect(riskProfile.isActive).toBe(true);
    });

    it('should create risk profile with different tolerance levels', () => {
      const conservativeProfile = RiskProfile.create({
        ...validRiskProfileProps,
        riskToleranceLevel: 'conservative' as RiskToleranceLevel,
      });

      const aggressiveProfile = RiskProfile.create({
        ...validRiskProfileProps,
        riskToleranceLevel: 'aggressive' as RiskToleranceLevel,
      });

      expect(conservativeProfile.riskToleranceLevel).toBe('conservative');
      expect(aggressiveProfile.riskToleranceLevel).toBe('aggressive');
    });

    it('should emit domain event on creation', () => {
      const riskProfile = RiskProfile.create(validRiskProfileProps);
      const events = riskProfile.getUncommittedEvents();

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('RiskProfileCreated');
      expect(events[0].aggregateId).toBe(riskProfile.id);
    });
  });

  describe('RiskProfile Validation', () => {
    it('should reject profile with position risk exceeding portfolio risk', () => {
      const invalidProps = {
        ...validRiskProfileProps,
        thresholds: {
          ...validThresholds,
          maxPositionRiskPercent: 30, // > portfolio risk (25%)
          maxPortfolioRiskPercent: 25,
        },
      };

      expect(() => RiskProfile.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject profile with exposures exceeding total', () => {
      const invalidProps = {
        ...validRiskProfileProps,
        exposures: {
          ...validExposures,
          totalExposure: 100000,
          longExposure: 70000,
          shortExposure: 40000, // Combined > total
        },
      };

      expect(() => RiskProfile.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject profile with zero drawdown threshold', () => {
      const invalidProps = {
        ...validRiskProfileProps,
        thresholds: {
          ...validThresholds,
          maxDrawdownPercent: 0,
        },
      };

      expect(() => RiskProfile.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject profile with negative drawdown threshold', () => {
      const invalidProps = {
        ...validRiskProfileProps,
        thresholds: {
          ...validThresholds,
          maxDrawdownPercent: -5,
        },
      };

      expect(() => RiskProfile.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject profile with zero consecutive loss threshold', () => {
      const invalidProps = {
        ...validRiskProfileProps,
        thresholds: {
          ...validThresholds,
          consecutiveLossThreshold: 0,
        },
      };

      expect(() => RiskProfile.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject profile with invalid threshold percentages', () => {
      const invalidProps = {
        ...validRiskProfileProps,
        thresholds: {
          ...validThresholds,
          maxDrawdownPercent: 150, // > 100%
        },
      };

      expect(() => RiskProfile.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject profile with negative exposures', () => {
      const invalidProps = {
        ...validRiskProfileProps,
        exposures: {
          ...validExposures,
          totalExposure: -100000, // Negative
        },
      };

      expect(() => RiskProfile.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject profile with empty IDs', () => {
      const invalidProps = {
        ...validRiskProfileProps,
        portfolioId: '',
      };

      expect(() => RiskProfile.create(invalidProps)).toThrow(DomainValidationError);
    });
  });

  describe('Risk Calculations', () => {
    let riskProfile: RiskProfile;

    beforeEach(() => {
      riskProfile = RiskProfile.create(validRiskProfileProps);
    });

    it('should calculate drawdown percentage correctly', () => {
      const drawdown = riskProfile.calculateDrawdownPercent(100000, 120000);
      expect(drawdown).toBe((20000 / 120000) * 100); // ~16.67%
    });

    it('should handle zero initial value in drawdown calculation', () => {
      const drawdown = riskProfile.calculateDrawdownPercent(100000, 0);
      expect(drawdown).toBe(0);
    });

    it('should handle negative drawdown (gains)', () => {
      const drawdown = riskProfile.calculateDrawdownPercent(130000, 120000);
      expect(drawdown).toBe(0); // No drawdown when current > initial
    });

    it('should calculate concentration percentage correctly', () => {
      const concentration = riskProfile.calculateConcentrationPercent(15000, 100000);
      expect(concentration).toBe(15); // 15%
    });

    it('should handle zero portfolio value in concentration calculation', () => {
      const concentration = riskProfile.calculateConcentrationPercent(15000, 0);
      expect(concentration).toBe(0);
    });

    it('should calculate total exposure ratio correctly', () => {
      const ratio = riskProfile.calculateTotalExposureRatio();
      const expected = (60000 + 30000) / 100000; // 0.9
      expect(ratio).toBe(expected);
    });

    it('should handle zero total exposure in ratio calculation', () => {
      const profileWithZeroExposure = RiskProfile.create({
        ...validRiskProfileProps,
        exposures: {
          ...validExposures,
          totalExposure: 0,
        },
      });

      const ratio = profileWithZeroExposure.calculateTotalExposureRatio();
      expect(ratio).toBe(0);
    });

    it('should calculate leverage ratio correctly', () => {
      const leverage = riskProfile.calculateLeverageRatio();
      const expected = 1.0 + (10000 / 100000); // 1.1
      expect(leverage).toBe(expected);
    });

    it('should calculate net PnL correctly', () => {
      const netPnL = riskProfile.calculateNetPnL();
      expect(netPnL).toBe(7000); // 5000 + 2000
    });

    it('should calculate PnL percentage correctly', () => {
      const pnlPercent = riskProfile.calculatePnLPercent(100000);
      expect(pnlPercent).toBe(7); // 7000 / 100000 * 100
    });

    it('should handle zero base value in PnL percentage calculation', () => {
      const pnlPercent = riskProfile.calculatePnLPercent(0);
      expect(pnlPercent).toBe(0);
    });
  });

  describe('Threshold Evaluations', () => {
    let riskProfile: RiskProfile;

    beforeEach(() => {
      riskProfile = RiskProfile.create(validRiskProfileProps);
    });

    it('should detect drawdown threshold violation', () => {
      const isViolated = riskProfile.isDrawdownThresholdViolated(25); // > 20%
      expect(isViolated).toBe(true);
    });

    it('should not detect drawdown threshold violation within limits', () => {
      const isViolated = riskProfile.isDrawdownThresholdViolated(15); // < 20%
      expect(isViolated).toBe(false);
    });

    it('should detect position risk threshold violation', () => {
      const isViolated = riskProfile.isPositionRiskThresholdViolated(15000, 100000); // 15% > 10%
      expect(isViolated).toBe(true);
    });

    it('should not detect position risk threshold violation within limits', () => {
      const isViolated = riskProfile.isPositionRiskThresholdViolated(8000, 100000); // 8% < 10%
      expect(isViolated).toBe(false);
    });

    it('should detect concentration threshold violation', () => {
      const isViolated = riskProfile.isConcentrationThresholdViolated(20000, 100000); // 20% > 15%
      expect(isViolated).toBe(true);
    });

    it('should detect portfolio risk threshold violation', () => {
      const isViolated = riskProfile.isPortfolioRiskThresholdViolated(30000, 100000); // 30% > 25%
      expect(isViolated).toBe(true);
    });
  });

  describe('Risk Assessment', () => {
    let riskProfile: RiskProfile;

    beforeEach(() => {
      riskProfile = RiskProfile.create(validRiskProfileProps);
    });

    it('should evaluate thresholds and identify no violations', () => {
      const safeMarketData: MarketDataForRisk = {
        portfolioValue: 110000, // Small drawdown (8.3%)
        initialValue: 120000,
        positions: [
          { value: 8000, riskExposure: 2000 }, // 8% concentration, 2% risk
          { value: 5000, riskExposure: 1500 }, // 5% concentration, 1.5% risk
        ],
        consecutiveLosses: 2, // < 5
        dailyLoss: 200, // < 1000
        monthlyLoss: 800, // < 5000
      };

      const assessment = riskProfile.evaluateThresholds(safeMarketData);

      expect(assessment.violations).toHaveLength(0);
      expect(assessment.riskLevel).toBe('low');
      expect(assessment.overallRisk).toBe(0);
      expect(assessment.recommendedActions).toHaveLength(0);
      expect(assessment.assessmentTimestamp).toBeInstanceOf(Date);
    });

    it('should evaluate thresholds and identify drawdown violation', () => {
      const riskProfileWithLowThreshold = RiskProfile.create({
        ...validRiskProfileProps,
        thresholds: {
          ...validThresholds,
          maxDrawdownPercent: 10, // Lower threshold
        },
      });

      const assessment = riskProfileWithLowThreshold.evaluateThresholds(marketDataForRisk);

      expect(assessment.violations).toContain('drawdown_threshold');
      expect(assessment.riskLevel).toBe('medium');
      expect(assessment.overallRisk).toBeGreaterThan(0);
    });

    it('should evaluate thresholds and identify position risk violation', () => {
      const highPositionRiskData: MarketDataForRisk = {
        ...marketDataForRisk,
        positions: [
          { value: 15000, riskExposure: 5000 }, // 15% > 10% position risk
        ],
      };

      const assessment = riskProfile.evaluateThresholds(highPositionRiskData);

      expect(assessment.violations).toContain('position_risk');
    });

    it('should evaluate thresholds and identify concentration violation', () => {
      const highConcentrationData: MarketDataForRisk = {
        ...marketDataForRisk,
        positions: [
          { value: 20000, riskExposure: 5000 }, // 20% > 15% concentration
        ],
      };

      const assessment = riskProfile.evaluateThresholds(highConcentrationData);

      expect(assessment.violations).toContain('concentration_risk');
    });

    it('should evaluate thresholds and identify consecutive losses violation', () => {
      const highLossData: MarketDataForRisk = {
        ...marketDataForRisk,
        consecutiveLosses: 6, // > 5
      };

      const assessment = riskProfile.evaluateThresholds(highLossData);

      expect(assessment.violations).toContain('consecutive_losses');
    });

    it('should evaluate thresholds and identify daily loss violation', () => {
      const highDailyLossData: MarketDataForRisk = {
        ...marketDataForRisk,
        dailyLoss: 1500, // > 1000
      };

      const assessment = riskProfile.evaluateThresholds(highDailyLossData);

      expect(assessment.violations).toContain('daily_loss_threshold');
    });

    it('should evaluate thresholds and identify monthly loss violation', () => {
      const highMonthlyLossData: MarketDataForRisk = {
        ...marketDataForRisk,
        monthlyLoss: 6000, // > 5000
      };

      const assessment = riskProfile.evaluateThresholds(highMonthlyLossData);

      expect(assessment.violations).toContain('monthly_loss_threshold');
    });

    it('should calculate correct risk levels based on violation count', () => {
      expect(riskProfile.calculateRiskLevel([])).toBe('low');
      expect(riskProfile.calculateRiskLevel(['drawdown_threshold'])).toBe('medium');
      expect(riskProfile.calculateRiskLevel(['drawdown_threshold', 'position_risk'])).toBe('medium');
      expect(riskProfile.calculateRiskLevel(['drawdown_threshold', 'position_risk', 'concentration_risk'])).toBe('high');
      expect(riskProfile.calculateRiskLevel(['drawdown_threshold', 'position_risk', 'concentration_risk', 'consecutive_losses', 'daily_loss_threshold'])).toBe('critical');
    });
  });

  describe('Risk Profile Updates', () => {
    let riskProfile: RiskProfile;

    beforeEach(() => {
      riskProfile = RiskProfile.create(validRiskProfileProps);
      riskProfile.markEventsAsCommitted(); // Clear creation event
    });

    it('should update thresholds successfully', () => {
      const newThresholds: RiskThresholds = {
        ...validThresholds,
        maxDrawdownPercent: 15,
      };

      const updatedProfile = riskProfile.updateThresholds(newThresholds);

      expect(updatedProfile.thresholds.maxDrawdownPercent).toBe(15);
      expect(updatedProfile.version).toBe(2);
      expect(updatedProfile.updatedAt).not.toEqual(riskProfile.updatedAt);

      const events = updatedProfile.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('RiskProfileUpdated');
    });

    it('should reject threshold update for inactive profile', () => {
      const inactiveProfile = riskProfile.deactivate();
      inactiveProfile.markEventsAsCommitted();

      const newThresholds: RiskThresholds = {
        ...validThresholds,
        maxDrawdownPercent: 15,
      };

      expect(() => inactiveProfile.updateThresholds(newThresholds)).toThrow(DomainValidationError);
    });

    it('should update exposures successfully', () => {
      const newExposures: RiskExposures = {
        ...validExposures,
        totalExposure: 120000,
      };

      const updatedProfile = riskProfile.updateExposures(newExposures);

      expect(updatedProfile.exposures.totalExposure).toBe(120000);
      expect(updatedProfile.version).toBe(2);

      const events = updatedProfile.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('RiskProfileUpdated');
    });

    it('should change risk tolerance successfully', () => {
      const updatedProfile = riskProfile.changeRiskTolerance('aggressive');

      expect(updatedProfile.riskToleranceLevel).toBe('aggressive');
      expect(updatedProfile.version).toBe(2);

      const events = updatedProfile.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('RiskProfileUpdated');
    });

    it('should activate inactive profile', () => {
      const inactiveProfile = riskProfile.deactivate();
      inactiveProfile.markEventsAsCommitted();

      const activatedProfile = inactiveProfile.activate();

      expect(activatedProfile.isActive).toBe(true);
      expect(activatedProfile.version).toBe(3);

      const events = activatedProfile.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('RiskProfileUpdated');
    });

    it('should not change state when already active', () => {
      const stillActive = riskProfile.activate();

      expect(stillActive).toBe(riskProfile); // Same instance
      expect(stillActive.getUncommittedEvents()).toHaveLength(0);
    });

    it('should deactivate active profile', () => {
      const deactivatedProfile = riskProfile.deactivate();

      expect(deactivatedProfile.isActive).toBe(false);
      expect(deactivatedProfile.version).toBe(2);

      const events = deactivatedProfile.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('RiskProfileUpdated');
    });

    it('should not change state when already inactive', () => {
      const inactiveProfile = riskProfile.deactivate();
      inactiveProfile.markEventsAsCommitted();

      const stillInactive = inactiveProfile.deactivate();

      expect(stillInactive).toBe(inactiveProfile); // Same instance
      expect(stillInactive.getUncommittedEvents()).toHaveLength(0);
    });

    it('should trigger threshold violation event', () => {
      const violationData: ThresholdViolationData = {
        violationType: 'drawdown_threshold' as RiskViolationType,
        threshold: 20,
        currentValue: 25,
        severity: 'high',
        recommendedActions: ['Reduce positions', 'Review strategy'],
        violationContext: {
          symbol: 'BTCUSDT',
          timeframe: 'daily',
        },
      };

      const updatedProfile = riskProfile.triggerThresholdViolation(violationData);

      expect(updatedProfile.version).toBe(2);

      const events = updatedProfile.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('RiskThresholdViolated');
    });
  });

  describe('Recommendation Generation', () => {
    let riskProfile: RiskProfile;

    beforeEach(() => {
      riskProfile = RiskProfile.create(validRiskProfileProps);
    });

    it('should generate conservative recommendations', () => {
      const conservativeProfile = RiskProfile.create({
        ...validRiskProfileProps,
        riskToleranceLevel: 'conservative',
      });

      const recommendations = conservativeProfile.generateRecommendations();

      expect(recommendations).toContain('Maintain lower position sizes');
      expect(recommendations).toContain('Consider more conservative thresholds');
      expect(recommendations).toContain('Implement strict stop-loss mechanisms');
    });

    it('should generate medium risk recommendations', () => {
      const recommendations = riskProfile.generateRecommendations();

      expect(recommendations).toContain('Balance risk and reward opportunities');
      expect(recommendations).toContain('Monitor exposure levels regularly');
      expect(recommendations).toContain('Diversify across different assets');
    });

    it('should generate aggressive recommendations', () => {
      const aggressiveProfile = RiskProfile.create({
        ...validRiskProfileProps,
        riskToleranceLevel: 'aggressive',
      });

      const recommendations = aggressiveProfile.generateRecommendations();

      expect(recommendations).toContain('Monitor leverage usage carefully');
      expect(recommendations).toContain('Consider higher risk thresholds');
      expect(recommendations).toContain('Implement dynamic risk management');
    });

    it('should generate specific recommendations for violations', () => {
      const violations: RiskViolationType[] = [
        'drawdown_threshold',
        'position_risk',
        'consecutive_losses',
      ];

      const recommendations = riskProfile.generateRecommendationsForViolations(violations);

      expect(recommendations).toContain('Reduce overall portfolio exposure');
      expect(recommendations).toContain('Reduce individual position sizes');
      expect(recommendations).toContain('Pause trading temporarily');
    });

    it('should remove duplicate recommendations', () => {
      const violations: RiskViolationType[] = [
        'position_risk',
        'concentration_risk', // Both may suggest similar actions
      ];

      const recommendations = riskProfile.generateRecommendationsForViolations(violations);

      // Check that recommendations array has no duplicates
      const uniqueRecommendations = [...new Set(recommendations)];
      expect(recommendations).toEqual(uniqueRecommendations);
    });

    it('should generate recommendations for all violation types', () => {
      const allViolations: RiskViolationType[] = [
        'drawdown_threshold',
        'position_risk',
        'portfolio_risk',
        'concentration_risk',
        'consecutive_losses',
        'daily_loss_threshold',
        'monthly_loss_threshold',
      ];

      const recommendations = riskProfile.generateRecommendationsForViolations(allViolations);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations).toContain('Reduce overall portfolio exposure');
      expect(recommendations).toContain('Stop trading for the day');
      expect(recommendations).toContain('Review monthly trading performance');
    });
  });

  describe('RiskProfile from Existing', () => {
    it('should create risk profile from existing props', () => {
      const existingProps = {
        id: 'existing-risk-profile-123',
        portfolioId: 'portfolio-789',
        userId: 'user-abc',
        thresholds: validThresholds,
        exposures: validExposures,
        riskToleranceLevel: 'aggressive' as RiskToleranceLevel,
        isActive: false,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-15'),
        version: 5,
      };

      const riskProfile = RiskProfile.fromExisting(existingProps);

      expect(riskProfile.id).toBe('existing-risk-profile-123');
      expect(riskProfile.portfolioId).toBe('portfolio-789');
      expect(riskProfile.userId).toBe('user-abc');
      expect(riskProfile.riskToleranceLevel).toBe('aggressive');
      expect(riskProfile.isActive).toBe(false);
      expect(riskProfile.version).toBe(5);
      expect(riskProfile.createdAt).toEqual(new Date('2024-01-01'));
      expect(riskProfile.updatedAt).toEqual(new Date('2024-01-15'));
    });

    it('should validate existing props', () => {
      const invalidExistingProps = {
        id: 'existing-risk-profile-123',
        portfolioId: '', // Invalid empty ID
        userId: 'user-abc',
        thresholds: validThresholds,
        exposures: validExposures,
        riskToleranceLevel: 'medium' as RiskToleranceLevel,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      };

      expect(() => RiskProfile.fromExisting(invalidExistingProps)).toThrow(DomainValidationError);
    });
  });

  describe('RiskProfile Serialization', () => {
    it('should convert to plain object', () => {
      const riskProfile = RiskProfile.create(validRiskProfileProps);
      const plainObject = riskProfile.toPlainObject();

      expect(plainObject.id).toBe(riskProfile.id);
      expect(plainObject.portfolioId).toBe(riskProfile.portfolioId);
      expect(plainObject.userId).toBe(riskProfile.userId);
      expect(plainObject.thresholds).toEqual(riskProfile.thresholds);
      expect(plainObject.exposures).toEqual(riskProfile.exposures);
      expect(plainObject.riskToleranceLevel).toBe(riskProfile.riskToleranceLevel);
      expect(plainObject.isActive).toBe(riskProfile.isActive);
      expect(plainObject.createdAt).toBe(riskProfile.createdAt);
      expect(plainObject.updatedAt).toBe(riskProfile.updatedAt);
      expect(plainObject.version).toBe(riskProfile.version);
    });
  });

  describe('Domain Events', () => {
    it('should emit creation event with correct data', () => {
      const riskProfile = RiskProfile.create(validRiskProfileProps);
      const events = riskProfile.getUncommittedEvents();

      expect(events).toHaveLength(1);
      
      const creationEvent = events[0];
      expect(creationEvent.type).toBe('RiskProfileCreated');
      expect(creationEvent.aggregateId).toBe(riskProfile.id);
      expect(creationEvent.userId).toBe('user-456');
      expect(creationEvent.data.riskProfileId).toBe(riskProfile.id);
      expect(creationEvent.data.portfolioId).toBe('portfolio-123');
      expect(creationEvent.data.thresholds).toEqual(validThresholds);
      expect(creationEvent.data.exposures).toEqual(validExposures);
    });

    it('should emit update event with correct data', () => {
      const riskProfile = RiskProfile.create(validRiskProfileProps);
      riskProfile.markEventsAsCommitted();

      const newThresholds: RiskThresholds = {
        ...validThresholds,
        maxDrawdownPercent: 15,
      };

      const updatedProfile = riskProfile.updateThresholds(newThresholds);
      const events = updatedProfile.getUncommittedEvents();

      expect(events).toHaveLength(1);
      
      const updateEvent = events[0];
      expect(updateEvent.type).toBe('RiskProfileUpdated');
      expect(updateEvent.data.changeType).toBe('thresholds');
      expect(updateEvent.data.previousValues).toEqual(validThresholds);
      expect(updateEvent.data.newValues).toEqual(newThresholds);
    });

    it('should emit threshold violation event with correct data', () => {
      const riskProfile = RiskProfile.create(validRiskProfileProps);
      riskProfile.markEventsAsCommitted();

      const violationData: ThresholdViolationData = {
        violationType: 'drawdown_threshold',
        threshold: 20,
        currentValue: 25,
        severity: 'high',
        recommendedActions: ['Reduce positions'],
        violationContext: { symbol: 'BTCUSDT' },
      };

      const updatedProfile = riskProfile.triggerThresholdViolation(violationData);
      const events = updatedProfile.getUncommittedEvents();

      expect(events).toHaveLength(1);
      
      const violationEvent = events[0];
      expect(violationEvent.type).toBe('RiskThresholdViolated');
      expect(violationEvent.data.violationType).toBe('drawdown_threshold');
      expect(violationEvent.data.threshold).toBe(20);
      expect(violationEvent.data.currentValue).toBe(25);
      expect(violationEvent.data.severity).toBe('high');
    });

    it('should clear events when marked as committed', () => {
      const riskProfile = RiskProfile.create(validRiskProfileProps);
      expect(riskProfile.getUncommittedEvents()).toHaveLength(1);

      riskProfile.markEventsAsCommitted();
      expect(riskProfile.getUncommittedEvents()).toHaveLength(0);
    });
  });

  describe('Performance Tests', () => {
    it('should create risk profiles efficiently', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        RiskProfile.create({
          ...validRiskProfileProps,
          portfolioId: `portfolio-${i}`,
        });
      }
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500); // Should create 100 profiles in under 500ms
    });

    it('should evaluate thresholds efficiently', () => {
      const riskProfile = RiskProfile.create(validRiskProfileProps);
      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        riskProfile.evaluateThresholds(marketDataForRisk);
      }
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should evaluate 100 times in under 100ms
    });

    it('should perform calculations efficiently', () => {
      const riskProfile = RiskProfile.create(validRiskProfileProps);
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        riskProfile.calculateDrawdownPercent(100000, 120000);
        riskProfile.calculateConcentrationPercent(15000, 100000);
        riskProfile.calculateTotalExposureRatio();
        riskProfile.calculateLeverageRatio();
        riskProfile.calculateNetPnL();
      }
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(50); // Should perform 5000 calculations in under 50ms
    });
  });
});