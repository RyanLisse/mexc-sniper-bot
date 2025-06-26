/**
 * Pattern Monitoring Integration Tests
 * 
 * Tests the complete vertical slice of pattern monitoring functionality:
 * - Backend monitoring service
 * - API endpoints
 * - Frontend hook integration
 * 
 * This ensures the real-time pattern monitoring system works end-to-end.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setTestTimeout, withApiTimeout } from '../utils/timeout-utilities';
import { PatternMonitoringService } from '@/src/services/pattern-monitoring-service';
import { PatternDetectionCore } from '@/src/core/pattern-detection';
import { UnifiedMexcServiceV2 } from '@/src/services/unified-mexc-service-v2';

describe('Pattern Monitoring Integration', () => {
  const TEST_TIMEOUT = setTestTimeout('integration');
  let monitoringService: PatternMonitoringService;
  let patternEngine: PatternDetectionCore;
  let mexcService: UnifiedMexcServiceV2;

  beforeEach(async () => {
    // Clear singleton instances first to ensure fresh state
    (PatternMonitoringService as any).instance = undefined;
    (PatternDetectionCore as any).instance = undefined;

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
        timezone: 'UTC',
        serverTime: Date.now()
      }),
      text: () => Promise.resolve(JSON.stringify({ 
        symbols: [], 
        timezone: 'UTC',
        serverTime: Date.now()
      }))
    });

    // Mock UnifiedMexcServiceV2 methods at the prototype level
    vi.spyOn(UnifiedMexcServiceV2.prototype, 'getAllSymbols').mockResolvedValue({
      success: true,
      data: [
        {
          symbol: 'BTCUSDT',
          baseAsset: 'BTC',
          quoteAsset: 'USDT',
          status: 'TRADING',
          quoteOrderQtyMarketAllowed: true,
          baseAssetPrecision: 8,
          quotePrecision: 8,
          orderTypes: ['LIMIT', 'MARKET'],
          icebergAllowed: false,
          ocoAllowed: false,
          isSpotTradingAllowed: true,
          isMarginTradingAllowed: false,
          filters: []
        }
      ],
      timestamp: Date.now(),
      source: 'test-mock'
    });

    // Mock other methods that might be called during monitoring

    // Mock pattern detection methods to prevent errors
    vi.spyOn(PatternDetectionCore.prototype, 'detectReadyStatePattern').mockResolvedValue([]);
    vi.spyOn(PatternDetectionCore.prototype, 'detectAdvanceOpportunities').mockResolvedValue([]);

    // Initialize services after mocks are set up
    monitoringService = PatternMonitoringService.getInstance();
    patternEngine = PatternDetectionCore.getInstance();
    mexcService = new UnifiedMexcServiceV2();

    // Reset monitoring service state before each test
    monitoringService.resetState();
  });

  afterEach(() => {
    // Clean up after each test
    if (monitoringService && typeof monitoringService.resetState === 'function') {
      monitoringService.resetState();
    }
    vi.restoreAllMocks();
    
    // Clean up global fetch mock
    if (global.fetch && 'mockRestore' in global.fetch) {
      (global.fetch as any).mockRestore?.();
    }
  });

  describe('Pattern Monitoring Service', () => {
    it('should initialize with correct default state', async () => {
      const report = await monitoringService.getMonitoringReport();

      expect(report.status).toBe('healthy');
      expect(report.stats.totalPatternsDetected).toBe(0);
      expect(report.stats.engineStatus).toBe('idle');
      expect(report.activeAlerts).toHaveLength(0);
      expect(report.recentActivity).toHaveLength(0);
      expect(report.recommendations).toBeDefined();
    }, TEST_TIMEOUT);

    it('should start and stop monitoring successfully', async () => {
      // Start monitoring
      await monitoringService.startMonitoring();
      
      let report = await monitoringService.getMonitoringReport();
      expect(report.stats.engineStatus).toBe('active');

      // Stop monitoring
      monitoringService.stopMonitoring();
      
      report = await monitoringService.getMonitoringReport();
      expect(report.stats.engineStatus).toBe('idle');
    }, TEST_TIMEOUT);

    it('should perform manual pattern detection correctly', async () => {
      const mockSymbols = [
        {
          symbol: 'BTCUSDT',
          sts: 2,
          st: 2,
          tt: 4,
          price: '50000',
          volume: '1000'
        },
        {
          symbol: 'ETHUSDT',
          sts: 1,
          st: 2,
          tt: 3,
          price: '3000',
          volume: '500'
        }
      ];

      const mockPatterns = [
        {
          patternType: 'ready_state' as const,
          confidence: 85,
          symbol: 'BTCUSDT',
          indicators: { sts: 2, st: 2, tt: 4 },
          recommendation: 'immediate_action' as const,
          metadata: { source: 'test' },
          detectedAt: new Date(),
          advanceNoticeHours: 3.5,
          riskLevel: 'low' as const
        }
      ];

      // Mock pattern detection methods
      vi.spyOn(patternEngine, 'detectReadyStatePattern').mockResolvedValue(mockPatterns);
      vi.spyOn(patternEngine, 'detectPreReadyPatterns').mockResolvedValue([]);
      vi.spyOn(patternEngine, 'detectAdvanceOpportunities').mockResolvedValue([]);

      const result = await monitoringService.detectPatternsManually(mockSymbols);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        patternType: 'ready_state',
        confidence: 85,
        symbol: 'BTCUSDT'
      });

      // Check that stats were updated
      const report = await monitoringService.getMonitoringReport();
      expect(report.stats.totalPatternsDetected).toBe(1);
      expect(report.stats.readyStatePatterns).toBe(1);
      expect(report.stats.averageConfidence).toBeCloseTo(85);
    }, TEST_TIMEOUT);

    it('should track pattern statistics correctly', async () => {
      const mockSymbols = [{ symbol: 'BTCUSDT', sts: 2, st: 2, tt: 4, price: '50000', volume: '1000' }];
      
      const readyStatePattern = {
        patternType: 'ready_state' as const,
        confidence: 90,
        symbol: 'BTCUSDT',
        indicators: { sts: 2, st: 2, tt: 4 },
        recommendation: 'immediate_action' as const,
        metadata: {},
        detectedAt: new Date(),
        advanceNoticeHours: 4.0,
        riskLevel: 'low' as const
      };

      const preReadyPattern = {
        patternType: 'pre_ready' as const,
        confidence: 70,
        symbol: 'ETHUSDT',
        indicators: { sts: 1, st: 2, tt: 3 },
        recommendation: 'monitor_closely' as const,
        metadata: {},
        detectedAt: new Date(),
        advanceNoticeHours: 6.0,
        riskLevel: 'medium' as const
      };

      // First detection with ready state pattern
      vi.spyOn(patternEngine, 'detectReadyStatePattern').mockResolvedValueOnce([readyStatePattern]);
      vi.spyOn(patternEngine, 'detectPreReadyPatterns').mockResolvedValueOnce([]);
      vi.spyOn(patternEngine, 'detectAdvanceOpportunities').mockResolvedValueOnce([]);

      await monitoringService.detectPatternsManually(mockSymbols);

      // Second detection with pre-ready pattern
      vi.spyOn(patternEngine, 'detectReadyStatePattern').mockResolvedValueOnce([]);
      vi.spyOn(patternEngine, 'detectPreReadyPatterns').mockResolvedValueOnce([preReadyPattern]);
      vi.spyOn(patternEngine, 'detectAdvanceOpportunities').mockResolvedValueOnce([]);

      await monitoringService.detectPatternsManually(mockSymbols);

      const report = await monitoringService.getMonitoringReport();
      expect(report.stats.totalPatternsDetected).toBe(2);
      expect(report.stats.readyStatePatterns).toBe(1);
      expect(report.stats.preReadyPatterns).toBe(1);
      expect(report.stats.averageConfidence).toBeCloseTo(80); // (90 + 70) / 2
    }, TEST_TIMEOUT);

    it('should generate alerts for high confidence patterns', async () => {
      const mockSymbols = [{ symbol: 'BTCUSDT', sts: 2, st: 2, tt: 4, price: '50000', volume: '1000' }];
      
      const highConfidencePattern = {
        patternType: 'ready_state' as const,
        confidence: 95, // Above threshold (80)
        symbol: 'BTCUSDT',
        indicators: { sts: 2, st: 2, tt: 4 },
        recommendation: 'immediate_action' as const,
        metadata: {},
        detectedAt: new Date(),
        advanceNoticeHours: 2.5,
        riskLevel: 'low' as const
      };

      vi.spyOn(patternEngine, 'detectReadyStatePattern').mockResolvedValue([highConfidencePattern]);
      vi.spyOn(patternEngine, 'detectPreReadyPatterns').mockResolvedValue([]);
      vi.spyOn(patternEngine, 'detectAdvanceOpportunities').mockResolvedValue([]);

      await monitoringService.detectPatternsManually(mockSymbols);

      const report = await monitoringService.getMonitoringReport();
      expect(report.activeAlerts.length).toBeGreaterThan(0);
      
      const highConfidenceAlert = report.activeAlerts.find(alert => 
        alert.type === 'high_confidence_ready'
      );
      expect(highConfidenceAlert).toBeDefined();
      expect(highConfidenceAlert?.severity).toBe('high');
      expect(highConfidenceAlert?.acknowledged).toBe(false);
    }, TEST_TIMEOUT);

    it('should manage alerts correctly', async () => {
      const mockSymbols = [{ symbol: 'BTCUSDT', sts: 2, st: 2, tt: 4, price: '50000', volume: '1000' }];
      
      const highConfidencePattern = {
        patternType: 'ready_state' as const,
        confidence: 90,
        symbol: 'BTCUSDT',
        indicators: { sts: 2, st: 2, tt: 4 },
        recommendation: 'immediate_action' as const,
        metadata: {},
        detectedAt: new Date(),
        advanceNoticeHours: 3.0,
        riskLevel: 'low' as const
      };

      vi.spyOn(patternEngine, 'detectReadyStatePattern').mockResolvedValue([highConfidencePattern]);
      vi.spyOn(patternEngine, 'detectPreReadyPatterns').mockResolvedValue([]);
      vi.spyOn(patternEngine, 'detectAdvanceOpportunities').mockResolvedValue([]);

      // Generate alert
      await monitoringService.detectPatternsManually(mockSymbols);

      let report = await monitoringService.getMonitoringReport();
      expect(report.activeAlerts.length).toBeGreaterThan(0);
      
      const alertId = report.activeAlerts[0].id;
      
      // Acknowledge alert
      const acknowledged = monitoringService.acknowledgeAlert(alertId);
      expect(acknowledged).toBe(true);

      report = await monitoringService.getMonitoringReport();
      const acknowledgedAlert = report.activeAlerts.find(alert => alert.id === alertId);
      expect(acknowledgedAlert?.acknowledged).toBe(true);

      // Clear acknowledged alerts
      const clearedCount = monitoringService.clearAcknowledgedAlerts();
      expect(clearedCount).toBeGreaterThan(0);

      report = await monitoringService.getMonitoringReport();
      expect(report.activeAlerts.length).toBe(0);
    }, TEST_TIMEOUT);

    it('should handle errors gracefully', async () => {
      const mockSymbols = [{ symbol: 'BTCUSDT', sts: 2, st: 2, tt: 4, price: '50000', volume: '1000' }];

      // Mock pattern detection to throw error
      vi.spyOn(patternEngine, 'detectReadyStatePattern').mockRejectedValue(
        new Error('Pattern detection failed')
      );

      await expect(
        monitoringService.detectPatternsManually(mockSymbols)
      ).rejects.toThrow('Pattern detection failed');

      const report = await monitoringService.getMonitoringReport();
      expect(report.stats.consecutiveErrors).toBe(1);
    }, TEST_TIMEOUT);

    it('should provide recent patterns correctly', async () => {
      const mockSymbols = [{ symbol: 'BTCUSDT', sts: 2, st: 2, tt: 4, price: '50000', volume: '1000' }];
      
      const patterns = [
        {
          patternType: 'ready_state' as const,
          confidence: 85,
          symbol: 'BTCUSDT',
          indicators: { sts: 2, st: 2, tt: 4 },
          recommendation: 'immediate_action' as const,
          metadata: {},
          detectedAt: new Date(),
          advanceNoticeHours: 3.5,
          riskLevel: 'low' as const
        },
        {
          patternType: 'pre_ready' as const,
          confidence: 75,
          symbol: 'ETHUSDT',
          indicators: { sts: 1, st: 2, tt: 3 },
          recommendation: 'monitor_closely' as const,
          metadata: {},
          detectedAt: new Date(),
          advanceNoticeHours: 5.0,
          riskLevel: 'medium' as const
        }
      ];

      vi.spyOn(patternEngine, 'detectReadyStatePattern').mockResolvedValue([patterns[0]]);
      vi.spyOn(patternEngine, 'detectPreReadyPatterns').mockResolvedValue([patterns[1]]);
      vi.spyOn(patternEngine, 'detectAdvanceOpportunities').mockResolvedValue([]);

      await monitoringService.detectPatternsManually(mockSymbols);

      const recentPatterns = monitoringService.getRecentPatterns(10);
      expect(recentPatterns).toHaveLength(2);
      expect(recentPatterns[0]).toMatchObject({
        patternType: 'ready_state',
        confidence: 85,
        symbol: 'BTCUSDT'
      });
      expect(recentPatterns[1]).toMatchObject({
        patternType: 'pre_ready',
        confidence: 75,
        symbol: 'ETHUSDT'
      });
    }, TEST_TIMEOUT);
  });

  describe('Pattern Monitoring Performance', () => {
    it('should track processing time correctly', async () => {
      const mockSymbols = [{ symbol: 'BTCUSDT', sts: 2, st: 2, tt: 4, price: '50000', volume: '1000' }];

      // Mock pattern detection with delay
      vi.spyOn(patternEngine, 'detectReadyStatePattern').mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
        return [];
      });
      vi.spyOn(patternEngine, 'detectPreReadyPatterns').mockResolvedValue([]);
      vi.spyOn(patternEngine, 'detectAdvanceOpportunities').mockResolvedValue([]);

      await monitoringService.detectPatternsManually(mockSymbols);

      const report = await monitoringService.getMonitoringReport();
      expect(report.stats.avgProcessingTime).toBeGreaterThan(0);
      expect(report.stats.avgProcessingTime).toBeLessThan(1000); // Should be reasonable
    }, TEST_TIMEOUT);

    it('should generate appropriate recommendations', async () => {
      // Get initial report with no activity
      let report = await monitoringService.getMonitoringReport();
      
      expect(report.recommendations).toBeDefined();
      expect(report.recommendations.length).toBeGreaterThan(0);
      
      // Should include low detection rate recommendation initially (detectionRate = 0 < 1)
      expect(report.recommendations.some(rec => 
        rec.toLowerCase().includes('detection rate')
      )).toBe(true);
    }, TEST_TIMEOUT);
  });

  describe('Monitoring Service Singleton', () => {
    it('should maintain singleton instance', () => {
      const instance1 = PatternMonitoringService.getInstance();
      const instance2 = PatternMonitoringService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });
});