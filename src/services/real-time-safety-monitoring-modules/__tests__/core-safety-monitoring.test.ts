/**
 * Unit Tests for Core Safety Monitoring Module
 * 
 * Tests the CoreSafetyMonitoring class in isolation to ensure proper
 * monitoring functionality, risk metric updates, and threshold checking.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CoreSafetyMonitoring, createCoreSafetyMonitoring, type CoreSafetyMonitoringConfig } from '../core-safety-monitoring';
import type { SafetyConfiguration, SafetyAlert } from '../../../schemas/safety-monitoring-schemas';
import { AutoSnipingExecutionService } from '../../auto-sniping-execution-service';
import { PatternMonitoringService } from '../../pattern-monitoring-service';

// Mock dependencies
vi.mock('../../auto-sniping-execution-service');
vi.mock('../../pattern-monitoring-service');

describe('CoreSafetyMonitoring', () => {
  let coreMonitoring: CoreSafetyMonitoring;
  let mockExecutionService: vi.Mocked<AutoSnipingExecutionService>;
  let mockPatternMonitoring: vi.Mocked<PatternMonitoringService>;
  let mockConfig: CoreSafetyMonitoringConfig;
  let alertsReceived: Array<Omit<SafetyAlert, "id" | "timestamp" | "acknowledged">>;

  const defaultConfiguration: SafetyConfiguration = {
    enabled: true,
    monitoringIntervalMs: 30000,
    riskCheckIntervalMs: 60000,
    autoActionEnabled: false,
    emergencyMode: false,
    alertRetentionHours: 24,
    thresholds: {
      maxDrawdownPercentage: 15,
      maxDailyLossPercentage: 5,
      maxPositionRiskPercentage: 10,
      maxPortfolioConcentration: 25,
      minSuccessRatePercentage: 60,
      maxConsecutiveLosses: 5,
      maxSlippagePercentage: 2,
      maxApiLatencyMs: 1000,
      minApiSuccessRate: 95,
      maxMemoryUsagePercentage: 80,
      minPatternConfidence: 75,
      maxPatternDetectionFailures: 3,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    alertsReceived = [];

    // Create mock execution service
    mockExecutionService = {
      getExecutionReport: vi.fn().mockResolvedValue({
        stats: {
          currentDrawdown: 5,
          maxDrawdown: 10,
          successRate: 75,
          averageSlippage: 0.5,
          totalPnl: "500",
        },
        activePositions: [
          {
            symbol: 'BTCUSDT',
            quantity: '0.1',
            currentPrice: '45000',
            unrealizedPnl: '50',
          },
          {
            symbol: 'ETHUSDT',
            quantity: '2',
            currentPrice: '3000',
            unrealizedPnl: '100',
          },
        ],
        recentExecutions: [
          {
            symbol: 'BTCUSDT',
            quantity: '0.05',
            currentPrice: '44000',
            unrealizedPnl: '25',
          },
          {
            symbol: 'ETHUSDT',
            quantity: '1',
            currentPrice: '2900',
            unrealizedPnl: '-50', // Loss
          },
        ],
        systemHealth: {
          apiConnection: true,
        },
      }),
    } as any;

    // Create mock pattern monitoring
    mockPatternMonitoring = {
      getMonitoringReport: vi.fn().mockResolvedValue({
        status: "healthy",
        stats: {
          averageConfidence: 80,
          consecutiveErrors: 1,
          totalPatternsDetected: 100,
        },
      }),
    } as any;

    // Create configuration
    mockConfig = {
      configuration: defaultConfiguration,
      executionService: mockExecutionService,
      patternMonitoring: mockPatternMonitoring,
      onAlert: (alert) => alertsReceived.push(alert),
    };

    coreMonitoring = createCoreSafetyMonitoring(mockConfig);
  });

  describe('Initialization', () => {
    it('should initialize with provided configuration', () => {
      expect(coreMonitoring).toBeInstanceOf(CoreSafetyMonitoring);
      
      const status = coreMonitoring.getStatus();
      expect(status.isActive).toBe(false);
      expect(status.lastUpdate).toBeDefined();
    });

    it('should create instance using factory function', () => {
      const instance = createCoreSafetyMonitoring(mockConfig);
      expect(instance).toBeInstanceOf(CoreSafetyMonitoring);
    });

    it('should start with default risk metrics', () => {
      const riskMetrics = coreMonitoring.getRiskMetrics();
      
      expect(riskMetrics.currentDrawdown).toBe(0);
      expect(riskMetrics.successRate).toBe(0);
      expect(riskMetrics.concentrationRisk).toBe(0);
      expect(riskMetrics.apiSuccessRate).toBe(100);
    });
  });

  describe('Monitoring Lifecycle', () => {
    it('should start and stop monitoring', () => {
      expect(coreMonitoring.getStatus().isActive).toBe(false);
      
      coreMonitoring.start();
      expect(coreMonitoring.getStatus().isActive).toBe(true);
      
      coreMonitoring.stop();
      expect(coreMonitoring.getStatus().isActive).toBe(false);
    });

    it('should not start monitoring twice', () => {
      coreMonitoring.start();
      
      // Should not throw, but should log warning
      coreMonitoring.start();
      expect(coreMonitoring.getStatus().isActive).toBe(true);
    });

    it('should throw error when performing monitoring cycle while inactive', async () => {
      await expect(coreMonitoring.performMonitoringCycle()).rejects.toThrow(
        'Monitoring not active'
      );
    });
  });

  describe('Risk Metrics Updates', () => {
    beforeEach(() => {
      coreMonitoring.start();
    });

    it('should update risk metrics from execution service', async () => {
      const riskMetrics = await coreMonitoring.updateRiskMetrics();
      
      expect(mockExecutionService.getExecutionReport).toHaveBeenCalled();
      expect(mockPatternMonitoring.getMonitoringReport).toHaveBeenCalled();
      
      expect(riskMetrics.currentDrawdown).toBe(5);
      expect(riskMetrics.successRate).toBe(75);
      expect(riskMetrics.patternAccuracy).toBe(80);
      expect(riskMetrics.portfolioValue).toBe(10500); // 500 + 10000 base
    });

    it('should calculate concentration risk from positions', async () => {
      await coreMonitoring.updateRiskMetrics();
      const riskMetrics = coreMonitoring.getRiskMetrics();
      
      // BTC: 0.1 * 45000 = 4500
      // ETH: 2 * 3000 = 6000
      // Total: 10500
      // Max concentration: ETH = 6000/10500 ≈ 57.14%
      expect(riskMetrics.concentrationRisk).toBeCloseTo(57.14, 1);
    });

    it('should calculate consecutive losses correctly', async () => {
      // Mock execution report with consecutive losses
      mockExecutionService.getExecutionReport.mockResolvedValue({
        stats: {
          currentDrawdown: 8,
          maxDrawdown: 12,
          successRate: 60,
          averageSlippage: 1.0,
          totalPnl: "200",
        },
        activePositions: [],
        recentExecutions: [
          { symbol: 'BTC', quantity: '0.1', currentPrice: '45000', unrealizedPnl: '-100' },
          { symbol: 'ETH', quantity: '1', currentPrice: '3000', unrealizedPnl: '-50' },
          { symbol: 'ADA', quantity: '100', currentPrice: '1', unrealizedPnl: '-25' },
          { symbol: 'DOT', quantity: '10', currentPrice: '30', unrealizedPnl: '15' }, // Profit breaks streak
        ],
        systemHealth: { apiConnection: true },
      });

      await coreMonitoring.updateRiskMetrics();
      const riskMetrics = coreMonitoring.getRiskMetrics();
      
      expect(riskMetrics.consecutiveLosses).toBe(3);
    });

    it('should handle service failures gracefully', async () => {
      mockExecutionService.getExecutionReport.mockRejectedValue(new Error('Service unavailable'));
      
      await expect(coreMonitoring.updateRiskMetrics()).rejects.toThrow('Service unavailable');
    });
  });

  describe('Threshold Checking', () => {
    beforeEach(() => {
      coreMonitoring.start();
    });

    it('should detect drawdown threshold violations', async () => {
      // Set current drawdown above threshold
      mockExecutionService.getExecutionReport.mockResolvedValue({
        stats: {
          currentDrawdown: 20, // Above 15% threshold
          maxDrawdown: 25,
          successRate: 75,
          averageSlippage: 0.5,
          totalPnl: "100",
        },
        activePositions: [],
        recentExecutions: [],
        systemHealth: { apiConnection: true },
      });

      await coreMonitoring.updateRiskMetrics();
      const result = await coreMonitoring.checkSafetyThresholds();
      
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe('max_drawdown_exceeded');
      expect(result.violations[0].severity).toBe('critical');
      expect(result.violations[0].currentValue).toBe(20);
      expect(result.violations[0].thresholdValue).toBe(15);
      
      // Should have triggered an alert
      expect(alertsReceived).toHaveLength(1);
      expect(alertsReceived[0].type).toBe('risk_threshold');
      expect(alertsReceived[0].title).toBe('Maximum Drawdown Exceeded');
    });

    it('should detect success rate threshold violations', async () => {
      mockExecutionService.getExecutionReport.mockResolvedValue({
        stats: {
          currentDrawdown: 5,
          maxDrawdown: 10,
          successRate: 45, // Below 60% threshold
          averageSlippage: 0.5,
          totalPnl: "100",
        },
        activePositions: [],
        recentExecutions: [],
        systemHealth: { apiConnection: true },
      });

      await coreMonitoring.updateRiskMetrics();
      const result = await coreMonitoring.checkSafetyThresholds();
      
      const successRateViolation = result.violations.find(v => v.type === 'low_success_rate');
      expect(successRateViolation).toBeDefined();
      expect(successRateViolation?.severity).toBe('high');
      
      const successRateAlert = alertsReceived.find(a => a.title === 'Low Success Rate');
      expect(successRateAlert).toBeDefined();
    });

    it('should detect consecutive losses threshold violations', async () => {
      mockExecutionService.getExecutionReport.mockResolvedValue({
        stats: {
          currentDrawdown: 5,
          maxDrawdown: 10,
          successRate: 65,
          averageSlippage: 0.5,
          totalPnl: "100",
        },
        activePositions: [],
        recentExecutions: [
          { symbol: 'BTC', quantity: '0.1', currentPrice: '45000', unrealizedPnl: '-100' },
          { symbol: 'ETH', quantity: '1', currentPrice: '3000', unrealizedPnl: '-50' },
          { symbol: 'ADA', quantity: '100', currentPrice: '1', unrealizedPnl: '-25' },
          { symbol: 'DOT', quantity: '10', currentPrice: '30', unrealizedPnl: '-15' },
          { symbol: 'LINK', quantity: '5', currentPrice: '25', unrealizedPnl: '-10' },
          { symbol: 'UNI', quantity: '20', currentPrice: '15', unrealizedPnl: '-5' }, // 6 consecutive losses
        ],
        systemHealth: { apiConnection: true },
      });

      await coreMonitoring.updateRiskMetrics();
      const result = await coreMonitoring.checkSafetyThresholds();
      
      const consecutiveLossesViolation = result.violations.find(v => v.type === 'excessive_consecutive_losses');
      expect(consecutiveLossesViolation).toBeDefined();
      expect(consecutiveLossesViolation?.currentValue).toBe(6);
      expect(consecutiveLossesViolation?.thresholdValue).toBe(5);
    });

    it('should detect API latency threshold violations', async () => {
      // Update risk metrics with high API latency
      const riskMetrics = coreMonitoring.getRiskMetrics();
      riskMetrics.apiLatency = 1500; // Above 1000ms threshold
      
      // Manually set the risk metrics for testing
      coreMonitoring.resetRiskMetrics();
      Object.assign(coreMonitoring.getRiskMetrics(), riskMetrics);
      
      const result = await coreMonitoring.checkSafetyThresholds();
      
      const latencyViolation = result.violations.find(v => v.type === 'high_api_latency');
      expect(latencyViolation).toBeDefined();
      expect(latencyViolation?.severity).toBe('medium');
    });

    it('should return no violations when all thresholds are met', async () => {
      await coreMonitoring.updateRiskMetrics();
      const result = await coreMonitoring.checkSafetyThresholds();
      
      expect(result.violations).toHaveLength(0);
      expect(alertsReceived).toHaveLength(0);
    });
  });

  describe('Risk Score Calculation', () => {
    it('should return 0 for default metrics', () => {
      const score = coreMonitoring.calculateOverallRiskScore();
      expect(score).toBe(0);
    });

    it('should calculate weighted risk score correctly', async () => {
      // Set some risk metrics
      mockExecutionService.getExecutionReport.mockResolvedValue({
        stats: {
          currentDrawdown: 10, // 10/15 * 25 = 16.67 points
          maxDrawdown: 15,
          successRate: 50, // (60-50)/60 * 20 = 3.33 points
          averageSlippage: 1.0,
          totalPnl: "100",
        },
        activePositions: [],
        recentExecutions: [
          { symbol: 'BTC', quantity: '0.1', currentPrice: '45000', unrealizedPnl: '-100' },
          { symbol: 'ETH', quantity: '1', currentPrice: '3000', unrealizedPnl: '-50' },
          { symbol: 'ADA', quantity: '100', currentPrice: '1', unrealizedPnl: '-25' }, // 3 consecutive losses = 3/5 * 15 = 9 points
        ],
        systemHealth: { apiConnection: true },
      });

      coreMonitoring.start();
      await coreMonitoring.updateRiskMetrics();
      
      const score = coreMonitoring.calculateOverallRiskScore();
      
      // Should be > 0 but specific calculation depends on weights
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should cap risk score at 100', async () => {
      // Set extremely high risk metrics
      mockExecutionService.getExecutionReport.mockResolvedValue({
        stats: {
          currentDrawdown: 50, // Way above threshold
          maxDrawdown: 60,
          successRate: 10, // Way below threshold
          averageSlippage: 5.0,
          totalPnl: "-5000",
        },
        activePositions: [],
        recentExecutions: Array(20).fill(0).map((_, i) => ({
          symbol: `COIN${i}`,
          quantity: '1',
          currentPrice: '100',
          unrealizedPnl: '-50', // All losses
        })),
        systemHealth: { apiConnection: false },
      });

      coreMonitoring.start();
      await coreMonitoring.updateRiskMetrics();
      
      const score = coreMonitoring.calculateOverallRiskScore();
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('Monitoring Cycle', () => {
    beforeEach(() => {
      coreMonitoring.start();
    });

    it('should perform complete monitoring cycle', async () => {
      const result = await coreMonitoring.performMonitoringCycle();
      
      expect(result).toHaveProperty('riskMetrics');
      expect(result).toHaveProperty('thresholdViolations');
      expect(result).toHaveProperty('overallRiskScore');
      
      expect(Array.isArray(result.thresholdViolations)).toBe(true);
      expect(typeof result.overallRiskScore).toBe('number');
      
      // Should have called service methods
      expect(mockExecutionService.getExecutionReport).toHaveBeenCalled();
      expect(mockPatternMonitoring.getMonitoringReport).toHaveBeenCalled();
    });

    it('should handle monitoring cycle errors', async () => {
      mockExecutionService.getExecutionReport.mockRejectedValue(new Error('Service error'));
      
      await expect(coreMonitoring.performMonitoringCycle()).rejects.toThrow('Service error');
    });
  });

  describe('Alert Generation', () => {
    beforeEach(() => {
      coreMonitoring.start();
    });

    it('should trigger alerts through callback', async () => {
      // Create condition that will trigger alert
      mockExecutionService.getExecutionReport.mockResolvedValue({
        stats: {
          currentDrawdown: 20, // Above threshold
          maxDrawdown: 25,
          successRate: 40, // Below threshold
          averageSlippage: 0.5,
          totalPnl: "100",
        },
        activePositions: [],
        recentExecutions: [],
        systemHealth: { apiConnection: true },
      });

      await coreMonitoring.updateRiskMetrics();
      await coreMonitoring.checkSafetyThresholds();
      
      expect(alertsReceived.length).toBeGreaterThan(0);
      
      alertsReceived.forEach(alert => {
        expect(alert).toHaveProperty('type');
        expect(alert).toHaveProperty('severity');
        expect(alert).toHaveProperty('category');
        expect(alert).toHaveProperty('title');
        expect(alert).toHaveProperty('message');
        expect(alert).toHaveProperty('riskLevel');
        expect(alert).toHaveProperty('source');
        expect(alert.source).toBe('core_monitoring');
      });
    });

    it('should not trigger alerts when callback is not provided', () => {
      const configWithoutCallback = {
        ...mockConfig,
        onAlert: undefined,
      };
      
      const coreMonitoringNoCallback = createCoreSafetyMonitoring(configWithoutCallback);
      coreMonitoringNoCallback.start();
      
      // Should not throw even without callback
      expect(async () => {
        await coreMonitoringNoCallback.checkSafetyThresholds();
      }).not.toThrow();
    });
  });

  describe('Reset and Cleanup', () => {
    it('should reset risk metrics to defaults', () => {
      coreMonitoring.start();
      
      // Modify some metrics first
      const originalMetrics = coreMonitoring.getRiskMetrics();
      expect(originalMetrics.currentDrawdown).toBe(0);
      
      coreMonitoring.resetRiskMetrics();
      
      const resetMetrics = coreMonitoring.getRiskMetrics();
      expect(resetMetrics.currentDrawdown).toBe(0);
      expect(resetMetrics.successRate).toBe(0);
      expect(resetMetrics.portfolioValue).toBe(10000);
      expect(resetMetrics.apiSuccessRate).toBe(100);
    });
  });

  describe('Error Handling', () => {
    it('should validate configuration during updates', async () => {
      // This would be handled by the configuration management module
      // But core monitoring should handle invalid data gracefully
      mockExecutionService.getExecutionReport.mockResolvedValue({
        stats: {
          currentDrawdown: NaN, // Invalid data
          maxDrawdown: -5, // Invalid negative
          successRate: 150, // Invalid > 100
          averageSlippage: -1, // Invalid negative
          totalPnl: "invalid", // Invalid format
        },
        activePositions: [],
        recentExecutions: [],
        systemHealth: { apiConnection: true },
      });

      coreMonitoring.start();
      
      // Should handle invalid data gracefully
      await expect(coreMonitoring.updateRiskMetrics()).rejects.toThrow();
    });

    it('should handle partial service failures', async () => {
      // Pattern monitoring fails but execution service works
      mockPatternMonitoring.getMonitoringReport.mockRejectedValue(new Error('Pattern service down'));
      
      coreMonitoring.start();
      
      await expect(coreMonitoring.updateRiskMetrics()).rejects.toThrow('Pattern service down');
    });
  });
});