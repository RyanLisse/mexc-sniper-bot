/**
 * API Test Mock Configuration Utilities
 * 
 * Provides proper mock configurations for API endpoints to prevent
 * service initialization errors and ensure consistent test behavior.
 */

import { vi } from "vitest";

// Mock Core Trading Service with proper initialization handling
export const createMockCoreTrading = () => ({
  initialize: vi.fn().mockResolvedValue({ success: true }),
  getActivePositions: vi.fn().mockResolvedValue([]),
  getServiceStatus: vi.fn().mockResolvedValue({
    isHealthy: true,
    isConnected: true,
    isAuthenticated: true,
    tradingEnabled: true,
    autoSnipingEnabled: false,
    paperTradingMode: true,
    activePositions: 0,
    maxPositions: 10,
    availableCapacity: 1.0,
    circuitBreakerOpen: false,
    circuitBreakerFailures: 0,
    currentRiskLevel: "low",
    dailyPnL: 0,
    dailyVolume: 0,
    uptime: 3600000,
    lastHealthCheck: new Date(),
    version: "2.0.0",
  }),
  stopExecution: vi.fn().mockResolvedValue({ success: true }),
  emergencyCloseAll: vi.fn().mockResolvedValue({ success: true, data: { closedCount: 0 } }),
  shutdown: vi.fn().mockResolvedValue({ success: true }),
});

