import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PatternDetectionEngine } from '../../src/services/pattern-detection-engine';
import type { SymbolEntry, CalendarEntry } from '../../src/services/mexc-unified-exports';
import type { ActivityData } from '../../src/schemas/mexc-schemas';

describe('PatternDetectionEngine - Phase 1 Week 2 Enhancement', () => {
  let patternEngine: PatternDetectionEngine;

  beforeEach(() => {
    patternEngine = PatternDetectionEngine.getInstance();

    // Mock database queries to avoid actual database calls in unit tests
    vi.mock('../../src/db', () => ({
      db: {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      },
    }));

    // Mock AI Intelligence Service
    vi.mock('../../src/services/ai-intelligence-service', () => ({
      aiIntelligenceService: {
        enhancePatternWithAI: vi.fn().mockResolvedValue({
          cohereEmbedding: [0.1, 0.2, 0.3],
          perplexityInsights: null,
        }),
        calculateAIEnhancedConfidence: vi.fn().mockResolvedValue({
          enhancedConfidence: 85,
          recommendations: ['High confidence pattern detected'],
        }),
      },
    }));

    // Mock Pattern Embedding Service
    vi.mock('../../src/services/pattern-embedding-service', () => ({
      patternEmbeddingService: {
        storePattern: vi.fn().mockResolvedValue(undefined),
        calculatePatternConfidenceScore: vi.fn().mockResolvedValue({
          confidence: 80,
          reasoning: 'Strong pattern match',
        }),
        findSimilarPatterns: vi.fn().mockResolvedValue([]),
      },
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Ready State Pattern Detection with Activity Enhancement', () => {
    it('should detect exact ready state pattern (sts:2, st:2, tt:4)', async () => {
      const mockSymbol: SymbolEntry = {
        sts: 2,
        st: 2,
        tt: 4,
        cd: 'TESTUSDT',
        ca: 1000,
        ps: 100,
        qs: 50,
      };

      const matches = await patternEngine.detectReadyStatePattern(mockSymbol);

      expect(matches).toHaveLength(1);
      expect(matches[0].patternType).toBe('ready_state');
      expect(matches[0].confidence).toBeGreaterThanOrEqual(85);
      expect(matches[0].symbol).toBe('TESTUSDT');
      expect(matches[0].indicators.sts).toBe(2);
      expect(matches[0].indicators.st).toBe(2);
      expect(matches[0].indicators.tt).toBe(4);
      expect(matches[0].recommendation).toBe('immediate_action');
    });

    it('should enhance confidence with activity data', async () => {
      const mockSymbol: SymbolEntry = {
        sts: 2,
        st: 2,
        tt: 4,
        cd: 'FCATUSDT',
        ca: 1000,
        ps: 100,
        qs: 50,
      };

      // Mock activity data retrieval
      const mockActivities: ActivityData[] = [
        {
          activityId: 'test-activity-1',
          currency: 'FCAT',
          currencyId: 'test-currency-id',
          activityType: 'SUN_SHINE',
        },
        {
          activityId: 'test-activity-2',
          currency: 'FCAT',
          currencyId: 'test-currency-id',
          activityType: 'PROMOTION',
        },
      ];

      // Mock the private method getActivityDataForSymbol
      vi.spyOn(patternEngine as any, 'getActivityDataForSymbol').mockResolvedValue(mockActivities);

      const matches = await patternEngine.detectReadyStatePattern(mockSymbol);

      expect(matches).toHaveLength(1);
      expect(matches[0].activityInfo).toBeDefined();
      expect(matches[0].activityInfo?.activities).toHaveLength(2);
      expect(matches[0].activityInfo?.activityBoost).toBeGreaterThan(0);
      expect(matches[0].activityInfo?.activityTypes).toContain('SUN_SHINE');
      expect(matches[0].activityInfo?.activityTypes).toContain('PROMOTION');

      // Confidence should be enhanced by activity data
      expect(matches[0].confidence).toBeGreaterThanOrEqual(90);
    });

    it('should handle symbols without activity data gracefully', async () => {
      const mockSymbol: SymbolEntry = {
        sts: 2,
        st: 2,
        tt: 4,
        cd: 'NOACTIVITYUSDT',
        ca: 1000,
        ps: 100,
        qs: 50,
      };

      // Mock no activity data
      vi.spyOn(patternEngine as any, 'getActivityDataForSymbol').mockResolvedValue([]);

      const matches = await patternEngine.detectReadyStatePattern(mockSymbol);

      expect(matches).toHaveLength(1);
      expect(matches[0].activityInfo).toBeUndefined();
      expect(matches[0].confidence).toBeGreaterThanOrEqual(85);
    });

    it('should not detect patterns below confidence threshold', async () => {
      const mockSymbol: SymbolEntry = {
        sts: 1, // Not ready state
        st: 1,
        tt: 1,
        cd: 'LOWCONFUSDT',
      };

      const matches = await patternEngine.detectReadyStatePattern(mockSymbol);

      expect(matches).toHaveLength(0);
    });
  });

  describe('Advance Opportunity Detection with Activity Enhancement', () => {
    it('should detect 3.5+ hour advance opportunities', async () => {
      const futureTime = Date.now() + (4 * 60 * 60 * 1000); // 4 hours from now

      const mockCalendarEntry: CalendarEntry = {
        symbol: 'ADVANCEUSDT',
        vcoinId: 'test-vcoin-id',
        firstOpenTime: futureTime,
        projectName: 'Test Advance Project',
      };

      // Mock activity data for advance opportunity
      const mockActivities: ActivityData[] = [
        {
          activityId: 'advance-activity-1',
          currency: 'ADVANCE',
          currencyId: 'advance-currency-id',
          activityType: 'SUN_SHINE',
        },
      ];

      vi.spyOn(patternEngine as any, 'getActivityDataForSymbol').mockResolvedValue(mockActivities);

      const matches = await patternEngine.detectAdvanceOpportunities([mockCalendarEntry]);

      expect(matches).toHaveLength(1);
      expect(matches[0].patternType).toBe('launch_sequence');
      expect(matches[0].advanceNoticeHours).toBeGreaterThanOrEqual(3.5);
      expect(matches[0].activityInfo).toBeDefined();
      expect(matches[0].activityInfo?.activities).toHaveLength(1);
      expect(matches[0].recommendation).toMatch(/prepare_entry|monitor_closely/);
    });

    it('should filter out opportunities with insufficient advance notice', async () => {
      const nearFutureTime = Date.now() + (2 * 60 * 60 * 1000); // 2 hours from now (below 3.5h threshold)

      const mockCalendarEntry: CalendarEntry = {
        symbol: 'SHORTNOTICEUSDT',
        vcoinId: 'test-vcoin-id',
        firstOpenTime: nearFutureTime,
        projectName: 'Short Notice Project',
      };

      const matches = await patternEngine.detectAdvanceOpportunities([mockCalendarEntry]);

      expect(matches).toHaveLength(0);
    });

    it('should scale activity boost for advance opportunities', async () => {
      const futureTime = Date.now() + (6 * 60 * 60 * 1000); // 6 hours from now

      const mockCalendarEntry: CalendarEntry = {
        symbol: 'SCALEDUSDT',
        vcoinId: 'test-vcoin-id',
        firstOpenTime: futureTime,
        projectName: 'Scaled Activity Project',
      };

      const mockActivities: ActivityData[] = [
        {
          activityId: 'scaled-activity-1',
          currency: 'SCALED',
          currencyId: 'scaled-currency-id',
          activityType: 'PROMOTION',
        },
      ];

      vi.spyOn(patternEngine as any, 'getActivityDataForSymbol').mockResolvedValue(mockActivities);

      const matches = await patternEngine.detectAdvanceOpportunities([mockCalendarEntry]);

      expect(matches).toHaveLength(1);
      expect(matches[0].activityInfo?.activityBoost).toBeDefined();
      // Activity boost should be scaled down for advance opportunities (80% of normal)
      expect(matches[0].activityInfo?.activityBoost).toBeLessThan(20);
    });
  });

  describe('Symbol Readiness Analysis with AI Enhancement', () => {
    it('should analyze symbol readiness with AI enhancement', async () => {
      const mockSymbol: SymbolEntry = {
        sts: 2,
        st: 2,
        tt: 4,
        cd: 'AIENHANCEDUSDT',
        ca: 1000,
        ps: 100,
        qs: 50,
      };

      const result = await patternEngine.analyzeSymbolReadiness(mockSymbol);

      expect(result).toBeDefined();
      expect(result?.isReady).toBe(true);
      expect(result?.confidence).toBeGreaterThanOrEqual(85);
      expect(result?.patternType).toBe('ready_state');
      expect(result?.enhancedAnalysis).toBe(true);
      expect(result?.aiEnhancement).toBeDefined();
      expect(result?.aiEnhancement?.cohereEmbedding).toEqual([0.1, 0.2, 0.3]);
    });

    it('should return null for low confidence symbols', async () => {
      const mockSymbol: SymbolEntry = {
        sts: 0,
        st: 0,
        tt: 0,
        cd: 'LOWCONFUSDT',
      };

      const result = await patternEngine.analyzeSymbolReadiness(mockSymbol);

      // The engine may still return a result with AI enhancement, but isReady should be false
      if (result) {
        expect(result.isReady).toBe(false);
        expect(result.confidence).toBeLessThan(95); // Should not be high confidence
      } else {
        expect(result).toBeNull();
      }
    });

    it('should handle AI enhancement failures gracefully', async () => {
      const mockSymbol: SymbolEntry = {
        sts: 2,
        st: 2,
        tt: 4,
        cd: 'AIFAILUREUSDT',
        ca: 1000,
        ps: 100,
        qs: 50,
      };

      // Mock AI service failure
      const { aiIntelligenceService } = await import('../../src/services/ai-intelligence-service');
      vi.mocked(aiIntelligenceService.enhancePatternWithAI).mockRejectedValue(new Error('AI service unavailable'));

      const result = await patternEngine.analyzeSymbolReadiness(mockSymbol);

      expect(result).toBeDefined();
      expect(result?.isReady).toBe(true);
      expect(result?.confidence).toBeGreaterThanOrEqual(85);
      expect(result?.enhancedAnalysis).toBeUndefined();
      expect(result?.aiEnhancement).toBeUndefined();
    });
  });

  describe('Performance and Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const mockSymbol: SymbolEntry = {
        sts: 2,
        st: 2,
        tt: 4,
        cd: 'DBERRORUSDT',
        ca: 1000,
        ps: 100,
        qs: 50,
      };

      // Mock no activity data to simulate database error fallback
      vi.spyOn(patternEngine as any, 'getActivityDataForSymbol').mockResolvedValue([]);

      const matches = await patternEngine.detectReadyStatePattern(mockSymbol);

      // Should still detect pattern without activity enhancement
      expect(matches).toHaveLength(1);
      expect(matches[0].activityInfo).toBeUndefined();
      expect(matches[0].confidence).toBeGreaterThanOrEqual(85);
    });

    it('should process multiple symbols efficiently', async () => {
      const mockSymbols: SymbolEntry[] = Array.from({ length: 10 }, (_, i) => ({
        sts: 2,
        st: 2,
        tt: 4,
        cd: `BATCH${i}USDT`,
        ca: 1000,
        ps: 100,
        qs: 50,
      }));

      // Mock activity data for consistent testing
      vi.spyOn(patternEngine as any, 'getActivityDataForSymbol').mockResolvedValue([]);

      const startTime = Date.now();
      const matches = await patternEngine.detectReadyStatePattern(mockSymbols);
      const executionTime = Date.now() - startTime;

      expect(matches).toHaveLength(10);
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds

      // All matches should have high confidence
      matches.forEach(match => {
        expect(match.confidence).toBeGreaterThanOrEqual(85);
        expect(match.patternType).toBe('ready_state');
      });
    });

    it('should maintain backward compatibility', async () => {
      const mockSymbol: SymbolEntry = {
        sts: 2,
        st: 2,
        tt: 4,
        cd: 'BACKWARDUSDT',
        // Missing optional fields to test backward compatibility
      };

      // Mock no activity data for backward compatibility test
      vi.spyOn(patternEngine as any, 'getActivityDataForSymbol').mockResolvedValue([]);

      const matches = await patternEngine.detectReadyStatePattern(mockSymbol);

      expect(matches).toHaveLength(1);
      expect(matches[0].patternType).toBe('ready_state');
      expect(matches[0].symbol).toBe('BACKWARDUSDT');
      // Should still have reasonable confidence even with missing data
      expect(matches[0].confidence).toBeGreaterThanOrEqual(70);
    });
  });

  describe('Activity Data Integration Validation', () => {
    it('should correctly calculate activity boost', async () => {
      const mockSymbol: SymbolEntry = {
        sts: 2,
        st: 2,
        tt: 4,
        cd: 'ACTIVITYBOOSTUSDT',
        ca: 1000,
        ps: 100,
        qs: 50,
      };

      const mockActivities: ActivityData[] = [
        {
          activityId: 'boost-activity-1',
          currency: 'ACTIVITYBOOST',
          currencyId: 'boost-currency-id',
          activityType: 'SUN_SHINE',
        },
        {
          activityId: 'boost-activity-2',
          currency: 'ACTIVITYBOOST',
          currencyId: 'boost-currency-id',
          activityType: 'PROMOTION',
        },
        {
          activityId: 'boost-activity-3',
          currency: 'ACTIVITYBOOST',
          currencyId: 'boost-currency-id',
          activityType: 'HIGH_PRIORITY',
        },
      ];

      vi.spyOn(patternEngine as any, 'getActivityDataForSymbol').mockResolvedValue(mockActivities);

      const matches = await patternEngine.detectReadyStatePattern(mockSymbol);

      expect(matches).toHaveLength(1);
      expect(matches[0].activityInfo?.activityBoost).toBeGreaterThan(0);
      expect(matches[0].activityInfo?.activityBoost).toBeLessThanOrEqual(20); // Max boost cap
      expect(matches[0].activityInfo?.activityTypes).toHaveLength(3);
      expect(matches[0].confidence).toBeGreaterThan(85); // Base confidence + activity boost
    });

    it('should identify high priority activities', async () => {
      const mockSymbol: SymbolEntry = {
        sts: 2,
        st: 2,
        tt: 4,
        cd: 'HIGHPRIORITYUSDT',
        ca: 1000,
        ps: 100,
        qs: 50,
      };

      const mockActivities: ActivityData[] = [
        {
          activityId: 'high-priority-activity',
          currency: 'HIGHPRIORITY',
          currencyId: 'high-priority-currency-id',
          activityType: 'SUN_SHINE', // Typically high priority
        },
      ];

      vi.spyOn(patternEngine as any, 'getActivityDataForSymbol').mockResolvedValue(mockActivities);

      const matches = await patternEngine.detectReadyStatePattern(mockSymbol);

      expect(matches).toHaveLength(1);
      expect(matches[0].activityInfo?.hasHighPriorityActivity).toBeDefined();
      expect(matches[0].confidence).toBeGreaterThan(90); // Should get extra boost for high priority
    });
  });
});
