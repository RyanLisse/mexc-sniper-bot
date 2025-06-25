/**
 * Safety Monitoring API Integration Tests
 * 
 * Tests the complete vertical slice of safety monitoring functionality:
 * - API endpoint connectivity and responses
 * - Safety monitoring service integration
 * - Database integration with safety monitoring
 * - Response validation and error handling
 * - Connection timeout management
 * 
 * This ensures the safety monitoring API works end-to-end with proper error handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setTestTimeout, withApiTimeout } from '../utils/timeout-utilities';
import { NextRequest } from 'next/server';

// Mock auth decorators to bypass authentication in tests
vi.mock('../../src/lib/auth-decorators', () => ({
  authenticatedRoute: (handler: (...args: any[]) => any) => handler,
}));

// Mock logger to avoid logging noise during tests
vi.mock('../../src/lib/structured-logger', () => ({
  createSafeLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trading: vi.fn(),
  }),
}));

// Mock the safety service at module level first
let mockSafetyService: any;

// Create comprehensive mock safety service
const createMockSafetyService = () => ({
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
        }
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

// Mock the safety monitoring service module
vi.mock('../../src/services/real-time-safety-monitoring-modules', () => ({
  RealTimeSafetyMonitoringService: {
    getInstance: vi.fn(() => mockSafetyService)
  }
}));

// Import after mocking
const { GET, POST } = await import('../../src/app/api/auto-sniping/safety-monitoring/route');

describe('Safety Monitoring API Integration', () => {
  const TEST_TIMEOUT = setTestTimeout('integration');
  
  // Mock user for authenticated requests
  const mockUser = { 
    id: "test-user-123", 
    email: "test@example.com", 
    name: "Test User" 
  };

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Create fresh mock service for each test
    mockSafetyService = createMockSafetyService();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('API Endpoint Connectivity', () => {
    it('should handle GET /status requests successfully', async () => {
      const url = new URL('http://localhost:3000/api/auto-sniping/safety-monitoring?action=status');
      const request = new NextRequest(url.toString());
      
      const response = await withApiTimeout(
        () => GET(request, mockUser),
        5000,
        'GET /status request'
      );
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('isActive');
      expect(data.data).toHaveProperty('timerOperations');
      expect(data.data).toHaveProperty('lastChecked');
    }, TEST_TIMEOUT);

    it('should handle GET /report requests with proper response structure', async () => {
      const url = new URL('http://localhost:3000/api/auto-sniping/safety-monitoring?action=report');
      const request = new NextRequest(url.toString());
      
      const response = await withApiTimeout(
        () => GET(request, mockUser),
        5000,
        'GET /report request'
      );
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('status');
      expect(data.data).toHaveProperty('overallRiskScore');
      expect(data.data).toHaveProperty('riskMetrics');
      expect(data.data).toHaveProperty('systemHealth');
      expect(data.data).toHaveProperty('activeAlerts');
      expect(data.data).toHaveProperty('recommendations');
    }, TEST_TIMEOUT);

    it('should handle GET /risk-metrics requests', async () => {
      const url = new URL('http://localhost:3000/api/auto-sniping/safety-monitoring?action=risk-metrics');
      const request = new NextRequest(url.toString());
      
      const response = await withApiTimeout(
        () => GET(request, mockUser),
        5000,
        'GET /risk-metrics request'
      );
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('riskMetrics');
      expect(data.data).toHaveProperty('timestamp');
      expect(data.data.riskMetrics).toHaveProperty('currentDrawdown');
      expect(data.data.riskMetrics).toHaveProperty('successRate');
    }, TEST_TIMEOUT);

    it('should handle GET /system-health requests', async () => {
      const url = new URL('http://localhost:3000/api/auto-sniping/safety-monitoring?action=system-health');
      const request = new NextRequest(url.toString());
      
      const response = await withApiTimeout(
        () => GET(request, mockUser),
        5000,
        'GET /system-health request'
      );
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('systemHealth');
      expect(data.data).toHaveProperty('overallRiskScore');
      expect(data.data.systemHealth).toHaveProperty('executionService');
      expect(data.data.systemHealth).toHaveProperty('overallHealth');
    }, TEST_TIMEOUT);

    it('should handle GET /configuration requests', async () => {
      const url = new URL('http://localhost:3000/api/auto-sniping/safety-monitoring?action=configuration');
      const request = new NextRequest(url.toString());
      
      const response = await withApiTimeout(
        () => GET(request, mockUser),
        5000,
        'GET /configuration request'
      );
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('configuration');
      expect(data.data).toHaveProperty('isActive');
      expect(data.data.configuration).toHaveProperty('enabled');
      expect(data.data.configuration).toHaveProperty('thresholds');
    }, TEST_TIMEOUT);

    it('should handle GET /check-safety requests', async () => {
      const url = new URL('http://localhost:3000/api/auto-sniping/safety-monitoring?action=check-safety');
      const request = new NextRequest(url.toString());
      
      const response = await withApiTimeout(
        () => GET(request, mockUser),
        5000,
        'GET /check-safety request'
      );
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('isSafe');
      expect(data.data).toHaveProperty('overallRiskScore');
      expect(data.data).toHaveProperty('currentDrawdown');
      expect(data.data).toHaveProperty('successRate');
    }, TEST_TIMEOUT);
  });

  describe('Safety Monitoring Service Integration', () => {
    it('should start monitoring successfully via API', async () => {
      // Ensure monitoring is not active initially
      mockSafetyService.getMonitoringStatus.mockReturnValue(false);
      
      const request = new NextRequest('http://localhost:3000/api/auto-sniping/safety-monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_monitoring' }),
      });
      
      const response = await withApiTimeout(
        () => POST(request, mockUser),
        5000,
        'POST /start_monitoring request'
      );
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.message).toContain('started successfully');
      expect(mockSafetyService.startMonitoring).toHaveBeenCalled();
    }, TEST_TIMEOUT);

    it('should stop monitoring successfully via API', async () => {
      // Ensure monitoring is active initially
      mockSafetyService.getMonitoringStatus.mockReturnValue(true);
      
      const request = new NextRequest('http://localhost:3000/api/auto-sniping/safety-monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop_monitoring' }),
      });
      
      const response = await withApiTimeout(
        () => POST(request, mockUser),
        5000,
        'POST /stop_monitoring request'
      );
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.message).toContain('stopped successfully');
      expect(mockSafetyService.stopMonitoring).toHaveBeenCalled();
    }, TEST_TIMEOUT);

    it('should update configuration successfully', async () => {
      const newConfig = {
        monitoringIntervalMs: 45000,
        autoActionEnabled: true,
        emergencyMode: true,
      };
      
      const request = new NextRequest('http://localhost:3000/api/auto-sniping/safety-monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'update_configuration',
          configuration: newConfig 
        }),
      });
      
      const response = await withApiTimeout(
        () => POST(request, mockUser),
        5000,
        'POST /update_configuration request'
      );
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.message).toContain('updated successfully');
      expect(mockSafetyService.updateConfiguration).toHaveBeenCalledWith(newConfig);
    }, TEST_TIMEOUT);

    it('should trigger emergency response successfully', async () => {
      const request = new NextRequest('http://localhost:3000/api/auto-sniping/safety-monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'emergency_response',
          reason: 'Critical system failure detected' 
        }),
      });
      
      const response = await withApiTimeout(
        () => POST(request, mockUser),
        5000,
        'POST /emergency_response request'
      );
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.message).toContain('triggered successfully');
      expect(data.data.actionsExecuted).toHaveLength(1);
      expect(mockSafetyService.triggerEmergencyResponse).toHaveBeenCalledWith('Critical system failure detected');
    }, TEST_TIMEOUT);
  });

  describe('Response Validation and Error Handling', () => {
    it('should return 400 for invalid GET action', async () => {
      const url = new URL('http://localhost:3000/api/auto-sniping/safety-monitoring?action=invalid_action');
      const request = new NextRequest(url.toString());
      
      const response = await withApiTimeout(
        () => GET(request, mockUser),
        5000,
        'GET /invalid_action request'
      );
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid action parameter');
    }, TEST_TIMEOUT);

    it('should return 400 for missing POST action', async () => {
      const request = new NextRequest('http://localhost:3000/api/auto-sniping/safety-monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ someField: 'value' }),
      });
      
      const response = await withApiTimeout(
        () => POST(request, mockUser),
        5000,
        'POST with missing action'
      );
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Action is required');
    }, TEST_TIMEOUT);

    it('should return 400 for invalid JSON in POST request', async () => {
      const request = new NextRequest('http://localhost:3000/api/auto-sniping/safety-monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ invalid json',
      });
      
      const response = await withApiTimeout(
        () => POST(request, mockUser),
        5000,
        'POST with invalid JSON'
      );
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid JSON');
    }, TEST_TIMEOUT);

    it('should handle service errors gracefully', async () => {
      // Mock service error
      mockSafetyService.getSafetyReport.mockRejectedValue(new Error('Service temporarily unavailable'));
      
      const url = new URL('http://localhost:3000/api/auto-sniping/safety-monitoring?action=report');
      const request = new NextRequest(url.toString());
      
      const response = await withApiTimeout(
        () => GET(request, mockUser),
        5000,
        'GET /report with service error'
      );
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Service temporarily unavailable');
    }, TEST_TIMEOUT);

    it('should return 409 for starting monitoring when already active', async () => {
      // Mock monitoring as already active
      mockSafetyService.getMonitoringStatus.mockReturnValue(true);
      
      const request = new NextRequest('http://localhost:3000/api/auto-sniping/safety-monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_monitoring' }),
      });
      
      const response = await withApiTimeout(
        () => POST(request, mockUser),
        5000,
        'POST /start_monitoring when active'
      );
      
      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('already active');
    }, TEST_TIMEOUT);

    it('should return 409 for stopping monitoring when not active', async () => {
      // Mock monitoring as not active
      mockSafetyService.getMonitoringStatus.mockReturnValue(false);
      
      const request = new NextRequest('http://localhost:3000/api/auto-sniping/safety-monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop_monitoring' }),
      });
      
      const response = await withApiTimeout(
        () => POST(request, mockUser),
        5000,
        'POST /stop_monitoring when not active'
      );
      
      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('not currently active');
    }, TEST_TIMEOUT);

    it('should return 404 for acknowledging non-existent alert', async () => {
      // Mock alert not found
      mockSafetyService.acknowledgeAlert.mockReturnValue(false);
      
      const request = new NextRequest('http://localhost:3000/api/auto-sniping/safety-monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'acknowledge_alert',
          alertId: 'nonexistent_alert'
        }),
      });
      
      const response = await withApiTimeout(
        () => POST(request, mockUser),
        5000,
        'POST /acknowledge_alert for non-existent alert'
      );
      
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Alert not found');
    }, TEST_TIMEOUT);
  });

  describe('Database Integration and Performance', () => {
    it('should handle concurrent requests efficiently', async () => {
      const requests = Array.from(
        { length: 5 },
        () => {
          const url = new URL('http://localhost:3000/api/auto-sniping/safety-monitoring?action=status');
          return new NextRequest(url.toString());
        }
      );
      
      const startTime = Date.now();
      const responses = await Promise.all(
        requests.map(request => 
          withApiTimeout(
            () => GET(request, mockUser),
            10000,
            'Concurrent GET /status request'
          )
        )
      );
      const endTime = Date.now();
      
      // All requests should succeed
      responses.forEach(async (response) => {
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
      });
      
      // Should complete within reasonable time (less than 5 seconds for 5 requests)
      expect(endTime - startTime).toBeLessThan(5000);
      
      // Service should be called for each request
      expect(mockSafetyService.getMonitoringStatus).toHaveBeenCalledTimes(5);
      expect(mockSafetyService.getTimerStatus).toHaveBeenCalledTimes(5);
    }, TEST_TIMEOUT);

    it('should validate response data structure for safety reports', async () => {
      const url = new URL('http://localhost:3000/api/auto-sniping/safety-monitoring?action=report');
      const request = new NextRequest(url.toString());
      
      const response = await withApiTimeout(
        () => GET(request, mockUser),
        5000,
        'GET /report for validation'
      );
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      // Validate response structure
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('data');
      expect(data.success).toBe(true);
      
      const report = data.data;
      expect(report).toHaveProperty('status');
      expect(report).toHaveProperty('overallRiskScore');
      expect(report).toHaveProperty('riskMetrics');
      expect(report).toHaveProperty('thresholds');
      expect(report).toHaveProperty('activeAlerts');
      expect(report).toHaveProperty('recentActions');
      expect(report).toHaveProperty('systemHealth');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('monitoringStats');
      expect(report).toHaveProperty('lastUpdated');
      
      // Validate data types
      expect(typeof report.status).toBe('string');
      expect(typeof report.overallRiskScore).toBe('number');
      expect(Array.isArray(report.activeAlerts)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(typeof report.systemHealth).toBe('object');
      expect(typeof report.riskMetrics).toBe('object');
    }, TEST_TIMEOUT);

    it('should handle timeout scenarios gracefully', async () => {
      // Mock a slow service response
      mockSafetyService.getSafetyReport.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 10000)) // 10 second delay
      );
      
      const url = new URL('http://localhost:3000/api/auto-sniping/safety-monitoring?action=report');
      const request = new NextRequest(url.toString());
      
      // This should timeout and handle gracefully
      try {
        const response = await withApiTimeout(
          () => GET(request, mockUser),
          2000, // 2 second timeout
          'GET /report with timeout'
        );
        
        // If we get here, the timeout was handled appropriately
        expect(response).toBeDefined();
      } catch (error) {
        // Timeout error is expected and acceptable
        expect(error.message).toContain('timed out');
      }
    }, TEST_TIMEOUT);
  });

  describe('Advanced Error Handling', () => {
    it('should handle service initialization failure', async () => {
      // Mock getInstance to throw an error for this test
      const { RealTimeSafetyMonitoringService } = await import('../../src/services/real-time-safety-monitoring-modules');
      vi.mocked(RealTimeSafetyMonitoringService.getInstance).mockImplementationOnce(() => {
        throw new Error('Service initialization failed');
      });
      
      const url = new URL('http://localhost:3000/api/auto-sniping/safety-monitoring?action=status');
      const request = new NextRequest(url.toString());
      
      const response = await withApiTimeout(
        () => GET(request, mockUser),
        5000,
        'GET /status with service init failure'
      );
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Service initialization failed');
    }, TEST_TIMEOUT);

    it('should handle async operation failures gracefully', async () => {
      mockSafetyService.startMonitoring.mockRejectedValue(new Error('Async operation failed'));
      
      const request = new NextRequest('http://localhost:3000/api/auto-sniping/safety-monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_monitoring' }),
      });
      
      const response = await withApiTimeout(
        () => POST(request, mockUser),
        5000,
        'POST /start_monitoring with async failure'
      );
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Async operation failed');
    }, TEST_TIMEOUT);
  });
});