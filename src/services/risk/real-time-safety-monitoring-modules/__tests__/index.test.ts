/**
 * Integration Tests for Real-time Safety Monitoring Service - Modular Implementation
 *
 * Tests the main RealTimeSafetyMonitoringService class to ensure all modules
 * work together correctly and maintain backward compatibility.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UnifiedMexcServiceV2 } from "../../../api/unified-mexc-service-v2";
import type { PatternMonitoringService } from "../../../notification/pattern-monitoring-service";
import type {
  RiskMetrics,
  SafetyAlert,
  SafetyConfiguration,
} from "../../../schemas/safety-monitoring-schemas";
import type { OptimizedAutoSnipingCore } from "../../../trading/optimized-auto-sniping-core";
import type { EmergencySafetySystem } from "../../emergency-safety-system";
import { createRealTimeSafetyMonitoringService, RealTimeSafetyMonitoringService } from "../index";

describe("RealTimeSafetyMonitoringService - Modular Integration", () => {
  let safetyService: RealTimeSafetyMonitoringService;
  let mockExecutionService: Partial<OptimizedAutoSnipingCore>;
  let mockPatternMonitoring: Partial<PatternMonitoringService>;
  let mockEmergencySystem: Partial<EmergencySafetySystem>;
  let mockMexcService: Partial<UnifiedMexcServiceV2>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock instances using partial objects
    mockExecutionService = {
      getExecutionReport: vi.fn().mockResolvedValue({
        stats: {
          currentDrawdown: 5,
          maxDrawdown: 10,
          successRate: 75,
          averageSlippage: 0.5,
          totalPnl: "500",
        },
        activePositions: [],
        recentExecutions: [],
        systemHealth: {
          apiConnection: true,
        },
      }),
      getActivePositions: vi.fn().mockReturnValue([]),
      getConfig: vi.fn().mockReturnValue({
        thresholds: {
          maxDrawdownPercentage: 20,
          maxPortfolioConcentration: 10,
          minSuccessRatePercentage: 70,
          maxConsecutiveLosses: 5,
          maxSlippagePercentage: 2,
          minPatternConfidence: 70,
          maxPatternDetectionFailures: 3,
          maxApiLatencyMs: 1000,
          minApiSuccessRate: 95,
          maxMemoryUsagePercentage: 80,
        },
        enabled: true,
        autoActionEnabled: false,
        emergencyMode: false,
      }),
      stopExecution: vi.fn().mockResolvedValue(undefined),
      emergencyCloseAll: vi.fn().mockResolvedValue(0),
    };

    mockPatternMonitoring = {
      getMonitoringReport: vi.fn().mockResolvedValue({
        status: "healthy",
        stats: {
          averageConfidence: 80,
          consecutiveErrors: 1,
          totalPatternsDetected: 100,
        },
      }),
    };

    mockEmergencySystem = {
      performSystemHealthCheck: vi.fn().mockResolvedValue({
        overall: "healthy",
      }),
    };

    mockMexcService = {
      // Add any needed mock methods
    };

    // Create service instance
    safetyService = createRealTimeSafetyMonitoringService();

    // Inject mocked dependencies
    safetyService.injectDependencies({
      executionService: mockExecutionService as OptimizedAutoSnipingCore,
      patternMonitoring: mockPatternMonitoring as PatternMonitoringService,
      emergencySystem: mockEmergencySystem as EmergencySafetySystem,
      mexcService: mockMexcService as UnifiedMexcServiceV2,
    });

    // Reset to clean state for each test
    safetyService.resetToDefaults();
  });

  afterEach(() => {
    try {
      if (safetyService?.getMonitoringStatus?.()) {
        safetyService.stopMonitoring();
      }
    } catch (error) {
      // Ignore cleanup errors in tests
      console.warn("Test cleanup warning:", error);
    }
    // Reset all mocks after each test
    vi.clearAllMocks();
  });

  describe("Initialization and Configuration", () => {
    it("should initialize with default configuration", () => {
      expect(safetyService).toBeInstanceOf(RealTimeSafetyMonitoringService);
      expect(safetyService.getMonitoringStatus()).toBe(false);
    });

    it("should get and update configuration", () => {
      const currentConfig = safetyService.getConfiguration();
      expect(currentConfig).toHaveProperty("enabled");
      expect(currentConfig).toHaveProperty("monitoringIntervalMs");
      expect(currentConfig).toHaveProperty("thresholds");

      const newConfig: Partial<SafetyConfiguration> = {
        monitoringIntervalMs: 15000,
        autoActionEnabled: true,
      };

      safetyService.updateConfiguration(newConfig);
      const updatedConfig = safetyService.getConfiguration();

      expect(updatedConfig.monitoringIntervalMs).toBe(15000);
      expect(updatedConfig.autoActionEnabled).toBe(true);
    });

    it("should maintain singleton pattern", () => {
      const instance1 = RealTimeSafetyMonitoringService.getInstance();
      const instance2 = RealTimeSafetyMonitoringService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("Monitoring Lifecycle", () => {
    it("should start and stop monitoring successfully", async () => {
      expect(safetyService.getMonitoringStatus()).toBe(false);

      await safetyService.startMonitoring();
      expect(safetyService.getMonitoringStatus()).toBe(true);

      safetyService.stopMonitoring();
      expect(safetyService.getMonitoringStatus()).toBe(false);
    });

    it("should not allow starting monitoring twice", async () => {
      await safetyService.startMonitoring();

      await expect(safetyService.startMonitoring()).rejects.toThrow(
        "Safety monitoring is already active"
      );
    });

    it("should perform initial health check on startup", async () => {
      await safetyService.startMonitoring();

      expect(mockEmergencySystem.performSystemHealthCheck).toHaveBeenCalled();
    });
  });

  describe("Risk Metrics and Calculations", () => {
    it("should get current risk metrics", async () => {
      const riskMetrics = safetyService.getRiskMetrics();

      expect(riskMetrics).toHaveProperty("currentDrawdown");
      expect(riskMetrics).toHaveProperty("successRate");
      expect(riskMetrics).toHaveProperty("concentrationRisk");
      expect(riskMetrics).toHaveProperty("apiLatency");
      expect(riskMetrics).toHaveProperty("patternAccuracy");

      expect(typeof riskMetrics.currentDrawdown).toBe("number");
      expect(typeof riskMetrics.successRate).toBe("number");
    });

    it("should calculate overall risk score", () => {
      const riskScore = safetyService.calculateOverallRiskScore();

      expect(typeof riskScore).toBe("number");
      expect(riskScore).toBeGreaterThanOrEqual(0);
      expect(riskScore).toBeLessThanOrEqual(100);
    });

    it("should perform comprehensive risk assessment", async () => {
      const assessment = await safetyService.performRiskAssessment();

      expect(assessment).toHaveProperty("portfolio");
      expect(assessment).toHaveProperty("performance");
      expect(assessment).toHaveProperty("pattern");
      expect(assessment).toHaveProperty("system");
      expect(assessment).toHaveProperty("overallRiskScore");
      expect(assessment).toHaveProperty("riskStatus");
      expect(assessment).toHaveProperty("priorityRecommendations");

      expect(Array.isArray(assessment.priorityRecommendations)).toBe(true);
    });
  });

  describe("Safety Report Generation", () => {
    it("should generate comprehensive safety report", async () => {
      const report = await safetyService.getSafetyReport();

      expect(report).toHaveProperty("status");
      expect(report).toHaveProperty("overallRiskScore");
      expect(report).toHaveProperty("riskMetrics");
      expect(report).toHaveProperty("thresholds");
      expect(report).toHaveProperty("activeAlerts");
      expect(report).toHaveProperty("recentActions");
      expect(report).toHaveProperty("systemHealth");
      expect(report).toHaveProperty("recommendations");
      expect(report).toHaveProperty("monitoringStats");
      expect(report).toHaveProperty("lastUpdated");

      expect(["safe", "warning", "critical", "emergency"]).toContain(report.status);
      expect(Array.isArray(report.activeAlerts)).toBe(true);
      expect(Array.isArray(report.recentActions)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it("should generate safety report without updates", async () => {
      const report = await safetyService.getSafetyReportWithoutUpdate();

      expect(report).toHaveProperty("status");
      expect(report).toHaveProperty("overallRiskScore");
      expect(report).toHaveProperty("riskMetrics");
    });
  });

  describe("Alert Management", () => {
    it("should handle alert acknowledgment", () => {
      // First trigger an alert by updating configuration to trigger threshold checks
      safetyService.updateConfiguration({
        thresholds: {
          ...safetyService.getConfiguration().thresholds,
          maxDrawdownPercentage: 1, // Very low threshold to trigger alert
        },
      });

      // Get the safety report to potentially trigger alerts
      safetyService.getSafetyReport().then(() => {
        const report = safetyService.getSafetyReportWithoutUpdate();
        // Check if there are any alerts to acknowledge
        // In a real scenario, we'd have a more predictable way to generate alerts
      });

      // Test acknowledgment of non-existent alert
      const acknowledged = safetyService.acknowledgeAlert("nonexistent-alert-id");
      expect(acknowledged).toBe(false);
    });

    it("should clear acknowledged alerts", () => {
      const clearedCount = safetyService.clearAcknowledgedAlerts();
      expect(typeof clearedCount).toBe("number");
      expect(clearedCount).toBeGreaterThanOrEqual(0);
    });

    it("should clear all alerts for testing", () => {
      safetyService.clearAllAlerts();
      // This should complete without throwing
      expect(true).toBe(true);
    });
  });

  describe("Emergency Response", () => {
    it("should trigger emergency response", async () => {
      const reason = "Test emergency response";
      const actions = await safetyService.triggerEmergencyResponse(reason);

      expect(Array.isArray(actions)).toBe(true);
      expect(actions.length).toBeGreaterThan(0);

      // Check that emergency actions were executed
      expect(mockExecutionService.stopExecution).toHaveBeenCalled();
      expect(mockExecutionService.emergencyCloseAll).toHaveBeenCalled();

      // Verify action properties
      actions.forEach((action) => {
        expect(action).toHaveProperty("id");
        expect(action).toHaveProperty("type");
        expect(action).toHaveProperty("description");
        expect(action).toHaveProperty("executed");
        expect(typeof action.executed).toBe("boolean");
      });
    });

    it("should handle emergency response failures gracefully", async () => {
      // Mock service failure
      mockExecutionService.stopExecution.mockRejectedValue(new Error("Service unavailable"));
      mockExecutionService.emergencyCloseAll.mockRejectedValue(new Error("Service unavailable"));

      const actions = await safetyService.triggerEmergencyResponse("Test failure handling");

      expect(actions.length).toBeGreaterThan(0);

      // Check that failed actions are marked appropriately
      const failedActions = actions.filter((action) => action.result === "failed");
      expect(failedActions.length).toBeGreaterThan(0);
    });
  });

  describe("System Safety Status", () => {
    it("should check if system is safe", async () => {
      const isSafe = await safetyService.isSystemSafe();
      expect(typeof isSafe).toBe("boolean");
    });

    it("should return false for high risk scenarios", async () => {
      // Mock high-risk execution report
      mockExecutionService.getExecutionReport.mockResolvedValue({
        stats: {
          currentDrawdown: 50, // High drawdown
          maxDrawdown: 60,
          successRate: 30, // Low success rate
          averageSlippage: 5, // High slippage
          totalPnl: "-2000", // Losses
        },
        activePositions: [],
        recentExecutions: [],
        systemHealth: {
          apiConnection: false, // Poor connectivity
        },
      });

      const isSafe = await safetyService.isSystemSafe();
      expect(isSafe).toBe(false);
    });
  });

  describe("Timer and Event Management", () => {
    it("should get timer status", async () => {
      await safetyService.startMonitoring();

      const timerStatus = safetyService.getTimerStatus();
      expect(Array.isArray(timerStatus)).toBe(true);

      timerStatus.forEach((status) => {
        expect(status).toHaveProperty("id");
        expect(status).toHaveProperty("name");
        expect(status).toHaveProperty("intervalMs");
        expect(status).toHaveProperty("lastExecuted");
        expect(status).toHaveProperty("isRunning");
        expect(status).toHaveProperty("nextExecution");

        expect(typeof status.intervalMs).toBe("number");
        expect(typeof status.isRunning).toBe("boolean");
      });
    });

    it("should coordinate multiple monitoring operations", async () => {
      await safetyService.startMonitoring();

      // Wait a bit to let operations start
      await new Promise((resolve) => setTimeout(resolve, 100));

      const timerStatus = safetyService.getTimerStatus();

      // Should have registered monitoring operations
      const monitoringOp = timerStatus.find((op) => op.id === "monitoring_cycle");
      const riskAssessmentOp = timerStatus.find((op) => op.id === "risk_assessment");
      const alertCleanupOp = timerStatus.find((op) => op.id === "alert_cleanup");

      expect(monitoringOp).toBeDefined();
      expect(riskAssessmentOp).toBeDefined();
      expect(alertCleanupOp).toBeDefined();
    });
  });

  describe("Backward Compatibility", () => {
    it("should maintain all original public methods", () => {
      // Verify all original methods exist
      expect(typeof safetyService.startMonitoring).toBe("function");
      expect(typeof safetyService.stopMonitoring).toBe("function");
      expect(typeof safetyService.getSafetyReport).toBe("function");
      expect(typeof safetyService.updateConfiguration).toBe("function");
      expect(typeof safetyService.triggerEmergencyResponse).toBe("function");
      expect(typeof safetyService.acknowledgeAlert).toBe("function");
      expect(typeof safetyService.clearAcknowledgedAlerts).toBe("function");
      expect(typeof safetyService.getRiskMetrics).toBe("function");
      expect(typeof safetyService.getMonitoringStatus).toBe("function");
      expect(typeof safetyService.getConfiguration).toBe("function");
      expect(typeof safetyService.isSystemSafe).toBe("function");
      expect(typeof safetyService.calculateOverallRiskScore).toBe("function");
      expect(typeof safetyService.performRiskAssessment).toBe("function");
      expect(typeof safetyService.getTimerStatus).toBe("function");

      // Testing methods
      expect(typeof safetyService.injectDependencies).toBe("function");
      expect(typeof safetyService.clearAllAlerts).toBe("function");
      expect(typeof safetyService.resetToDefaults).toBe("function");
      expect(typeof safetyService.getSafetyReportWithoutUpdate).toBe("function");
    });

    it("should return data structures compatible with original interface", async () => {
      const report = await safetyService.getSafetyReport();
      const riskMetrics = safetyService.getRiskMetrics();
      const config = safetyService.getConfiguration();

      // Verify structure matches original SafetyMonitoringReport
      expect(report).toMatchObject({
        status: expect.stringMatching(/^(safe|warning|critical|emergency)$/),
        overallRiskScore: expect.any(Number),
        riskMetrics: expect.any(Object),
        thresholds: expect.any(Object),
        activeAlerts: expect.any(Array),
        recentActions: expect.any(Array),
        systemHealth: expect.any(Object),
        recommendations: expect.any(Array),
        monitoringStats: expect.any(Object),
        lastUpdated: expect.any(String),
      });

      // Verify RiskMetrics structure
      expect(riskMetrics).toMatchObject({
        currentDrawdown: expect.any(Number),
        maxDrawdown: expect.any(Number),
        portfolioValue: expect.any(Number),
        totalExposure: expect.any(Number),
        concentrationRisk: expect.any(Number),
        successRate: expect.any(Number),
        consecutiveLosses: expect.any(Number),
        averageSlippage: expect.any(Number),
        apiLatency: expect.any(Number),
        apiSuccessRate: expect.any(Number),
        memoryUsage: expect.any(Number),
        patternAccuracy: expect.any(Number),
        detectionFailures: expect.any(Number),
        falsePositiveRate: expect.any(Number),
      });

      // Verify SafetyConfiguration structure
      expect(config).toMatchObject({
        enabled: expect.any(Boolean),
        monitoringIntervalMs: expect.any(Number),
        riskCheckIntervalMs: expect.any(Number),
        autoActionEnabled: expect.any(Boolean),
        emergencyMode: expect.any(Boolean),
        alertRetentionHours: expect.any(Number),
        thresholds: expect.any(Object),
      });
    });
  });

  describe("Error Handling and Resilience", () => {
    it("should handle service failures gracefully", async () => {
      // Mock service failures
      mockExecutionService.getExecutionReport.mockRejectedValue(new Error("Service unavailable"));
      mockPatternMonitoring.getMonitoringReport.mockRejectedValue(
        new Error("Pattern service down")
      );
      mockEmergencySystem.performSystemHealthCheck.mockRejectedValue(
        new Error("Emergency system failure")
      );

      // These should not throw, but handle errors gracefully
      const riskMetrics = safetyService.getRiskMetrics();
      expect(riskMetrics).toBeDefined();

      // Risk assessment should handle errors gracefully
      await expect(safetyService.performRiskAssessment()).rejects.toThrow();
    });

    it("should validate configuration updates", () => {
      // Test invalid configuration
      expect(() => {
        safetyService.updateConfiguration({
          monitoringIntervalMs: -1000, // Invalid negative interval
        });
      }).toThrow();

      expect(() => {
        safetyService.updateConfiguration({
          thresholds: {
            ...safetyService.getConfiguration().thresholds,
            maxDrawdownPercentage: 150, // Invalid percentage > 100
          },
        });
      }).toThrow();
    });

    it("should reset to clean state", () => {
      // Modify some state
      safetyService.updateConfiguration({
        autoActionEnabled: true,
        emergencyMode: true,
      });

      // Reset to defaults
      safetyService.resetToDefaults();

      const config = safetyService.getConfiguration();
      expect(config.autoActionEnabled).toBe(false);
      expect(config.emergencyMode).toBe(false);
    });
  });
});
