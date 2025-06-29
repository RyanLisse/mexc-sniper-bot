/**
 * Standardized Safety Monitoring Test Mocks
 * 
 * Provides consistent mocking utilities for all safety monitoring tests
 * to eliminate service initialization issues and ensure predictable test behavior.
 */

import { vi, expect } from "vitest";

/**
 * Create mock Core Trading Service
 */
export function createMockCoreTrading() {
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    getServiceStatus: vi.fn().mockResolvedValue({ 
      initialized: true, 
      status: "active",
      lastCheck: new Date().toISOString()
    }),
    getActivePositions: vi.fn().mockResolvedValue([]),
    stopExecution: vi.fn().mockResolvedValue(undefined),
    emergencyCloseAll: vi.fn().mockResolvedValue(0),
    isInitialized: vi.fn().mockReturnValue(true),
  };
}

/**
 * Create mock Emergency Safety System
 */
export function createMockEmergencySafetySystem() {
  return {
    performSystemHealthCheck: vi.fn().mockResolvedValue({
      status: "healthy",
      checks: {
        database: true,
        api: true,
        services: true,
      },
    }),
    triggerEmergency: vi.fn().mockResolvedValue([]),
  };
}

/**
 * Create mock Emergency Stop Coordinator
 */
export function createMockEmergencyStopCoordinator() {
  return {
    registerService: vi.fn().mockReturnValue(undefined),
    triggerEmergencyStop: vi.fn().mockResolvedValue({
      success: true,
      actionsExecuted: ["halt_trading", "close_positions"],
      coordinatedServices: ["core-trading", "safety-monitoring"],
      duration: 150,
      errors: [],
    }),
    getInstance: vi.fn().mockReturnThis(),
  };
}

/**
 * Create mock Pattern Monitoring Service
 */
export function createMockPatternMonitoringService() {
  return {
    getPatternStatus: vi.fn().mockReturnValue({ 
      active: true, 
      patterns: [],
      lastUpdate: new Date().toISOString()
    }),
    getInstance: vi.fn().mockReturnThis(),
  };
}

/**
 * Create mock MEXC Service
 */
export function createMockMexcService() {
  return {
    getAccountBalance: vi.fn().mockResolvedValue({ 
      balance: 10000,
      currency: "USDT",
      available: 10000,
    }),
    testConnection: vi.fn().mockResolvedValue(true),
  };
}

/**
 * Create comprehensive mock Safety Monitoring Service
 */
export function createMockSafetyMonitoringService() {
  return {
    getMonitoringStatus: vi.fn().mockReturnValue(false),
    startMonitoring: vi.fn().mockResolvedValue(undefined),
    stopMonitoring: vi.fn().mockReturnValue(undefined),
    updateConfiguration: vi.fn().mockReturnValue(undefined),
    getConfiguration: vi.fn().mockReturnValue({
      enabled: true,
      monitoringIntervalMs: 30000,
      riskCheckIntervalMs: 60000,
      autoActionEnabled: true,
      emergencyMode: false,
      alertRetentionHours: 24,
      thresholds: {
        maxDrawdownPercentage: 15,
        maxDailyLossPercentage: 10,
        maxPositionRiskPercentage: 5,
        maxPortfolioConcentration: 25,
        minSuccessRatePercentage: 70,
        maxConsecutiveLosses: 3,
        maxSlippagePercentage: 2,
        maxApiLatencyMs: 1000,
        minApiSuccessRate: 95,
        maxMemoryUsagePercentage: 80,
        minPatternConfidence: 75,
        maxPatternDetectionFailures: 5,
      },
    }),
    getRiskMetrics: vi.fn().mockReturnValue({
      currentDrawdown: 2.5,
      maxDrawdown: 5.0,
      portfolioValue: 10000,
      totalExposure: 1000,
      concentrationRisk: 15,
      successRate: 85,
      consecutiveLosses: 0,
      averageSlippage: 0.1,
      apiLatency: 150,
      apiSuccessRate: 98,
      memoryUsage: 45,
      patternAccuracy: 80,
      detectionFailures: 0,
      falsePositiveRate: 5,
    }),
    getSafetyReport: vi.fn().mockResolvedValue({
      status: "safe",
      overallRiskScore: 25,
      riskMetrics: {
        currentDrawdown: 2.5,
        maxDrawdown: 5.0,
        portfolioValue: 10000,
        totalExposure: 1000,
        concentrationRisk: 15,
        successRate: 85,
        consecutiveLosses: 0,
        averageSlippage: 0.1,
        apiLatency: 150,
        apiSuccessRate: 98,
        memoryUsage: 45,
        patternAccuracy: 80,
        detectionFailures: 0,
        falsePositiveRate: 5,
      },
      thresholds: {
        maxDrawdownPercentage: 15,
        maxDailyLossPercentage: 10,
        maxPositionRiskPercentage: 5,
        maxPortfolioConcentration: 25,
        minSuccessRatePercentage: 70,
        maxConsecutiveLosses: 3,
        maxSlippagePercentage: 2,
        maxApiLatencyMs: 1000,
        minApiSuccessRate: 95,
        maxMemoryUsagePercentage: 80,
        minPatternConfidence: 75,
        maxPatternDetectionFailures: 5,
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
      recommendations: [
        "System operating within normal parameters",
        "Continue monitoring for changes",
      ],
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
        id: "emergency_123",
        type: "halt_trading",
        description: "Emergency trading halt",
        executed: true,
        executedAt: new Date().toISOString(),
        result: "success",
      },
    ]),
    acknowledgeAlert: vi.fn().mockReturnValue(true),
    clearAcknowledgedAlerts: vi.fn().mockReturnValue(0),
    isSystemSafe: vi.fn().mockResolvedValue(true),
    calculateOverallRiskScore: vi.fn().mockReturnValue(25),
    performRiskAssessment: vi.fn().mockResolvedValue({
      overallRiskScore: 25,
      systemRisk: "low",
      portfolioRisk: "low",
      performanceRisk: "low",
      patternRisk: "low",
      priorityRecommendations: [
        "System operating within normal parameters",
      ],
    }),
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
  };
}

