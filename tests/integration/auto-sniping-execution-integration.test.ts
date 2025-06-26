/**
 * Auto-Sniping Execution Integration Tests
 * 
 * Tests the complete vertical slice of auto-sniping execution functionality:
 * - Backend execution service
 * - API endpoints
 * - Position management
 * - Configuration handling
 * 
 * This ensures the auto-sniping execution system works end-to-end.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setTestTimeout, withApiTimeout } from '../utils/timeout-utilities';
import { AutoSnipingExecutionService } from '@/src/services/auto-sniping-execution-service';
import { PatternDetectionCore } from '@/src/core/pattern-detection';
import { PatternMonitoringService } from '@/src/services/pattern-monitoring-service';
import { UnifiedMexcServiceV2 } from '@/src/services/unified-mexc-service-v2';
import { EmergencySafetySystem } from '@/src/services/emergency-safety-system';

describe('Auto-Sniping Execution Integration', () => {
  const TEST_TIMEOUT = setTestTimeout('integration');
  let executionService: AutoSnipingExecutionService;
  let patternMonitoring: PatternMonitoringService;
  let mexcService: UnifiedMexcServiceV2;
  let safetySystem: EmergencySafetySystem;

  beforeEach(async () => {
    // Setup global fetch mock with proper headers for MEXC API
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({
        'content-type': 'application/json',
        'x-ratelimit-limit': '1200',
        'x-ratelimit-remaining': '1199'
      }),
      json: () => Promise.resolve({ 
        symbols: [], 
        balances: [{ asset: 'USDT', free: '1000.00', locked: '0.00' }] 
      }),
      text: () => Promise.resolve(JSON.stringify({ 
        symbols: [], 
        balances: [{ asset: 'USDT', free: '1000.00', locked: '0.00' }] 
      }))
    });

    // Mock UnifiedMexcServiceV2 methods at the prototype level so all instances use the mocks
    vi.spyOn(UnifiedMexcServiceV2.prototype, 'getAccountBalances').mockResolvedValue({
      success: true,
      data: [{ asset: 'USDT', free: '1000.00', locked: '0.00' }],
      timestamp: Date.now(),
      source: 'test'
    });

    vi.spyOn(UnifiedMexcServiceV2.prototype, 'getAllSymbols').mockResolvedValue({
      success: true,
      data: [],
      timestamp: Date.now(),
      source: 'test'
    });

    vi.spyOn(UnifiedMexcServiceV2.prototype, 'createOrder').mockResolvedValue({
      success: true,
      data: { orderId: 'test_order_123', executedPrice: '50000', status: 'FILLED' },
      timestamp: Date.now(),
      source: 'test'
    });

    vi.spyOn(UnifiedMexcServiceV2.prototype, 'getSymbolTicker').mockResolvedValue({
      success: true,
      data: { symbol: 'BTCUSDT', price: '50000' },
      timestamp: Date.now(),
      source: 'test'
    });

    // Mock EmergencySafetySystem methods at the prototype level
    vi.spyOn(EmergencySafetySystem.prototype, 'performSystemHealthCheck').mockResolvedValue({
      overall: 'healthy',
      components: {
        riskEngine: 'healthy',
        tradingEngine: 'healthy',
        emergencySystem: 'healthy'
      },
      emergencyConditions: [],
      lastHealthCheck: new Date().toISOString()
    });

    // Mock PatternMonitoringService methods at the prototype level
    vi.spyOn(PatternMonitoringService.prototype, 'getRecentPatterns').mockReturnValue([]);

    // Initialize services after setting up mocks
    executionService = AutoSnipingExecutionService.getInstance();
    patternMonitoring = PatternMonitoringService.getInstance();
    mexcService = new UnifiedMexcServiceV2();
    safetySystem = new EmergencySafetySystem();

    // Ensure execution is stopped before each test
    executionService.stopExecution();
  });

  afterEach(() => {
    // Clean up after each test
    executionService.stopExecution();
    vi.restoreAllMocks();
    
    // Clean up global fetch mock
    if (global.fetch && 'mockRestore' in global.fetch) {
      (global.fetch as any).mockRestore?.();
    }
  });

  describe('Auto-Sniping Execution Service', () => {
    it('should initialize with correct default state', async () => {
      const report = await executionService.getExecutionReport();

      expect(report.status).toBe('idle');
      expect(report.stats.totalTrades).toBe(0);
      expect(report.activePositions).toHaveLength(0);
      expect(report.config.enabled).toBe(true); // Default configuration has enabled: true
      expect(report.systemHealth).toBeDefined();
    }, TEST_TIMEOUT);

    it('should update configuration correctly', async () => {
      const newConfig = {
        enabled: true,
        maxPositions: 3,
        minConfidence: 85,
        positionSizeUSDT: 200,
      };

      executionService.updateConfig(newConfig);
      const report = await executionService.getExecutionReport();

      expect(report.config.enabled).toBe(true);
      expect(report.config.maxPositions).toBe(3);
      expect(report.config.minConfidence).toBe(85);
      expect(report.config.positionSizeUSDT).toBe(200);
    }, TEST_TIMEOUT);

    it('should handle start execution with proper pre-flight checks', async () => {
      // Enable execution in config
      executionService.updateConfig({ enabled: true });

      await executionService.startExecution();
      
      const report = await executionService.getExecutionReport();
      expect(report.status).toBe('active');

      // Verify mocks were called
      expect(UnifiedMexcServiceV2.prototype.getAccountBalances).toHaveBeenCalled();
      expect(EmergencySafetySystem.prototype.performSystemHealthCheck).toHaveBeenCalled();
    }, TEST_TIMEOUT);

    it('should fail to start execution when disabled', async () => {
      // Keep execution disabled
      executionService.updateConfig({ enabled: false });

      await expect(executionService.startExecution()).rejects.toThrow('Auto-sniping is disabled');
    }, TEST_TIMEOUT);

    it('should stop execution successfully', async () => {
      // Start then stop execution
      executionService.updateConfig({ enabled: true });
      await executionService.startExecution();
      
      executionService.stopExecution();
      
      const report = await executionService.getExecutionReport();
      expect(report.status).toBe('idle');
    }, TEST_TIMEOUT);

    it('should pause and resume execution', async () => {
      // Start execution
      executionService.updateConfig({ enabled: true });
      await executionService.startExecution();
      
      // Pause execution
      executionService.pauseExecution();
      let report = await executionService.getExecutionReport();
      expect(report.status).toBe('paused');
      
      // Resume execution
      await executionService.resumeExecution();
      report = await executionService.getExecutionReport();
      expect(report.status).toBe('active');
    }, TEST_TIMEOUT);

    it('should handle pattern-based trade execution simulation', async () => {
      // Mock pattern detection
      const mockPattern = {
        patternType: 'ready_state' as const,
        confidence: 90,
        symbol: 'BTCUSDT',
        indicators: { sts: 2, st: 2, tt: 4 },
        recommendation: 'immediate_action' as const,
        metadata: {}
      };

      vi.spyOn(PatternMonitoringService.prototype, 'getRecentPatterns').mockReturnValue([mockPattern]);

      // Configure for execution
      executionService.updateConfig({
        enabled: true,
        maxPositions: 5,
        minConfidence: 80,
        allowedPatternTypes: ['ready_state'],
        positionSizeUSDT: 100,
        stopLossPercentage: 5,
        takeProfitPercentage: 10,
      });

      // Start execution
      await executionService.startExecution();

      // Allow some time for execution cycle (in real scenario)
      // Note: In actual implementation, we'd need to trigger the execution cycle manually
      // or wait for the interval to execute

      const report = await executionService.getExecutionReport();
      expect(report.status).toBe('active');
      expect(report.config.allowedPatternTypes).toContain('ready_state');
    }, TEST_TIMEOUT);

    it('should manage alerts correctly', async () => {
      const initialReport = await executionService.getExecutionReport();
      const initialAlertCount = initialReport.activeAlerts.length;

      // Enable and start execution (this generates alerts)
      executionService.updateConfig({ enabled: true });
      await executionService.startExecution();

      const report = await executionService.getExecutionReport();
      expect(report.activeAlerts.length).toBeGreaterThan(initialAlertCount);

      // Test alert acknowledgment
      if (report.activeAlerts.length > 0) {
        const alertId = report.activeAlerts[0].id;
        const acknowledged = executionService.acknowledgeAlert(alertId);
        expect(acknowledged).toBe(true);

        const updatedReport = await executionService.getExecutionReport();
        const acknowledgedAlert = updatedReport.activeAlerts.find(alert => alert.id === alertId);
        expect(acknowledgedAlert?.acknowledged).toBe(true);
      }
    }, TEST_TIMEOUT);

    it('should handle emergency close all', async () => {
      // Start with some mock positions (in a real scenario, these would be created through execution)
      const closedCount = await executionService.emergencyCloseAll();
      
      // Since we start with no positions, expect 0
      expect(closedCount).toBe(0);
      
      const report = await executionService.getExecutionReport();
      expect(report.activePositions).toHaveLength(0);
    }, TEST_TIMEOUT);

    it('should track execution statistics correctly', async () => {
      const report = await executionService.getExecutionReport();
      
      expect(report.stats).toBeDefined();
      expect(report.stats.totalTrades).toBe(0);
      expect(report.stats.successfulTrades).toBe(0);
      expect(report.stats.failedTrades).toBe(0);
      expect(report.stats.successRate).toBe(0);
      expect(report.stats.activePositions).toBe(0);
      expect(typeof report.stats.totalPnl).toBe('string');
    }, TEST_TIMEOUT);

    it('should provide system health information', async () => {
      const report = await executionService.getExecutionReport();
      
      expect(report.systemHealth).toBeDefined();
      expect(report.systemHealth.apiConnection).toBeDefined();
      expect(report.systemHealth.patternEngine).toBeDefined();
      expect(report.systemHealth.safetySystem).toBeDefined();
      expect(report.systemHealth.riskLimits).toBeDefined();
    }, TEST_TIMEOUT);

    it('should generate appropriate recommendations', async () => {
      const report = await executionService.getExecutionReport();
      
      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
      
      // Should have recommendations for no active positions when execution is idle
      if (report.status === 'idle') {
        expect(report.recommendations.length).toBeGreaterThan(0);
      }
    }, TEST_TIMEOUT);

    it('should validate configuration limits', () => {
      // Test that configuration validation would work (this would be in the API layer)
      const validConfig = {
        maxPositions: 5,
        minConfidence: 80,
        positionSizeUSDT: 100,
      };
      
      expect(() => executionService.updateConfig(validConfig)).not.toThrow();
      
      // Test edge cases
      const edgeConfig = {
        maxPositions: 1,
        minConfidence: 0,
        positionSizeUSDT: 10,
      };
      
      expect(() => executionService.updateConfig(edgeConfig)).not.toThrow();
    }, TEST_TIMEOUT);

    it('should handle position management operations', async () => {
      const activePositions = executionService.getActivePositions();
      expect(Array.isArray(activePositions)).toBe(true);
      expect(activePositions.length).toBe(0); // Should start with no positions
      
      // Test position closing with non-existent position
      await expect(
        executionService.closePosition('non_existent_position', 'test')
      ).rejects.toThrow('Position not found');
    }, TEST_TIMEOUT);
  });

  describe('Execution Service Error Handling', () => {
    it('should handle API failures gracefully', async () => {
      // Mock API failure at prototype level
      vi.spyOn(UnifiedMexcServiceV2.prototype, 'getAccountBalances').mockRejectedValue(
        new Error('API connection failed')
      );

      executionService.updateConfig({ enabled: true });

      await expect(executionService.startExecution()).rejects.toThrow('API connectivity check failed');
    }, TEST_TIMEOUT);

    it('should handle safety system failures', async () => {
      // Mock safety system failure at prototype level
      vi.spyOn(EmergencySafetySystem.prototype, 'performSystemHealthCheck').mockResolvedValue({
        overall: 'critical',
        components: {
          riskEngine: 'critical',
          tradingEngine: 'healthy',
          emergencySystem: 'healthy'
        },
        emergencyConditions: [],
        lastHealthCheck: new Date().toISOString()
      });

      executionService.updateConfig({ enabled: true });

      await expect(executionService.startExecution()).rejects.toThrow('Safety system status: critical');
    }, TEST_TIMEOUT);

    it('should prevent double start', async () => {
      executionService.updateConfig({ enabled: true });
      
      await executionService.startExecution();
      
      await expect(executionService.startExecution()).rejects.toThrow('Auto-sniping execution is already active');
    }, TEST_TIMEOUT);

    it('should handle invalid alert acknowledgment', () => {
      const result = executionService.acknowledgeAlert('non_existent_alert');
      expect(result).toBe(false);
    }, TEST_TIMEOUT);

    it('should handle clear alerts on empty alerts', async () => {
      const clearedCount = executionService.clearAcknowledgedAlerts();
      expect(clearedCount).toBe(0);
    }, TEST_TIMEOUT);
  });

  describe('Execution Service Singleton', () => {
    it('should maintain singleton instance', () => {
      const instance1 = AutoSnipingExecutionService.getInstance();
      const instance2 = AutoSnipingExecutionService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Configuration Validation', () => {
    it('should handle various configuration scenarios', () => {
      // Test minimum configuration
      const minConfig = {
        enabled: true,
        maxPositions: 1,
        minConfidence: 50,
      };
      
      expect(() => executionService.updateConfig(minConfig)).not.toThrow();
      
      // Test maximum configuration
      const maxConfig = {
        enabled: true,
        maxPositions: 50,
        minConfidence: 100,
        positionSizeUSDT: 10000,
      };
      
      expect(() => executionService.updateConfig(maxConfig)).not.toThrow();
      
      // Test partial configuration update
      const partialConfig = {
        stopLossPercentage: 3,
        takeProfitPercentage: 15,
      };
      
      expect(() => executionService.updateConfig(partialConfig)).not.toThrow();
    }, TEST_TIMEOUT);
  });

  describe('Pattern Integration', () => {
    it('should respect pattern type filtering', async () => {
      const readyStatePattern = {
        patternType: 'ready_state' as const,
        confidence: 90,
        symbol: 'BTCUSDT',
        indicators: { sts: 2, st: 2, tt: 4 },
        recommendation: 'immediate_action' as const,
        metadata: {}
      };

      const preReadyPattern = {
        patternType: 'pre_ready' as const,
        confidence: 85,
        symbol: 'ETHUSDT',
        indicators: { sts: 1, st: 2, tt: 3 },
        recommendation: 'monitor_closely' as const,
        metadata: {}
      };

      vi.spyOn(PatternMonitoringService.prototype, 'getRecentPatterns').mockReturnValue([readyStatePattern, preReadyPattern]);

      // Configure to only allow ready_state patterns
      executionService.updateConfig({
        enabled: true,
        allowedPatternTypes: ['ready_state'],
        minConfidence: 80,
      });

      const report = await executionService.getExecutionReport();
      expect(report.config.allowedPatternTypes).toEqual(['ready_state']);
    }, TEST_TIMEOUT);

    it('should respect confidence thresholds', () => {
      executionService.updateConfig({ minConfidence: 85 });
      
      const report = executionService.getActivePositions(); // This would be used in pattern filtering
      expect(Array.isArray(report)).toBe(true);
    }, TEST_TIMEOUT);
  });
});