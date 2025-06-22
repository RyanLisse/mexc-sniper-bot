/**
 * Integration Tests for Safety Monitoring API Endpoint
 *
 * Tests all GET and POST actions, authentication, error handling,
 * and service integration for /api/auto-sniping/safety-monitoring
 */

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GET, POST } from "../../app/api/auto-sniping/safety-monitoring/route";
import { RealTimeSafetyMonitoringService } from "../../services/real-time-safety-monitoring-service";

// Mock the service
vi.mock("../../services/real-time-safety-monitoring-service");

// Mock auth decorators
vi.mock("../../lib/auth-decorators", () => ({
  authenticatedRoute: (handler: (...args: any[]) => any) => handler,
}));

// Mock logger
vi.mock("../../lib/structured-logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("Safety Monitoring API Integration Tests", () => {
  let mockSafetyService: Record<string, (...args: any[]) => any>;
  const mockUser = { id: "user-123", email: "test@example.com", name: "Test User" };

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Create mock service instance
    mockSafetyService = {
      startMonitoring: vi.fn(),
      stopMonitoring: vi.fn(),
      getSafetyReport: vi.fn(),
      getRiskMetrics: vi.fn(),
      getTimerStatus: vi.fn(),
      updateConfiguration: vi.fn(),
      triggerEmergencyResponse: vi.fn(),
      acknowledgeAlert: vi.fn(),
      clearAcknowledgedAlerts: vi.fn(),
      isSystemSafe: vi.fn(),
      // Access to private fields for testing
      isMonitoringActive: false,
      config: {
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
      },
      calculateOverallRiskScore: vi.fn(),
      performRiskAssessment: vi.fn(),
    } as Record<string, (...args: any[]) => any>;

    // Mock service singleton
    vi.mocked(RealTimeSafetyMonitoringService.getInstance).mockReturnValue(mockSafetyService);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("GET Endpoints", () => {
    const createGetRequest = (action?: string, additionalParams?: Record<string, string>) => {
      const url = new URL("http://localhost:3000/api/auto-sniping/safety-monitoring");
      if (action) url.searchParams.set("action", action);
      if (additionalParams) {
        Object.entries(additionalParams).forEach(([key, value]) => {
          url.searchParams.set(key, value);
        });
      }

      return new NextRequest(url.toString());
    };

    test("GET /status - should return monitoring status", async () => {
      mockSafetyService.getTimerStatus.mockReturnValue([
        {
          id: "monitoring_cycle",
          name: "Safety Monitoring Cycle",
          intervalMs: 30000,
          lastExecuted: Date.now() - 10000,
          isRunning: false,
          nextExecution: Date.now() + 20000,
        },
      ]);

      const request = createGetRequest("status");
      const response = await GET(request, mockUser);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty("isActive");
      expect(data.data).toHaveProperty("timerOperations");
      expect(data.data).toHaveProperty("lastChecked");
      expect(mockSafetyService.getTimerStatus).toHaveBeenCalled();
    });

    test("GET /report - should return comprehensive safety report", async () => {
      const mockReport = {
        status: "safe" as const,
        overallRiskScore: 25,
        riskMetrics: {
          currentDrawdown: 2.5,
          maxDrawdown: 5.0,
          portfolioValue: 10000,
          totalExposure: 500,
          concentrationRisk: 15,
          successRate: 85,
          consecutiveLosses: 1,
          averageSlippage: 0.5,
          apiLatency: 150,
          apiSuccessRate: 98,
          memoryUsage: 45,
          patternAccuracy: 78,
          detectionFailures: 0,
          falsePositiveRate: 5,
        },
        thresholds: mockSafetyService.config.thresholds,
        activeAlerts: [],
        recentActions: [],
        systemHealth: {
          executionService: true,
          patternMonitoring: true,
          emergencySystem: true,
          mexcConnectivity: true,
          overallHealth: 95,
        },
        recommendations: ["System operating within safe parameters"],
        monitoringStats: {
          alertsGenerated: 0,
          actionsExecuted: 0,
          riskEventsDetected: 0,
          systemUptime: 3600000,
          lastRiskCheck: new Date().toISOString(),
          monitoringFrequency: 30000,
        },
        lastUpdated: new Date().toISOString(),
      };

      mockSafetyService.getSafetyReport.mockResolvedValue(mockReport);

      const request = createGetRequest("report");
      const response = await GET(request, mockUser);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockReport);
      expect(mockSafetyService.getSafetyReport).toHaveBeenCalled();
    });

    test("GET /risk-metrics - should return current risk metrics", async () => {
      const mockRiskMetrics = {
        currentDrawdown: 2.5,
        maxDrawdown: 5.0,
        portfolioValue: 10000,
        totalExposure: 500,
        concentrationRisk: 15,
        successRate: 85,
        consecutiveLosses: 1,
        averageSlippage: 0.5,
        apiLatency: 150,
        apiSuccessRate: 98,
        memoryUsage: 45,
        patternAccuracy: 78,
        detectionFailures: 0,
        falsePositiveRate: 5,
      };

      mockSafetyService.getRiskMetrics.mockReturnValue(mockRiskMetrics);

      const request = createGetRequest("risk-metrics");
      const response = await GET(request, mockUser);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.riskMetrics).toEqual(mockRiskMetrics);
      expect(data.data).toHaveProperty("timestamp");
    });

    test("GET /alerts - should return filtered alerts", async () => {
      const mockAlerts = [
        {
          id: "alert_1",
          type: "risk_threshold" as const,
          severity: "high" as const,
          category: "portfolio" as const,
          title: "High Risk Alert",
          message: "Portfolio risk threshold exceeded",
          timestamp: new Date().toISOString(),
          acknowledged: false,
          autoActions: [],
          riskLevel: 75,
          source: "risk_monitor",
          metadata: {},
        },
        {
          id: "alert_2",
          type: "performance_degradation" as const,
          severity: "medium" as const,
          category: "performance" as const,
          title: "Performance Alert",
          message: "Success rate below threshold",
          timestamp: new Date().toISOString(),
          acknowledged: false,
          autoActions: [],
          riskLevel: 55,
          source: "performance_monitor",
          metadata: {},
        },
      ];

      mockSafetyService.getSafetyReport.mockResolvedValue({
        activeAlerts: mockAlerts,
      } as Record<string, unknown>);

      const request = createGetRequest("alerts", { severity: "high", limit: "10" });
      const response = await GET(request, mockUser);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.alerts).toHaveLength(1);
      expect(data.data.alerts[0].severity).toBe("high");
      expect(data.data.totalCount).toBe(2);
      expect(data.data.filteredCount).toBe(1);
    });

    test("GET /system-health - should return system health status", async () => {
      const mockReport = {
        systemHealth: {
          executionService: true,
          patternMonitoring: true,
          emergencySystem: true,
          mexcConnectivity: true,
          overallHealth: 95,
        },
        overallRiskScore: 25,
        status: "safe" as const,
        recommendations: ["System operating normally"],
        lastUpdated: new Date().toISOString(),
      };

      mockSafetyService.getSafetyReport.mockResolvedValue(mockReport as any);

      const request = createGetRequest("system-health");
      const response = await GET(request, mockUser);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.systemHealth).toEqual(mockReport.systemHealth);
      expect(data.data.overallRiskScore).toBe(25);
    });

    test("GET /configuration - should return current configuration", async () => {
      const request = createGetRequest("configuration");
      const response = await GET(request, mockUser);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.configuration).toEqual(mockSafetyService.config);
      expect(data.data).toHaveProperty("isActive");
    });

    test("GET /check-safety - should return safety check result", async () => {
      mockSafetyService.isSystemSafe.mockResolvedValue(true);
      mockSafetyService.getRiskMetrics.mockReturnValue({
        currentDrawdown: 2.5,
        successRate: 85,
        consecutiveLosses: 1,
      } as any);
      mockSafetyService.calculateOverallRiskScore.mockReturnValue(25);

      const request = createGetRequest("check-safety");
      const response = await GET(request, mockUser);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.isSafe).toBe(true);
      expect(data.data.overallRiskScore).toBe(25);
      expect(data.data.currentDrawdown).toBe(2.5);
    });

    test("GET with invalid action - should return error", async () => {
      const request = createGetRequest("invalid-action");
      const response = await GET(request, mockUser);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid action parameter");
    });

    test("GET with service error - should handle gracefully", async () => {
      mockSafetyService.getSafetyReport.mockRejectedValue(new Error("Service unavailable"));

      const request = createGetRequest("report");
      const response = await GET(request, mockUser);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Service unavailable");
    });
  });

  describe("POST Endpoints", () => {
    const createPostRequest = (body: any) => {
      return new NextRequest("http://localhost:3000/api/auto-sniping/safety-monitoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    };

    test("POST /start_monitoring - should start monitoring successfully", async () => {
      mockSafetyService.isMonitoringActive = false;
      mockSafetyService.startMonitoring.mockResolvedValue(undefined);

      const request = createPostRequest({ action: "start_monitoring" });
      const response = await POST(request, mockUser);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.message).toContain("started successfully");
      expect(data.data.isActive).toBe(true);
      expect(mockSafetyService.startMonitoring).toHaveBeenCalled();
    });

    test("POST /start_monitoring - should fail if already active", async () => {
      mockSafetyService.isMonitoringActive = true;

      const request = createPostRequest({ action: "start_monitoring" });
      const response = await POST(request, mockUser);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error).toContain("already active");
    });

    test("POST /stop_monitoring - should stop monitoring successfully", async () => {
      mockSafetyService.isMonitoringActive = true;
      mockSafetyService.stopMonitoring.mockReturnValue(undefined);

      const request = createPostRequest({ action: "stop_monitoring" });
      const response = await POST(request, mockUser);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.message).toContain("stopped successfully");
      expect(data.data.isActive).toBe(false);
      expect(mockSafetyService.stopMonitoring).toHaveBeenCalled();
    });

    test("POST /stop_monitoring - should fail if not active", async () => {
      mockSafetyService.isMonitoringActive = false;

      const request = createPostRequest({ action: "stop_monitoring" });
      const response = await POST(request, mockUser);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error).toContain("not currently active");
    });

    test("POST /update_configuration - should update configuration", async () => {
      const newConfig = {
        monitoringIntervalMs: 45000,
        autoActionEnabled: true,
        emergencyMode: true,
      };

      mockSafetyService.updateConfiguration.mockReturnValue(undefined);

      const request = createPostRequest({
        action: "update_configuration",
        configuration: newConfig,
      });
      const response = await POST(request, mockUser);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.message).toContain("updated successfully");
      expect(data.data.updatedFields).toEqual(Object.keys(newConfig));
      expect(mockSafetyService.updateConfiguration).toHaveBeenCalledWith(newConfig);
    });

    test("POST /update_thresholds - should update safety thresholds", async () => {
      const newThresholds = {
        maxDrawdownPercentage: 20,
        minSuccessRatePercentage: 70,
        maxConsecutiveLosses: 3,
      };

      mockSafetyService.updateConfiguration.mockReturnValue(undefined);

      const request = createPostRequest({
        action: "update_thresholds",
        thresholds: newThresholds,
      });
      const response = await POST(request, mockUser);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.message).toContain("updated successfully");
      expect(data.data.updatedThresholds).toEqual(Object.keys(newThresholds));
      expect(mockSafetyService.updateConfiguration).toHaveBeenCalledWith({
        thresholds: newThresholds,
      });
    });

    test("POST /emergency_response - should trigger emergency response", async () => {
      const mockActions = [
        {
          id: "halt_123",
          type: "halt_trading" as const,
          description: "Emergency trading halt",
          executed: true,
          executedAt: new Date().toISOString(),
          result: "success" as const,
        },
      ];

      mockSafetyService.triggerEmergencyResponse.mockResolvedValue(mockActions);

      const request = createPostRequest({
        action: "emergency_response",
        reason: "Critical system failure detected",
      });
      const response = await POST(request, mockUser);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.message).toContain("triggered successfully");
      expect(data.data.actionsExecuted).toEqual(mockActions);
      expect(mockSafetyService.triggerEmergencyResponse).toHaveBeenCalledWith(
        "Critical system failure detected"
      );
    });

    test("POST /acknowledge_alert - should acknowledge alert", async () => {
      mockSafetyService.acknowledgeAlert.mockReturnValue(true);

      const request = createPostRequest({
        action: "acknowledge_alert",
        alertId: "alert_123",
      });
      const response = await POST(request, mockUser);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.message).toContain("acknowledged successfully");
      expect(data.data.alertId).toBe("alert_123");
      expect(mockSafetyService.acknowledgeAlert).toHaveBeenCalledWith("alert_123");
    });

    test("POST /acknowledge_alert - should fail for non-existent alert", async () => {
      mockSafetyService.acknowledgeAlert.mockReturnValue(false);

      const request = createPostRequest({
        action: "acknowledge_alert",
        alertId: "nonexistent_alert",
      });
      const response = await POST(request, mockUser);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Alert not found");
    });

    test("POST /clear_acknowledged_alerts - should clear alerts", async () => {
      mockSafetyService.clearAcknowledgedAlerts.mockReturnValue(5);

      const request = createPostRequest({ action: "clear_acknowledged_alerts" });
      const response = await POST(request, mockUser);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.clearedCount).toBe(5);
      expect(mockSafetyService.clearAcknowledgedAlerts).toHaveBeenCalled();
    });

    test("POST /force_risk_assessment - should force risk assessment", async () => {
      const mockRiskMetrics = {
        currentDrawdown: 3.5,
        successRate: 78,
        consecutiveLosses: 2,
      } as any;

      mockSafetyService.performRiskAssessment.mockResolvedValue(undefined);
      mockSafetyService.getRiskMetrics.mockReturnValue(mockRiskMetrics);
      mockSafetyService.calculateOverallRiskScore.mockReturnValue(35);

      const request = createPostRequest({ action: "force_risk_assessment" });
      const response = await POST(request, mockUser);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.message).toContain("assessment completed");
      expect(data.data.riskMetrics).toEqual(mockRiskMetrics);
      expect(data.data.overallRiskScore).toBe(35);
    });

    test("POST with missing action - should return error", async () => {
      const request = createPostRequest({ someField: "value" });
      const response = await POST(request, mockUser);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Action is required");
    });

    test("POST with invalid action - should return error", async () => {
      const request = createPostRequest({ action: "invalid_action" });
      const response = await POST(request, mockUser);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid action");
    });

    test("POST with invalid JSON - should return error", async () => {
      const request = new NextRequest("http://localhost:3000/api/auto-sniping/safety-monitoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ invalid json",
      });

      const response = await POST(request, mockUser);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid JSON");
    });

    test("POST missing required parameters - should return appropriate errors", async () => {
      // Test missing configuration
      const configRequest = createPostRequest({ action: "update_configuration" });
      const configResponse = await POST(configRequest, mockUser);
      const configData = await configResponse.json();

      expect(configResponse.status).toBe(400);
      expect(configData.error).toContain("Configuration is required");

      // Test missing thresholds
      const thresholdRequest = createPostRequest({ action: "update_thresholds" });
      const thresholdResponse = await POST(thresholdRequest, mockUser);
      const thresholdData = await thresholdResponse.json();

      expect(thresholdResponse.status).toBe(400);
      expect(thresholdData.error).toContain("Thresholds are required");

      // Test missing reason for emergency
      const emergencyRequest = createPostRequest({ action: "emergency_response" });
      const emergencyResponse = await POST(emergencyRequest, mockUser);
      const emergencyData = await emergencyResponse.json();

      expect(emergencyResponse.status).toBe(400);
      expect(emergencyData.error).toContain("Emergency reason is required");

      // Test missing alertId
      const alertRequest = createPostRequest({ action: "acknowledge_alert" });
      const alertResponse = await POST(alertRequest, mockUser);
      const alertData = await alertResponse.json();

      expect(alertResponse.status).toBe(400);
      expect(alertData.error).toContain("Alert ID is required");
    });
  });

  describe("Error Handling and Edge Cases", () => {
    test("Should handle service initialization failure", async () => {
      vi.mocked(RealTimeSafetyMonitoringService.getInstance).mockImplementation(() => {
        throw new Error("Service initialization failed");
      });

      const request = new NextRequest(
        "http://localhost:3000/api/auto-sniping/safety-monitoring?action=status"
      );
      const response = await GET(request, mockUser);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Service initialization failed");
    });

    test("Should handle async operation failures gracefully", async () => {
      mockSafetyService.startMonitoring.mockRejectedValue(new Error("Async operation failed"));

      const request = new NextRequest("http://localhost:3000/api/auto-sniping/safety-monitoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start_monitoring" }),
      });

      const response = await POST(request, mockUser);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Async operation failed");
    });

    test("Should validate threshold field types", async () => {
      const invalidThresholds = {
        maxDrawdownPercentage: "not_a_number", // Invalid type
        minSuccessRatePercentage: 70, // Valid
        invalidField: 123, // Invalid field name
      };

      const request = new NextRequest("http://localhost:3000/api/auto-sniping/safety-monitoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_thresholds",
          thresholds: invalidThresholds,
        }),
      });

      const response = await POST(request, mockUser);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      // Should only update valid numeric fields
      expect(mockSafetyService.updateConfiguration).toHaveBeenCalledWith({
        thresholds: { minSuccessRatePercentage: 70 },
      });
    });
  });

  describe("Performance and Timing Tests", () => {
    test("API responses should be fast", async () => {
      const startTime = Date.now();

      const request = new NextRequest(
        "http://localhost:3000/api/auto-sniping/safety-monitoring?action=status"
      );
      await GET(request, mockUser);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(1000); // Should respond in under 1 second
    });

    test("Should handle concurrent requests properly", async () => {
      const requests = Array.from(
        { length: 5 },
        () =>
          new NextRequest("http://localhost:3000/api/auto-sniping/safety-monitoring?action=status")
      );

      const responses = await Promise.all(requests.map((request) => GET(request, mockUser)));

      responses.forEach(async (response) => {
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
      });

      expect(mockSafetyService.getTimerStatus).toHaveBeenCalledTimes(5);
    });
  });

  describe("Data Validation and Sanitization", () => {
    test("Should sanitize and validate configuration updates", async () => {
      const configWithExtraFields = {
        monitoringIntervalMs: 45000,
        autoActionEnabled: true,
        invalidField: "should_be_ignored",
        anotherInvalidField: { nested: "object" },
      };

      const request = new NextRequest("http://localhost:3000/api/auto-sniping/safety-monitoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_configuration",
          configuration: configWithExtraFields,
        }),
      });

      const response = await POST(request, mockUser);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Should only pass valid configuration fields
      expect(mockSafetyService.updateConfiguration).toHaveBeenCalledWith({
        monitoringIntervalMs: 45000,
        autoActionEnabled: true,
      });
    });

    test("Should handle malformed query parameters gracefully", async () => {
      // Mock the getSafetyReport method to return empty alerts
      mockSafetyService.getSafetyReport.mockResolvedValue({
        activeAlerts: [],
        status: "safe",
        overallRiskScore: 25,
      } as any);

      const request = new NextRequest(
        "http://localhost:3000/api/auto-sniping/safety-monitoring?action=alerts&limit=not_a_number&severity=invalid_severity"
      );

      const response = await GET(request, mockUser);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      // Should use default limit and ignore invalid severity
      expect(data.data.alerts).toBeDefined();
    });
  });
});
