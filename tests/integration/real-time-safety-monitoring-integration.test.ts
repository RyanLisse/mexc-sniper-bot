/**
 * Real-time Safety Monitoring Integration Tests
 * 
 * Tests the complete vertical slice of real-time safety monitoring functionality:
 * - Backend safety monitoring service
 * - API endpoints
 * - Risk assessment and alert management
 * - Emergency response capabilities
 * 
 * This ensures the safety monitoring system works end-to-end.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setTestTimeout, withApiTimeout } from '../utils/timeout-utilities';
import { RealTimeSafetyMonitoringService } from '../../src/services/real-time-safety-monitoring-service';
import { AutoSnipingExecutionService } from '../../src/services/auto-sniping-execution-service';
import { PatternMonitoringService } from '../../src/services/pattern-monitoring-service';
import { UnifiedMexcService } from '../../src/services/unified-mexc-service';
import { EmergencySafetySystem } from '../../src/services/emergency-safety-system';

describe('Real-time Safety Monitoring Integration', () => {
  const TEST_TIMEOUT = setTestTimeout('integration');
  let safetyMonitoringService: RealTimeSafetyMonitoringService;
  let executionService: AutoSnipingExecutionService;
  let patternMonitoring: PatternMonitoringService;
  let mexcService: UnifiedMexcService;
  let emergencySystem: EmergencySafetySystem;

  beforeEach(async () => {
    // Initialize services
    safetyMonitoringService = RealTimeSafetyMonitoringService.getInstance();
    executionService = AutoSnipingExecutionService.getInstance();
    patternMonitoring = PatternMonitoringService.getInstance();
    mexcService = new UnifiedMexcService();
    emergencySystem = new EmergencySafetySystem();

    // Ensure monitoring is stopped before each test
    safetyMonitoringService.stopMonitoring();
    
    // Setup mocks for external dependencies
    vi.spyOn(mexcService, 'getAccountInfo').mockResolvedValue({
      success: true,
      data: { balance: '1000', available: '1000' },
      timestamp: new Date().toISOString()
    });

    vi.spyOn(emergencySystem, 'performSystemHealthCheck').mockResolvedValue({
      overall: 'healthy',
      components: {
        riskEngine: 'healthy',
        tradingEngine: 'healthy',
        dataFeed: 'healthy',
        agentSystem: 'healthy',
        database: 'healthy',
        connectivity: 'healthy'
      },
      emergencyConditions: [],
      lastHealthCheck: new Date().toISOString()
    });

    // Mock execution service methods
    vi.spyOn(executionService, 'getExecutionReport').mockResolvedValue({
      status: 'idle',
      config: {
        enabled: false,
        maxPositions: 5,
        maxDailyTrades: 10,
        positionSizeUSDT: 100,
        minConfidence: 80,
        allowedPatternTypes: ['ready_state'],
        requireCalendarConfirmation: true,
        stopLossPercentage: 5,
        takeProfitPercentage: 10,
        maxDrawdownPercentage: 20,
        enableAdvanceDetection: true,
        advanceHoursThreshold: 3.5,
        enableMultiPhaseStrategy: false,
        slippageTolerancePercentage: 1,
      },
      stats: {
        totalTrades: 0,
        successfulTrades: 0,
        failedTrades: 0,
        successRate: 0,
        totalPnl: '0',
        totalPnlPercentage: 0,
        averageTradeReturn: 0,
        maxDrawdown: 0,
        currentDrawdown: 0,
        averageExecutionTime: 0,
        averageSlippage: 0,
        activePositions: 0,
        dailyTradeCount: 0,
        patternSuccessRates: {
          ready_state: 0,
          pre_ready: 0,
          launch_sequence: 0,
          risk_warning: 0,
        },
        averagePatternConfidence: 0,
        mostSuccessfulPattern: null,
      },
      activePositions: [],
      recentExecutions: [],
      activeAlerts: [],
      systemHealth: {
        apiConnection: true,
        patternEngine: true,
        safetySystem: true,
        riskLimits: true,
      },
      recommendations: [],
      lastUpdated: new Date().toISOString(),
    });

    vi.spyOn(executionService, 'getActivePositions').mockReturnValue([]);
    vi.spyOn(executionService, 'stopExecution').mockImplementation(() => {});
    vi.spyOn(executionService, 'emergencyCloseAll').mockResolvedValue(0);

    // Mock pattern monitoring
    vi.spyOn(patternMonitoring, 'getMonitoringReport').mockResolvedValue({
      status: 'healthy',
      stats: {
        totalPatternsDetected: 10,
        averageConfidence: 85,
        readyStatePatterns: 5,
        preReadyPatterns: 3,
        launchSequencePatterns: 2,
        riskWarningPatterns: 0,
        engineStatus: 'active',
        lastHealthCheck: new Date().toISOString(),
        consecutiveErrors: 0,
        successRate: 95,
        lastPatternDetected: new Date().toISOString(),
      },
      activeAlerts: [],
      recentActivity: [],
      recommendations: [],
      lastUpdated: new Date().toISOString(),
    });
  });

  afterEach(() => {
    // Clean up after each test
    safetyMonitoringService.stopMonitoring();
    vi.restoreAllMocks();
  });

  describe('Real-time Safety Monitoring Service', () => {
    it('should initialize with correct default state', async () => {
      const report = await safetyMonitoringService.getSafetyReport();

      expect(report.status).toBe('safe');
      expect(report.overallRiskScore).toBe(0);
      expect(report.activeAlerts).toHaveLength(0);
      expect(report.systemHealth).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.monitoringStats).toBeDefined();
    }, TEST_TIMEOUT);

    it('should start monitoring successfully', async () => {
      await safetyMonitoringService.startMonitoring();
      
      const report = await safetyMonitoringService.getSafetyReport();
      expect(report.monitoringStats.systemUptime).toBeGreaterThan(0);

      // Verify mocks were called
      expect(emergencySystem.performSystemHealthCheck).toHaveBeenCalled();
    }, TEST_TIMEOUT);

    it('should stop monitoring successfully', async () => {
      // Start then stop monitoring
      await safetyMonitoringService.startMonitoring();
      safetyMonitoringService.stopMonitoring();
      
      // Give a moment for the stop to take effect
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const report = await safetyMonitoringService.getSafetyReport();
      // After stopping, the monitoring should not be active
      expect(report).toBeDefined();
    }, TEST_TIMEOUT);

    it('should handle configuration updates', () => {
      const newConfig = {
        enabled: true,
        monitoringIntervalMs: 15000,
        autoActionEnabled: true,
        thresholds: {
          maxDrawdownPercentage: 20,
          minSuccessRatePercentage: 70,
          maxConsecutiveLosses: 3,
          maxApiLatencyMs: 1500,
          minApiSuccessRate: 90,
          maxMemoryUsagePercentage: 75,
          minPatternConfidence: 80,
          maxPatternDetectionFailures: 2,
          maxDailyLossPercentage: 5,
          maxPositionRiskPercentage: 10,
          maxPortfolioConcentration: 25,
          maxSlippagePercentage: 2,
        },
      };

      expect(() => safetyMonitoringService.updateConfiguration(newConfig)).not.toThrow();
    }, TEST_TIMEOUT);

    it('should provide risk metrics', () => {
      const riskMetrics = safetyMonitoringService.getRiskMetrics();
      
      expect(riskMetrics).toBeDefined();
      expect(riskMetrics.currentDrawdown).toBeTypeOf('number');
      expect(riskMetrics.maxDrawdown).toBeTypeOf('number');
      expect(riskMetrics.portfolioValue).toBeTypeOf('number');
      expect(riskMetrics.successRate).toBeTypeOf('number');
      expect(riskMetrics.apiLatency).toBeTypeOf('number');
      expect(riskMetrics.patternAccuracy).toBeTypeOf('number');
    }, TEST_TIMEOUT);

    it('should handle emergency response', async () => {
      const reason = 'Test emergency response';
      const actions = await safetyMonitoringService.triggerEmergencyResponse(reason);
      
      expect(Array.isArray(actions)).toBe(true);
      expect(actions.length).toBeGreaterThan(0);
      
      // Verify emergency actions were attempted
      expect(executionService.stopExecution).toHaveBeenCalled();
      expect(executionService.emergencyCloseAll).toHaveBeenCalled();
      
      const report = await safetyMonitoringService.getSafetyReport();
      expect(report.recentActions.length).toBeGreaterThan(0);
    }, TEST_TIMEOUT);

    it('should manage alerts correctly', async () => {
      const initialReport = await safetyMonitoringService.getSafetyReport();
      const initialAlertCount = initialReport.activeAlerts.length;

      // Start monitoring (this should generate some alerts)
      await safetyMonitoringService.startMonitoring();

      const report = await safetyMonitoringService.getSafetyReport();
      expect(report.activeAlerts.length).toBeGreaterThanOrEqual(initialAlertCount);

      // Test alert acknowledgment if there are alerts
      if (report.activeAlerts.length > 0) {
        const alertId = report.activeAlerts[0].id;
        const acknowledged = safetyMonitoringService.acknowledgeAlert(alertId);
        expect(acknowledged).toBe(true);

        const updatedReport = await safetyMonitoringService.getSafetyReport();
        const acknowledgedAlert = [...updatedReport.activeAlerts, ...updatedReport.recentActions]
          .find((item: any) => item.id === alertId);
        if (acknowledgedAlert && 'acknowledged' in acknowledgedAlert) {
          expect(acknowledgedAlert.acknowledged).toBe(true);
        }
      }
    }, TEST_TIMEOUT);

    it('should clear acknowledged alerts', async () => {
      // Start monitoring to generate alerts
      await safetyMonitoringService.startMonitoring();
      
      const report = await safetyMonitoringService.getSafetyReport();
      
      // Acknowledge some alerts if they exist
      let acknowledgedCount = 0;
      for (const alert of report.activeAlerts.slice(0, 2)) {
        const acknowledged = safetyMonitoringService.acknowledgeAlert(alert.id);
        if (acknowledged) acknowledgedCount++;
      }

      // Clear acknowledged alerts
      const clearedCount = safetyMonitoringService.clearAcknowledgedAlerts();
      expect(clearedCount).toBe(acknowledgedCount);
    }, TEST_TIMEOUT);

    it('should check system safety status', async () => {
      const isSystemSafe = await safetyMonitoringService.isSystemSafe();
      expect(typeof isSystemSafe).toBe('boolean');
    }, TEST_TIMEOUT);

    it('should calculate overall risk score correctly', async () => {
      const report = await safetyMonitoringService.getSafetyReport();
      
      expect(report.overallRiskScore).toBeGreaterThanOrEqual(0);
      expect(report.overallRiskScore).toBeLessThanOrEqual(100);
      
      // Status should correspond to risk score
      if (report.overallRiskScore < 25) {
        expect(report.status).toBe('safe');
      } else if (report.overallRiskScore < 50) {
        expect(report.status).toBe('warning');
      } else if (report.overallRiskScore < 75) {
        expect(report.status).toBe('critical');
      } else {
        expect(report.status).toBe('emergency');
      }
    }, TEST_TIMEOUT);

    it('should provide system health assessment', async () => {
      const report = await safetyMonitoringService.getSafetyReport();
      
      expect(report.systemHealth).toBeDefined();
      expect(report.systemHealth.executionService).toBeTypeOf('boolean');
      expect(report.systemHealth.patternMonitoring).toBeTypeOf('boolean');
      expect(report.systemHealth.emergencySystem).toBeTypeOf('boolean');
      expect(report.systemHealth.mexcConnectivity).toBeTypeOf('boolean');
      expect(report.systemHealth.overallHealth).toBeTypeOf('number');
    }, TEST_TIMEOUT);

    it('should generate appropriate recommendations', async () => {
      const report = await safetyMonitoringService.getSafetyReport();
      
      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(report.recommendations.length).toBeGreaterThan(0);
    }, TEST_TIMEOUT);

    it('should track monitoring statistics', async () => {
      await safetyMonitoringService.startMonitoring();
      
      const report = await safetyMonitoringService.getSafetyReport();
      
      expect(report.monitoringStats).toBeDefined();
      expect(report.monitoringStats.alertsGenerated).toBeTypeOf('number');
      expect(report.monitoringStats.actionsExecuted).toBeTypeOf('number');
      expect(report.monitoringStats.riskEventsDetected).toBeTypeOf('number');
      expect(report.monitoringStats.systemUptime).toBeTypeOf('number');
      expect(report.monitoringStats.lastRiskCheck).toBeTypeOf('string');
      expect(report.monitoringStats.monitoringFrequency).toBeTypeOf('number');
    }, TEST_TIMEOUT);
  });

  describe('Safety Monitoring Error Handling', () => {
    it('should handle execution service failures gracefully', async () => {
      // Mock execution service failure
      vi.spyOn(executionService, 'getExecutionReport').mockRejectedValue(
        new Error('Execution service unavailable')
      );

      const report = await safetyMonitoringService.getSafetyReport();
      
      // Should still return a report even with execution service failure
      expect(report).toBeDefined();
      expect(report.systemHealth.executionService).toBe(false);
    }, TEST_TIMEOUT);

    it('should handle pattern monitoring failures', async () => {
      // Mock pattern monitoring failure
      vi.spyOn(patternMonitoring, 'getMonitoringReport').mockRejectedValue(
        new Error('Pattern monitoring unavailable')
      );

      const report = await safetyMonitoringService.getSafetyReport();
      
      // Should still return a report even with pattern monitoring failure
      expect(report).toBeDefined();
      expect(report.systemHealth.patternMonitoring).toBe(false);
    }, TEST_TIMEOUT);

    it('should handle emergency system failures', async () => {
      // Mock emergency system failure
      vi.spyOn(emergencySystem, 'performSystemHealthCheck').mockResolvedValue({
        overall: 'critical',
        components: {
          riskEngine: 'critical',
          tradingEngine: 'healthy',
          dataFeed: 'critical',
          agentSystem: 'healthy',
          database: 'healthy',
          connectivity: 'healthy'
        },
        emergencyConditions: ['System failure detected'],
        lastHealthCheck: new Date().toISOString()
      });

      const report = await safetyMonitoringService.getSafetyReport();
      
      expect(report.systemHealth.emergencySystem).toBe(false);
      expect(report.status).not.toBe('safe');
    }, TEST_TIMEOUT);

    it('should handle invalid alert acknowledgment', () => {
      const result = safetyMonitoringService.acknowledgeAlert('non_existent_alert');
      expect(result).toBe(false);
    }, TEST_TIMEOUT);

    it('should handle emergency response failures gracefully', async () => {
      // Mock emergency close failure
      vi.spyOn(executionService, 'emergencyCloseAll').mockRejectedValue(
        new Error('Emergency close failed')
      );

      const actions = await safetyMonitoringService.triggerEmergencyResponse('Test emergency');
      
      expect(Array.isArray(actions)).toBe(true);
      // Should still return actions even if some fail
      expect(actions.length).toBeGreaterThan(0);
      
      // Check that at least one action has a failed result
      const hasFailedAction = actions.some(action => action.result === 'failed');
      expect(hasFailedAction).toBe(true);
    }, TEST_TIMEOUT);
  });

  describe('Safety Monitoring Singleton', () => {
    it('should maintain singleton instance', () => {
      const instance1 = RealTimeSafetyMonitoringService.getInstance();
      const instance2 = RealTimeSafetyMonitoringService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Configuration Validation', () => {
    it('should handle various configuration scenarios', () => {
      // Test minimum configuration
      const minConfig = {
        enabled: true,
        monitoringIntervalMs: 5000,
        autoActionEnabled: false,
      };
      
      expect(() => safetyMonitoringService.updateConfiguration(minConfig)).not.toThrow();
      
      // Test comprehensive configuration
      const fullConfig = {
        enabled: true,
        monitoringIntervalMs: 30000,
        riskCheckIntervalMs: 60000,
        autoActionEnabled: true,
        emergencyMode: false,
        alertRetentionHours: 48,
        thresholds: {
          maxDrawdownPercentage: 25,
          maxDailyLossPercentage: 10,
          maxPositionRiskPercentage: 15,
          maxPortfolioConcentration: 30,
          minSuccessRatePercentage: 50,
          maxConsecutiveLosses: 8,
          maxSlippagePercentage: 3,
          maxApiLatencyMs: 2000,
          minApiSuccessRate: 90,
          maxMemoryUsagePercentage: 85,
          minPatternConfidence: 70,
          maxPatternDetectionFailures: 5,
        },
      };
      
      expect(() => safetyMonitoringService.updateConfiguration(fullConfig)).not.toThrow();
      
      // Test partial configuration update
      const partialConfig = {
        autoActionEnabled: true,
        thresholds: {
          maxDrawdownPercentage: 18,
          minSuccessRatePercentage: 65,
          maxDailyLossPercentage: 10,
          maxPositionRiskPercentage: 5,
          maxPortfolioConcentration: 25,
          maxConsecutiveLosses: 3,
          maxSlippagePercentage: 2,
          minProfitMarginPercentage: 2,
          maxMarketImpactPercentage: 1,
          emergencyStopLossPercentage: 15,
        },
      };
      
      expect(() => safetyMonitoringService.updateConfiguration(partialConfig)).not.toThrow();
    }, TEST_TIMEOUT);
  });

  describe('Risk Assessment Integration', () => {
    it('should integrate with execution service for risk calculation', async () => {
      // Mock execution service with specific risk data
      const mockExecutionReport = {
        status: 'active' as const,
        config: {
          enabled: true,
          maxPositions: 5,
          maxDailyTrades: 10,
          positionSizeUSDT: 100,
          minConfidence: 80,
          allowedPatternTypes: ['ready_state' as const],
          requireCalendarConfirmation: true,
          stopLossPercentage: 5,
          takeProfitPercentage: 10,
          maxDrawdownPercentage: 20,
          enableAdvanceDetection: true,
          advanceHoursThreshold: 3.5,
          enableMultiPhaseStrategy: false,
          slippageTolerancePercentage: 1,
        },
        stats: {
          totalTrades: 20,
          successfulTrades: 15,
          failedTrades: 5,
          successRate: 75,
          totalPnl: '500',
          totalPnlPercentage: 5,
          averageTradeReturn: 2.5,
          maxDrawdown: 8,
          currentDrawdown: 3,
          averageExecutionTime: 150,
          averageSlippage: 0.5,
          activePositions: 2,
          dailyTradeCount: 5,
          patternSuccessRates: {
            ready_state: 80,
            pre_ready: 70,
            launch_sequence: 85,
            risk_warning: 0,
          },
          averagePatternConfidence: 85,
          mostSuccessfulPattern: 'launch_sequence' as const,
        },
        activePositions: [],
        recentExecutions: [],
        activeAlerts: [],
        systemHealth: {
          apiConnection: true,
          patternEngine: true,
          safetySystem: true,
          riskLimits: true,
        },
        recommendations: [],
        lastUpdated: new Date().toISOString(),
      };

      vi.spyOn(executionService, 'getExecutionReport').mockResolvedValue(mockExecutionReport);

      await safetyMonitoringService.startMonitoring();
      const report = await safetyMonitoringService.getSafetyReport();
      
      expect(report.riskMetrics.successRate).toBe(75);
      expect(report.riskMetrics.currentDrawdown).toBe(3);
      expect(report.riskMetrics.maxDrawdown).toBe(8);
    }, TEST_TIMEOUT);

    it('should respect risk thresholds and generate alerts', async () => {
      // Configure low thresholds to trigger alerts
      safetyMonitoringService.updateConfiguration({
        thresholds: {
          maxDrawdownPercentage: 1, // Very low to trigger alerts
          minSuccessRatePercentage: 95, // Very high to trigger alerts
          maxConsecutiveLosses: 1,
          maxApiLatencyMs: 50, // Very low to trigger alerts
          minApiSuccessRate: 99,
          maxMemoryUsagePercentage: 80,
          minPatternConfidence: 95, // Very high to trigger alerts
          maxPatternDetectionFailures: 1,
          maxDailyLossPercentage: 5,
          maxPositionRiskPercentage: 10,
          maxPortfolioConcentration: 25,
          maxSlippagePercentage: 2,
        },
      });

      await safetyMonitoringService.startMonitoring();
      
      // Wait a moment for monitoring cycle to run
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const report = await safetyMonitoringService.getSafetyReport();
      
      // With very strict thresholds, we should have some alerts
      expect(report.overallRiskScore).toBeGreaterThan(0);
    }, TEST_TIMEOUT);
  });
});