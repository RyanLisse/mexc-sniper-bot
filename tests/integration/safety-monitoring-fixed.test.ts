/**
 * FIXED: Safety Monitoring API Integration Tests
 * 
 * Tests the complete vertical slice of safety monitoring functionality with proper mocking.
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

vi.mock("@/src/services/risk/real-time-safety-monitoring-modules", () => ({
  RealTimeSafetyMonitoringService: {
    getInstance: vi.fn(() => mockSafetyService),
  },
}));

describe("FIXED: Safety Monitoring API Integration", () => {
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
  });

  describe("API Endpoint Connectivity", () => {
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
  });

  describe("Response Validation and Error Handling", () => {
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
          "POST with invalid JSON",
        );

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain("Invalid JSON");
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
          "GET /report with service error",
        );

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain("Service temporarily unavailable");
      },
      TEST_TIMEOUT,
    );
  });

  describe("Safety Monitoring Service Integration", () => {
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
          "POST /start_monitoring request",
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.message).toContain("started successfully");
        expect(mockSafetyService.startMonitoring).toHaveBeenCalled();
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
          "POST /emergency_response request",
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
  });

  describe("Advanced API Error Cases", () => {
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
          "POST with missing action",
        );

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain("Action is required");
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
          "POST /start_monitoring when active",
        );

        expect(response.status).toBe(409);
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain("already active");
      },
      TEST_TIMEOUT,
    );
  });
});