// Mock Safety Monitoring Service with comprehensive methods
export const createMockSafetyService = () => ({
  // Core monitoring methods
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

  // Configuration methods
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

  // Risk assessment methods
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

  // Report and alert methods
  getSafetyReport: vi.fn().mockResolvedValue({
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

  // Emergency and alert methods
  triggerEmergencyResponse: vi.fn().mockResolvedValue([
    {
      id: "halt_123",
      type: "halt_trading" as const,
      description: "Emergency trading halt",
      executed: true,
      executedAt: new Date().toISOString(),
      result: "success" as const,
    },
  ]),
  acknowledgeAlert: vi.fn().mockReturnValue(true),
  clearAcknowledgedAlerts: vi.fn().mockReturnValue(5),
});

// Mock Pattern Monitoring Service
export const createMockPatternMonitoring = () => ({
  getInstance: vi.fn(() => ({
    isPatternDetectionActive: vi.fn().mockReturnValue(true),
    getPatternStats: vi.fn().mockReturnValue({
      activePatterns: 0,
      successRate: 85,
      averageConfidence: 78,
    }),
  })),
});

// Mock Emergency System
export const createMockEmergencySystem = () => ({
  performSystemHealthCheck: vi.fn().mockResolvedValue(undefined),
  isEmergencyActive: vi.fn().mockReturnValue(false),
  triggerEmergency: vi.fn().mockResolvedValue(undefined),
});

// Mock MEXC Service
export const createMockMexcService = () => ({
  getTicker: vi.fn().mockResolvedValue({
    success: true,
    data: {
      symbol: "TESTUSDT",
      price: "1.0000",
      lastPrice: "1.0000",
      priceChange: "0.0500",
      priceChangePercent: "5.0",
    },
  }),
  getAccountBalance: vi.fn().mockResolvedValue({
    success: true,
    data: {
      balances: [
        { asset: "USDT", free: "1000.00", locked: "0.00" },
      ],
    },
  }),
  isConnected: vi.fn().mockReturnValue(true),
  checkConnectivity: vi.fn().mockResolvedValue(true),
  getOrderBook: vi.fn().mockResolvedValue({
    success: true,
    data: {
      symbol: 'BTCUSDT',
      bids: [
        ['45000.00', '1.5'],
        ['44995.00', '2.0'],
        ['44990.00', '0.8'],
      ],
      asks: [
        ['45005.00', '1.2'],
        ['45010.00', '3.0'],
        ['45015.00', '0.5'],
      ],
      timestamp: Date.now(),
    },
    timestamp: Date.now(),
  }),
  getOrderBookDepth: vi.fn().mockResolvedValue({
    success: true,
    data: {
      symbol: 'BTCUSDT',
      bids: [
        ['45000.00', '1.5'],
        ['44995.00', '2.0'],
        ['44990.00', '0.8'],
      ],
      asks: [
        ['45005.00', '1.2'],
        ['45010.00', '3.0'],
        ['45015.00', '0.5'],
      ],
      timestamp: Date.now(),
    },
    timestamp: Date.now(),
  }),
});

/**
 * Setup comprehensive mocks for safety monitoring API tests
 */
export function setupSafetyMonitoringMocks() {
  const mockCoreTrading = createMockCoreTrading();
  const mockSafetyService = createMockSafetyService();
  const mockPatternMonitoring = createMockPatternMonitoring();
  const mockEmergencySystem = createMockEmergencySystem();
  const mockMexcService = createMockMexcService();

  // Mock Core Trading Service
  vi.mock("@/src/services/trading/consolidated/core-trading/base-service", () => ({
    getCoreTrading: vi.fn(() => mockCoreTrading),
    resetCoreTrading: vi.fn(),
    createCoreTrading: vi.fn(() => mockCoreTrading),
    CoreTradingService: vi.fn(() => mockCoreTrading),
  }));

  // Mock Safety Monitoring Service
  vi.mock("@/src/services/risk/real-time-safety-monitoring-modules", () => ({
    RealTimeSafetyMonitoringService: {
      getInstance: vi.fn(() => mockSafetyService),
    },
    createRealTimeSafetyMonitoringService: vi.fn(() => mockSafetyService),
  }));

  // Mock Pattern Monitoring Service
  vi.mock("@/src/services/notification/pattern-monitoring-service", () => ({
    PatternMonitoringService: mockPatternMonitoring,
  }));

  // Mock Emergency Safety System
  vi.mock("@/src/services/risk/emergency-safety-system", () => ({
    EmergencySafetySystem: vi.fn(() => mockEmergencySystem),
  }));

  // Mock Emergency Stop Coordinator
  vi.mock("@/src/services/risk/emergency-stop-coordinator", () => ({
    EmergencyStopCoordinator: {
      getInstance: vi.fn(() => ({
        registerService: vi.fn(),
        triggerEmergencyStop: vi.fn().mockResolvedValue({
          success: true,
          actionsExecuted: ["trading_halt", "position_close"],
          coordinatedServices: ["core-trading", "safety-monitoring"],
          errors: [],
          duration: 150,
        }),
      })),
    },
  }));

  // Mock MEXC Service
  vi.mock("@/src/services/api/unified-mexc-service-v2", () => ({
    UnifiedMexcServiceV2: vi.fn(() => mockMexcService),
  }));

  // Mock API Authentication
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

  // Mock Structured Logger
  vi.mock("@/src/lib/structured-logger", () => ({
    createSafeLogger: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      trading: vi.fn(),
    }),
  }));

  return {
    mockCoreTrading,
    mockSafetyService,
    mockPatternMonitoring,
    mockEmergencySystem,
    mockMexcService,
  };
}

/**
 * Setup mocks for service integration tests to prevent Core Trading Service errors
 */
export function setupServiceIntegrationMocks() {
  const mockCoreTrading = createMockCoreTrading();

  // Mock Core Trading Service to prevent initialization errors
  vi.mock("@/src/services/trading/consolidated/core-trading/base-service", () => ({
    getCoreTrading: vi.fn(() => mockCoreTrading),
    resetCoreTrading: vi.fn(),
    createCoreTrading: vi.fn(() => mockCoreTrading),
    CoreTradingService: vi.fn(() => mockCoreTrading),
  }));

  // Mock confidence calculator that was failing
  vi.mock("@/src/services/data/modules/confidence-calculator", () => ({
    calculateConfidence: vi.fn().mockReturnValue({ 
      success: true, 
      confidence: 85, 
      historicalData: [] 
    }),
    getHistoricalSuccessData: vi.fn().mockResolvedValue([]),
  }));

  return { mockCoreTrading };
}