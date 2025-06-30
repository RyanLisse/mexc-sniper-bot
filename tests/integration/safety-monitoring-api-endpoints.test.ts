/**
 * Safety Monitoring API Endpoints Tests
 * 
 * Focused tests for API endpoint functionality with proper mocking
 */

import { NextRequest } from "next/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setTestTimeout, withApiTimeout } from "../utils/timeout-utilities";

// Mock all dependencies at module level
vi.mock("@/src/lib/api-auth", () => ({
  apiAuthWrapper: vi.fn().mockImplementation((handler) => {
    return async (request, ...args) => {
      return await handler(request, ...args);
    };
  }),
  requireApiAuth: vi.fn().mockResolvedValue({
    id: "test-user-123",
    email: "test@example.com",
    name: "Test User",
  }),
}));

vi.mock("@/src/lib/structured-logger", () => ({
  createSafeLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trading: vi.fn(),
  }),
}));

// Create mock safety service
const createMockSafetyService = () => ({
  getMonitoringStatus: vi.fn().mockReturnValue(false),
  getTimerStatus: vi.fn().mockReturnValue([
    {
      id: "monitoring_cycle",
      name: "Safety Monitoring Cycle", 
      intervalMs: 30000,
      lastExecuted: Date.now() - 10000,
      isRunning: false,
      nextExecution: Date.now() + 20000,
    },
  ]),
  startMonitoring: vi.fn().mockResolvedValue(undefined),
  stopMonitoring: vi.fn().mockReturnValue(undefined),
  getConfiguration: vi.fn().mockReturnValue({
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
  }),
  updateConfiguration: vi.fn().mockReturnValue(undefined),
  getRiskMetrics: vi.fn().mockReturnValue({
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
  }),
  calculateOverallRiskScore: vi.fn().mockReturnValue(25),
  performRiskAssessment: vi.fn().mockResolvedValue(undefined),
  isSystemSafe: vi.fn().mockResolvedValue(true),
  getSafetyReport: vi.fn().mockResolvedValue({
    status: "safe",
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
  }),
  triggerEmergencyResponse: vi.fn().mockResolvedValue([
    {
      id: "halt_123",
      type: "halt_trading",
      description: "Emergency trading halt",
      executed: true,
      executedAt: new Date().toISOString(),
      result: "success",
    },
  ]),
  acknowledgeAlert: vi.fn().mockReturnValue(true),
  clearAcknowledgedAlerts: vi.fn().mockReturnValue(5),
});

let mockSafetyService = createMockSafetyService();

// Create a mock function that will always return the current mockSafetyService
const getInstanceMock = vi.fn(() => mockSafetyService);

// Mock the entire RealTimeSafetyMonitoringService module
vi.mock("@/src/services/risk/real-time-safety-monitoring-modules", () => ({
  RealTimeSafetyMonitoringService: {
    getInstance: getInstanceMock,
  },
}));

// Also mock the index export
vi.mock("@/src/services/risk/real-time-safety-monitoring-modules/index", () => ({
  RealTimeSafetyMonitoringService: {
    getInstance: getInstanceMock,
  },
}));