/**
 * Setup all safety monitoring mocks
 */
export function setupSafetyMonitoringMocks() {
  // Mock Core Trading Service
  vi.mock("@/src/services/trading/consolidated/core-trading/base-service", () => ({
    getCoreTrading: vi.fn(() => createMockCoreTrading()),
  }));

  // Mock Emergency Systems
  vi.mock("@/src/services/risk/emergency-safety-system", () => ({
    EmergencySafetySystem: vi.fn().mockImplementation(() => createMockEmergencySafetySystem()),
  }));

  vi.mock("@/src/services/risk/emergency-stop-coordinator", () => ({
    EmergencyStopCoordinator: {
      getInstance: vi.fn(() => createMockEmergencyStopCoordinator()),
    },
  }));

  // Mock Pattern Monitoring Service
  vi.mock("@/src/services/notification/pattern-monitoring-service", () => ({
    PatternMonitoringService: {
      getInstance: vi.fn(() => createMockPatternMonitoringService()),
    },
  }));

  // Mock MEXC Service
  vi.mock("@/src/services/api/unified-mexc-service-v2", () => ({
    UnifiedMexcServiceV2: vi.fn().mockImplementation(() => createMockMexcService()),
  }));

  // Mock Safety Monitoring Service
  vi.mock("@/src/services/risk/real-time-safety-monitoring-modules/index", () => ({
    RealTimeSafetyMonitoringService: {
      getInstance: vi.fn(() => createMockSafetyMonitoringService()),
    },
  }));

  // Mock API utilities
  vi.mock("@/src/lib/api-auth", () => ({
    apiAuthWrapper: vi.fn().mockImplementation((handler) => {
      return async (request: any, ...args: any[]) => {
        return await handler(request, ...args);
      };
    }),
  }));
}

/**
 * Create mock NextRequest for testing
 */
export function createMockRequest(
  method: "GET" | "POST" = "POST",
  body?: any,
  searchParams?: Record<string, string>
) {
  const url = new URL("http://localhost:3000/api/auto-sniping/safety-monitoring");
  
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  return new Request(url.toString(), {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Assert successful API response structure
 */
export function assertSuccessResponse(response: any, expectedData?: any) {
  expect(response.success).toBe(true);
  expect(response.data).toBeDefined();
  if (expectedData) {
    expect(response.data).toMatchObject(expectedData);
  }
  expect(response.meta?.timestamp).toBeDefined();
}

/**
 * Assert error API response structure
 */
export function assertErrorResponse(response: any, expectedError?: string | RegExp) {
  expect(response.success).toBe(false);
  expect(response.error).toBeDefined();
  if (expectedError) {
    if (typeof expectedError === "string") {
      expect(response.error).toContain(expectedError);
    } else {
      expect(response.error).toMatch(expectedError);
    }
  }
  expect(response.meta?.timestamp).toBeDefined();
}