describe("Safety Monitoring API Endpoints", () => {
  const TEST_TIMEOUT = setTestTimeout("integration");

  let GET: any;
  let POST: any;

  beforeAll(async () => {
    // Import after mocking
    const { GET: getHandler, POST: postHandler } = await import(
      "../../app/api/auto-sniping/safety-monitoring/route"
    );
    GET = getHandler;
    POST = postHandler;
  });

  beforeEach(() => {
    // Clear all mocks and recreate fresh mock service
    vi.clearAllMocks();
    mockSafetyService = createMockSafetyService();
    
    // Update the getInstance mock to return the new service
    getInstanceMock.mockReturnValue(mockSafetyService);
  });

  describe("GET Endpoints", () => {
    it(
      "should handle GET /status requests successfully",
      async () => {
        const url = new URL(
          "http://localhost:3000/api/auto-sniping/safety-monitoring?action=status",
        );
        const request = new NextRequest(url.toString());

        const response = await withApiTimeout(
          () => GET(request),
          5000
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data).toHaveProperty("isActive");
        expect(data.data).toHaveProperty("timerOperations");
        expect(data.data).toHaveProperty("lastChecked");
      },
      TEST_TIMEOUT,
    );

    it(
      "should handle GET /report requests with proper response structure",
      async () => {
        const url = new URL(
          "http://localhost:3000/api/auto-sniping/safety-monitoring?action=report",
        );
        const request = new NextRequest(url.toString());

        const response = await withApiTimeout(
          () => GET(request),
          5000
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data).toHaveProperty("status");
        expect(data.data).toHaveProperty("overallRiskScore");
        expect(data.data).toHaveProperty("riskMetrics");
        expect(data.data).toHaveProperty("systemHealth");
        expect(data.data).toHaveProperty("activeAlerts");
        expect(data.data).toHaveProperty("recommendations");
      },
      TEST_TIMEOUT,
    );

    it(
      "should handle GET /risk-metrics requests",
      async () => {
        const url = new URL(
          "http://localhost:3000/api/auto-sniping/safety-monitoring?action=risk-metrics",
        );
        const request = new NextRequest(url.toString());

        const response = await withApiTimeout(
          () => GET(request),
          5000
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data).toHaveProperty("riskMetrics");
        expect(data.data).toHaveProperty("timestamp");
        expect(data.data.riskMetrics).toHaveProperty("currentDrawdown");
        expect(data.data.riskMetrics).toHaveProperty("successRate");
      },
      TEST_TIMEOUT,
    );

    it(
      "should handle GET /system-health requests",
      async () => {
        const url = new URL(
          "http://localhost:3000/api/auto-sniping/safety-monitoring?action=system-health",
        );
        const request = new NextRequest(url.toString());

        const response = await withApiTimeout(
          () => GET(request),
          5000,
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data).toHaveProperty("systemHealth");
        expect(data.data).toHaveProperty("overallRiskScore");
        expect(data.data.systemHealth).toHaveProperty("executionService");
        expect(data.data.systemHealth).toHaveProperty("overallHealth");
      },
      TEST_TIMEOUT,
    );

    it(
      "should handle GET /configuration requests",
      async () => {
        const url = new URL(
          "http://localhost:3000/api/auto-sniping/safety-monitoring?action=configuration",
        );
        const request = new NextRequest(url.toString());

        const response = await withApiTimeout(
          () => GET(request),
          5000,
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data).toHaveProperty("configuration");
        expect(data.data).toHaveProperty("isActive");
        expect(data.data.configuration).toHaveProperty("enabled");
        expect(data.data.configuration).toHaveProperty("thresholds");
      },
      TEST_TIMEOUT,
    );

    it(
      "should handle GET /check-safety requests",
      async () => {
        const url = new URL(
          "http://localhost:3000/api/auto-sniping/safety-monitoring?action=check-safety",
        );
        const request = new NextRequest(url.toString());

        const response = await withApiTimeout(
          () => GET(request),
          5000,
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data).toHaveProperty("isSafe");
        expect(data.data).toHaveProperty("overallRiskScore");
        expect(data.data).toHaveProperty("currentDrawdown");
        expect(data.data).toHaveProperty("successRate");
      },
      TEST_TIMEOUT,
    );

    it(
      "should return 400 for invalid GET action",
      async () => {
        const url = new URL(
          "http://localhost:3000/api/auto-sniping/safety-monitoring?action=invalid_action",
        );
        const request = new NextRequest(url.toString());

        const response = await withApiTimeout(
          () => GET(request),
          5000,
        );

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain("Invalid action parameter");
      },
      TEST_TIMEOUT,
    );
  });

  describe("POST Endpoints", () => {
    it(
      "should start monitoring successfully via API",
      async () => {
        // Ensure monitoring is not active initially
        mockSafetyService.getMonitoringStatus.mockReturnValue(false);

        const request = new NextRequest(
          "http://localhost:3000/api/auto-sniping/safety-monitoring",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "start_monitoring" }),
          },
        );

        const response = await withApiTimeout(
          () => POST(request),
          5000,
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.message).toContain("started successfully");
        expect(data.data).toHaveProperty("isActive");
        expect(data.data).toHaveProperty("timestamp");
      },
      TEST_TIMEOUT,
    );

    it(
      "should trigger emergency response successfully",
      async () => {
        const request = new NextRequest(
          "http://localhost:3000/api/auto-sniping/safety-monitoring",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "emergency_response",
              reason: "Critical system failure detected",
            }),
          },
        );

        const response = await withApiTimeout(
          () => POST(request),
          5000,
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.message).toContain("triggered successfully");
        expect(data.data.actionsExecuted).toHaveLength(1);
        expect(mockSafetyService.triggerEmergencyResponse).toHaveBeenCalledWith(
          "Critical system failure detected",
        );
      },
      TEST_TIMEOUT,
    );

    it(
      "should return 400 for missing POST action",
      async () => {
        const request = new NextRequest(
          "http://localhost:3000/api/auto-sniping/safety-monitoring",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ someField: "value" }),
          },
        );

        const response = await withApiTimeout(
          () => POST(request),
          5000,
        );

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain("action is required");
      },
      TEST_TIMEOUT,
    );

    it(
      "should return 400 for invalid JSON in POST request",
      async () => {
        const request = new NextRequest(
          "http://localhost:3000/api/auto-sniping/safety-monitoring",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{ invalid json",
          },
        );

        const response = await withApiTimeout(
          () => POST(request),
          5000,
        );

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain("Invalid JSON");
      },
      TEST_TIMEOUT,
    );

    it(
      "should return 409 for starting monitoring when already active",
      async () => {
        // Mock monitoring as already active
        mockSafetyService.getMonitoringStatus.mockReturnValue(true);

        const request = new NextRequest(
          "http://localhost:3000/api/auto-sniping/safety-monitoring",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "start_monitoring" }),
          },
        );

        const response = await withApiTimeout(
          () => POST(request),
          5000,
        );

        expect(response.status).toBe(409);
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain("already active");
      },
      TEST_TIMEOUT,
    );

    it(
      "should handle service errors gracefully",
      async () => {
        // Mock service error for this specific test
        mockSafetyService.getSafetyReport.mockRejectedValueOnce(
          new Error("Service temporarily unavailable"),
        );

        const url = new URL(
          "http://localhost:3000/api/auto-sniping/safety-monitoring?action=report",
        );
        const request = new NextRequest(url.toString());

        const response = await withApiTimeout(
          () => GET(request),
          5000,
        );

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain("Service temporarily unavailable");
      },
      TEST_TIMEOUT,
    );
  });

  describe("Response Structure Validation", () => {
    it(
      "should validate response data structure for safety reports",
      async () => {
        const url = new URL(
          "http://localhost:3000/api/auto-sniping/safety-monitoring?action=report",
        );
        const request = new NextRequest(url.toString());

        const response = await withApiTimeout(
          () => GET(request),
          5000,
        );

        expect(response.status).toBe(200);
        const data = await response.json();

        // Validate response structure
        expect(data).toHaveProperty("success");
        expect(data).toHaveProperty("data");
        expect(data.success).toBe(true);

        const report = data.data;
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

        // Validate data types
        expect(typeof report.status).toBe("string");
        expect(typeof report.overallRiskScore).toBe("number");
        expect(Array.isArray(report.activeAlerts)).toBe(true);
        expect(Array.isArray(report.recommendations)).toBe(true);
        expect(typeof report.systemHealth).toBe("object");
        expect(typeof report.riskMetrics).toBe("object");
      },
      TEST_TIMEOUT,
    );
  });
});